import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { subDays, subMonths } from 'date-fns';

/**
 * 실시간 채널 최적화 API (Thompson Sampling 대시보드)
 *
 * GET /api/analytics/optimization
 *
 * 소비처: src/app/(dashboard)/analytics/optimization/page.tsx
 * 반환 shape (page가 기대하는 flat object):
 * {
 *   ok: true,
 *   currentAllocation: { SMS, KAKAO, EMAIL },           // %
 *   lastUpdateAt, nextUpdateAt,                          // ISO string → page에서 new Date()
 *   confidence,                                          // %
 *   banditStats: { SMS|KAKAO|EMAIL: { successes, failures, successRate } },
 *   recommendations: string[],
 *   abTestResults: Array<{ variant, channel, conversionRate, winner? }>,
 *   projectedImpact: { monthlyRevenue, revenueIncrease, expectedCPA, cpaSavings },
 * }
 *
 * 데이터 소스(실제 모델만 집계):
 *  - AdminMessage.messageType(sms/kakao/email) + totalSent/successCount → 채널 통계
 *  - CrmMarketingMessage.variant + status → A/B 테스트 전환율
 *  - AffiliateSale.commissionAmount → 예상 효과(월 수익/CPA)
 *
 * 산출 불가한 고급 지표는 실제 데이터 기반 안전한 기본값(0/빈배열)으로 채움.
 * 데이터가 전혀 없어도 ok:true (에러 아님).
 */

type ChannelKey = 'SMS' | 'KAKAO' | 'EMAIL';

const CHANNELS: ChannelKey[] = ['SMS', 'KAKAO', 'EMAIL'];

// AdminMessage.messageType("sms"|"kakao"|"email") → 채널 키 매핑
function mapMessageTypeToChannel(messageType: string): ChannelKey | null {
  const t = (messageType || '').toLowerCase();
  if (t.includes('sms')) return 'SMS';
  if (t.includes('kakao')) return 'KAKAO';
  if (t.includes('email') || t.includes('mail')) return 'EMAIL';
  return null;
}

export async function GET(_request: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const orgId = session.organizationId;
    const now = new Date();
    const windowStart = subDays(now, 30); // 최근 30일 성과 기준
    const monthStart = subMonths(now, 1);

    // 1. 채널별 발송/성공 집계 (AdminMessage.messageType 기준)
    const adminMessages = await prisma.adminMessage.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: windowStart },
      },
      select: {
        messageType: true,
        totalSent: true,
        successCount: true,
      },
    });

    // 채널별 성공/실패 누적
    const channelAgg: Record<ChannelKey, { successes: number; failures: number }> = {
      SMS: { successes: 0, failures: 0 },
      KAKAO: { successes: 0, failures: 0 },
      EMAIL: { successes: 0, failures: 0 },
    };

    for (const m of adminMessages) {
      const ch = mapMessageTypeToChannel(m.messageType);
      if (!ch) continue;
      const sent = m.totalSent ?? 0;
      const success = m.successCount ?? 0;
      const fail = Math.max(sent - success, 0);
      channelAgg[ch].successes += success;
      channelAgg[ch].failures += fail;
    }

    // banditStats: 실제 성공/실패 + 성공률 (시도 0이면 0)
    const banditStats: Record<
      ChannelKey,
      { successes: number; failures: number; successRate: number }
    > = {
      SMS: buildBanditStat(channelAgg.SMS),
      KAKAO: buildBanditStat(channelAgg.KAKAO),
      EMAIL: buildBanditStat(channelAgg.EMAIL),
    };

    // currentAllocation: 성공 건수 비율로 정수 % 배분 (합계 100), 데이터 없으면 0
    const successByChannel: Record<ChannelKey, number> = {
      SMS: banditStats.SMS.successes,
      KAKAO: banditStats.KAKAO.successes,
      EMAIL: banditStats.EMAIL.successes,
    };
    const currentAllocation = computeAllocation(successByChannel);

    // confidence: 총 시도량 기반 신뢰도 (표본이 많을수록 높음, 0~95 캡)
    const totalTrials = CHANNELS.reduce(
      (sum, ch) => sum + banditStats[ch].successes + banditStats[ch].failures,
      0
    );
    // 200건 도달 시 95% 신뢰 (선형 캡). 표본 0이면 0.
    const confidence = Math.min(Math.round((totalTrials / 200) * 95), 95);

    // 2. A/B 테스트 결과 (CrmMarketingMessage.variant + status)
    const abTestResults = await buildAbTestResults(orgId, windowStart);

    // 3. 추천사항 (실제 banditStats 기반 동적 도출)
    const recommendations = buildRecommendations(banditStats, currentAllocation);

    // 4. 예상 효과 (AffiliateSale 실제 매출 + 신뢰도 계수)
    const projectedImpact = await buildProjectedImpact(
      orgId,
      monthStart,
      confidence
    );

    // 업데이트 시각 (30분 주기 가정)
    const lastUpdateAt = now.toISOString();
    const nextUpdateAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    return NextResponse.json({
      ok: true,
      currentAllocation,
      lastUpdateAt,
      nextUpdateAt,
      confidence,
      banditStats,
      recommendations,
      abTestResults,
      projectedImpact,
    });
  } catch (error) {
    logger.error('Analytics optimization error:', error as object);
    return NextResponse.json(
      { ok: false, message: '최적화 데이터를 가져올 수 없습니다' },
      { status: 500 }
    );
  }
}

