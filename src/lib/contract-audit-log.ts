import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface CreateAuditLogInput {
  contractId: string;
  organizationId: string;
  action:
    | 'signed'
    | 'viewed'
    | 'downloaded'
    | 'emailed'
    | 'resent'
    | 'modification_requested'
    | 'modification_approved'
    | 'modification_rejected'
    | 'modification_alternative_proposed'
    | 're_signing_invited'
    | 're_signed'
    | 're_sign_completed';
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
}

/**
 * 계약서 감사 로그 기록
 * 로깅 실패 시에도 메인 프로세스는 계속 진행됨 (non-blocking)
 */
export async function logContractAction(input: CreateAuditLogInput): Promise<void> {
  try {
    await prisma.contractAuditLog.create({
      data: {
        contractId: input.contractId,
        organizationId: input.organizationId,
        action: input.action,
        userId: input.userId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        details: input.details,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    // 로깅 실패해도 계약서 프로세스는 중단 안 함
    logger.log('[ContractAuditLog] 감사 로그 저장 실패', {
      contractId: input.contractId,
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 계약서 감사 로그 조회 (시간순 역정렬)
 */
export async function getContractAuditLog(contractId: string) {
  try {
    const logs = await prisma.contractAuditLog.findMany({
      where: { contractId },
      orderBy: { timestamp: 'desc' },
    });
    return logs;
  } catch (error) {
    logger.log('[ContractAuditLog] 감사 로그 조회 실패', {
      contractId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 계약서 감사 로그 요약 (최근 N개)
 */
export async function getContractAuditLogSummary(contractId: string, limit: number = 10) {
  try {
    const logs = await prisma.contractAuditLog.findMany({
      where: { contractId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return logs;
  } catch (error) {
    logger.log('[ContractAuditLog] 감사 로그 요약 조회 실패', {
      contractId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 계약서별 감사 로그 통계
 */
export async function getContractAuditLogStats(contractId: string) {
  try {
    const logs = await prisma.contractAuditLog.findMany({
      where: { contractId },
    });

    const stats = {
      totalEvents: logs.length,
      actionCounts: {
        signed: logs.filter((l) => l.action === 'signed').length,
        viewed: logs.filter((l) => l.action === 'viewed').length,
        downloaded: logs.filter((l) => l.action === 'downloaded').length,
        emailed: logs.filter((l) => l.action === 'emailed').length,
        resent: logs.filter((l) => l.action === 'resent').length,
        modification_requested: logs.filter((l) => l.action === 'modification_requested').length,
        modification_approved: logs.filter((l) => l.action === 'modification_approved').length,
        modification_rejected: logs.filter((l) => l.action === 'modification_rejected').length,
        modification_alternative_proposed: logs.filter((l) => l.action === 'modification_alternative_proposed').length,
        re_signing_invited: logs.filter((l) => l.action === 're_signing_invited').length,
        re_signed: logs.filter((l) => l.action === 're_signed').length,
        re_sign_completed: logs.filter((l) => l.action === 're_sign_completed').length,
      },
      firstEventAt: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
      lastEventAt: logs.length > 0 ? logs[0].timestamp : null,
    };

    return stats;
  } catch (error) {
    logger.log('[ContractAuditLog] 감사 로그 통계 조회 실패', {
      contractId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
