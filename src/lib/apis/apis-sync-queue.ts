/**
 * APIS Google Sheets 동기화 큐
 * GmApisSyncQueue 테이블을 사용하여 APIS 데이터를 비동기 처리합니다.
 *
 * targetType 별 처리:
 *   MASTER_SHEET  → syncToMasterApisSheet(targetId=userId)
 *   TRIP_SHEET    → syncApisSpreadsheet(targetId=tripId)
 *   PNR           → sendPnrSmsForReservation(targetId=reservationId)
 *
 * batchId 에코: 배치 내 모든 태스크 완료 시 passport-sent | pnr-sent 호출
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendPnrSmsForReservation } from '@/lib/pnr-sms-send';
import {
  notifyCruisedotPassportSent,
  notifyCruisedotPnrSent,
} from '@/lib/notify-cruisedot-ops';

export type ApisSyncTargetType = 'MASTER_SHEET' | 'TRIP_SHEET' | 'PNR';

/**
 * Enqueue a sync task for APIS data.
 * @param targetType 'MASTER_SHEET' | 'TRIP_SHEET' | 'PNR'
 * @param targetId userId(MASTER), tripId(TRIP), reservationId(PNR)
 * @param delayMinutes Number of minutes to delay execution (default: 10)
 */
export async function enqueueApisSync(
  targetType: ApisSyncTargetType,
  targetId: number,
  delayMinutes: number = 10
) {
  try {
    const existing = await prisma.gmApisSyncQueue.findFirst({
      where: {
        targetType,
        targetId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    if (existing) {
      logger.log(`[ApisSyncQueue] Task already pending for ${targetType}:${targetId}`);
      return;
    }

    const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    await prisma.gmApisSyncQueue.create({
      data: {
        targetType,
        targetId,
        status: 'PENDING',
        scheduledAt,
      },
    });

    logger.log(`[ApisSyncQueue] Enqueued task for ${targetType}:${targetId} (Scheduled at: ${scheduledAt.toISOString()})`);
  } catch (error) {
    logger.error('[ApisSyncQueue] Failed to enqueue task:', error instanceof Error ? { message: error.message } : undefined);
  }
}

/**
 * Google Sheets 동기화 함수를 동적으로 로드
 */
async function loadSyncFunctions(): Promise<{
  syncApisSpreadsheet: (tripId: number) => Promise<{ ok: boolean; error?: string }>;
  syncToMasterApisSheet: (userId: number) => Promise<{ ok: boolean; error?: string }>;
} | null> {
  try {
    const mod = await (Function('return import("@/lib/google-sheets")')() as Promise<{
      syncApisSpreadsheet: (tripId: number) => Promise<{ ok: boolean; error?: string }>;
      syncToMasterApisSheet: (userId: number) => Promise<{ ok: boolean; error?: string }>;
    }>);
    return {
      syncApisSpreadsheet: mod.syncApisSpreadsheet,
      syncToMasterApisSheet: mod.syncToMasterApisSheet,
    };
  } catch {
    logger.warn('[ApisSyncQueue] google-sheets module not available');
    return null;
  }
}

/**
 * 배치 완료 여부 확인 후 cruisedot 에코 알림
 * - 배치의 모든 태스크가 COMPLETED/FAILED이면 notify
 * - PNR 태스크가 포함된 배치 → pnr-sent, 그 외 → passport-sent
 */
async function checkAndNotifyBatch(batchId: string): Promise<void> {
  const tasks = await prisma.gmApisSyncQueue.findMany({
    where: { batchId },
    select: { status: true, targetType: true },
  });

  if (tasks.length === 0) return;

  const allDone = tasks.every((t) => t.status === 'COMPLETED' || t.status === 'FAILED');
  if (!allDone) return;

  const sentCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const failureCount = tasks.filter((t) => t.status === 'FAILED').length;

  const isPnrBatch = tasks.some((t) => t.targetType === 'PNR');

  logger.log('[ApisSyncQueue] 배치 완료 — 에코 알림', { batchId, sentCount, failureCount, isPnrBatch });

  if (isPnrBatch) {
    await notifyCruisedotPnrSent(batchId, sentCount, failureCount > 0 ? failureCount : undefined);
  } else {
    await notifyCruisedotPassportSent(batchId, sentCount, failureCount > 0 ? failureCount : undefined);
  }
}

/**
 * Process pending tasks in the APIS sync queue.
 * Cron job: GET /api/cron/apis-sync
 */
export async function processApisSyncQueue(batchSize = 10) {
  logger.log('[ApisSyncQueue] Starting queue processing...');

  const tasks = await prisma.gmApisSyncQueue.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    take: batchSize,
  });

  if (tasks.length === 0) {
    logger.log('[ApisSyncQueue] No pending tasks.');
    return;
  }

  logger.log(`[ApisSyncQueue] Found ${tasks.length} tasks to process.`);

  const syncFns = await loadSyncFunctions();
  const batchIdsToCheck = new Set<string>();

  for (const task of tasks) {
    try {
      await prisma.gmApisSyncQueue.update({
        where: { id: task.id },
        data: { status: 'PROCESSING', attempts: { increment: 1 } },
      });

      let result: { ok: boolean; error?: string } | undefined;

      if (task.targetType === 'MASTER_SHEET' || task.targetType === 'TRIP_SHEET') {
        if (!syncFns) {
          throw new Error('google-sheets module unavailable');
        }
        if (task.targetType === 'MASTER_SHEET') {
          result = await syncFns.syncToMasterApisSheet(task.targetId);
        } else {
          result = await syncFns.syncApisSpreadsheet(task.targetId);
        }
      } else if (task.targetType === 'PNR') {
        const pnrResult = await sendPnrSmsForReservation(task.targetId);
        result = { ok: pnrResult.success, error: pnrResult.error };
      } else {
        throw new Error(`Unknown targetType: ${task.targetType}`);
      }

      if (result && result.ok) {
        await prisma.gmApisSyncQueue.update({
          where: { id: task.id },
          data: { status: 'COMPLETED', processedAt: new Date() },
        });
        logger.log(`[ApisSyncQueue] Task ${task.id} (${task.targetType}:${task.targetId}) completed.`);
      } else {
        throw new Error(result?.error ?? 'Unknown error during sync');
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[ApisSyncQueue] Task ${task.id} failed:`, { message: errMsg });

      if (task.attempts >= 2) {
        await prisma.gmApisSyncQueue.update({
          where: { id: task.id },
          data: { status: 'FAILED', lastError: errMsg, processedAt: new Date() },
        });
      } else {
        await prisma.gmApisSyncQueue.update({
          where: { id: task.id },
          data: { status: 'PENDING', lastError: errMsg },
        });
      }
    }

    // batchId가 있으면 완료 체크 목록에 추가
    if (task.batchId) {
      batchIdsToCheck.add(task.batchId);
    }
  }

  // 이 cron 실행에서 처리된 배치들 완료 여부 확인
  for (const batchId of batchIdsToCheck) {
    await checkAndNotifyBatch(batchId).catch((err) => {
      logger.warn('[ApisSyncQueue] batchId 알림 실패 — 무시됨', {
        batchId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  logger.log('[ApisSyncQueue] Queue processing finished.');
}
