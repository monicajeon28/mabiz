/**
 * GET /api/partners/analytics/summary
 *
 * Get organization-wide partner analytics:
 * - Top 10 partners by commission
 * - Tier distribution
 * - Risk distribution
 * - Onboarding status
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';
import { getTopPartners } from '@/lib/services/partner-analytics-service';
import { getTierSummary } from '@/lib/services/partner-tier-service';

interface SummaryResponse {
  organization: {
    id: string;
    name: string;
  };
  topPartners: Array<{
    rank: number;
    id: string;
    name: string;
    commission: number;
    sales: number;
    tier: string;
  }>;
  tierDistribution: {
    Tier1: { count: number; commission: number; percentage: number };
    Tier2: { count: number; commission: number; percentage: number };
    Tier3: { count: number; commission: number; percentage: number };
    Tier4: { count: number; commission: number; percentage: number };
    total: number;
  };
  riskDistribution: {
    GREEN: number;
    YELLOW: number;
    RED: number;
  };
  onboardingStatus: {
    active: number;
    completed: number;
    failed: number;
  };
}

export async function GET(request: Request) {
  try {
    // 인증 체크: GLOBAL_ADMIN 또는 OWNER만 접근 허용
    const ctx = await getAuthContext().catch(() => null);
    if (!ctx?.userId) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    // GLOBAL_ADMIN: query param, OWNER: 세션 org 고정
    const searchParams = new URL(request.url).searchParams;
    const organizationId = ctx.role === 'GLOBAL_ADMIN'
      ? (searchParams.get('organizationId') ?? ctx.organizationId)
      : ctx.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Verify organization exists
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get top partners
    const topPartnersData = await getTopPartners(organizationId, 10);
    const topPartners = topPartnersData.map((p) => ({
      rank: p.rank,
      id: p.partner.id,
      name: p.partner.name,
      commission: Number(p.commission),
      sales: p.salesCount,
      tier: p.partner.incomeLevel || 'Tier4',
    }));

    // Get tier distribution
    const tierSummary = await getTierSummary(organizationId);

    // Get risk distribution
    const riskCounts = await prisma.partnerRiskFlags.groupBy({
      by: ['partnerId'],
      where: {
        partner: {
          organizationId,
          status: 'ACTIVE',
        },
      },
      _sum: {
        totalRiskScore: true,
      },
    });

    // Count by risk level
    const riskDistribution = {
      GREEN: 0,
      YELLOW: 0,
      RED: 0,
    };

    const allRisks = await prisma.partnerRiskFlags.findMany({
      where: {
        partner: {
          organizationId,
          status: 'ACTIVE',
        },
      },
      select: { totalRiskScore: true },
    });

    allRisks.forEach((r) => {
      if (r.totalRiskScore <= 3) riskDistribution.GREEN++;
      else if (r.totalRiskScore <= 6) riskDistribution.YELLOW++;
      else riskDistribution.RED++;
    });

    // Get onboarding status
    const onboardingStatus = {
      active: await prisma.partner.count({
        where: {
          organizationId,
          onboardingStatus: 'IN_PROGRESS',
        },
      }),
      completed: await prisma.partner.count({
        where: {
          organizationId,
          onboardingStatus: 'COMPLETED',
        },
      }),
      failed: await prisma.partner.count({
        where: {
          organizationId,
          onboardingStatus: 'FAILED',
        },
      }),
    };

    const response: SummaryResponse = {
      organization: {
        id: org.id,
        name: org.name,
      },
      topPartners,
      tierDistribution: {
        Tier1: {
          count: tierSummary.Tier1.count,
          commission: tierSummary.Tier1.commission,
          percentage: tierSummary.Tier1.percentage,
        },
        Tier2: {
          count: tierSummary.Tier2.count,
          commission: tierSummary.Tier2.commission,
          percentage: tierSummary.Tier2.percentage,
        },
        Tier3: {
          count: tierSummary.Tier3.count,
          commission: tierSummary.Tier3.commission,
          percentage: tierSummary.Tier3.percentage,
        },
        Tier4: {
          count: tierSummary.Tier4.count,
          commission: tierSummary.Tier4.commission,
          percentage: tierSummary.Tier4.percentage,
        },
        total: tierSummary.totalPartners,
      },
      riskDistribution,
      onboardingStatus,
    };

    return NextResponse.json(response);
  } catch (err) {
    logger.error('Error fetching partner analytics summary', { err });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
