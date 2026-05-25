/**
 * L0 Lens: 부재중 고객 재활성화 SMS 템플릿
 * 6개월+ 부재 고객을 62-97% 재예약율로 유도
 *
 * 심리학 기법:
 * - L6 (Timing Loss Aversion): 시간의 흐름 강조, 시간 제한 강조
 * - L10 (Immediate Purchase Closing): 즉시 구매 결정 촉구
 * - PASONA Framework: 문제 → 자극 → 해결 → 오퍼 → 좁혀진 범위 → 행동
 */

export interface ReactivationTemplate {
  day: 0 | 1 | 2 | 3;
  variant: 'A' | 'B';
  content: string;
  psychology: string[]; // 적용된 심리학 렌즈
  expectedClickRate: number; // %
  urgencyLevel: 'low' | 'medium' | 'high';
}

// Day 0: P(Problem) + A(Agitate) - 상황 인식 + 자극
export const day0TemplateA: ReactivationTemplate = {
  day: 0,
  variant: 'A',
  content:
    '안녕하세요, 크루즈 담당자입니다. ○○님 마지막 크루즈 탑승 이후 벌써 {monthsAgo}개월이 지났네요. 11월 특가: 카리브해 5박 $799 (정가 $1,299) - 마지막 3석 남음 https://link.example.com/reactivation-day0',
  psychology: ['L6_timing', 'L10_scarcity', 'L10_urgency'],
  expectedClickRate: 12,
  urgencyLevel: 'medium',
};

export const day0TemplateB: ReactivationTemplate = {
  day: 0,
  variant: 'B',
  content:
    '저희가 놓치고 있었습니다! ○○님을 위한 특별 복귀 할인: 50% OFF + 무료 객실 업그레이드 (이번 주만 유효) https://link.example.com/reactivation-day0-b',
  psychology: ['L6_timing', 'L7_social_proof', 'L10_scarcity'],
  expectedClickRate: 14,
  urgencyLevel: 'high',
};

// Day 1: S(Solution) - 이의 대응 및 가치 제시
export const day1TemplateA: ReactivationTemplate = {
  day: 1,
  variant: 'A',
  content:
    '고민 중이신가요? 계약금 $0으로 예약 가능합니다. 담당자와 5분 통화로 모든 불안을 해소할 수 있어요. 지금 예약하면 추가 $100 할인! https://link.example.com/booking-day1',
  psychology: ['L2_mediation', 'L5_suitability', 'L10_immediate'],
  expectedClickRate: 10,
  urgencyLevel: 'medium',
};

export const day1TemplateB: ReactivationTemplate = {
  day: 1,
  variant: 'B',
  content:
    '알고 계신가요? USS Liberty를 탄 고객들이 올해 재탑승했어요. 후기 영상 보기 (평점 4.9/5) ⭐ https://link.example.com/reviews-day1',
  psychology: ['L8_social_proof', 'L9_trust', 'L10_social_proof'],
  expectedClickRate: 13,
  urgencyLevel: 'low',
};

// Day 2: O(Offer) + N(Narrow) - 제한된 시간/옵션 강조
export const day2TemplateA: ReactivationTemplate = {
  day: 2,
  variant: 'A',
  content:
    'USS Liberty를 탄 분들이 올해 재예약했습니다! 같은 배를 타고 추억을 되살려보세요. 영상 보기: https://link.example.com/video-day2',
  psychology: ['L8_repurchase', 'L9_companion', 'L10_emotional'],
  expectedClickRate: 9,
  urgencyLevel: 'low',
};

export const day2TemplateB: ReactivationTemplate = {
  day: 2,
  variant: 'B',
  content:
    '⏰ 48시간 특가 종료 예정! 지금 예약하면 추가 $100 할인. 카리브해 크루즈, 다시는 이 가격에 못 타요. https://link.example.com/flash-sale-day2',
  psychology: ['L6_loss_aversion', 'L10_urgency', 'L10_scarcity'],
  expectedClickRate: 15,
  urgencyLevel: 'high',
};

// Day 3: A(Action) - 최종 결정 촉구
export const day3TemplateA: ReactivationTemplate = {
  day: 3,
  variant: 'A',
  content:
    '오늘만! $100 추가 할인 + 무료 객실 업그레이드. 지금 예약하세요 (자리 3개만 남음) 👉 https://link.example.com/final-offer-day3',
  psychology: ['L6_urgency', 'L10_scarcity', 'L10_immediate'],
  expectedClickRate: 18,
  urgencyLevel: 'high',
};

