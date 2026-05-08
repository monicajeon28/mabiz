export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/cleanup
 *
 * 오래된 데이터를 정리합니다:
 * - 6개월 이상 된 완료된 BackupJob 삭제
 * - 90일 이상 된 실패 작업 삭제 (로그는 유지)
 *
 * 저장 공간 절약 + 데이터베이스 성능 향상
 */
export async function GET(req: Request) {
  try {
    const cronSecret = req.headers.get('x-vercel-cron-secret');
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
    }

    logger.log('[CRON] cleanup 시작');

    // 1. 6개월 이전의 완료된 백업 작업 삭제
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const deletedOldJobs = await prisma.backupJob.deleteMany({
      where: {
        status: 'SUCCESS',
        createdAt: { lt: sixMonthsAgo },
      },
    });

    logger.log(`[CRON] 6개월 이전 완료 작업 ${deletedOldJobs.count}개 삭제`);

    // 2. 90일 이상 된 실패 작업 마크 (상태 변경 또는 별도 보관)
    // → 삭제하지 않고 archived 플래그나 별도 테이블로 이동
    // (일단은 로그만 남기고 삭제하지 않음 - 나중에 분석용)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const oldFailedJobs = await prisma.backupJob.findMany({
      where: {
        status: 'FAILED',
        createdAt: { lt: ninetyDaysAgo },
      },
      select: { id: true, targetId: true, lastError: true },
    });

    logger.warn(
      `[CRON] 90일 이상 된 실패 작업 ${oldFailedJobs.length}개 발견 (삭제 안 함, 보관)`,
      { sampleJobs: oldFailedJobs.slice(0, 3) }
    );

    // 3. PENDING 상태로 6개월 이상 있는 작업 (스택된 작업)
    // → 처리하지 못한 것으로 표시
    const stackedJobs = await prisma.backupJob.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: sixMonthsAgo },
      },
      data: {
        status: 'FAILED',
        lastError: '6개월 이상 처리되지 않음 (타임아웃)',
      },
    });

    logger.warn(`[CRON] 스택된 PENDING 작업 ${stackedJobs.count}개를 FAILED로 마크`);

    // 4. 정리 완료 리포트
    const cleanup = {
      timestamp: new Date().toISOString(),
      deletedSuccessJobs: deletedOldJobs.count,
      oldFailedJobs: oldFailedJobs.length,
      stackedJobs: stackedJobs.count,
      totalCleaned: deletedOldJobs.count + stackedJobs.count,
    };

    logger.log('[CRON] cleanup 완료', cleanup);

    return NextResponse.json({
      ok: true,
      message: `${cleanup.totalCleaned}개 작업 정리 완료`,
      ...cleanup,
    });
  } catch (err) {
    logger.error('[CRON] cleanup 에러', { err });
    return NextResponse.json(
      { ok: false, message: '정리 작업 실패' },
      { status: 500 }
    );
  }
}
