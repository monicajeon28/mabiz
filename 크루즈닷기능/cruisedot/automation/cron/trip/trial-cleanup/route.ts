export const runtime = 'nodejs'; // Prisma 필수
export const dynamic = 'force-dynamic'; // 캐시 금지

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Vercel Cron: GDPR 자동 정리 (90일 만료 데이터 삭제)
 * Schedule: 주 1회 일요일 2시 UTC (vercel.json에 설정)
 * Purpose: 90일 이상 전에 만료된 Trial 데이터 자동 삭제 (GDPR 규정 준수)
 *
 * Security:
 * - CRON_SECRET 환경변수로 인증 (Bearer token)
 * - 삭제 전 audit log 기록 (감시 추적)
 * - Soft delete 방식 아님 (hard delete) → 규정상 완전 삭제
 *
 * Compliance:
 * - GDPR: 개인정보 수집 목적이 만료되면 90일 내 삭제
 * - Status: EXPIRED, CANCELLED, CONVERTED (완료된 trial만 대상)
 * - endedAt이 90일 이상 이전이면 삭제 대상
 *
 * Performance:
 * - Batch 삭제 (deleteMany) → 단일 쿼리 실행
 * - 복합 인덱스 활용 (status, endedAt은 없으므로 sequential scan)
 * - Cascade delete: TrialAuditLog도 함께 삭제 (Prisma relation)
 */
export async function POST(req: Request) {
  try {
    // 0. CRON_SECRET 환경변수 검증 (필수)
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      logger.error('[TrialCleanup] CRON_SECRET 환경변수 미설정');
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 401 }
      );
    }

    // 1. Cron 인증 (Vercel이 Bearer token 자동 제공)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // 2. 삭제 대상 Trial 찾기
    // Status: EXPIRED, CANCELLED, CONVERTED (완료된 상태)
    // endedAt: 90일 이상 이전
    const trialsToDelete = await prisma.trial.findMany({
      where: {
        status: { in: ['EXPIRED', 'CANCELLED', 'CONVERTED'] },
        endedAt: { lt: ninetyDaysAgo },
      },
      select: {
        id: true,
        userId: true,
        status: true,
        endedAt: true,
      },
    });

    if (trialsToDelete.length === 0) {
      logger.info('[Cron] GDPR cleanup: no trials to delete', {
        cutoffDate: ninetyDaysAgo.toISOString(),
        timestamp: now.toISOString(),
      });
      return NextResponse.json({
        ok: true,
        deletedTrialCount: 0,
        deletedLogCount: 0,
        timestamp: now.toISOString(),
      });
    }

    // 3. 삭제 전 Audit log 기록 (감시용)
    // 참고: 삭제 후에는 Trial을 조회할 수 없으므로 먼저 기록
    await prisma.trialAuditLog.createMany({
      data: trialsToDelete.map((trial) => ({
        trialId: trial.id,
        action: 'TRIAL_DATA_DELETED_GDPR',
        previousState: {
          status: trial.status,
          endedAt: trial.endedAt?.toISOString(),
          userId: trial.userId,
          reason: 'GDPR_90_DAY_COMPLIANCE',
        },
        performedBy: null, // System action
        performedAt: now,
      })),
    });

    // 4. Trial 삭제 (Cascade: TrialAuditLog도 함께 삭제)
    const deleteResult = await prisma.trial.deleteMany({
      where: {
        id: { in: trialsToDelete.map((t) => t.id) },
      },
    });

    logger.info('[Cron] GDPR trial cleanup completed', {
      deletedTrialCount: deleteResult.count,
      cutoffDate: ninetyDaysAgo.toISOString(),
      timestamp: now.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      deletedTrialCount: deleteResult.count,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    logger.error('[Cron] Trial cleanup failed', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
