export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { generatePerformanceReport } from '@/lib/services/analytics-aggregation-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/analytics/performance/report
 *
 * Generate comprehensive performance report
 * Query params:
 * - days: number (default 30)
 * - format: 'json' | 'pdf' (default 'json')
 */

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const orgId = resolveOrgId(ctx);
    if (!orgId) return NextResponse.json({ ok: false, error: 'No organization' }, { status: 400 });

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);
    const format = searchParams.get('format') || 'json';

    const report = await generatePerformanceReport(orgId, days);

    if (format === 'pdf') {
      // TODO: Implement PDF export (requires html2pdf or similar)
      return NextResponse.json({ ok: true, data: report });
    }

    return NextResponse.json({ ok: true, data: report });
  } catch (error) {
    logger.error('GET /api/analytics/performance/report failed:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
