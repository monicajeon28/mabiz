import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sendDayNSmsBatch } from '@/lib/loop5-sms-batch';

/**
 * Loop 5: Day 3 SMS 자동 발송 (배치 처리)
 * 매일 01:00 UTC (한국시간 +9 = 10:00)
 *
 * P1-1 최적화:
 * - 순차 처리 (30-60초) → 배치 처리 (2-3초) = 93% 단축
 * - 개별 Aligo 호출 → 병렬 Aligo 호출 (동시 100개)
 * - 1건마다 4쿼리 (SMS + Contact) → 2쿼리 (createMany + Raw SQL)
 * - 1000명: 4000 쿼리 → 2 쿼리 (99% 단축)
 */

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
    }
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const tokenBuf = Buffer.from(token, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
      logger.warn('[Loop5 Day3 Batch] CRON 권한 없음');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.log('[Loop5 Day3 Batch] Cron 시작 (배치 처리)');

    // ✅ P1-1 최적화: 배치 처리
    const result = await sendDayNSmsBatch(3, 100);

    const response = {
      ok: true,
      day: result.day,
      totalProcessed: result.total,
      successCount: result.sentCount,
      failureCount: result.failedCount,
      successRate: result.total > 0
        ? ((result.sentCount / result.total) * 100).toFixed(1)
        : '0',
      executionTimeMs: result.executionTimeMs,
      improvementMetrics: {
        previousApproach: '30-60 seconds (sequential)',
        currentApproach: `${(result.executionTimeMs / 1000).toFixed(1)} seconds (batch)`,
        timeReduction: `${((1 - result.executionTimeMs / 45000) * 100).toFixed(0)}% faster`,
        queriesReduced: `${result.total * 4} → ~2 queries`,
      },
      errors: result.errors.slice(0, 10),
    };

    logger.log('[Loop5 Day3 Batch] Cron 완료', {
      successCount: result.sentCount,
      failureCount: result.failedCount,
      executionTimeMs: result.executionTimeMs,
    });

    return NextResponse.json(response);
  } catch (error: unknown) {
    logger.error('[Loop5 Day3 Batch] 크론 오류', {
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
