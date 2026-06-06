import { NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { subDays } from 'date-fns';
import type { MessageChannel } from '@/lib/types/multi-channel';

/**
 * 채널 성과 분석 API
 *
 * GET /api/analytics/channels
 * - SMS / KAKAO / EMAIL 채널별 발송·개방·클릭·전환·비용 실측 집계
 * - 30일 현재 기간 vs 직전 30일 기간 추세 비교
 * - 최고 성과 채널 + 최적화 추천사항 산출
 *
 * 데이터 소스 (실측):
 * - SMS   = SmsLog (channel != 'KAKAO')
 * - KAKAO = SmsLog (channel == 'KAKAO')   ← kakao-service / blast-kakao 가 SmsLog 에 기록
 * - EMAIL = EmailLog
 *
 * 응답 필드는 src/app/(dashboard)/analytics/channels/page.tsx 의
 * DashboardData (channels / bestPerformer / recommendations / periodStart / periodEnd) 와 정확히 일치.
 */

interface ChannelStats {
  channel: MessageChannel;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  failed: number;
  cost: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  roi: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  trendPercent: number;
}

const FAILED_STATUSES = ['FAILED', 'failed', 'BLOCKED', 'blocked', 'ERROR', 'error'];

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? parseFloat(((numerator / denominator) * 100).toFixed(2)) : 0;
}

/**
 * 직전 기간 대비 전환율 변화로 추세 산출.
 * 직전 기간 데이터가 없으면 STABLE 0%.
 */
function computeTrend(
  currentConvRate: number,
  prevConvRate: number,
): { trend: 'UP' | 'DOWN' | 'STABLE'; trendPercent: number } {
  if (prevConvRate <= 0) {
    return { trend: 'STABLE', trendPercent: 0 };
  }
  const delta = ((currentConvRate - prevConvRate) / prevConvRate) * 100;
  const trendPercent = parseFloat(Math.abs(delta).toFixed(1));
  if (delta > 1) return { trend: 'UP', trendPercent };
  if (delta < -1) return { trend: 'DOWN', trendPercent };
  return { trend: 'STABLE', trendPercent };
}

/** 현재 기간 SMS/KAKAO 집계 (SmsLog) */
async function aggregateSmsLog(
  orgId: string,
  isKakao: boolean,
  start: Date,
  end: Date,
) {
  const channelFilter = isKakao
    ? { equals: 'KAKAO' }
    : { not: 'KAKAO' };

  const where = {
    organizationId: orgId,
    sentAt: { gte: start, lt: end },
    channel: channelFilter,
  };

  const [sent, failed, opened, clicked, converted, costAgg] = await Promise.all([
    prisma.smsLog.count({ where }),
    prisma.smsLog.count({ where: { ...where, status: { in: FAILED_STATUSES } } }),
    prisma.smsLog.count({ where: { ...where, openedAt: { not: null } } }),
    prisma.smsLog.count({ where: { ...where, clickedAt: { not: null } } }),
    prisma.smsLog.count({ where: { ...where, convertedAt: { not: null } } }),
    prisma.smsLog.aggregate({ where, _sum: { cost: true } }),
  ]);

  return {
    sent,
    failed,
    opened,
    clicked,
    converted,
    cost: costAgg._sum.cost ?? 0,
  };
}

/** 현재 기간 EMAIL 집계 (EmailLog) — 개방/클릭/비용 컬럼 없음 → 0 */
async function aggregateEmailLog(orgId: string, start: Date, end: Date) {
  const where = {
    organizationId: orgId,
    sentAt: { gte: start, lt: end },
  };

  const [sent, failed] = await Promise.all([
    prisma.emailLog.count({ where }),
    prisma.emailLog.count({ where: { ...where, status: { in: FAILED_STATUSES } } }),
  ]);

  return { sent, failed, opened: 0, clicked: 0, converted: 0, cost: 0 };
}

type RawAgg = {
  sent: number;
  failed: number;
  opened: number;
  clicked: number;
  converted: number;
  cost: number;
};

async function collectChannel(
  channel: MessageChannel,
  orgId: string,
  start: Date,
  end: Date,
): Promise<RawAgg> {
  if (channel === 'EMAIL') return aggregateEmailLog(orgId, start, end);
  return aggregateSmsLog(orgId, channel === 'KAKAO', start, end);
}

