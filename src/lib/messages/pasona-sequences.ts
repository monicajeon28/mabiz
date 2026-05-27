/**
 * PASONA Day 0-3 메시지 시퀀스
 * 심리학 10렌즈 기반 자동화된 SMS/Email 템플릿
 *
 * PASONA Framework:
 * - P (Problem): 문제 인식
 * - A (Agitate): 감정 자극
 * - S (Solution): 해결책 제시
 * - O (Offer): 오퍼 제시
 * - N (Narrow): 범위 좁히기
 * - A (Action): 행동 촉구
 */

export interface PasonaSequence {
  day: 0 | 1 | 2 | 3;
  lens: string; // L0-L10
  phase: 'P_A' | 'S' | 'O_N' | 'A';
  template: string;
  tone: 'FRIENDLY' | 'URGENT' | 'PROFESSIONAL' | 'EMPATHETIC';
  expectedMetric: 'OPEN_RATE' | 'CLICK_RATE' | 'CONVERSION';
  expectedRate: number; // 기대 성공률 (%)
}

export const PASONA_DAY0_SEQUENCES: PasonaSequence[] = [
  {
    day: 0,
    lens: 'L0',
    phase: 'P_A',
    template:
      '{{name}}님, 안녕하세요! 지난 {{daysSince}}일 간 소식이 없었네요. 혹시 여행 계획이 바뀌셨나요? 😟',
    tone: 'EMPATHETIC',
    expectedMetric: 'OPEN_RATE',
    expectedRate: 25,
  },
  {
    day: 0,
    lens: 'L1',
    phase: 'P_A',
    template:
      '{{name}}님, "가격이 너무 비싼 건 아닐까?" 많은 고객님들이 생각하셨어요. 5월 특가는 정말 최저가입니다. 🔥',
    tone: 'PROFESSIONAL',
    expectedMetric: 'OPEN_RATE',
    expectedRate: 28,
  },
  {
    day: 0,
    lens: 'L2',
    phase: 'P_A',
    template:
      '{{name}}님, 크루즈 준비가 복잡해 보이세요? 저희가 처음부터 끝까지 가이드해드릴게요. 📋',
    tone: 'FRIENDLY',
    expectedMetric: 'OPEN_RATE',
    expectedRate: 26,
  },
  {
    day: 0,
    lens: 'L3',
    phase: 'P_A',
    template:
      '{{name}}님, 경쟁사 크루즈와 비교 중이신가요? 저희 차별성을 명확하게 설명해드릴게요. ⭐',
    tone: 'PROFESSIONAL',
    expectedMetric: 'OPEN_RATE',
    expectedRate: 30,
  },
  {
    day: 0,
    lens: 'L5',
    phase: 'P_A',
    template:
      '{{name}}님, 크루즈 경험이 없으세요? 안심하세요! 1,000명 이상이 안전하게 다녀갔습니다. 🚢',
    tone: 'EMPATHETIC',
    expectedMetric: 'OPEN_RATE',
    expectedRate: 29,
  },
  {
    day: 0,
    lens: 'L6',
    phase: 'P_A',
    template:
      '⏰ {{name}}님, 5월 특가는 48시간 한정입니다! 지금 예약하면 {{discount}}% 할인 🔥',
    tone: 'URGENT',
    expectedMetric: 'OPEN_RATE',
    expectedRate: 35,
  },
  {
    day: 0,
    lens: 'L7',
    phase: 'P_A',
    template:
      '{{name}}님의 배우자님도 함께 즐길 수 있는 크루즈! 가족 패키지로 {{discount}}% 절약하세요. 👨‍👩‍👧‍👦',
    tone: 'FRIENDLY',
    expectedMetric: 'OPEN_RATE',
    expectedRate: 27,
  },
  {
    day: 0,
    lens: 'L8',
    phase: 'P_A',
    template:
      '{{name}}님, 매년 크루즈 다니셨잖아요? 올해도 예약하셔야죠! 특가 + VIP 업그레이드 🎁',
    tone: 'FRIENDLY',
    expectedMetric: 'OPEN_RATE',
    expectedRate: 32,
  },
  {
    day: 0,
    lens: 'L9',
    phase: 'P_A',
    template:
      '{{name}}님, 고혈압/당뇨가 있으신가요? 크루즈 의료 시설은 국제 수준입니다. 안전하게 다녀오세요! ⚕️',
    tone: 'EMPATHETIC',
    expectedMetric: 'OPEN_RATE',
    expectedRate: 22,
  },
  {
    day: 0,
    lens: 'L10',
    phase: 'P_A',
    template:
      '{{name}}님, 지금이 결정의 시간입니다! 특가 예약하기: {{link}}',
    tone: 'URGENT',
    expectedMetric: 'OPEN_RATE',
    expectedRate: 33,
  },
];

