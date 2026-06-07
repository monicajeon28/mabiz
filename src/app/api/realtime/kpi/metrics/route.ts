import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { realtimeMetricsService } from '@/lib/services/realtime-metrics-service';
import { getMabizSession } from '@/lib/auth';

/**
 * GET /api/realtime/kpi/metrics?org=<organizationId>
 *
 * Fetch real-time metrics via HTTP polling
 * Used as fallback when WebSocket is unavailable
 *
 * Response:
 * {
 *   todayRevenue: number,
 *   yesterdayRevenue: number,
 *   lastHourConversion: number,
 *   activeDaySequences: number,
 *   topLenses: Array<{ lens: string; count: number }>,
 *   channelMetrics: {
 *     sms: { sent, opened, clicked },
 *     kakao: { sent, opened, clicked },
 *     email: { sent, opened, clicked }
 *   },
 *   partnerLeaderboard: Array<{ partnerId, name, amount }>,
 *   cronHealth: Record<string, any>,
 *   databaseHealth: { queryLatency, connectionCount }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const orgParam = searchParams.get('org');
    // GLOBAL_ADMIN: query param 허용, 일반: 세션 org 고정
    const organizationId = session.role === 'GLOBAL_ADMIN'
      ? (orgParam || session.organizationId)
      : session.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Fetch all metrics
    const metrics = await realtimeMetricsService.getAllMetrics(organizationId);

    // Set cache headers - allow 1 minute cache for public CDN, but must revalidate
    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Content-Type': 'application/json',
        'X-Generated-At': new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching real-time metrics', { error: error instanceof Error ? error.message : String(error) });

    // Return partial data even on error
    return NextResponse.json(
      {
        todayRevenue: 0,
        yesterdayRevenue: 0,
        lastHourConversion: 0,
        activeDaySequences: 0,
        topLenses: [],
        channelMetrics: {
          sms: { sent: 0, opened: 0, clicked: 0 },
          kakao: { sent: 0, opened: 0, clicked: 0 },
          email: { sent: 0, opened: 0, clicked: 0 },
        },
        partnerLeaderboard: [],
        cronHealth: {},
        databaseHealth: { queryLatency: 0, connectionCount: 0 },
        error: 'Partial data - some metrics unavailable',
      },
      { status: 200 }
    );
  }
}
