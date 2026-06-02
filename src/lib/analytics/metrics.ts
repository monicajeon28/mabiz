import { prisma } from '@/lib/prisma';
import { startOfDay, startOfMonth, startOfWeek, subDays, subMonths } from 'date-fns';

/**
 * 분석 메트릭 계산 라이브러리
 *
 * 심리학 렌즈 기반 5계층 KPI:
 * 1. Hero KPI: 수익, 신규고객, 전환율, LTV, Risk Score
 * 2. 렌즈별 성과: L0-L10 전환율, LTV, 누적매출
 * 3. 채널별 성과: SMS, Email, Call ROAS 비교
 * 4. 위험도: Risk Score + 신호 감지
 * 5. 예측: Trending + 목표달성도
 */

export class AnalyticsMetrics {
  /**
   * 기본 KPI 계산 (현재 vs 이전 기간)
   */
  static async calculateHeroKPI(orgId: string, startDate: Date, prevStartDate: Date) {
    const [
      revenue,
      prevRevenue,
      newContacts,
      prevNewContacts,
      totalContacts,
      conversions,
      prevConversions,
    ] = await Promise.all([
      // 현재 기간 수익
      prisma.affiliateSale.aggregate({
        where: { organizationId: orgId, createdAt: { gte: startDate } },
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
        where: { organizationId: orgId, createdAt: { gte: startDate } },
      }),
      // 이전 기간 신규고객
      prisma.contact.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: prevStartDate, lt: startDate },
        },
      }),
      // 총 고객수
      prisma.contact.count({ where: { organizationId: orgId } }),
      // 현재 기간 전환
      prisma.contract.count({
        where: { organizationId: orgId, createdAt: { gte: startDate } },
      }),
      // 이전 기간 전환
      prisma.contract.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: prevStartDate, lt: startDate },
        },
      }),
    ]);

    const revenueVal = revenue._sum.amount || 0;
    const prevRevenueVal = prevRevenue._sum.amount || 0;
    const revenueGrowth =
      prevRevenueVal > 0 ? ((revenueVal - prevRevenueVal) / prevRevenueVal) * 100 : 0;

    const conversionRate = newContacts > 0 ? (conversions / newContacts) * 100 : 0;
    const prevConversionRate = prevNewContacts > 0 ? (prevConversions / prevNewContacts) * 100 : 0;

    const ltv = totalContacts > 0 ? revenueVal / totalContacts : 0;
    const prevLtv = prevNewContacts > 0 ? prevRevenueVal / prevNewContacts : 0;

    return {
      revenue: {
        current: Math.round(revenueVal),
        previous: Math.round(prevRevenueVal),
        growth: parseFloat(revenueGrowth.toFixed(2)),
        target: Math.round(revenueVal * 1.15),
      },
      newContacts: {
        current: newContacts,
        previous: prevNewContacts,
        growth:
          prevNewContacts > 0
            ? parseFloat(((newContacts - prevNewContacts) / prevNewContacts) * 100).toFixed(2))
            : 0,
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
        growth: prevLtv > 0 ? parseFloat(((ltv - prevLtv) / prevLtv) * 100).toFixed(2)) : 0,
        target: Math.round(ltv * 1.25),
      },
    };
  }

  /**
   * 렌즈별 성과 분석 (전환율, LTV, 누적매출)
   */
  static async analyzeLensPerformance(
    orgId: string,
    startDate: Date,
    limit: number = 10
  ) {
    const lenses = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'];

    const performance = await Promise.all(
      lenses.map(async (lens) => {
        const [classified, converted, revenue] = await Promise.all([
          // 렌즈 분류 고객수
          prisma.contactLensClassification.count({
            where: { organizationId: orgId, lensType: lens },
          }),
          // 렌즈별 전환수 (계약)
          prisma.contract.count({
            where: {
              organizationId: orgId,
              contact: {
                classification: { some: { lensType: lens } },
              },
              createdAt: { gte: startDate },
            },
          }),
          // 렌즈별 수익
          prisma.affiliateSale.aggregate({
            where: {
              organizationId: orgId,
              contact: {
                classification: { some: { lensType: lens } },
              },
            },
            _sum: { amount: true },
          }),
        ]);

        const conversionRate = classified > 0 ? (converted / classified) * 100 : 0;
        const lensLtv = classified > 0 ? (revenue._sum.amount || 0) / classified : 0;

        return {
          lens,
          totalContacts: classified,
          conversions: converted,
          conversionRate: parseFloat(conversionRate.toFixed(2)),
          revenue: revenue._sum.amount || 0,
          ltv: Math.round(lensLtv),
        };
      })
    );

    return performance
      .filter((p) => p.totalContacts > 0)
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, limit);
  }

  /**
   * 채널별 성과 (ROAS, CTR, 오픈율)
   */
  static async analyzeChannelPerformance(orgId: string, startDate: Date) {
    const channels = ['SMS', 'EMAIL', 'CALL'];

    const performance = await Promise.all(
      channels.map(async (channel) => {
        if (channel === 'SMS') {
          const sms = await prisma.crmMarketingMessage.aggregate({
            where: {
              organizationId: orgId,
              sentTime: { gte: startDate },
            },
            _count: true,
            _sum: { clickCount: true },
          });

          const sent = sms._count || 0;
          const clicked = sms._sum.clickCount || 0;
          const ctr = sent > 0 ? (clicked / sent) * 100 : 0;

          return {
            channel: 'SMS',
            sent,
            opened: 0,
            clicked,
            converted: 0,
            openRate: 0,
            clickRate: parseFloat(ctr.toFixed(2)),
            roas: sent > 0 ? 1 + ctr / 100 : 0,
          };
        } else if (channel === 'EMAIL') {
          const email = await prisma.crmMarketingMessage.aggregate({
            where: {
              organizationId: orgId,
              sentTime: { gte: startDate },
            },
            _count: true,
            _sum: { clickCount: true },
          });

          const sent = email._count || 0;
          const clicked = email._sum.clickCount || 0;
          const clickRate = sent > 0 ? (clicked / sent) * 100 : 0;

          return {
            channel: 'EMAIL',
            sent,
            opened: 0,
            clicked,
            converted: 0,
            openRate: 0,
            clickRate: parseFloat(clickRate.toFixed(2)),
            roas: sent > 0 ? 1 + clickRate / 100 : 0,
          };
        } else {
          const calls = await prisma.contactInteraction.count({
            where: {
              organizationId: orgId,
              type: 'CALL',
              createdAt: { gte: startDate },
            },
          });

          return {
            channel: 'CALL',
            sent: calls,
            opened: 0,
            clicked: 0,
            converted: 0,
            openRate: 0,
            clickRate: 0,
            roas: calls > 0 ? 1.5 : 0, // 기본 가정
          };
        }
      })
    );

    return performance.filter((p) => p.sent > 0).sort((a, b) => b.roas - a.roas);
  }

  /**
   * Risk Score 계산 (0-100)
   */
  static async calculateRiskScore(orgId: string): Promise<number> {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const sixtyDaysAgo = subDays(new Date(), 60);
    const sevenDaysAgo = subDays(new Date(), 7);

    const [inactiveContacts, pendingContracts, churnRisk, totalContacts] = await Promise.all([
      // 30일 이상 비활성
      prisma.contact.count({
        where: {
          organizationId: orgId,
          lastInteractionAt: { lt: thirtyDaysAgo },
        },
      }),
      // 7일 이상 미확인 계약
      prisma.contract.count({
        where: {
          organizationId: orgId,
          status: 'PENDING',
          createdAt: { lt: sevenDaysAgo },
        },
      }),
      // 60일 비활성 (Churn risk)
      prisma.contact.count({
        where: {
          organizationId: orgId,
          lastInteractionAt: { lt: sixtyDaysAgo },
        },
      }),
      // 총 고객
      prisma.contact.count({
        where: { organizationId: orgId },
      }),
    ]);

    if (totalContacts === 0) return 0;

    const inactiveRatio = (inactiveContacts / totalContacts) * 100;
    const churnRatio = (churnRisk / totalContacts) * 100;

    let score = 0;
    score += Math.min(inactiveRatio * 0.3, 30); // 최대 30점
    score += Math.min(pendingContracts * 2, 20); // 최대 20점
    score += Math.min(churnRatio * 0.2, 30); // 최대 30점
    score += Math.min((totalContacts - inactiveContacts) * -0.01, 20); // 보너스: 활성고객

    return Math.min(Math.round(Math.max(score, 0)), 100);
  }

  /**
   * 목표 달성도 계산
   */
  static calculateGoalProgress(current: number, target: number): number {
    if (target === 0) return 0;
    return parseFloat(((current / target) * 100).toFixed(1));
  }

  /**
   * 주간 트렌드 데이터
   */
  static async getWeeklyTrend(orgId: string, days: number = 7) {
    const dailyData = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = startOfDay(subDays(new Date(), i));
      const nextDate = subDays(new Date(), i - 1);

      const [revenue, newContacts, conversions] = await Promise.all([
        prisma.affiliateSale.aggregate({
          where: {
            organizationId: orgId,
            createdAt: { gte: date, lt: nextDate },
          },
          _sum: { amount: true },
        }),
        prisma.contact.count({
          where: {
            organizationId: orgId,
            createdAt: { gte: date, lt: nextDate },
          },
        }),
        prisma.contract.count({
          where: {
            organizationId: orgId,
            createdAt: { gte: date, lt: nextDate },
          },
        }),
      ]);

      dailyData.push({
        date: date.toISOString().split('T')[0],
        revenue: revenue._sum.amount || 0,
        newContacts,
        conversions,
      });
    }

    return dailyData;
  }
}