export const PASONA_DAY1_SEQUENCES: PasonaSequence[] = [
  {
    day: 1,
    lens: 'L0',
    phase: 'S',
    template:
      '{{name}}님, 부재중 고객님께 특별한 복귀 보너스를 준비했어요! 20% OFF + 무료 업그레이드 🎁',
    tone: 'FRIENDLY',
    expectedMetric: 'CLICK_RATE',
    expectedRate: 38,
  },
  {
    day: 1,
    lens: 'L1',
    phase: 'S',
    template:
      '{{name}}님, 가격 항의하셨던 분들 대부분 예약하셨어요. 이유가 뭘까요? [비교 자료 보기]',
    tone: 'PROFESSIONAL',
    expectedMetric: 'CLICK_RATE',
    expectedRate: 35,
  },
  {
    day: 1,
    lens: 'L2',
    phase: 'S',
    template:
      '{{name}}님, 크루즈 준비 체크리스트입니다! 📋\n1. 여권\n2. 짐 싸기 팁\n3. 탑승 절차\n→ [상세 가이드]',
    tone: 'FRIENDLY',
    expectedMetric: 'CLICK_RATE',
    expectedRate: 40,
  },
  {
    day: 1,
    lens: 'L3',
    phase: 'S',
    template:
      '{{name}}님, 호텔 vs 크루즈 구조 차이 아세요?\n\n호텔: 매일 짐 싸기 + 새 체크인\n크루즈: 한 번만 짐 싸기 + 배가 움직임 ✅\n\n[자세히 보기]',
    tone: 'PROFESSIONAL',
    expectedMetric: 'CLICK_RATE',
    expectedRate: 42,
  },
  {
    day: 1,
    lens: 'L5',
    phase: 'S',
    template:
      '{{name}}님, 1,000명 이상의 성공 사례! ⭐⭐⭐⭐⭐\n"정말 안전했어요!" - {{testimonial_name}}\n고객 평가 보기: [링크]',
    tone: 'PROFESSIONAL',
    expectedMetric: 'CLICK_RATE',
    expectedRate: 36,
  },
  {
    day: 1,
    lens: 'L6',
    phase: 'S',
    template:
      '⏰ {{name}}님, 시간이 점점 줄어들고 있어요! 특가 남은 자리: {{remaining}}석',
    tone: 'URGENT',
    expectedMetric: 'CLICK_RATE',
    expectedRate: 44,
  },
  {
    day: 1,
    lens: 'L7',
    phase: 'S',
    template:
      '{{name}}님, 가족이 함께할 수 있는 프로그램을 준비했어요! 👨‍👩‍👧‍👦\n- 키즈클럽\n- 부부 특별석\n- 가족 식사 할인\n[패키지 보기]',
    tone: 'FRIENDLY',
    expectedMetric: 'CLICK_RATE',
    expectedRate: 39,
  },
  {
    day: 1,
    lens: 'L8',
    phase: 'S',
    template:
      '{{name}}님, VIP 멤버라서 이번 특별 대우! 🌟\n- 우선 탑승\n- 와인 무료 업그레이드\n- 콘시에르지 서비스\n[VIP 혜택 확인]',
    tone: 'PROFESSIONAL',
    expectedMetric: 'CLICK_RATE',
    expectedRate: 41,
  },
  {
    day: 1,
    lens: 'L9',
    phase: 'S',
    template:
      '{{name}}님, 크루즈 의료 안내입니다! ⚕️\n- 24시간 의료진 상근\n- 응급 헬리콥터 지원\n- 의약품 충분 보유\n안심하고 다녀오세요! [안내 보기]',
    tone: 'PROFESSIONAL',
    expectedMetric: 'CLICK_RATE',
    expectedRate: 33,
  },
  {
    day: 1,
    lens: 'L10',
    phase: 'S',
    template:
      '{{name}}님, 예약 버튼을 누르기만 하면 됩니다! 나머지는 저희가 모두 처리해드릴게요. [지금 예약하기]',
    tone: 'PROFESSIONAL',
    expectedMetric: 'CLICK_RATE',
    expectedRate: 37,
  },
];

