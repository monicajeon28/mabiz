/**
 * GET /api/analytics/reports
 *
 * Fetch report history with filtering
 * Query params: days (7/30/90, default 30), limit (default 50)
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getCurrentOrg } from '@/lib/auth-helpers';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get current org
    const org = await getCurrentOrg();
    if (!org) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Calculate date range
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Fetch reports
    const reports = await prisma.dailyReport.findMany({
      where: {
        organizationId: org.id,
        reportDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        reportDate: 'desc',
      },
      take: limit,
    });

    // Transform for frontend
    const transformed = reports.map((report) => {
      const alerts = JSON.parse(report.alerts || '[]');
      const topPartners = JSON.parse(report.topPartners || '[]');

      return {
        id: report.id,
        reportDate: report.reportDate,
        revenue: report.revenue,
        conversionRate: report.conversionRate,
        alertCount: alerts.length,
        topPartner: topPartners[0]?.name || null,
        topPartnerRevenue: topPartners[0]?.revenue || 0,
        status: report.status,
      };
    });

    return NextResponse.json(transformed);
  } catch (err) {
    logger.error('[ReportsAPI] Error', { err });
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
