/**
 * Proactive Workflow Cron Jobs
 * Daily/Weekly jobs to run predictions and auto-create workflows
 * Jobs: churn-prediction-daily, upsell-opportunity-daily, winback-prediction-weekly, workflow-trigger, nba-update
 */

import { prisma } from '@/lib/prisma';
import { ChurnPredictor } from '@/lib/ai/churn-predictor';
import { UpsellPredictor } from '@/lib/ai/upsell-predictor';
import { WinBackPredictor } from '@/lib/ai/winback-predictor';
import { ProactiveWorkflowEngine } from '@/lib/services/proactive-workflow-engine';
import { NextBestActionEngine } from '@/lib/services/next-best-action';
import { DeliveryOptimizer } from '@/lib/services/delivery-optimizer';

/**
 * Daily churn prediction job
 * Runs at 2 AM daily
 */
export async function runChurnPredictionDaily(): Promise<void> {
  const predictor = new ChurnPredictor();

  // Get all organizations
  const organizations = await prisma.organization.findMany({
    where: { status: 'ACTIVE' }
  });

  for (const org of organizations) {
    try {
      // Run churn predictions
      const predictions = await predictor.predictChurnBatch(org.id, 500);

      // Store predictions for dashboard
      for (const prediction of predictions) {
        await prisma.churnPrediction.upsert({
          where: { contactId_organizationId: { contactId: prediction.contactId, organizationId: org.id } },
          create: {
            contactId: prediction.contactId,
            organizationId: org.id,
            churnProbability: prediction.churnProbability,
            confidence: prediction.confidence,
            riskLevel: prediction.riskLevel,
            signals: prediction.signals as any,
            reasonsForChurn: prediction.reasonsForChurn,
            estimatedChurnDate: prediction.estimatedChurnDate
          },
          update: {
            churnProbability: prediction.churnProbability,
            confidence: prediction.confidence,
            riskLevel: prediction.riskLevel,
            signals: prediction.signals as any,
            reasonsForChurn: prediction.reasonsForChurn,
            estimatedChurnDate: prediction.estimatedChurnDate,
            updatedAt: new Date()
          }
        });
      }

      console.log(`[CHURN] Organization ${org.id}: Processed ${predictions.length} predictions`);

      // Log execution
      await prisma.executionLog.create({
        data: {
          organizationId: org.id,
          sourceType: 'CRON',
          sourceId: 'churn-prediction-daily',
          sourceName: 'Churn Prediction Daily',
          contactId: 'system',
          channel: 'INTERNAL',
          status: 'SENT',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
          lensMetadata: { predictionsCount: predictions.length, highRiskCount: predictions.filter(p => p.riskLevel === 'CRITICAL' || p.riskLevel === 'HIGH').length }
        }
      });
    } catch (error) {
      console.error(`[CHURN] Error for organization ${org.id}:`, error);
      await prisma.executionLog.create({
        data: {
          organizationId: org.id,
          sourceType: 'CRON',
          sourceId: 'churn-prediction-daily',
          sourceName: 'Churn Prediction Daily',
          contactId: 'system',
          channel: 'INTERNAL',
          status: 'FAILED',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
          lensMetadata: { error: String(error) }
        }
      });
    }
  }
}

/**
 * Daily upsell opportunity job
 * Runs at 3 AM daily
 */
export async function runUpsellOpportunityDaily(): Promise<void> {
  const predictor = new UpsellPredictor();

  const organizations = await prisma.organization.findMany({
    where: { status: 'ACTIVE' }
  });

  for (const org of organizations) {
    try {
      const opportunities = await predictor.predictUpsellBatch(org.id, 500);

      // Store top opportunities
      for (const opp of opportunities.slice(0, 100)) {
        await prisma.upsellOpportunity.upsert({
          where: { contactId_organizationId: { contactId: opp.contactId, organizationId: org.id } },
          create: {
            contactId: opp.contactId,
            organizationId: org.id,
            opportunityScore: opp.opportunityScore,
            readinessLevel: opp.readinessLevel,
            signals: opp.signals as any,
            recommendedProduct: opp.recommendedProduct as any,
            expectedConversionProbability: opp.expectedConversionProbability,
            suggestedOfferType: opp.suggestedOfferType,
            urgency: opp.urgency
          },
          update: {
            opportunityScore: opp.opportunityScore,
            readinessLevel: opp.readinessLevel,
            signals: opp.signals as any,
            recommendedProduct: opp.recommendedProduct as any,
            expectedConversionProbability: opp.expectedConversionProbability,
            suggestedOfferType: opp.suggestedOfferType,
            urgency: opp.urgency,
            updatedAt: new Date()
          }
        });
      }

      console.log(`[UPSELL] Organization ${org.id}: Processed ${opportunities.length} opportunities`);

      await prisma.executionLog.create({
        data: {
          organizationId: org.id,
          sourceType: 'CRON',
          sourceId: 'upsell-opportunity-daily',
          sourceName: 'Upsell Opportunity Daily',
          contactId: 'system',
          channel: 'INTERNAL',
          status: 'SENT',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
          lensMetadata: { opportunitiesCount: opportunities.length, highReadyCount: opportunities.filter(o => o.readinessLevel === 'HIGHLY_READY').length }
        }
      });
    } catch (error) {
      console.error(`[UPSELL] Error for organization ${org.id}:`, error);
      await prisma.executionLog.create({
        data: {
          organizationId: org.id,
          sourceType: 'CRON',
          sourceId: 'upsell-opportunity-daily',
          sourceName: 'Upsell Opportunity Daily',
          contactId: 'system',
          channel: 'INTERNAL',
          status: 'FAILED',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
          lensMetadata: { error: String(error) }
        }
      });
    }
  }
}

