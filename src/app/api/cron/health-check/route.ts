export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/cron/health-check
 *
 * 시스템 상태를 확인합니다:
 * - BackupJob 성공률
 * - 실패한 작업 개수
 * - 평균 처리 시간
 *
 * Vercel Cron으로 매일 자동 실행됩니다.
 */
export async function GET(req: Request) {
  try {
    // Cron 인증 — CRON_SECRET 환경변수
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      logger.error('[CronHealthCheck] 인증 실패', { reason: 'CRON_SECRET 환경변수 미설정' });
      throw new Error('CRON_SECRET environment variable is not set');
    }

    const auth = req.headers.get('x-cron-secret') ?? req.headers.get('x-vercel-cron-secret') ?? '';
    let authValid = false;
    try {
      authValid = auth.length === secret.length && timingSafeEqual(Buffer.from(auth), Buffer.from(secret));
    } catch {
      authValid = false;
    }

    if (!authValid) {
      logger.warn('[CronHealthCheck] 인증 실패', { ip: req.headers.get('x-forwarded-for') });
      return NextResponse.json({ ok: false, message: '인증 실패' }, { status: 401 });
    }

    logger.log('[CRON] health-check 시작');

    // 1. 오늘의 작업 통계
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStats = await prisma.backupJob.groupBy({
      by: ['status'],
      where: { createdAt: { gte: today } },
      _count: true,
    });

    // 2. 지난 24시간 실패 작업
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const failedJobs = await prisma.backupJob.findMany({
      where: {
        status: 'FAILED',
        createdAt: { gte: yesterday },
      },
      select: { id: true, targetId: true, lastError: true },
    });

    // 3. 현재 PENDING 작업 (처리 대기 중)
    const pendingJobs = await prisma.backupJob.count({
      where: { status: 'PENDING' },
    });

    // 통계 계산
    const totalToday = todayStats.reduce((sum, s) => sum + s._count, 0);
    const successToday = todayStats.find(s => s.status === 'SUCCESS')?._count ?? 0;
    const failureToday = todayStats.find(s => s.status === 'FAILED')?._count ?? 0;
    const successRate = totalToday > 0 ? ((successToday / totalToday) * 100).toFixed(2) : 'N/A';

    const health = {
      status: failureToday === 0 && pendingJobs === 0 ? 'HEALTHY' : 'WARNING',
      timestamp: new Date().toISOString(),
      today: {
        total: totalToday,
        success: successToday,
        failure: failureToday,
        successRate: `${successRate}%`,
      },
      pending: pendingJobs,
      failedJobs: failedJobs.length,
    };

    logger.log('[CRON] health-check 완료', health);

    // 4. 문제가 있으면 경고
    if (health.status === 'WARNING') {
      logger.warn('[HEALTH] ⚠️ 경고: 실패한 작업 또는 대기 중인 작업이 있습니다', {
        failure: failureToday,
        pending: pendingJobs,
      });
    }

    return NextResponse.json(health);
  } catch (err) {
    logger.error('[CRON] health-check 에러', { err });
    return NextResponse.json(
      { ok: false, status: 'ERROR', message: '헬스체크 실패' },
      { status: 500 }
    );
  }
}
