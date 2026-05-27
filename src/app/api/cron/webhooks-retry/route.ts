import { NextRequest, NextResponse } from 'next/server';
import { retryProcessor } from '@/lib/webhooks/retry-processor';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) {
      logger.warn('[Cron/Webhooks-Retry] Unauthorized');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
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