/**
 * Weekly win-back prediction job
 * Runs on Mondays at 4 AM
 */
export async function runWinBackPredictionWeekly(): Promise<void> {
  const predictor = new WinBackPredictor();

  const organizations = await prisma.organization.findMany({
    where: { status: 'ACTIVE' }
  });

  for (const org of organizations) {
    try {
      const opportunities = await predictor.predictWinBackBatch(org.id, 500);

      // Store top opportunities
      for (const opp of opportunities.slice(0, 100)) {
        await prisma.winBackOpportunity.upsert({
          where: { contactId_organizationId: { contactId: opp.contactId, organizationId: org.id } },
          create: {
            contactId: opp.contactId,
            organizationId: org.id,
            reactivationProbability: opp.reactivationProbability,
            reactivationUrgency: opp.reactivationUrgency,
            signals: opp.signals as any,
            winBackReason: opp.winBackReason,
            bestOffer: opp.bestOffer as any,
            expectedReactivationValue: opp.expectedReactivationValue,
            expectedFirstPurchaseValue: opp.expectedFirstPurchaseValue,
            optimalContactTime: opp.optimalContactTime,
            contentTheme: opp.contentTheme
          },
          update: {
            reactivationProbability: opp.reactivationProbability,
            reactivationUrgency: opp.reactivationUrgency,
            signals: opp.signals as any,
            winBackReason: opp.winBackReason,
            bestOffer: opp.bestOffer as any,
            expectedReactivationValue: opp.expectedReactivationValue,
            expectedFirstPurchaseValue: opp.expectedFirstPurchaseValue,
            optimalContactTime: opp.optimalContactTime,
            contentTheme: opp.contentTheme,
            updatedAt: new Date()
          }
        });
      }

      console.log(`[WINBACK] Organization ${org.id}: Processed ${opportunities.length} opportunities`);

      await prisma.executionLog.create({
        data: {
          organizationId: org.id,
          sourceType: 'CRON',
          sourceId: 'winback-prediction-weekly',
          sourceName: 'Win Back Prediction Weekly',
          contactId: 'system',
          channel: 'INTERNAL',
          status: 'SENT',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
          lensMetadata: { opportunitiesCount: opportunities.length, highPriorityCount: opportunities.filter(o => o.reactivationProbability > 60).length }
        }
      });
    } catch (error) {
      console.error(`[WINBACK] Error for organization ${org.id}:`, error);
      await prisma.executionLog.create({
        data: {
          organizationId: org.id,
          sourceType: 'CRON',
          sourceId: 'winback-prediction-weekly',
          sourceName: 'Win Back Prediction Weekly',
          contactId: 'system',
          channel: 'INTERNAL',
          status: 'FAILED',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
          lensMetadata: { error: String(error) }
        }
      });
    }
  }
}

/**
 * Auto-trigger workflows from predictions
 * Runs at 5 AM daily
 */
