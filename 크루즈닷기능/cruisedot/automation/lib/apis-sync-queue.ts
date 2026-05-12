import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { syncApisSpreadsheet, syncToMasterApisSheet } from '@/lib/google-sheets';

export type ApisSyncTargetType = 'MASTER_SHEET' | 'TRIP_SHEET';

/**
 * Enqueue a sync task for APIS data.
 * @param targetType 'MASTER_SHEET' or 'TRIP_SHEET'
 * @param targetId userId for MASTER_SHEET, tripId for TRIP_SHEET
 * @param delayMinutes Number of minutes to delay execution (default: 10)
 */
export async function enqueueApisSync(targetType: ApisSyncTargetType, targetId: number, delayMinutes: number = 10) {
    try {
        // Check if a pending task already exists to avoid duplicates
        const existing = await prisma.apisSyncQueue.findFirst({
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

        await prisma.apisSyncQueue.create({
            data: {
                targetType,
                targetId,
                status: 'PENDING',
                scheduledAt,
            },
        });

        logger.log(`[ApisSyncQueue] Enqueued task for ${targetType}:${targetId} (Scheduled at: ${scheduledAt.toISOString()})`);
    } catch (error) {
        logger.error('[ApisSyncQueue] Failed to enqueue task:', error);
    }
}

/**
 * Process pending tasks in the APIS sync queue.
 * Should be called by Cron job.
 */
export async function processApisSyncQueue(batchSize = 10) {
    logger.log('[ApisSyncQueue] Starting queue processing...');

    // Fetch pending tasks that are scheduled for now or in the past
    const tasks = await prisma.apisSyncQueue.findMany({
        where: {
            status: 'PENDING',
            scheduledAt: { lte: new Date() }
        },
        orderBy: { scheduledAt: 'asc' },
        take: batchSize,
    });

    if (tasks.length === 0) {
        logger.log('[ApisSyncQueue] No pending tasks.');
        return;
    }

    logger.log(`[ApisSyncQueue] Found ${tasks.length} tasks to process.`);

    for (const task of tasks) {
        try {
            // Update status to PROCESSING
            await prisma.apisSyncQueue.update({
                where: { id: task.id },
                data: { status: 'PROCESSING', attempts: { increment: 1 } },
            });

            let result;
            if (task.targetType === 'MASTER_SHEET') {
                result = await syncToMasterApisSheet(task.targetId);
            } else if (task.targetType === 'TRIP_SHEET') {
                result = await syncApisSpreadsheet(task.targetId);
            }

            if (result && result.ok) {
                await prisma.apisSyncQueue.update({
                    where: { id: task.id },
                    data: { status: 'COMPLETED', processedAt: new Date() },
                });
                logger.log(`[ApisSyncQueue] Task ${task.id} (${task.targetType}:${task.targetId}) completed.`);
            } else {
                throw new Error(result?.error || 'Unknown error during sync');
            }

        } catch (error: any) {
            logger.error(`[ApisSyncQueue] Task ${task.id} failed:`, error);

            // If max attempts reached (e.g., 3), mark as FAILED
            if (task.attempts >= 2) { // 0-indexed + increment = 3rd try
                await prisma.apisSyncQueue.update({
                    where: { id: task.id },
                    data: {
                        status: 'FAILED',
                        lastError: error.message,
                        processedAt: new Date() // Mark as processed even if failed to stop retrying
                    },
                });
            } else {
                // Reset to PENDING for retry
                await prisma.apisSyncQueue.update({
                    where: { id: task.id },
                    data: {
                        status: 'PENDING',
                        lastError: error.message
                    },
                });
            }
        }
    }

    logger.log('[ApisSyncQueue] Queue processing finished.');
}
