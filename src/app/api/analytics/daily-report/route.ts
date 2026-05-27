/**
 * GET /api/analytics/daily-report
 *
 * Fetch daily report for a specific date
 * Query params: date (YYYY-MM-DD), orgId (optional, defaults to current org)
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getCurrentOrg } from '@/lib/auth-helpers';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');
    const orgId = searchParams.get('orgId');

    if (!dateStr) {
      return NextResponse.json(
        { error: 'Missing date parameter (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Get current org if not specified
    let currentOrgId = orgId;
    if (!currentOrgId) {
      const org = await getCurrentOrg();
      if (!org) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        );
      }
      currentOrgId = org.id;
    }

    // Parse date
    const reportDate = new Date(dateStr);
    reportDate.setHours(0, 0, 0, 0);

    // Fetch report
    const report = await prisma.dailyReport.findUnique({
      where: {
        organizationId_reportDate: {
          organizationId: currentOrgId,
          reportDate,
        },
      },
    });

    if (!report) {
      // Return empty report if not found
      return NextResponse.json(
        {
          id: null,
          revenue: 0,
          conversionRate: 0,
          alerts: '[]',
          recommendations: '[]',
          channelMetrics: '{}',
          topPartners: '[]',
          smsOpenRate: 0,
          emailOpenRate: 0,
          day0Opened: 0,
          status: 'NOT_GENERATED',
        },
        { status: 200 }
      );
    }

    return NextResponse.json(report);
  } catch (err) {
    logger.error('[DailyReportAPI] Error', { err });
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}