function buildBanditStat(agg: { successes: number; failures: number }) {
  const total = agg.successes + agg.failures;
  const successRate = total > 0 ? agg.successes / total : 0;
  return {
    successes: agg.successes,
    failures: agg.failures,
    successRate: parseFloat(successRate.toFixed(3)),
  };
}

/**
 * 성공 건수 비율로 정수 % 배분. 합계가 정확히 100이 되도록 최대 채널에 잔여 보정.
 * 데이터가 전혀 없으면 모두 0 반환 (더미 배분 금지).
 */
function computeAllocation(
  successByChannel: Record<ChannelKey, number>
): Record<ChannelKey, number> {
  const total = CHANNELS.reduce((s, ch) => s + successByChannel[ch], 0);
  if (total <= 0) {
    return { SMS: 0, KAKAO: 0, EMAIL: 0 };
  }

  const raw: Record<ChannelKey, number> = {
    SMS: (successByChannel.SMS / total) * 100,
    KAKAO: (successByChannel.KAKAO / total) * 100,
    EMAIL: (successByChannel.EMAIL / total) * 100,
  };

  const floored: Record<ChannelKey, number> = {
    SMS: Math.floor(raw.SMS),
    KAKAO: Math.floor(raw.KAKAO),
    EMAIL: Math.floor(raw.EMAIL),
  };

  // 잔여(rounding remainder) 합계를 최대 소수부 채널에 분배해 합 100 보정
  let remainder = 100 - (floored.SMS + floored.KAKAO + floored.EMAIL);
  const byFraction = [...CHANNELS].sort(
    (a, b) => raw[b] - floored[b] - (raw[a] - floored[a])
  );
  for (let i = 0; i < byFraction.length && remainder > 0; i++) {
    floored[byFraction[i]] += 1;
    remainder -= 1;
  }

  return floored;
}

/**
 * A/B 테스트 결과: CrmMarketingMessage를 variant별로 집계.
 * 각 variant의 전환율 = converted / sent. 채널은 CrmMarketingMessage에 별도
 * 필드가 없어 SMS로 표기(이 모델의 발송 경로). variant 그룹 내 최고 전환율 = winner.
 * 데이터 없으면 빈 배열.
 */