export const PASONA_DAY2_SEQUENCES: PasonaSequence[] = [
  {
    day: 2,
    lens: 'L0',
    phase: 'O_N',
    template:
      '{{name}}님을 위한 특별 오퍼! 🎁\n- {{discount}}% 할인\n- 무료 스파 이용권\n- 온보드 크레딧 $100\n\n[지금 예약하기]',
    tone: 'FRIENDLY',
    expectedMetric: 'CONVERSION',
    expectedRate: 8,
  },
  {
    day: 2,
    lens: 'L1',
    phase: 'O_N',
    template:
      '{{name}}님, 가격 걱정 끝! 💰\n평균 가격: ${{avg_price}}/박\n우리 가격: ${{our_price}}/박\n차이: ${{difference}} 절약!\n\n[예약하기]',
    tone: 'PROFESSIONAL',
    expectedMetric: 'CONVERSION',
    expectedRate: 7,
  },
  {
    day: 2,
    lens: 'L2',
    phase: 'O_N',
    template:
      '{{name}}님, 모든 준비는 저희가! 📋\n✓ 여권 확인\n✓ 탑승 수속\n✓ 짐 배송\n✓ 신원 확인\n\n복잡하지 않습니다! [예약하기]',
    tone: 'FRIENDLY',
    expectedMetric: 'CONVERSION',
    expectedRate: 9,
  },
  {
    day: 2,
    lens: 'L3',
    phase: 'O_N',
    template:
      '{{name}}님만을 위한 차별성! ⭐\n- 7박 1박당 $214 (모두 포함)\n- 호텔 1박당 $300+ (추가 비용 계속)\n- 액티비티 10+ (무료 vs 호텔 유료)\n\n[크루즈 예약하기]',
    tone: 'PROFESSIONAL',
    expectedMetric: 'CONVERSION',
    expectedRate: 10,
  },
  {
    day: 2,
    lens: 'L5',
    phase: 'O_N',
    template:
      '{{name}}님, 신뢰할 수 있는 이유! 🏆\n✓ 30년 역사\n✓ 국제 인증 (ISO)\n✓ 의료진 24/7\n✓ 고객 만족도 98%\n\n[예약하기]',
    tone: 'PROFESSIONAL',
    expectedMetric: 'CONVERSION',
    expectedRate: 8,
  },
  {
    day: 2,
    lens: 'L6',
    phase: 'O_N',
    template:
      '🚨 {{name}}님, 마지막 경고입니다! ⏰\n남은 자리: {{remaining}}석\n남은 시간: {{hours}}시간\n지금 놓치면 다음 달이 됩니다!\n\n[지금 예약하기]',
    tone: 'URGENT',
    expectedMetric: 'CONVERSION',
    expectedRate: 12,
  },
  {
    day: 2,
    lens: 'L7',
    phase: 'O_N',
    template:
      '{{name}}님 가족을 위한 완벽한 선물! 🎁\n- 배우자: VIP 스위트\n- 아이들: 키즈 프로그램\n- 부모님: 의료 지원\n\n[가족 예약하기]',
    tone: 'FRIENDLY',
    expectedMetric: 'CONVERSION',
    expectedRate: 11,
  },
  {
    day: 2,
    lens: 'L8',
    phase: 'O_N',
    template:
      '{{name}}님, 올해 {{bookingCount}}번째 예약입니다! 🌟\n습관처럼 크루즈 다니시는 분들께:\n- 최상급 할인\n- VIP 라운지 무료\n- 우선 탑승\n\n[VIP 예약하기]',
    tone: 'PROFESSIONAL',
    expectedMetric: 'CONVERSION',
    expectedRate: 13,
  },
  {
    day: 2,
    lens: 'L9',
    phase: 'O_N',
    template:
      '{{name}}님의 건강을 위해! ⚕️\n- 의료진 상시 대기\n- 응급 헬리콥터 지원\n- 약물 무료 제공\n- 건강 모니터링\n\n안심하고 예약하세요! [예약하기]',
    tone: 'EMPATHETIC',
    expectedMetric: 'CONVERSION',
    expectedRate: 6,
  },
  {
    day: 2,
    lens: 'L10',
    phase: 'O_N',
    template:
      '{{name}}님, 결정할 시간입니다! 💎\n최종 오퍼:\n- {{discount}}% 할인\n- 무료 업그레이드\n- 취소 수수료 0%\n\n[지금 예약하기]',
    tone: 'URGENT',
    expectedMetric: 'CONVERSION',
    expectedRate: 14,
  },
];

