// app/api/cron/sync-images/route.ts
// 구글 드라이브 크루즈정보사진 → DB ImageCache 동기화 트리거
// Vercel Cron 또는 관리자가 수동으로 호출
// 보안: CRON_SECRET constant-time 검증, 분산 Lock, Rate Limiting, 에러 마스킹

import { NextRequest, NextResponse } from 'next/server';
import { syncImageCache } from '@/lib/image-cache-sync';
import { logger, securityLogger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { validateCronSecret, checkSyncRateLimit } from '@/lib/security-validators';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분 (Vercel Pro)

// 동기화 락 (분산 환경 고려: DB를 이용한 낙관적 락)
const SYNC_LOCK_KEY = 'image-cache-sync';
const SYNC_LOCK_TTL = 600000; // 10분 (동기화 시간초과 방지)

/**
 * 분산 Lock 획득 (Prisma를 이용한 낙관적 락)
 */
async function acquireSyncLock(): Promise<boolean> {
  try {
    const now = new Date();
    const lockExpiry = new Date(now.getTime() - SYNC_LOCK_TTL);

    // 기존 만료된 락 삭제
    await prisma.cronLock.deleteMany({
      where: {
        key: SYNC_LOCK_KEY,
        expiresAt: { lt: lockExpiry },
      },
    });

    // 새 락 생성 시도 (UNIQUE 제약으로 동시성 보장)
    try {
      await prisma.cronLock.create({
        data: {
          key: SYNC_LOCK_KEY,
          expiresAt: new Date(now.getTime() + SYNC_LOCK_TTL),
        },
      });
      return true;
    } catch (err: unknown) {
      // UNIQUE 제약 위반 = 다른 프로세스가 락 소유
      if (err instanceof Error && 'code' in err && (err as any).code === 'P2002') {
        return false;
      }
      throw err;
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[SyncImages] acquireSyncLock error:', errorMsg);
    return false;
  }
}

/**
 * 분산 Lock 해제
 */
async function releaseSyncLock(): Promise<void> {
  try {
    await prisma.cronLock.deleteMany({
      where: { key: SYNC_LOCK_KEY },
    });
  } catch (error) {
    logger.error('[SyncImages] releaseSyncLock error:', error);
  }
}

export async function GET(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  try {
    // 1. Rate Limiting 검증 (P1-HIGH)
    const rateLimitOk = await checkSyncRateLimit(clientIp);
    if (!rateLimitOk) {
      securityLogger.rateLimitExceeded(clientIp, '/api/cron/sync-images', 10);
      return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
    }

    // 2. CRON_SECRET 검증: constant-time 비교 (CRITICAL)
    const authHeader = req.headers.get('authorization');
    const querySecret = new URL(req.url).searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      logger.error('[SyncImages] CRON_SECRET not configured');
      return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
    }

    // Vercel Cron Bearer 토큰 검증 (constant-time)
    const vercelBearerToken = authHeader ? authHeader.replace(/^Bearer\s+/, '') : '';
    const isVercelCron = validateCronSecret(vercelBearerToken, cronSecret);

    // 쿼리 파라미터 secret 검증 (constant-time)
    const isManualTrigger = querySecret ? validateCronSecret(querySecret, cronSecret) : false;

    if (!isVercelCron && !isManualTrigger) {
      securityLogger.suspiciousActivity(clientIp, 'invalid CRON_SECRET attempt');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 3. 분산 Lock 획득 (동시 실행 방지, P1-HIGH)
    const lockAcquired = await acquireSyncLock();
    if (!lockAcquired) {
      logger.warn('[SyncImages] Another sync process is running, skipping this request');
      return NextResponse.json(
        { ok: false, error: 'Sync already in progress' },
        { status: 409 }
      );
    }

    try {
      logger.log('[SyncImages] 이미지 동기화 시작...');
      const result = await syncImageCache();

      logger.log('[SyncImages] 완료:', result);
      return NextResponse.json({
        ok: result.success,
        ...result,
      });
    } finally {
      // 락 해제 (반드시 실행)
      await releaseSyncLock();
    }
  } catch (error: unknown) {
    // 에러 마스킹 (CRITICAL): 시스템 정보 노출 금지
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
    logger.error('[SyncImages] 동기화 실패:', {
      errorType,
      errorMessage: errorMsg,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { ok: false, error: 'Image synchronization failed. Please try again later.' },
      { status: 500 }
    );
  }
}
