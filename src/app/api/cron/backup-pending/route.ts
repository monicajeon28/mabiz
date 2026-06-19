export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { backupCallLogsToGoogleDrive } from '@/lib/google-drive';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/backup-pending
 *
 * BackupJob 큐에서 PENDING 작업들을 가져와서 처리합니다.
 * Vercel Cron으로 매일 자동 실행됩니다.
 */
export async function GET(req: Request) {
  try {
    // Cron 보안 — CRON_SECRET 미설정 시 fail-closed (500)
    const envSecret = process.env.CRON_SECRET;
    if (!envSecret) {
      return NextResponse.json({ ok: false, message: 'CRON_SECRET 환경변수 미설정' }, { status: 503 });
    }
    const cronSecret = req.headers.get('x-vercel-cron-secret');
    if (cronSecret !== envSecret) {
      return NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
    }

    logger.log('[CRON] backup-pending 시작');

    // 1. PENDING 상태인 백업 작업 10개 가져오기
    const pendingJobs = await prisma.backupJob.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 10, // 한 번에 10개씩만 처리 (부하 관리)
    });

    logger.log(`[CRON] ${pendingJobs.length}개의 PENDING 작업 발견`);

    let successCount = 0;
    let failureCount = 0;

    // 2. 각 작업 처리
    for (const job of pendingJobs) {
      try {
        // 최대 재시도 횟수 초과 확인
        if (job.retryCount >= job.maxRetries) {
          await prisma.backupJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              lastError: `최대 재시도 횟수(${job.maxRetries}) 초과`,
            },
          });
          failureCount++;
          logger.warn(`[CRON] 작업 실패 (재시도 초과): ${job.id}`, { retryCount: job.retryCount });
          continue;
        }

        // BackupJob payload에서 콜 기록 정보 추출
        const payload = job.payload as {
          userId: string;
          displayName: string;
          customerName: string;
          customerPhone: string;
        };

        // 최근 콜 기록 100개 가져오기
        const recentLogs = await prisma.callLog.findMany({
          where: { contactId: job.targetId },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            createdAt: true,
            result: true,
            convictionScore: true,
            content: true,
            nextAction: true,
          },
        });

        // Google Drive에 백업
        const result = await backupCallLogsToGoogleDrive({
          userId: payload.userId,
          displayName: payload.displayName,
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          callLogs: recentLogs,
        });

        // 성공: 작업 상태 업데이트
        await prisma.backupJob.update({
          where: { id: job.id },
          data: {
            status: 'SUCCESS',
            updatedAt: new Date(),
          },
        });

        successCount++;
        logger.log(`[CRON] 백업 성공`, {
          jobId: job.id,
          contactId: job.targetId,
          fileId: result.fileId,
        });
      } catch (err) {
        failureCount++;
        const errorMsg = err instanceof Error ? err.message : String(err);

        // 실패: 재시도 횟수 증가
        await prisma.backupJob.update({
          where: { id: job.id },
          data: {
            retryCount: { increment: 1 },
            lastError: errorMsg,
            updatedAt: new Date(),
          },
        });

        logger.error(`[CRON] 백업 실패 (재시도: ${job.retryCount + 1}/${job.maxRetries})`, {
          jobId: job.id,
          error: errorMsg,
        });
      }
    }

    logger.log(`[CRON] backup-pending 완료`, {
      total: pendingJobs.length,
      success: successCount,
      failure: failureCount,
    });

    return NextResponse.json({
      ok: true,
      message: `${successCount}개 성공, ${failureCount}개 실패`,
      processed: pendingJobs.length,
    });
  } catch (err) {
    logger.error('[CRON] backup-pending 에러', { err });
    return NextResponse.json(
      { ok: false, message: '크론 작업 실패' },
      { status: 500 }
    );
  }
}