function buildStats(channel: MessageChannel, cur: RawAgg, prev: RawAgg): ChannelStats {
  const openRate = rate(cur.opened, cur.sent);
  const clickRate = rate(cur.clicked, cur.sent);
  const conversionRate = rate(cur.converted, cur.sent);
  const prevConversionRate = rate(prev.converted, prev.sent);

  // ROI: 전환당 가치(예: 전환 1건 = 평균 마진 추정 불가하므로
  // 비용 대비 전환 효율을 비용효율 지표로 환산). 비용이 0이면 전환 발생만으로 효율 측정.
  // 실측 데이터만 사용: roi = converted / (cost in 원). cost 는 SmsLog 의 원 단위 정수.
  const roi = cur.cost > 0
    ? parseFloat((cur.converted / cur.cost).toFixed(4))
    : 0;

  const { trend, trendPercent } = computeTrend(conversionRate, prevConversionRate);

  return {
    channel,
    sent: cur.sent,
    opened: cur.opened,
    clicked: cur.clicked,
    converted: cur.converted,
    failed: cur.failed,
    cost: cur.cost,
    openRate,
    clickRate,
    conversionRate,
    roi,
    trend,
    trendPercent,
  };
}

function buildRecommendations(channels: ChannelStats[], best: MessageChannel): string[] {
  const recs: string[] = [];
  const labelMap: Record<MessageChannel, string> = {
    SMS: 'SMS',
    KAKAO: '카카오',
    EMAIL: '이메일',
  };

  const active = channels.filter((c) => c.sent > 0);
  if (active.length === 0) {
    return ['아직 발송 데이터가 없습니다. 캠페인을 발송하면 채널별 성과가 집계됩니다.'];
  }

  const bestData = channels.find((c) => c.channel === best);
  if (bestData) {
    recs.push(
      `💡 ${labelMap[best]} 채널이 전환율 ${bestData.conversionRate.toFixed(2)}% 로 최고 성과입니다.`,
    );
  }

  // 클릭율 최고 채널 안내
  const topClick = [...active].sort((a, b) => b.clickRate - a.clickRate)[0];
  if (topClick && topClick.clickRate > 0) {
    recs.push(
      `📈 ${labelMap[topClick.channel]} 채널 클릭율이 ${topClick.clickRate.toFixed(1)}% 로 가장 높습니다.`,
    );
  }

  // 실패율 경고
  const highFail = active.find((c) => c.sent > 0 && c.failed / c.sent > 0.05);
  if (highFail) {
    const failPct = ((highFail.failed / highFail.sent) * 100).toFixed(1);
    recs.push(
      `⚠️ ${labelMap[highFail.channel]} 발송 실패율이 ${failPct}% 입니다. 발송 품질 점검이 필요합니다.`,
    );
  }

  // 하락 추세 경고
  const declining = active.find((c) => c.trend === 'DOWN');
  if (declining) {
    recs.push(
      `📉 ${labelMap[declining.channel]} 전환율이 직전 기간 대비 ${declining.trendPercent.toFixed(1)}% 하락했습니다.`,
    );
  }

  if (active.length >= 2) {
    recs.push('🎯 다채널 혼합 발송(카카오 → SMS → 이메일)으로 전환율을 추가로 끌어올릴 수 있습니다.');
  }

  return recs;
}

export async function GET() {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다.' },
        { status: 401 },
      );
    }

    const orgId = session.organizationId;

    const periodEnd = new Date();
    const periodStart = subDays(periodEnd, 30);
    const prevStart = subDays(periodStart, 30);

    const CHANNELS: MessageChannel[] = ['SMS', 'KAKAO', 'EMAIL'];

    // 현재 기간 + 직전 기간 동시 집계
    const [current, previous] = await Promise.all([
      Promise.all(CHANNELS.map((c) => collectChannel(c, orgId, periodStart, periodEnd))),
      Promise.all(CHANNELS.map((c) => collectChannel(c, orgId, prevStart, periodStart))),
    ]);

    const channels: ChannelStats[] = CHANNELS.map((channel, i) =>
      buildStats(channel, current[i], previous[i]),
    );

    // 최고 성과 채널: 전환율 우선, 동률 시 클릭율 → 발송량 순.
    // 발송 데이터가 전혀 없으면 기본값 SMS.
    const ranked = [...channels].sort((a, b) => {
      if (b.conversionRate !== a.conversionRate) return b.conversionRate - a.conversionRate;
      if (b.clickRate !== a.clickRate) return b.clickRate - a.clickRate;
      return b.sent - a.sent;
    });
    const bestPerformer: MessageChannel =
      ranked[0] && ranked[0].sent > 0 ? ranked[0].channel : 'SMS';

    const recommendations = buildRecommendations(channels, bestPerformer);

    return NextResponse.json({
      ok: true,
      channels,
      bestPerformer,
      recommendations,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });
  } catch (error) {
    logger.error('Analytics channels error:', error as object);
    return NextResponse.json(
      { ok: false, message: '채널 성과를 가져올 수 없습니다.' },
      { status: 500 },
    );
  }
}
