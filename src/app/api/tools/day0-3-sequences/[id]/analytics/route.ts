/**
 * GET /api/tools/day0-3-sequences/[id]/analytics - Get sequence performance analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { AnalyticsResponse } from '@/lib/types/sequence';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organizationId = (session as any).user.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'Organization not found' },
        { status: 400 }
      );
    }

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '7d'; // 7d, 30d, all

    // Verify sequence exists
    const sequence = await prisma.smsSequenceTemplate.findUnique({
      where: { id: params.id }
    });

    if (!sequence || sequence.organizationId !== organizationId) {
      return NextResponse.json(
        { ok: false, error: 'Sequence not found' },
        { status: 404 }
      );
    }

    // For Phase 2, this will query actual SmsLog data
    // For now, return template data and mock analytics structure
    const emptyDayMetrics = {
      sent: 0,
      opened: 0,
      clicked: 0,
      converted: 0,
      openRate: '0%',
      clickRate: '0%',
      convertRate: '0%'
    };

    const analytics = {
      overallPerformance: {
        totalSent: sequence.totalSent,
        totalOpened: sequence.totalOpened,
        totalClicked: sequence.totalClicked,
        totalConverted: sequence.totalConverted,
        cumulativeOpenRate: calculateRate(sequence.totalOpened, sequence.totalSent),
        cumulativeClickRate: calculateRate(sequence.totalClicked, sequence.totalSent),
        cumulativeConvertRate: calculateRate(sequence.totalConverted, sequence.totalSent)
      },
      byDay: [
        { ...emptyDayMetrics, day: 0 },
        { ...emptyDayMetrics, day: 1 },
        { ...emptyDayMetrics, day: 2 },
        { ...emptyDayMetrics, day: 3 }
      ],
      variantPerformance: [] // Will be populated with variant data in Phase 2
    };

    const response: AnalyticsResponse = {
      ok: true,
      analytics
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[day0-3-sequences/:id/analytics] GET error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to get analytics' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Calculate percentage rate
 */
function calculateRate(numerator: number, denominator: number): string {
  if (denominator === 0) return '0%';
  const rate = (numerator / denominator) * 100;
  return `${rate.toFixed(2)}%`;
}