export const PASONA_DAY3_SEQUENCES: PasonaSequence[] = [
  {
    day: 3,
    lens: 'L0',
    phase: 'A',
    template:
      '{{name}}님, 마지막 기회입니다! 🎯\n내일 자정이 마감입니다.\n다시 돌아올 때까지 기다릴까요?\n\n[지금 예약하기]',
    tone: 'URGENT',
    expectedMetric: 'CONVERSION',
    expectedRate: 5,
  },
  {
    day: 3,
    lens: 'L1',
    phase: 'A',
    template:
      '{{name}}님, 값싼 가격은 내일은 없습니다! 💰\n{{discount}}% 할인은 오늘까지!\n\n[지금 예약하기]',
    tone: 'URGENT',
    expectedMetric: 'CONVERSION',
    expectedRate: 6,
  },
  {
    day: 3,
    lens: 'L2',
    phase: 'A',
    template:
      '{{name}}님, 준비가 완벽합니다! ✅\n체크리스트 모두 완료\n이제 예약만 하면 끝!\n\n[마지막 예약하기]',
    tone: 'FRIENDLY',
    expectedMetric: 'CONVERSION',
    expectedRate: 7,
  },
  {
    day: 3,
    lens: 'L3',
    phase: 'A',
    template:
      '{{name}}님, 차별성이 증명되었습니다! ⭐\n호텔과 크루즈, 이제 선택하세요.\n우리 선택: [예약하기]',
    tone: 'PROFESSIONAL',
    expectedMetric: 'CONVERSION',
    expectedRate: 8,
  },
  {
    day: 3,
    lens: 'L5',
    phase: 'A',
    template:
      '{{name}}님, 신뢰하기로 결정하세요! 🏆\n1,000명이 이미 다녀갔습니다.\n{{name}}님도 함께하세요!\n\n[예약하기]',
    tone: 'PROFESSIONAL',
    expectedMetric: 'CONVERSION',
    expectedRate: 5,
  },
  {
    day: 3,
    lens: 'L6',
    phase: 'A',
    template:
      '🚨 {{name}}님, 남은 시간: {{hours}}시간! ⏰\n자리: {{remaining}}석\n지금 놓치면 6개월 뒤입니다!\n\n[지금 예약하기]',
    tone: 'URGENT',
    expectedMetric: 'CONVERSION',
    expectedRate: 10,
  },
  {
    day: 3,
    lens: 'L7',
    phase: 'A',
    template:
      '{{name}}님, 가족이 기다리고 있어요! 👨‍👩‍👧‍👦\n아이들: "언제 크루즈 가?" 😄\n배우자님: "빨리 예약해!" 💬\n\n[가족과 함께 예약하기]',
    tone: 'FRIENDLY',
    expectedMetric: 'CONVERSION',
    expectedRate: 9,
  },
  {
    day: 3,
    lens: 'L8',
    phase: 'A',
    template:
      '{{name}}님, 특가는 오늘 자정까지입니다! ⏰\n매년 예약하셨잖아요.\n올해도 지금 결정하세요!\n\n[예약하기]',
    tone: 'URGENT',
    expectedMetric: 'CONVERSION',
    expectedRate: 11,
  },
  {
    day: 3,
    lens: 'L9',
    phase: 'A',
    template:
      '{{name}}님, 건강 걱정 끝입니다! ⚕️\n의료진이 함께합니다.\n안심하고 예약하세요!\n\n[예약하기]',
    tone: 'EMPATHETIC',
    expectedMetric: 'CONVERSION',
    expectedRate: 3,
  },
  {
    day: 3,
    lens: 'L10',
    phase: 'A',
    template:
      '{{name}}님, 결정했습니까? 🎯\n예약: [클릭]\n취소: [안 누르기]\n\n지금이 마지막 기회입니다!',
    tone: 'URGENT',
    expectedMetric: 'CONVERSION',
    expectedRate: 12,
  },
];

export function getPasonaTemplate(
  day: 0 | 1 | 2 | 3,
  lens: string
): PasonaSequence | null {
  const sequences =
    {
      0: PASONA_DAY0_SEQUENCES,
      1: PASONA_DAY1_SEQUENCES,
      2: PASONA_DAY2_SEQUENCES,
      3: PASONA_DAY3_SEQUENCES,
    }[day] || [];

  return sequences.find((s) => s.lens === lens) || null;
}

export function getAllPasonaTemplates(lens: string): PasonaSequence[] {
  return [
    ...PASONA_DAY0_SEQUENCES,
    ...PASONA_DAY1_SEQUENCES,
    ...PASONA_DAY2_SEQUENCES,
    ...PASONA_DAY3_SEQUENCES,
  ].filter((s) => s.lens === lens);
}