async function buildAbTestResults(orgId: string, windowStart: Date) {
  const grouped = await prisma.crmMarketingMessage.groupBy({
    by: ['variant', 'status'],
    where: {
      organizationId: orgId,
      sentTime: { gte: windowStart },
    },
    _count: { _all: true },
  });

  if (grouped.length === 0) return [];

  // variant별 sent/converted 집계
  const perVariant = new Map<string, { sent: number; converted: number }>();
  for (const row of grouped) {
    const variant = row.variant || 'default';
    const cur = perVariant.get(variant) || { sent: 0, converted: 0 };
    const count = row._count._all;
    // sent 이상의 모든 상태는 발송된 것으로 간주
    cur.sent += count;
    if ((row.status || '').toLowerCase() === 'converted') {
      cur.converted += count;
    }
    perVariant.set(variant, cur);
  }

  const results = Array.from(perVariant.entries()).map(([variant, v]) => {
    const conversionRate = v.sent > 0 ? (v.converted / v.sent) * 100 : 0;
    return {
      variant,
      channel: 'SMS' as ChannelKey,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
    };
  });

  // 최고 전환율 winner 표시
  const maxRate = Math.max(...results.map((r) => r.conversionRate));
  return results.map((r) => ({
    ...r,
    winner: maxRate > 0 && r.conversionRate === maxRate ? true : undefined,
  }));
}

/**
 * 실제 banditStats 기반 동적 추천. 데이터 없으면 안내 1건만 반환.
 */
function buildRecommendations(
  banditStats: Record<
    ChannelKey,
    { successes: number; failures: number; successRate: number }
  >,
  allocation: Record<ChannelKey, number>
): string[] {
  const recs: string[] = [];
  const labels: Record<ChannelKey, string> = {
    SMS: 'SMS',
    KAKAO: '카카오',
    EMAIL: '이메일',
  };

  const active = CHANNELS.filter(
    (ch) => banditStats[ch].successes + banditStats[ch].failures > 0
  );

  if (active.length === 0) {
    return ['발송 데이터가 누적되면 채널별 최적화 추천이 표시됩니다.'];
  }

  // 최고 성공률 채널 → 할당 증대 추천
  const best = active.reduce((a, b) =>
    banditStats[b].successRate > banditStats[a].successRate ? b : a
  );
  recs.push(
    `${labels[best]} 성공률 ${(banditStats[best].successRate * 100).toFixed(1)}% 최고 → 할당 비중 확대 추천 (현재 ${allocation[best]}%)`
  );

  // 최저 성공률 채널 → 점검 추천 (2개 이상일 때만)
  if (active.length >= 2) {
    const worst = active.reduce((a, b) =>
      banditStats[b].successRate < banditStats[a].successRate ? b : a
    );
    if (worst !== best) {
      recs.push(
        `${labels[worst]} 성공률 ${(banditStats[worst].successRate * 100).toFixed(1)}% 최저 → 콘텐츠/발송시간 점검 필요`
      );
    }
  }

  // 미사용 채널 안내
  const inactive = CHANNELS.filter((ch) => !active.includes(ch));
  if (inactive.length > 0) {
    recs.push(
      `${inactive.map((ch) => labels[ch]).join(', ')} 채널 미발송 → 테스트 발송으로 비교군 확보 권장`
    );
  }

  return recs;
}

/**
 * 예상 효과: 최근 1개월 AffiliateSale 수당 합계를 월 수익으로 사용.
 * 증가분 = 신뢰도 계수(최대 15%). CPA = 수익 / 전환 건수(없으면 0).
 * 데이터 없으면 모두 0.
 */
async function buildProjectedImpact(
  orgId: string,
  monthStart: Date,
  confidence: number
) {
  const [revenueAgg, conversions] = await Promise.all([
    prisma.affiliateSale.aggregate({
      where: {
        organizationId: orgId,
        createdAt: { gte: monthStart },
      },
      _sum: { commissionAmount: true },
    }),
    prisma.contractInstance.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: monthStart },
      },
    }),
  ]);

  const monthlyRevenue = Math.round(revenueAgg._sum.commissionAmount || 0);

  // 증가율 = 신뢰도에 비례 (최대 15%). 신뢰도 0이면 0.
  const increaseRate = (confidence / 100) * 0.15;
  const revenueIncrease = Math.round(monthlyRevenue * increaseRate);

  // CPA = 월 수익 / 전환 건수 (전환 0이면 0)
  const expectedCPA = conversions > 0 ? Math.round(monthlyRevenue / conversions) : 0;
  // CPA 절감 = 증가율 비례 (최대 15%)
  const cpaSavings = Math.round(expectedCPA * increaseRate);

  return {
    monthlyRevenue,
    revenueIncrease,
    expectedCPA,
    cpaSavings,
  };
}
