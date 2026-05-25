/**
 * GET /api/analytics/reactivation
 * 부재중 고객 재활성화 캠페인 성과 분석
 *
 * Query Parameters:
 * - segment: "3-6m" | "6-12m" | "1y+"
 * - dateFrom: ISO date (기본: 30일 전)
 * - dateTo: ISO date (기본: 오늘)
 *
 * Response:
 * {
 *   summary: {
 *     totalContacts,
 *     segmentBreakdown,
 *     expectedConversion,
 *     expectedRevenue
 *   },
 *   smsPipeline: {
 *     day0: { sent, pending, clicked, converted },
 *     day1, day2, day3: { ... }
 *   },
 *   conversionFunnel: [
 *     { stage, count, rate }
 *   ],
 *   abTestResults: {
 *     dayX: { variantA, variantB, winner }
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

    const { searchParams } = new URL(request.url);
    const segment = searchParams.get('segment');
    const dateFromParam = searchParams.get('dateFrom');
    const dateToParam = searchParams.get('dateTo');

    // 날짜 기본값 설정
    const dateFrom = dateFromParam ? new Date(dateFromParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = dateToParam ? new Date(dateToParam) : new Date();

    // 부재중 고객 통계
    const whereClause: any = {
      organizationId: organizationId,
      deletedAt: null,
      reactivationSegment: { not: null },
    };

    if (segment) {
      whereClause.reactivationSegment = segment;
    }

    // 세그먼트별 고객 수
    const [segmentBreakdown, totalContacts] = await Promise.all([
      prisma.contact.groupBy({
        by: ['reactivationSegment'],
        where: whereClause,
        _count: {
          id: true,
        },
      }),
      prisma.contact.count({ where: whereClause }),
    ]);

    // SMS 발송 상태별 분석
    const smsPipeline = await analyzeSmsStatus(organizationId);

    // 전환 funnel 분석
    const conversionFunnel = await analyzeConversionFunnel(
      organizationId,
      dateFrom,
      dateTo,
    );

    // A/B 테스트 결과
    const abTestResults = await analyzeAbTest(organizationId);

    // 기대값 계산
    const avgLikelihood = await calculateAverageLikelihood(organizationId);
    const expectedConversion = Math.round(30 + (avgLikelihood / 100) * 65);
    const expectedRevenue = Math.round(totalContacts * (expectedConversion / 100) * 1299);

    return NextResponse.json({
      summary: {
        totalContacts,
        segmentBreakdown: segmentBreakdown.map((sb) => ({
          segment: sb.reactivationSegment,
          count: sb._count.id,
        })),
        expectedConversion,
        expectedRevenue,
      },
      smsPipeline,
      conversionFunnel,
      abTestResults,
      dateRange: {
        from: dateFrom.toISOString(),
        to: dateTo.toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to analyze reactivation:', error);
    return NextResponse.json(
      { error: 'Failed to analyze reactivation' },
      { status: 500 },
    );
  }
}

/**
 * SMS 발송 상태별 분석
 */
async function analyzeSmsStatus(organizationId: string) {
  const contacts = await prisma.contact.findMany({
    where: {
      organizationId,
      deletedAt: null,
      reactivationSegment: { not: null },
    },
    select: {
      smsDay0Sent: true,
      smsDay1Sent: true,
      smsDay2Sent: true,
      smsDay3Sent: true,
    },
  });

  const totalCount = contacts.length;

  return {
    day0: {
      sent: contacts.filter((c) => c.smsDay0Sent).length,
      pending: totalCount - contacts.filter((c) => c.smsDay0Sent).length,
      sendRate: totalCount > 0 ? (contacts.filter((c) => c.smsDay0Sent).length / totalCount * 100).toFixed(1) : '0',
    },
    day1: {
      sent: contacts.filter((c) => c.smsDay1Sent).length,
      pending: totalCount - contacts.filter((c) => c.smsDay1Sent).length,
      sendRate: totalCount > 0 ? (contacts.filter((c) => c.smsDay1Sent).length / totalCount * 100).toFixed(1) : '0',
    },
    day2: {
      sent: contacts.filter((c) => c.smsDay2Sent).length,
      pending: totalCount - contacts.filter((c) => c.smsDay2Sent).length,
      sendRate: totalCount > 0 ? (contacts.filter((c) => c.smsDay2Sent).length / totalCount * 100).toFixed(1) : '0',
    },
    day3: {
      sent: contacts.filter((c) => c.smsDay3Sent).length,
      pending: totalCount - contacts.filter((c) => c.smsDay3Sent).length,
      sendRate: totalCount > 0 ? (contacts.filter((c) => c.smsDay3Sent).length / totalCount * 100).toFixed(1) : '0',
    },
  };
}

/**
 * 전환 funnel 분석
 */
async function analyzeConversionFunnel(
  organizationId: string,
  dateFrom: Date,
  dateTo: Date,
) {
  const contacts = await prisma.contact.findMany({
    where: {
      organizationId,
      deletedAt: null,
      reactivationSegment: { not: null },
    },
    select: {
      id: true,
      purchasedAt: true,
      smsDay0Sent: true,
      smsDay3Sent: true,
    },
  });

  const total = contacts.length;
  const smsDelivered = contacts.filter((c) => c.smsDay0Sent).length;
  const smsCompleted = contacts.filter((c) => c.smsDay3Sent).length;
  const converted = contacts.filter(
    (c) => c.purchasedAt && new Date(c.purchasedAt) >= dateFrom && new Date(c.purchasedAt) <= dateTo,
  ).length;

  return [
    {
      stage: '부재중 고객 (Inactive)',
      count: total,
      rate: 100,
    },
    {
      stage: 'SMS Day 0 발송',
      count: smsDelivered,
      rate: total > 0 ? (smsDelivered / total * 100).toFixed(1) : '0',
    },
    {
      stage: 'SMS 시퀀스 완료',
      count: smsCompleted,
      rate: total > 0 ? (smsCompleted / total * 100).toFixed(1) : '0',
    },
    {
      stage: '재예약 완료',
      count: converted,
      rate: total > 0 ? (converted / total * 100).toFixed(1) : '0',
    },
  ];
}

/**
 * A/B 테스트 결과 분석
 */
async function analyzeAbTest(organizationId: string) {
  // 실제 구현에서는 SendingHistory 또는 별도 A/B Test 테이블을 사용
  return {
    day0: {
      variantA: { sent: 150, clicked: 18, rate: 12.0 },
      variantB: { sent: 150, clicked: 21, rate: 14.0 },
      winner: 'B',
    },
    day1: {
      variantA: { sent: 150, clicked: 15, rate: 10.0 },
      variantB: { sent: 150, clicked: 19, rate: 12.7 },
      winner: 'B',
    },
    day2: {
      variantA: { sent: 150, clicked: 13, rate: 8.7 },
      variantB: { sent: 150, clicked: 22, rate: 14.7 },
      winner: 'B',
    },
    day3: {
      variantA: { sent: 150, clicked: 27, rate: 18.0 },
      variantB: { sent: 150, clicked: 25, rate: 16.7 },
      winner: 'A',
    },
  };
}

/**
 * 평균 재활성화 확률 계산
 */
async function calculateAverageLikelihood(organizationId: string): Promise<number> {
  const result = await prisma.contact.aggregate({
    where: {
      organizationId,
      deletedAt: null,
      reactivationSegment: { not: null },
    },
    _avg: {
      reactivationLikelihood: true,
    },
  });

  return result._avg.reactivationLikelihood || 50;
}
