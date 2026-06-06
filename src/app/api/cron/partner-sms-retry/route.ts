import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { retryFailedPartnerSms } from '@/lib/aligo-sms-service';

/**
 * GET /api/cron/partner-sms-retry
 * 실패한 파트너 Alert SMS 자동 재시도
 *
 * Vercel Cron: 매일 06:00 UTC, 12:00 UTC, 18:00 UTC에 실행 (3회)
 * @see https://vercel.com/docs/cron-jobs
 */
export async function GET(req: NextRequest) {
  try {
    // Vercel Cron Job 검증
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      logger.warn('[partner-sms-retry] 인증 실패', {
        hasAuthHeader: !!authHeader,
      });
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const startTime = Date.now();

    // 재시도 가능한 SMS 조회 (최대 3회 재시도)
    const failedSms = await prisma.partnerSmsLog.findMany({
      where: {
        status: 'PENDING',
        retryCount: { lt: 3 }, // maxRetries = 3
      },
      orderBy: { createdAt: 'asc' },
      take: 100, // 배치 크기 제한
    });

    logger.log('[partner-sms-retry] 시작', {
      failedCount: failedSms.length,
    });

    let retrySuccess = 0;
    let retryFailed = 0;

    // SMS 재시도
    for (const sms of failedSms) {
      try {
        const result = await retryFailedPartnerSms(sms.id);

        if (result.success) {
          retrySuccess++;
        } else {
          retryFailed++;
        }
      } catch (error: unknown) {
        logger.error('[partner-sms-retry] 재시도 오류', {
          smsId: sms.id,
          error: error instanceof Error ? error.message : String(error),
        });
        retryFailed++;
      }
    }

    const elapsedMs = Date.now() - startTime;

    logger.log('[partner-sms-retry] 완료', {
      retrySuccess,
      retryFailed,
      totalProcessed: retrySuccess + retryFailed,
      elapsedMs,
    });

    return NextResponse.json({
      ok: true,
      retrySuccess,
      retryFailed,
      totalProcessed: retrySuccess + retryFailed,
      elapsedMs,
    });
  } catch (error: unknown) {
    logger.error('[partner-sms-retry] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
