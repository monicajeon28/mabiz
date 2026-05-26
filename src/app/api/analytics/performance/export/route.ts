export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { generatePerformanceReport } from '@/lib/services/analytics-aggregation-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/analytics/performance/export
 *
 * Export performance report as CSV or PDF
 * Query params:
 * - dateRange: '7' | '14' | '30' | '90'
 * - format: 'csv' | 'pdf' (default 'csv')
 */

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const orgId = resolveOrgId(ctx);
    if (!orgId) return NextResponse.json({ ok: false, error: 'No organization' }, { status: 400 });

    const searchParams = request.nextUrl.searchParams;
    const dateRange = parseInt(searchParams.get('dateRange') || '30', 10);
    const format = searchParams.get('format') || 'csv';

    const report = await generatePerformanceReport(orgId, dateRange);

    if (format === 'csv') {
      // Convert to CSV
      const csv = generateCsvReport(report);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="performance-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Default: JSON
    return NextResponse.json({
      ok: true,
      data: report,
    });
  } catch (error) {
    logger.error('GET /api/analytics/performance/export failed:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ─────────────────── CSV Generation ─────────────────

function generateCsvReport(report: any): string {
  const lines: string[] = [];

  // Header
  lines.push('마비즈 CRM - 성과 리포트');
  lines.push(`기간: ${report.period.startDate} ~ ${report.period.endDate} (${report.period.days}일)`);
  lines.push('');

  // Overview
  lines.push('=== 개요 ===');
  lines.push(`총 수익,${report.overview.totalRevenue.toLocaleString('ko-KR')} KRW`);
  lines.push(`총 고객수,${report.overview.totalContacts.toLocaleString('ko-KR')}`);
  lines.push(`전환율,${(report.overview.conversionRate * 100).toFixed(2)}%`);
  lines.push(`평균 주문가,${report.overview.avgOrderValue.toLocaleString('ko-KR')} KRW`);
  lines.push(`LTV,${report.overview.ltv.toLocaleString('ko-KR')} KRW`);
  lines.push(`CPA,${report.overview.cpa.toLocaleString('ko-KR')} KRW`);
  lines.push('');

  // Top Lenses
  lines.push('=== 상위 렌즈 ===');
  lines.push('렌즈,고객수,전환율,LTV,월수익,추이');
  for (const lens of report.topLenses) {
    lines.push(
      `${lens.lens},${lens.contactCount},${(lens.conversionRate * 100).toFixed(2)}%,${lens.ltv.toLocaleString('ko-KR')},${lens.monthlyRevenue.toLocaleString('ko-KR')},${lens.trend > 0 ? '+' : ''}${lens.trend.toFixed(0)} bps`
    );
  }
  lines.push('');

  // Day 0-3 Performance
  lines.push('=== Day 0-3 성과 ===');
  lines.push('Day,발송,오픈,클릭,전환,오픈율,클릭율,전환율');
  for (const day of report.day03Performance) {
    lines.push(
      `Day${day.day},${day.sent},${day.opened},${day.clicked},${day.converted},${(day.openRate * 100).toFixed(2)}%,${(day.clickRate * 100).toFixed(2)}%,${(day.conversionRate * 100).toFixed(2)}%`
    );
  }
  lines.push('');

  // Channel Performance
  lines.push('=== 채널별 성과 ===');
  lines.push('채널,발송,오픈,클릭,메시지당비용,총비용,ROI,ROAS');
  for (const channel of report.channelPerformance) {
    lines.push(
      `${channel.channel},${channel.sent},${channel.opened},${channel.clicked},${channel.costPerMessage}₩,${channel.totalCost.toLocaleString('ko-KR')}₩,${(channel.roi * 100).toFixed(2)}%,${(channel.roas * 100).toFixed(2)}%`
    );
  }
  lines.push('');

  // Recommendations
  lines.push('=== 권장사항 ===');
  for (const rec of report.recommendations) {
    lines.push(`- ${rec}`);
  }
  lines.push('');

  lines.push(`생성시간: ${report.timestamp}`);

  return lines.join('\n');
}
