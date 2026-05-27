import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendDay3Sms } from '@/lib/loop5-sms-service';

/**
 * Loop 5: Day 3 SMS 자동 발송 (72시간 후)
 * 매일 01:00 UTC (한국시간 +9 = 10:00)
 */

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('authorization');
    if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('[Loop5 Day3] CRON 권한 없음');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    logger.log('[Loop5 Day3] Cron 시작');

    // Day 2 발송 이후 24시간 경과한 Contact 찾기
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const day2SentLogs = await prisma.partnerSmsLog.findMany({
      where: {
        day: 'day2',
        status: 'SENT',
        sentAt: {
          lte: oneDayAgo,
        },
      },
      select: {
        id: true,
        organizationId: true,
        contactId: true,
        segment: true,
        variant: true,
        phoneNumber: true,
      },
      take: 1000,
    });

    logger.log('[Loop5 Day3] 처리 대상 찾음', {
      count: day2SentLogs.length,
    });

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    for (const log of day2SentLogs) {
      try {
        if (!log.contactId) {
          failureCount++;
          continue;
        }

        const result = await sendDay3Sms(
          log.organizationId,
          log.contactId,
          log.segment as 'A' | 'B' | 'C' | 'D' | 'E',
          log.phoneNumber,
          undefined,
          (log.variant as 'a' | 'b') || 'a'
        );

        if (result.success) {
          successCount++;
        } else {
          failureCount++;
          errors.push(`${log.contactId}: ${result.error}`);
        }
      } catch (err) {
        failureCount++;
        logger.error('[Loop5 Day3] 발송 중 오류', {
          contactId: log.contactId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const elapsedMs = Date.now() - startTime;

    const result = {
      ok: true,
      totalProcessed: day2SentLogs.length,
      successCount,
      failureCount,
      successRate: day2SentLogs.length > 0
        ? ((successCount / day2SentLogs.length) * 100).toFixed(1)
        : '0',
      elapsedMs,
      errors: errors.slice(0, 10),
    };

    logger.log('[Loop5 Day3] Cron 완료', result);

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('[Loop5 Day3] 크론 오류', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
