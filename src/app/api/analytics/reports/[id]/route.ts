/**
 * GET /api/analytics/reports/[id]
 *
 * Fetch detailed report by ID
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getCurrentOrg } from '@/lib/auth-helpers';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    // Get current org
    const org = await getCurrentOrg();
    if (!org) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Fetch report
    const report = await prisma.dailyReport.findUnique({
      where: { id: params.id },
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (report.organizationId !== org.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Parse JSON fields
    const transformed = {
      id: report.id,
      reportDate: report.reportDate,
      revenue: report.revenue,
      weeklyRevenue: report.weeklyRevenue,
      monthlyRevenue: report.monthlyRevenue,
      conversionRate: report.conversionRate,
      conversionCount: report.conversionCount,
      smsSent: report.smsSent,
      smsOpenRate: report.smsOpenRate,
      kakaoSent: report.kakaoSent,
      kakaoClickRate: report.kakaoClickRate,
      emailSent: report.emailSent,
      emailOpenRate: report.emailOpenRate,
      alerts: JSON.parse(report.alerts || '[]'),
      recommendations: JSON.parse(report.recommendations || '[]'),
      channelMetrics: JSON.parse(report.channelMetrics || '{}'),
      lensMetrics: JSON.parse(report.lensMetrics || '{}'),
      topPartners: JSON.parse(report.topPartners || '[]'),
      topSequences: JSON.parse(report.topSequences || '[]'),
      status: report.status,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };

    return NextResponse.json(transformed);
  } catch (err) {
    logger.error('[ReportDetailsAPI] Error', { err });
    return NextResponse.json(
      { error: 'Failed to fetch report details' },
      { status: 500 }
    );
  }
}
