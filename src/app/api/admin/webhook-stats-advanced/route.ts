import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import {
  collectWebhookMetrics,
  checkWebhookHealth,
  WebhookMonitoringConfig,
} from '@/lib/webhook-monitoring';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden: GLOBAL_ADMIN 권한이 필요합니다.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const daysParam = parseInt(url.searchParams.get('days') || '7', 10);
    const webhookTypesParam = url.searchParams.get('webhookTypes');
    const webhookTypes = webhookTypesParam ? webhookTypesParam.split(',') : undefined;
    const orgIdParam = url.searchParams.get('organizationId');

    const config: WebhookMonitoringConfig = {
      organizationId: orgIdParam ?? session.organizationId ?? '',
      dayCount: daysParam,
      webhookTypes,
    };

    const [monitoringData, health] = await Promise.all([
      collectWebhookMetrics(config),
      checkWebhookHealth(orgIdParam ?? session.organizationId ?? ''),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        health,
        monitoring: monitoringData,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('[Admin/WebhookStatsAdvanced] Error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