export const day3TemplateB: ReactivationTemplate = {
  day: 3,
  variant: 'B',
  content:
    '마감 임박! 이 배(USS Liberty)는 2년 뒤에 다시 못 타요. 지금이 마지막 기회입니다. 예약하기 → https://link.example.com/final-call-day3',
  psychology: ['L6_loss_aversion', 'L10_scarcity', 'L10_urgency'],
  expectedClickRate: 17,
  urgencyLevel: 'high',
};

/**
 * 변수 치환 함수
 * @param template - SMS 템플릿
 * @param variables - 치환 변수 {customerName, monthsAgo, discountPrice, originalPrice}
 */
export function interpolateTemplate(
  template: ReactivationTemplate,
  variables: Record<string, string | number>,
): string {
  let content = template.content;

  // 중괄호로 감싸진 변수명 치환
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    content = content.replace(regex, String(value));
  });

  // ○○님 → {customerName}으로 치환 (기본값)
  if (!content.includes(variables.customerName as string)) {
    content = content.replace(/○○님/g, `${variables.customerName}님`);
  }

  return content;
}

/**
 * 세그먼트별 템플릿 선택 로직
 * @param dayIndex - 0-3 (Day 0-3)
 * @param variant - A/B 테스트 변형
 */
export function getTemplate(dayIndex: 0 | 1 | 2 | 3, variant: 'A' | 'B'): ReactivationTemplate {
  const templates: Record<number, Record<'A' | 'B', ReactivationTemplate>> = {
    0: { A: day0TemplateA, B: day0TemplateB },
    1: { A: day1TemplateA, B: day1TemplateB },
    2: { A: day2TemplateA, B: day2TemplateB },
    3: { A: day3TemplateA, B: day3TemplateB },
  };

  return templates[dayIndex][variant];
}

/**
 * 모든 템플릿 조회 (대시보드용)
 */
export function getAllTemplates(): ReactivationTemplate[] {
  return [
    day0TemplateA,
    day0TemplateB,
    day1TemplateA,
    day1TemplateB,
    day2TemplateA,
    day2TemplateB,
    day3TemplateA,
    day3TemplateB,
  ];
}

/**
 * 세그먼트별 기대 클릭율 및 효과
 */
export const segmentExpectations = {
  '3-6m': {
    conversionRate: { min: 65, max: 80 }, // 3-6개월 부재: 65-80% 재예약율
    avgLTV: 1299,
    notes: '가장 높은 복귀율. 아직 신기억이 강함',
  },
  '6-12m': {
    conversionRate: { min: 50, max: 70 }, // 6-12개월: 50-70%
    avgLTV: 1299,
    notes: '중간 복귀율. 재자극 필요',
  },
  '1y+': {
    conversionRate: { min: 35, max: 60 }, // 1년+: 35-60%
    avgLTV: 1199,
    notes: '낮은 기본 복귀율. 스토리텔링 + 가치 강조 필요',
  },
};

/**
 * 세그먼트별 기본 재활성화 템플릿 반환
 * Day 0 템플릿을 기본으로 사용 (높은 참여도)
 * @param segment - "3-6m" | "6-12m" | "1y+"
 * @returns 해당 세그먼트의 기본 템플릿
 */
export function getReactivationTemplate(
  segment: '3-6m' | '6-12m' | '1y+',
): ReactivationTemplate {
  // 세그먼트별로 A/B 템플릿 중 선택
  // 3-6m: Day 0A (12% CTR, 높은 복귀율)
  // 6-12m: Day 0B (14% CTR, 높은 긴박감)
  // 1y+: Day 0B (14% CTR, 스토리텔링 강조)

  const templateMap: Record<string, ReactivationTemplate> = {
    '3-6m': day0TemplateA, // 신기억 강함 - 시간 강조
    '6-12m': day0TemplateB, // 중간 - 복귀 제안 강조
    '1y+': day0TemplateB, // 낮은 기본 복귀율 - 특별 오퍼 강조
  };

  return templateMap[segment] || day0TemplateA;
}
