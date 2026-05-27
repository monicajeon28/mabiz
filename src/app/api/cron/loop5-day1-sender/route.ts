import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendDay1Sms } from '@/lib/loop5-sms-service';

/**
 * Loop 5: Day 1 SMS 자동 발송 (24시간 후)
 * 매일 09:00 UTC (한국시간 +9 = 18:00)
 *
 * 로직:
 * 1. PartnerSmsLog에서 day: 'day0', status: 'SENT' 찾기
 * 2. createdAt + 24시간 지난 것만 선택
 * 3. 각각에 대해 sendDay1Sms() 호출
 * 4. 결과 집계
 */

export const maxDuration = 300; // 5분 제한

export async function GET(request: NextRequest) {
  try {
    // CRON_SECRET 검증
    const cronSecret = request.headers.get('authorization');
    if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('[Loop5 Day1] CRON 권한 없음', { cronSecret: cronSecret?.slice(0, 10) });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();

    logger.log('[Loop5 Day1] Cron 시작');

    // Day 0 발송 이후 24시간 경과한 Contact 찾기
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const day0SentLogs = await prisma.partnerSmsLog.findMany({
      where: {
        day: 'day0',
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
      take: 1000, // 한 번에 최대 1000개
    });

    logger.log('[Loop5 Day1] 처리 대상 찾음', {
      count: day0SentLogs.length,
    });

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // 각각 Day 1 SMS 발송
    for (const log of day0SentLogs) {
      try {
        if (!log.contactId) {
          logger.warn('[Loop5 Day1] contactId 없음', { smsLogId: log.id });
          failureCount++;
          continue;
        }

        const result = await sendDay1Sms(
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
        logger.error('[Loop5 Day1] 발송 중 오류', {
          contactId: log.contactId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const elapsedMs = Date.now() - startTime;

    const result = {
      ok: true,
      totalProcessed: day0SentLogs.length,
      successCount,
      failureCount,
      successRate: day0SentLogs.length > 0
        ? ((successCount / day0SentLogs.length) * 100).toFixed(1)
        : '0',
      elapsedMs,
      errors: errors.slice(0, 10), // 처음 10개만
    };

    logger.log('[Loop5 Day1] Cron 완료', result);

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('[Loop5 Day1] 크론 오류', {
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