export async function runProactiveWorkflowTrigger(): Promise<void> {
  const engine = new ProactiveWorkflowEngine();
  const optimizer = new DeliveryOptimizer();

  const organizations = await prisma.organization.findMany({
    where: { status: 'ACTIVE' }
  });

  for (const org of organizations) {
    try {
      // Get high-risk churn predictions
      const churnPredictions = await prisma.churnPrediction.findMany({
        where: {
          organizationId: org.id,
          riskLevel: { in: ['CRITICAL', 'HIGH'] },
          workflowTriggeredAt: null // Not yet triggered
        },
        take: 50
      });

      let workflowsCreated = 0;

      for (const prediction of churnPredictions) {
        try {
          // Check delivery constraints
          const analysis = await optimizer.analyzeDeliveryWindow(prediction.contactId, 'SMS');
          if (!analysis.canSendNow) {
            console.log(`[WORKFLOW] Skipping ${prediction.contactId} - delivery window not ready`);
            continue;
          }

          // Create workflow
          await engine.createWorkflowFromPrediction({
            type: 'VIP_SAVE',
            contactId: prediction.contactId,
            organizationId: org.id,
            maxMessages: 3, // VIP Save: Day 0 + Day 1 + Day 2
            triggerData: {
              contactId: prediction.contactId,
              churnProbability: prediction.churnProbability,
              confidence: prediction.confidence,
              riskLevel: prediction.riskLevel,
              signals: prediction.signals,
              reasonsForChurn: prediction.reasonsForChurn,
              recommendedAction: prediction.churnProbability > 80 ? 'IMMEDIATE_CALL' : 'SPECIAL_OFFER',
              estimatedChurnDate: prediction.estimatedChurnDate
            } as any
          });

          // Mark as triggered
          await prisma.churnPrediction.update({
            where: { id: prediction.id },
            data: { workflowTriggeredAt: new Date() }
          });

          workflowsCreated++;
        } catch (error) {
          console.error(`[WORKFLOW] Error creating workflow for ${prediction.contactId}:`, error);
        }
      }

      console.log(`[WORKFLOW] Organization ${org.id}: Created ${workflowsCreated} VIP Save workflows`);

      await prisma.executionLog.create({
        data: {
          organizationId: org.id,
          sourceType: 'CRON',
          sourceId: 'workflow-trigger',
          sourceName: 'Proactive Workflow Trigger',
          contactId: 'system',
          channel: 'INTERNAL',
          status: 'SENT',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
          lensMetadata: { workflowsCreated, churnPredictionsProcessed: churnPredictions.length }
        }
      });
    } catch (error) {
      console.error(`[WORKFLOW] Error for organization ${org.id}:`, error);
      await prisma.executionLog.create({
        data: {
          organizationId: org.id,
          sourceType: 'CRON',
          sourceId: 'workflow-trigger',
          sourceName: 'Proactive Workflow Trigger',
          contactId: 'system',
          channel: 'INTERNAL',
          status: 'FAILED',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
          lensMetadata: { error: String(error) }
        }
      });
    }
  }
}

/**
 * Update Next-Best-Action queue
 * Runs every 6 hours
 */
export async function runNextBestActionUpdate(): Promise<void> {
  const nbaEngine = new NextBestActionEngine();

  const organizations = await prisma.organization.findMany({
    where: { status: 'ACTIVE' }
  });

  for (const org of organizations) {
    try {
      // Get action queue
      const actions = await nbaEngine.getActionQueue(org.id, 100);

      // Store in NextBestAction table
      for (const action of actions) {
        await prisma.nextBestAction.upsert({
          where: { contactId_organizationId: { contactId: action.contactId, organizationId: org.id } },
          create: {
            contactId: action.contactId,
            organizationId: org.id,
            recommendedAction: action.recommendedAction,
            actionType: action.actionType,
            priority: action.priority,
            expectedRevenue: action.expectedRevenue,
            expectedConversionProbability: action.expectedConversionProbability,
            message: action.message as any,
            reasoning: action.reasoning,
            abTestVariant: action.abTestVariant || 'A',
            status: 'PENDING'
          },
          update: {
            recommendedAction: action.recommendedAction,
            actionType: action.actionType,
            priority: action.priority,
            expectedRevenue: action.expectedRevenue,
            expectedConversionProbability: action.expectedConversionProbability,
            message: action.message as any,
            reasoning: action.reasoning,
            abTestVariant: action.abTestVariant || 'A',
            status: 'PENDING',
            updatedAt: new Date()
          }
        });
      }

      console.log(`[NBA] Organization ${org.id}: Updated ${actions.length} next best actions`);

      await prisma.executionLog.create({
        data: {
          organizationId: org.id,
          sourceType: 'CRON',
          sourceId: 'nba-update',
          sourceName: 'Next Best Action Update',
          contactId: 'system',
          channel: 'INTERNAL',
          status: 'SENT',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
          lensMetadata: { actionsUpdated: actions.length }
        }
      });
    } catch (error) {
      console.error(`[NBA] Error for organization ${org.id}:`, error);
      await prisma.executionLog.create({
        data: {
          organizationId: org.id,
          sourceType: 'CRON',
          sourceId: 'nba-update',
          sourceName: 'Next Best Action Update',
          contactId: 'system',
          channel: 'INTERNAL',
          status: 'FAILED',
          executeMonth: new Date().toISOString().slice(0, 7),
          scheduledAt: new Date(),
          lensMetadata: { error: String(error) }
        }
      });
    }
  }
}
