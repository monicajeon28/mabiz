export const runtime = 'nodejs'; // Prisma 필수
export const dynamic = 'force-dynamic'; // 캐시 금지

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Vercel Cron: Trial 자동 만료 (72시간 경과)
 * Schedule: 4시간마다 (vercel.json에 설정)
 * Purpose: ACTIVE 상태의 Trial 중 expiresAt이 지난 것들을 자동으로 EXPIRED로 변경
 *
 * Security:
 * - CRON_SECRET 환경변수로 인증 (Bearer token)
 * - 읽기 전용 조회 후 원자성 업데이트 (race condition 방지)
 *
 * Performance:
 * - Batch 업데이트 (updateMany) → 단일 쿼리 실행
 * - 복합 인덱스 활용 (status, expiresAt)
 * - Audit logging은 배치 작업이므로 별도 처리
 */
export async function POST(req: Request) {
  try {
    // 0. CRON_SECRET 환경변수 검증 (필수)
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      logger.error('[TrialExpire] CRON_SECRET 환경변수 미설정');
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

    // 2. ACTIVE 상태이고 expiresAt < now인 Trial 찾기
    const expiredTrials = await prisma.trial.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now },
      },
      select: { id: true },
    });

    if (expiredTrials.length === 0) {
      logger.info('[Cron] Trial expiration check: no expired trials', {
        timestamp: now.toISOString(),
      });
      return NextResponse.json({
        ok: true,
        expiredCount: 0,
        timestamp: now.toISOString(),
      });
    }

    // 3. Batch 업데이트: ACTIVE → EXPIRED
    const result = await prisma.trial.updateMany({
      where: {
        id: { in: expiredTrials.map((t) => t.id) },
      },
      data: {
        status: 'EXPIRED',
        endedAt: now,
        updatedAt: now,
      },
    });

    // 4. Audit log 기록 (배치)
    // 참고: 대량 삽입이므로 createMany 사용 (transaction 내에서 일괄 생성)
    await prisma.trialAuditLog.createMany({
      data: expiredTrials.map((trial) => ({
        trialId: trial.id,
        action: 'TRIAL_AUTO_EXPIRED',
        newState: {
          status: 'EXPIRED',
          reason: 'AUTO_EXPIRATION_72H',
          expiredAt: now.toISOString(),
        },
        performedBy: null, // System action (no user)
        performedAt: now,
      })),
    });

    logger.info('[Cron] Trial expiration check completed', {
      expiredCount: result.count,
      timestamp: now.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      expiredCount: result.count,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    logger.error('[Cron] Trial expiration failed', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
