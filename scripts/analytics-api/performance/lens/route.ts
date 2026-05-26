export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { aggregateLensMetrics } from '@/lib/services/analytics-aggregation-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/analytics/performance/lens
 *
 * Detailed lens performance analytics
 * Query params:
 * - days: number (default 30)
 * - lens: string (optional, filter by specific lens)
 */

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const orgId = resolveOrgId(ctx);
    if (!orgId) return NextResponse.json({ ok: false, error: 'No organization' }, { status: 400 });

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);
    const filterLens = searchParams.get('lens');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await aggregateLensMetrics(orgId, startDate);

    const filtered = filterLens ? metrics.filter(m => m.lens === filterLens) : metrics;

    return NextResponse.json({
      ok: true,
      data: filtered,
      summary: {
        totalLenses: metrics.length,
        activeLenses: metrics.filter(m => m.contactCount > 0).length,
        topLens: metrics[0],
      },
    });
  } catch (error) {
    logger.error('GET /api/analytics/performance/lens failed:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
