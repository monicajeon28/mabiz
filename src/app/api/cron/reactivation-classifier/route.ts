/**
 * GET /api/cron/reactivation-classifier
 *
 * 부재중 고객 자동 분류 크론 작업
 * 매일 자동으로 실행되어 부재중 고객을 L0 렌즈로 분류
 *
 * Cron Header 검증:
 * Authorization: Bearer CRON_SECRET
 */

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { dailyReactivationClassification } from '@/lib/services/reactivation-classifier';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // 크론 시크릿 검증
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
    }
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const tokenBuf = Buffer.from(token, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    logger.info('[Cron] Starting daily reactivation classification...');

    // 자동 분류 실행
    const results = await dailyReactivationClassification();

    return NextResponse.json(
      {
        success: true,
        message: 'Daily reactivation classification completed',
        results,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('[Cron] Reactivation classification failed', { error: error instanceof Error ? error.message : String(error) });

    return NextResponse.json(
      { error: 'Reactivation classification failed' },
      { status: 500 },
    );
  }
}
