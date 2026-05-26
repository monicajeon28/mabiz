/**
 * GET /api/sms-ab-tests/{id}/timeline
 * Get day-by-day metrics for chart visualization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await getAuthContext();
    let orgId: string;

    if (ctx.organizationId) {
      orgId = ctx.organizationId;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ error: 'No organization' }, { status: 400 });
      orgId = firstOrg.id;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const testId = params.id;
    if (!testId) {
      return NextResponse.json({ error: 'Test ID required' }, { status: 400 });
    }

    // Verify test ownership
    const test = await prisma.smsABTest.findUnique({
      where: { id: testId },
      select: { organizationId: true },
    });

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    if (test.organizationId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch timeline snapshots
    const timelines = await prisma.smsABTestTimeline.findMany({
      where: { abTestId: testId },
      select: {
        snapshotDate: true,
        dayNumber: true,
        groupA_sent: true,
        groupA_opened: true,
        groupA_clicked: true,
        groupA_converted: true,
        groupA_rate: true,
        groupB_sent: true,
        groupB_opened: true,
        groupB_clicked: true,
        groupB_converted: true,
        groupB_rate: true,
        pValue: true,
        isSignificant: true,
        recommendation: true,
      },
      orderBy: { snapshotDate: 'asc' },
    });

    if (timelines.length === 0) {
      // If no timeline data, return empty array
      return NextResponse.json({ data: [] });
    }

    // Transform to readable format
    const data = timelines.map((t) => ({
      date: t.snapshotDate.toISOString().split('T')[0],
      day: t.dayNumber,
      groupA: {
        sent: t.groupA_sent,
        opened: t.groupA_opened,
        clicked: t.groupA_clicked,
        converted: t.groupA_converted,
        rate: t.groupA_rate,
      },
      groupB: {
        sent: t.groupB_sent,
        opened: t.groupB_opened,
        clicked: t.groupB_clicked,
        converted: t.groupB_converted,
        rate: t.groupB_rate,
      },
      statistics: {
        pValue: t.pValue,
        isSignificant: t.isSignificant,
      },
      recommendation: t.recommendation,
    }));

    logger.log('[ABTest] Timeline retrieved', { orgId, testId, days: data.length });

    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[ABTest] Timeline failed', { err });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
