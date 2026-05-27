import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { analyticsHandler } from '@/lib/webhooks/handlers';
import { signatureVerify } from '@/lib/webhooks/signature-verify';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.text();

    const signature = req.headers.get('x-webhook-signature');
    if (signature) {
      try {
        signatureVerify.verify(body, signature);
      } catch {
        logger.warn('[Webhook/Analytics] Invalid signature');
        return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 403 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const eventId = payload.eventId || uuidv4();
    const organizationId = session.organizationId;

    const result = await analyticsHandler.processEvent(
      eventId,
      organizationId,
      payload
    );

    return NextResponse.json({
      ok: result.success,
      eventId,
      durationMs: result.durationMs,
    }, { status: result.statusCode });
  } catch (error) {
    logger.error('[Webhook/Analytics] Error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
