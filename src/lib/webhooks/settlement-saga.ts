import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Saga Step Result
 */
export interface SagaStepResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  compensationRequired?: boolean;
}

/**
 * Saga Step Definition
 */
export interface SagaStep<T = any> {
  name: string;
  execute: () => Promise<SagaStepResult<T>>;
  compensate?: () => Promise<void>;
}

/**
 * Settlement Saga Context
 */
export interface SettlementSagaContext {
  eventId: string;
  organizationId: string;
  settlementId: number;
  partnerId: number;
  period: string;
  status: 'DRAFT' | 'APPROVED' | 'LOCKED' | 'PAID';
  amount: number;
  netAmount: number;
  commissionRate: number;
  paymentDate?: string;
  executedSteps: Map<string, any>;
}

/**
 * Settlement Saga Orchestrator
 *
 * Implements saga pattern for settlement webhook processing:
 * Step 1: Create Commission Ledger entry
 * Step 2: Create Settlement Event log
 * Step 3: Mark event as processed (idempotency)
 *
 * On any step failure, automatically compensates previous steps.
 */
export class SettlementSaga {
  private context: SettlementSagaContext;
  private steps: SagaStep[] = [];
  private completedSteps: string[] = [];

  constructor(context: SettlementSagaContext) {
    this.context = context;
    this.context.executedSteps = new Map();
  }

