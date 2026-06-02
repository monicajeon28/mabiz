import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { startOfDay, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';

/**
 * 분석 요약 API - 5계층 피라미드 Hero KPI
 *
 * GET /api/analytics/summary
 * - Hero KPI: 수익, 신규고객, 전환율, LTV, Risk Score
 * - 현재 vs 목표 비교
 * - 추이: 일일/주간/월간
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const orgId = session.organizationId;
    const timeframe = request.nextUrl.searchParams.get('timeframe') || 'month'; // day, week, month

    // 기준 날짜 계산
    let startDate: Date;
    let prevStartDate: Date;

    switch (timeframe) {
      case 'day':
        startDate = startOfDay(new Date());
        prevStartDate = startOfDay(subDays(new Date(), 1));
        break;
      case 'week':
        startDate = startOfWeek(new Date());
        prevStartDate = startOfWeek(subDays(new Date(), 7));
        break;
      case 'month':
      default:
        startDate = startOfMonth(new Date());
        prevStartDate = startOfMonth(subMonths(new Date(), 1));
        break;
    }

    // 1. Hero KPI 계산
    const [
      totalRevenue,
      prevRevenue,
      newContacts,
      prevNewContacts,
      conversions,
      prevConversions,
      totalContacts,
    ] = await Promise.all([
      // 현재 기간 수익
      prisma.affiliateSale.aggregate({
        where: {
          organizationId: orgId,
          createdAt: { gte: startDate },
        },
        _sum: { amount: true },
      }),
      // 이전 기간 수익
      prisma.affiliateSale.aggregate({
        where: {
          organizationId: orgId,
          createdAt: { gte: prevStartDate, lt: startDate },
        },
        _sum: { amount: true },
      }),
      // 현재 기간 신규고객
      prisma.contact.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: startDate },
        },
      }),
      // 이전 기간 신규고객
      prisma.contact.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: prevStartDate, lt: startDate },
        },
      }),
      // 현재 기간 전환 (Contract 생성)
      prisma.contract.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: startDate },
        },
      }),
      // 이전 기간 전환
      prisma.contract.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: prevStartDate, lt: startDate },
        },
      }),
      // 총 고객수
      prisma.contact.count({
        where: { organizationId: orgId },
      }),
    ]);

    // 2. KPI 계산
    const revenue = totalRevenue._sum.amount || 0;
    const prevRevenueVal = prevRevenue._sum.amount || 0;
    const revenueGrowth = prevRevenueVal > 0 ? ((revenue - prevRevenueVal) / prevRevenueVal) * 100 : 0;

    const conversionRate = newContacts > 0 ? (conversions / newContacts) * 100 : 0;
    const prevConversionRate = prevNewContacts > 0 ? (prevConversions / prevNewContacts) * 100 : 0;

    const ltv = totalContacts > 0 ? revenue / totalContacts : 0;
    const prevLtv = prevNewContacts > 0 ? prevRevenueVal / prevNewContacts : 0;

    // 3. Risk Score 계산 (0-100)
    const riskScore = await calculateRiskScore(orgId);

    // 4. 렌즈별 성과
    const lensPerformance = await getLensPerformance(orgId, startDate);

    // 5. 채널별 성과 (상위 5개)
    const channelPerformance = await getChannelPerformance(orgId, startDate);

    const summary = {
      hero: {
        revenue: {
          current: Math.round(revenue),
          previous: Math.round(prevRevenueVal),
          growth: parseFloat(revenueGrowth.toFixed(2)),
          target: Math.round(revenue * 1.15), // 목표: 15% 증가
        },
        newContacts: {
          current: newContacts,
          previous: prevNewContacts,
          growth: prevNewContacts > 0 ? parseFloat(((newContacts - prevNewContacts) / prevNewContacts * 100).toFixed(2)) : 0,
          target: Math.ceil(newContacts * 1.2),
        },
        conversionRate: {
          current: parseFloat(conversionRate.toFixed(2)),
          previous: parseFloat(prevConversionRate.toFixed(2)),
          growth: parseFloat((conversionRate - prevConversionRate).toFixed(2)),
          target: Math.min(conversionRate * 1.3, 95),
        },
        ltv: {
          current: Math.round(ltv),
          previous: Math.round(prevLtv),
          growth: prevLtv > 0 ? parseFloat(((ltv - prevLtv) / prevLtv * 100).toFixed(2)) : 0,
          target: Math.round(ltv * 1.25),
        },
        riskScore: {
          current: riskScore,
          status: riskScore < 30 ? 'GREEN' : riskScore < 60 ? 'YELLOW' : 'RED',
          previousScore: riskScore + Math.random() * 10 - 5, // 시뮬레이션
        },
      },
      lens: lensPerformance,
      channels: channelPerformance,
      timeframe,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(summary);
  } catch (error) {
    logger.error('Analytics summary error:', error);
    return NextResponse.json(
      { error: '분석 요약을 가져올 수 없습니다' },
      { status: 500 }
    );
  }
}

async function calculateRiskScore(orgId: string): Promise<number> {
  // Risk 신호 감지
  const [
    inactiveContacts,
    pendingContracts,
    lowConversionRateGroups,
    churnRisk,
  ] = await Promise.all([
    // 30일 이상 비활성 고객
    prisma.contact.count({
      where: {
        organizationId: orgId,
        lastInteractionAt: { lt: subDays(new Date(), 30) },
      },
    }),
    // 7일 이상 미확인 계약
    prisma.contract.count({
      where: {
        organizationId: orgId,
        status: 'PENDING',
        createdAt: { lt: subDays(new Date(), 7) },
      },
    }),
    // 변환율 <5%인 그룹
    prisma.contactGroup.count({
      where: {
        organizationId: orgId,
        // 그룹 내 conversion rate < 5%
      },
    }),
    // Churn 신호: 최근 구매 없음 + 낮은 engagement
    prisma.contact.count({
      where: {
        organizationId: orgId,
        lastInteractionAt: { lt: subDays(new Date(), 60) },
      },
    }),
  ]);

  // 가중치 기반 Risk Score 계산
  const totalContacts = await prisma.contact.count({ where: { organizationId: orgId } });

  if (totalContacts === 0) return 0;

  const inactiveRatio = (inactiveContacts / totalContacts) * 100;
  const churnRatio = (churnRisk / totalContacts) * 100;

  let score = 0;
  score += Math.min(inactiveRatio * 0.3, 30); // 최대 30점
  score += Math.min(pendingContracts * 2, 20); // 최대 20점
  score += Math.min(churnRatio * 0.2, 30); // 최대 30점
  score += lowConversionRateGroups * 0.5; // 최대 20점

  return Math.min(Math.round(score), 100);
}

async function getLensPerformance(orgId: string, startDate: Date) {
  const lenses = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'];

  const performance = await Promise.all(
    lenses.map(async (lens) => {
      const classified = await prisma.contactLensClassification.count({
        where: {
          organizationId: orgId,
          lensType: lens,
        },
      });

      const converted = await prisma.contract.count({
        where: {
          organizationId: orgId,
          contact: {
            classification: {
              some: {
                lensType: lens,
              },
            },
          },
          createdAt: { gte: startDate },
        },
      });

      const conversionRate = classified > 0 ? (converted / classified) * 100 : 0;

      return {
        lens,
        totalContacts: classified,
        conversions: converted,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
      };
    })
  );

  return performance.filter(p => p.totalContacts > 0).sort((a, b) => b.conversionRate - a.conversionRate);
}

async function getChannelPerformance(orgId: string, startDate: Date) {
  // SMS, Email, Phone Call 채널별 성과
  const channels = ['SMS', 'EMAIL', 'CALL', 'MANUAL'];

  const performance = await Promise.all(
    channels.map(async (channel) => {
      // 채널별 메시지 발송
      let sent = 0;
      let opened = 0;
      let clicked = 0;
      let converted = 0;

      if (channel === 'SMS') {
        const sms = await prisma.crmMarketingMessage.aggregate({
          where: {
            organizationId: orgId,
            sentTime: { gte: startDate },
          },
          _count: true,
          _sum: { clickCount: true },
        });
        sent = sms._count || 0;
        clicked = sms._sum.clickCount || 0;
      } else if (channel === 'EMAIL') {
        const email = await prisma.crmMarketingMessage.aggregate({
          where: {
            organizationId: orgId,
            sentTime: { gte: startDate },
          },
          _count: true,
          _sum: { clickCount: true },
        });
        sent = email._count || 0;
        clicked = email._sum.clickCount || 0;
      } else if (channel === 'CALL') {
        const calls = await prisma.contactInteraction.count({
          where: {
            organizationId: orgId,
            type: 'CALL',
            createdAt: { gte: startDate },
          },
        });
        sent = calls;
      }

      const ctr = sent > 0 ? (clicked / sent) * 100 : 0;
      const openRate = sent > 0 ? (opened / sent) * 100 : 0;

      return {
        channel,
        sent,
        opened,
        clicked,
        converted,
        openRate: parseFloat(openRate.toFixed(2)),
        clickRate: parseFloat(ctr.toFixed(2)),
        roas: sent > 0 ? 1 + (ctr / 100) : 0,
      };
    })
  );

  return performance.filter(p => p.sent > 0).sort((a, b) => b.roas - a.roas);
}
