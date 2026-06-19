import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { retryProcessor } from '@/lib/webhooks/retry-processor';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      logger.error('[Cron/Webhooks-Retry] CRON_SECRET not configured');
      return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 });
    }
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const tokenBuf = Buffer.from(token, 'utf8');
    const expectedBuf = Buffer.from(expectedToken, 'utf8');
    if (tokenBuf.byteLength !== expectedBuf.byteLength || !timingSafeEqual(tokenBuf, expectedBuf)) {
      logger.warn('[Cron/Webhooks-Retry] Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.log('[Cron/Webhooks-Retry] Starting webhook retry processing');

    const result = await retryProcessor.processQueue();

    logger.log('[Cron/Webhooks-Retry] Completed', result);

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    logger.error('[Cron/Webhooks-Retry] Error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
