/**
 * APIS Google Sheets 동기화 큐
 * 크루즈닷몰 GmApisSyncQueue 테이블을 사용하여
 * APIS 데이터를 Google Sheets에 비동기 동기화합니다.
 *
 * NOTE: syncApisSpreadsheet / syncToMasterApisSheet 함수는
 * 크루즈닷몰의 google-sheets 모듈에서 제공됩니다.
 * CRM에서는 동적 import로 안전하게 호출합니다.
 */

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type ApisSyncTargetType = 'MASTER_SHEET' | 'TRIP_SHEET';

/**
 * Enqueue a sync task for APIS data.
 * @param targetType 'MASTER_SHEET' or 'TRIP_SHEET'
 * @param targetId userId for MASTER_SHEET, tripId for TRIP_SHEET
 * @param delayMinutes Number of minutes to delay execution (default: 10)
 */
export async function enqueueApisSync(
  targetType: ApisSyncTargetType,
  targetId: number,
  delayMinutes: number = 10
) {
  try {
    // Check if a pending task already exists to avoid duplicates
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
 * CRM에 google-sheets 모듈이 없을 수 있으므로 안전하게 처리
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
 * Process pending tasks in the APIS sync queue.
 * Should be called by Cron job.
 */
import { notifyCruisedotPassportSent } from '@/lib/notify-cruisedot-ops';

export async function processApisSyncQueue(batchSize = 10) {
  logger.log('[ApisSyncQueue] Starting queue processing...');

  // Fetch pending tasks that are scheduled for now or in the past
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
  if (!syncFns) {
    logger.error('[ApisSyncQueue] Cannot process: google-sheets module unavailable');
    return;
  }

  for (const task of tasks) {
    try {
      // Update status to PROCESSING
      await prisma.gmApisSyncQueue.update({
        where: { id: task.id },
        data: { status: 'PROCESSING', attempts: { increment: 1 } },
      });

      let result: { ok: boolean; error?: string } | undefined;
      if (task.targetType === 'MASTER_SHEET') {
        result = await syncFns.syncToMasterApisSheet(task.targetId);
      } else if (task.targetType === 'TRIP_SHEET') {
        result = await syncFns.syncApisSpreadsheet(task.targetId);
      }

      if (result && result.ok) {
        await prisma.gmApisSyncQueue.update({
          where: { id: task.id },
          data: { status: 'COMPLETED', processedAt: new Date() },
        });
        logger.log(`[ApisSyncQueue] Task ${task.id} (${task.targetType}:${task.targetId}) completed.`);
        if (task.targetType === 'TRIP_SHEET') {
          void notifyCruisedotPassportSent(task.targetId);
        }
      } else {
        throw new Error(result?.error || 'Unknown error during sync');
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[ApisSyncQueue] Task ${task.id} failed:`, { message: errMsg });

      // If max attempts reached (e.g., 3), mark as FAILED
      if (task.attempts >= 2) {
        await prisma.gmApisSyncQueue.update({
          where: { id: task.id },
          data: {
            status: 'FAILED',
            lastError: errMsg,
            processedAt: new Date(),
          },
        });
      } else {
        // Reset to PENDING for retry
        await prisma.gmApisSyncQueue.update({
          where: { id: task.id },
          data: {
            status: 'PENDING',
            lastError: errMsg,
          },
        });
      }
    }
  }

  logger.log('[ApisSyncQueue] Queue processing finished.');
}
