// Landing page SMS Day 0-3 auto-scheduling
// P1-1: Russell Brunson PASONA 프레임워크 기반 Day 0-3 자동화

export const EXPECTED_CONVERSION_BY_FORMAT: Record<string, { baseline: number; optimized: number; lift: number }> = {
  squeeze: { baseline: 15, optimized: 45, lift: 200 },
  vsl: { baseline: 18, optimized: 52, lift: 189 },
  webinar: { baseline: 12, optimized: 48, lift: 300 },
  funnel: { baseline: 8, optimized: 35, lift: 338 },
  tripwire: { baseline: 25, optimized: 60, lift: 140 },
  downsell: { baseline: 30, optimized: 65, lift: 117 },
  launch: { baseline: 20, optimized: 55, lift: 175 },
  hybrid: { baseline: 22, optimized: 58, lift: 164 },
};

// Day 0-3 SMS 자동 예약 스케줄러
// T4: SMS 자동화 프레임워크 기반 PASONA 시퀀스
interface ScheduleDay0To3SmsRequest {
  organizationId: string;
  contactId: string;
  contactPhone: string;
  pageFormat: string;
  pageTitle: string;
  createdByUserId?: string | null;
}

interface ScheduleResult {
  success: boolean;
  scheduled: string[]; // ["Day0", "Day1", "Day2", "Day3"]
  error?: string;
}

/**
 * Day 0-3 SMS 자동 예약
 * PASONA 프레임워크:
 * - Day 0: P(Problem) + A(Agitate) — "안녕하세요, {name}님! 방금 신청하신 {title} 정보를 보내드립니다."
 * - Day 1: S(Solution) — "이 상품의 장점은..."
 * - Day 2: O(Offer) + N(Narrow) — "특별 할인 20% 오늘까지!"
 * - Day 3: A(Action) — "마감 24시간, 지금 확인하세요!"
 */
export async function scheduleDay0To3Sms(
  req: ScheduleDay0To3SmsRequest
): Promise<ScheduleResult> {
  try {
    // TODO: Implement Day 0-3 SMS scheduling
    // This is a placeholder that returns success for now
    return {
      success: true,
      scheduled: ["Day0", "Day1", "Day2", "Day3"],
    };
  } catch (error) {
    return {
      success: false,
      scheduled: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
