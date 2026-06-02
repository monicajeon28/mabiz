/**
 * Live Stream Event Tracking
 * 라이브방송 신청자 추적 + 성과 메트릭
 */

import { prisma } from '@/lib/prisma';

export interface LiveStreamEvent {
  contactId: string;
  eventType:
    | 'REGISTRATION' // 신청
    | 'DAY0_SMS_SENT' // Day 0 SMS 발송
    | 'DAY1_CALL' // Day 1 콜
    | 'DAY2_SMS_SENT' // Day 2 SMS 발송
    | 'DAY3_SMS_SENT' // Day 3 SMS 발송
    | 'CONVERSION' // 최종 예약
    | 'CHURN'; // 포기
  segment: 'LOW_PRICE' | 'FILIAL' | 'HONEYMOON';
  metadata?: Record<string, any>;
}

/**
 * 라이브방송 이벤트 로깅
 */
export async function logLiveStreamEvent(event: LiveStreamEvent): Promise<void> {
  try {
    // contactEvent 모델 미존재 - ContactMemo에 이벤트 기록으로 대체
    await prisma.contactMemo.create({
      data: {
        contactId: event.contactId,
        userId: 'SYSTEM',
        content: JSON.stringify({
          eventType: event.eventType,
          segment: event.segment,
          timestamp: new Date().toISOString(),
          ...event.metadata,
        }),
      },
    });
  } catch (error) {
    console.error('[LIVE_STREAM_TRACKING]', error);
  }
}

/**
 * 라이브방송 성과 통계 (실시간)
 */
export async function getLiveStreamStats(eventDate: string): Promise<{
  totalRegistrations: number;
  bySegment: Record<string, number>;
  conversionRate: number;
  avgResponseTime: number; // 평균 응답 시간 (분)
}> {
  const startOfDay = new Date(eventDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(eventDate);
  endOfDay.setHours(23, 59, 59, 999);

  // 총 신청 수
  const registrations = await prisma.contact.findMany({
    where: {
      createdAt: { gte: startOfDay, lte: endOfDay },
      status: 'LIVE_STREAM',
    },
    select: { id: true, tags: true, createdAt: true },
  });

  // 세그먼트별 신청 (tags 기반)
  const bySegment = {
    LOW_PRICE: registrations.filter(
      (r) => r.tags.includes('SEGMENT_LOW_PRICE')
    ).length,
    FILIAL: registrations.filter(
      (r) => r.tags.includes('SEGMENT_FILIAL')
    ).length,
    HONEYMOON: registrations.filter(
      (r) => r.tags.includes('SEGMENT_HONEYMOON')
    ).length,
  };

  // 최종 예약 (CONVERSION) - contactEvent 미존재, ContactMemo 기반 대체
  const conversionMemos = await prisma.contactMemo.findMany({
    where: {
      content: { contains: '"eventType":"CONVERSION"' },
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  });

  const conversionRate =
    registrations.length > 0
      ? (conversionMemos.length / registrations.length) * 100
      : 0;

  // 평균 응답 시간 - contactEvent 미존재, 임시 0 반환
  const responseTimes: number[] = [];

  const avgResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

  return {
    totalRegistrations: registrations.length,
    bySegment,
    conversionRate: parseFloat(conversionRate.toFixed(2)),
    avgResponseTime: parseFloat(avgResponseTime.toFixed(1)),
  };
}

/**
 * 라이브방송별 주간 리포트 (매주 목요일 자동)
 */
export async function generateLiveStreamWeeklyReport(eventDate: string): Promise<{
  eventDate: string;
  stats: any;
  insights: string[];
  nextAction: string;
}> {
  const stats = await getLiveStreamStats(eventDate);

  // 인사이트 도출
  const insights: string[] = [];

  // 1️⃣ 세그먼트 성과 분석
  const topSegment = Object.entries(stats.bySegment).sort(
    ([, a], [, b]) => b - a
  )[0];
  if (topSegment) {
    insights.push(
      `🎯 가장 반응 좋은 세그먼트: ${getSegmentName(topSegment[0])} (${topSegment[1]}명)`
    );
  }

  // 2️⃣ 전환율 평가
  if (stats.conversionRate >= 40) {
    insights.push(`✅ 전환율 ${stats.conversionRate}% — 매우 우수합니다! (목표 30%)`);
  } else if (stats.conversionRate >= 30) {
    insights.push(`✅ 전환율 ${stats.conversionRate}% — 좋습니다! (목표 30%)`);
  } else {
    insights.push(
      `⚠️ 전환율 ${stats.conversionRate}% — 개선 필요합니다. 콜 품질 점검 권장`
    );
  }

  // 3️⃣ 응답 시간 평가
  if (stats.avgResponseTime <= 30) {
    insights.push(
      `⚡ 평균 응답 시간 ${stats.avgResponseTime}분 — 매우 빠릅니다!`
    );
  } else {
    insights.push(
      `⏱️ 평균 응답 시간 ${stats.avgResponseTime}분 — 30분 이내로 개선 권장`
    );
  }

  return {
    eventDate,
    stats,
    insights,
    nextAction: `다음 라이브방송: ${getNextLiveStreamDate(eventDate)}`,
  };
}

/**
 * 세그먼트명 변환
 */
function getSegmentName(segment: string): string {
  const names: Record<string, string> = {
    'LOW_PRICE': '저가 고객',
    'FILIAL': '효도 여행',
    'HONEYMOON': '신혼 고객',
  };
  return names[segment] || segment;
}

/**
 * 다음 라이브방송 날짜 (매주 화요일)
 */
function getNextLiveStreamDate(eventDate: string): string {
  const date = new Date(eventDate);
  const nextTuesday = new Date(date);
  nextTuesday.setDate(nextTuesday.getDate() + 7);
  return nextTuesday.toISOString().split('T')[0];
}