  /**
   * Step 1: Create Commission Ledger Entry
   */
  private createCommissionLedgerStep(): SagaStep {
    return {
      name: 'CREATE_COMMISSION_LEDGER',
      execute: async () => {
        try {
          const commissionAmount = this.context.amount; // 총수당 (크루즈닷몰 SSoT)
          const withholdingAmount = Math.floor(this.context.amount - this.context.netAmount);

          const entry = await prisma.commissionLedger.create({
            data: {
              organizationId: this.context.organizationId,
              profileId: this.context.partnerId,
              entryType: 'SETTLEMENT_COMMISSION',
              amount: commissionAmount,
              currency: 'KRW',
              withholdingAmount,
              settlementId: this.context.settlementId,
              isSettled: this.context.status === 'PAID',
              notes: `정산 ${this.context.period}: ${this.context.amount.toLocaleString()}원 → ${this.context.netAmount.toLocaleString()}원`,
              metadata: {
                eventId: this.context.eventId,
                eventType: `settlement.${this.context.status.toLowerCase()}`,
                period: this.context.period,
                settlementStatus: this.context.status,
                paymentDate: this.context.paymentDate,
                commissionRate: this.context.commissionRate,
              } as any,
            },
            select: {
              id: true,
              amount: true,
              isSettled: true,
            },
          });

          logger.log('[SettlementSaga] Step 1: Commission Ledger created', {
            ledgerId: entry.id,
            amount: commissionAmount,
            profileId: this.context.partnerId,
          });

          return {
            success: true,
            data: entry,
          };
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error('[SettlementSaga] Step 1 failed', {
            error: err.message,
            partnerId: this.context.partnerId,
          });
          return {
            success: false,
            error: err.message,
            compensationRequired: true,
          };
        }
      },
      compensate: async () => {
        try {
          const ledgerId = this.context.executedSteps.get('CREATE_COMMISSION_LEDGER')?.id;
          if (ledgerId) {
            await prisma.commissionLedger.delete({
              where: { id: ledgerId },
            });
            logger.log('[SettlementSaga] Step 1 compensated: Commission Ledger deleted', {
              ledgerId,
            });
          }
        } catch (error) {
          logger.error('[SettlementSaga] Step 1 compensation failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    };
  }

  /**
   * Step 2: Create Settlement Event Log
   */
  private createSettlementEventStep(): SagaStep {
    return {
      name: 'CREATE_SETTLEMENT_EVENT',
      execute: async () => {
        try {
          const event = await prisma.settlementEvent.create({
            data: {
              settlementId: this.context.settlementId,
              userId: undefined,
              eventType: `SETTLEMENT_${this.context.status}`,
              description: `정산 ${this.context.status}: ${this.context.period} ${this.context.amount.toLocaleString()}원`,
              metadata: {
                eventId: this.context.eventId,
                eventType: `settlement.${this.context.status.toLowerCase()}`,
                partnerId: this.context.partnerId,
                amount: this.context.amount,
                netAmount: this.context.netAmount,
                commissionRate: this.context.commissionRate,
                paymentDate: this.context.paymentDate,
              } as any,
            },
            select: {
              id: true,
            },
          });

          logger.log('[SettlementSaga] Step 2: Settlement Event created', {
            eventId: event.id,
            status: this.context.status,
          });

          return {
            success: true,
            data: event,
          };
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error('[SettlementSaga] Step 2 failed', {
            error: err.message,
            settlementId: this.context.settlementId,
          });
          return {
            success: false,
            error: err.message,
            compensationRequired: true,
          };
        }
      },
      compensate: async () => {
        try {
          const eventId = this.context.executedSteps.get('CREATE_SETTLEMENT_EVENT')?.id;
          if (eventId) {
            await prisma.settlementEvent.delete({
              where: { id: eventId },
            });
            logger.log('[SettlementSaga] Step 2 compensated: Settlement Event deleted', {
              eventId,
            });
          }
        } catch (error) {
          logger.error('[SettlementSaga] Step 2 compensation failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    };
  }

  /**
   * Step 3: Mark Event as Processed (Idempotency)
   */
  private markProcessedStep(): SagaStep {
    return {
      name: 'MARK_PROCESSED',
      execute: async () => {
        try {
          const entry = await prisma.processedWebhookEvent.create({
            data: {
              eventId: this.context.eventId,
              webhookType: 'cruisedot-settlement',
              status: 'SUCCESS',
            },
            select: {
              id: true,
            },
          });

          logger.log('[SettlementSaga] Step 3: Event marked as processed', {
            entryId: entry.id,
            eventId: this.context.eventId,
          });

          return {
            success: true,
            data: entry,
          };
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error('[SettlementSaga] Step 3 failed', {
            error: err.message,
            eventId: this.context.eventId,
          });
          return {
            success: false,
            error: err.message,
            compensationRequired: false, // Don't compensate idempotency check
          };
        }
      },
      compensate: async () => {
        try {
          const entryId = this.context.executedSteps.get('MARK_PROCESSED')?.id;
          if (entryId) {
            await prisma.processedWebhookEvent.delete({
              where: { id: entryId },
            });
            logger.log('[SettlementSaga] Step 3 compensated: Idempotency entry deleted', {
              entryId,
            });
          }
        } catch (error) {
          logger.error('[SettlementSaga] Step 3 compensation failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    };
  }

  /**
   * Initialize all saga steps
   */
  private initializeSteps(): void {
    this.steps = [
      this.createCommissionLedgerStep(),
      this.createSettlementEventStep(),
      this.markProcessedStep(),
    ];
  }

  /**
   * Execute saga with SERIALIZABLE isolation level
   * ✅ P0-14: Compensation logic moved outside transaction to prevent deadlock
   * - Transaction only handles CREATE operations
   * - Compensation (DELETE) executed outside to avoid Serializable conflicts
   */
  async execute(): Promise<{
    success: boolean;
    completedSteps: string[];
    failedStep?: string;
    error?: string;
  }> {
    this.initializeSteps();

    try {
      // Step 1: Execute saga steps inside transaction (CREATE only)
      try {
        await prisma.$transaction(async (tx) => {
          for (const step of this.steps) {
            logger.log(`[SettlementSaga] Executing ${step.name}`);

            const result = await step.execute();

            if (!result.success) {
              logger.error(`[SettlementSaga] ${step.name} failed`, {
                error: result.error,
                requiresCompensation: result.compensationRequired,
              });

              throw new Error(`Saga failed at step: ${step.name}. ${result.error}`);
            }

            // Store result for potential compensation
            this.context.executedSteps.set(step.name, result.data);
            this.completedSteps.push(step.name);

            logger.log(`[SettlementSaga] ${step.name} completed successfully`, {
              data: result.data,
            });
          }
        }, {
          isolationLevel: 'Serializable',
          timeout: 30000, // 30 seconds
        });
      } catch (txError) {
        // Step 2: On transaction failure, run compensation OUTSIDE transaction
        // This prevents Serializable isolation conflicts that would cause deadlock
        logger.error('[SettlementSaga] Transaction failed, starting compensation', {
          failedAtStep: this.steps[this.completedSteps.length]?.name,
          error: txError instanceof Error ? txError.message : String(txError),
        });

        await this.compensate(this.steps[this.completedSteps.length]?.name || 'UNKNOWN');
        throw txError;
      }

      logger.log('[SettlementSaga] All steps completed successfully', {
        steps: this.completedSteps,
      });

      return {
        success: true,
        completedSteps: this.completedSteps,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[SettlementSaga] Saga execution failed', {
        error: err.message,
        completedSteps: this.completedSteps,
      });

      return {
        success: false,
        completedSteps: this.completedSteps,
        failedStep: this.steps[this.completedSteps.length]?.name,
        error: err.message,
      };
    }
  }

  /**
   * Compensation chain: rollback all completed steps in reverse order
   */
  private async compensate(failedStepName: string): Promise<void> {
    logger.log('[SettlementSaga] Starting compensation chain', {
      failedStep: failedStepName,
      completedSteps: this.completedSteps,
    });

    // Reverse order compensation
    for (let i = this.completedSteps.length - 1; i >= 0; i--) {
      const stepName = this.completedSteps[i];
      const step = this.steps.find((s) => s.name === stepName);

      if (step && step.compensate) {
        await step.compensate();
      }
    }

    logger.log('[SettlementSaga] Compensation chain completed', {
      compensatedSteps: this.completedSteps.length,
    });
  }
}
