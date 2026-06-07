/**
 * GET /api/partners/metrics/[id]
 *
 * Get individual partner metrics including:
 * - Sales count (day/week/month)
 * - Commission earned
 * - Performance tier
 * - Risk score
 * - Comparison with previous periods
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getDailyMetrics } from '@/lib/services/partner-analytics-service';
import { calculateChurnRisk } from '@/lib/services/partner-churn-detector';
import { getMabizSession } from '@/lib/auth';

interface MetricsResponse {
  partner: {
    id: string;
    name: string;
    email: string;
    tier: string;
    status: string;
  };
  analytics: {
    dailyMetrics: any;
    riskScore: any;
  };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = params.id;

    // Verify partner exists
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        name: true,
        email: true,
        incomeLevel: true,
        status: true,
      },
    });

    if (!partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Get daily metrics
    const dailyMetrics = await getDailyMetrics(partnerId);

    // Get risk score
    const riskScore = await calculateChurnRisk(partnerId);

    const response: MetricsResponse = {
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email || '',
        tier: partner.incomeLevel || 'Tier4',
        status: partner.status,
      },
      analytics: {
        dailyMetrics,
        riskScore: {
          score: riskScore.score,
          level: riskScore.riskLevel,
          breakdown: riskScore.breakdown,
          previousLevel: riskScore.previousLevel,
          changedLevel: riskScore.changedLevel,
        },
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    logger.error('Error fetching partner metrics', { err });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
