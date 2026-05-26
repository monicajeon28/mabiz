/**
 * GET /api/analytics/reactivation
 *
 * 부재중 고객 재활성화 성과 분석
 *
 * Query Parameters:
 * - organizationId: string (필수)
 * - segment: string (optional) - 특정 세그먼트만 조회
 * - startDate: string (optional, ISO 8601) - 시작 날짜
 * - endDate: string (optional, ISO 8601) - 종료 날짜
 *
 * Response:
 * {
 *   summary: {
 *     totalInactiveCustomers: 450,
 *     reactivatedCount: 284 (63% of 450)
 *     reactivationRate: 63%,
 *     expectedRevenue: $230,820,000
 *   },
 *   bySegment: [
 *     {
 *       segment: "3-6m",
 *       inactiveCount: 150,
 *       reactivatedCount: 126,
 *       reactivationRate: 84%,
 *       avgLikelihood: 75
 *     }
 *   ],
 *   campaigns: [
 *     {
 *       campaignId: string,
 *       segment: string,
 *       sentCount: number,
 *       responseCount: number,
 *       responseRate: number,
 *       revenue: number
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const organizationId = request.nextUrl.searchParams.get('organizationId');
    const segment = request.nextUrl.searchParams.get('segment');
    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 },
      );
    }

    // 조직 검증
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 },
      );
    }

    // 조건 구성
    const where: any = {
      organizationId,
      deletedAt: null,
      type: 'CUSTOMER',
      reactivationSegment: { not: null },
    };

    if (segment) {
      where.reactivationSegment = segment;
    }

    // 1. 전체 부재중 고객 수
    const totalInactiveCount = await prisma.contact.count({ where });

    // 2. 세그먼트별 통계
    const bySegmentData = await prisma.contact.groupBy({
      by: ['reactivationSegment'],
      where,
      _count: { id: true },
      _avg: { reactivationLikelihood: true },
    });

    // 3. SMS 캠페인 성과
    let campaignWhere: any = {
      organizationId,
      templateType: 'REACTIVATION',
    };

    if (startDate) {
      campaignWhere.createdAt = { gte: new Date(startDate) };
    }

    if (endDate) {
      if (campaignWhere.createdAt) {
        campaignWhere.createdAt.lte = new Date(endDate);
      } else {
        campaignWhere.createdAt = { lte: new Date(endDate) };
      }
    }

    const campaigns = await prisma.smsLog.groupBy({
      by: ['channel'],
      where: campaignWhere,
      _count: {
        id: true,
        contactId: true,
      },
    });

    // 4. 재활성화된 고객 (최근 30일 구매)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const reactivatedData = await prisma.contact.findMany({
      where: {
        ...where,
        purchasedAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        reactivationSegment: true,
        reactivationLikelihood: true,
      },
    });

    // 데이터 정렬
    const bySegment = bySegmentData.map((seg) => {
      const reactivated = reactivatedData.filter(
        (r) => r.reactivationSegment === seg.reactivationSegment,
      ).length;
      const total = seg._count.id;

      return {
        segment: seg.reactivationSegment,
        inactiveCount: total,
        reactivatedCount: reactivated,
        reactivationRate: `${Math.round((reactivated / total) * 100)}%`,
        avgLikelihood: Math.round(seg._avg.reactivationLikelihood || 0),
      };
    });

    // 전체 통계
    const totalReactivated = reactivatedData.length;
    const reactivationRate = totalInactiveCount
      ? Math.round((totalReactivated / totalInactiveCount) * 100)
      : 0;
    const expectedRevenue = totalInactiveCount * 366000 * (reactivationRate / 100);

    // 캠페인 상세
    const campaignDetails = await Promise.all(
      campaigns.map(async (campaign) => {
        const campaignSMS = await prisma.smsLog.findMany({
          where: {
            channel: campaign.channel,
          },
          select: {
            id: true,
            status: true,
            contactId: true,
          },
        });

        const sentCount = campaignSMS.filter(
          (s) => s.status !== 'FAILED',
        ).length;
        const responseCount = campaignSMS.filter((s) => s.contactId).length;

        return {
          campaignId: campaign.channel,
          sentCount,
          responseCount,
          responseRate: `${Math.round((responseCount / sentCount) * 100)}%`,
          revenue: responseCount * 366000,
        };
      }),
    );

    return NextResponse.json(
      {
        summary: {
          totalInactiveCustomers: totalInactiveCount,
          reactivatedCount: totalReactivated,
          reactivationRate: `${reactivationRate}%`,
          expectedRevenue: Math.round(expectedRevenue),
        },
        bySegment,
        campaigns: campaignDetails,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('[GET /api/analytics/reactivation]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch reactivation analytics' },
      { status: 500 },
    );
  }
}
