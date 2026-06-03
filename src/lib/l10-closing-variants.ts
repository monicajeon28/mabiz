/**
 * L10 렌즈 - 30개 클로징 변형 생성기
 *
 * 3 선택지 × 3 감정톤 × 3 시간프레임 = 27개 기본 변형
 * + 3개 고급 클로징 (예외 상황) = 30개 전체 변형
 */

export type EmotionalTone = 'hopeful' | 'fearful' | 'excited';
export type TimeFrame = 'immediate' | 'soon' | 'flexible';
export type ChoiceOption = 'A' | 'B' | 'C';

interface ClosingVariant {
  id: string;
  emotionalTone: EmotionalTone;
  timeFrame: TimeFrame;
  tripleChoice: {
    optionA: string;
    optionB: string;
    optionC: string;
    psychologyBridge: string;
    expectedConversion: number;
  };
  emotionalFinish: string;
  urgencyTrigger: string;
  estimatedConversion: number;
  notes: string;
}

const emotionalToneDescriptions: Record<EmotionalTone, string> = {
  hopeful: '희망감 + 설렘 (긍정적 자극)',
  fearful: '불안감 + 손실회피 (부정적 자극)',
  excited: '흥분감 + 즉시성 (행동 유도)',
};

const timeFrameDescriptions: Record<TimeFrame, string> = {
  immediate: '24시간 이내 (극도의 긴박감)',
  soon: '3-7일 이내 (중간 긴박감)',
  flexible: '2주 이내 (낮은 긴박감)',
};

// 1. 희망감 + 즉시 클로징 (3개)
const hopefulImmediate: ClosingVariant[] = [
  {
    id: 'h-imm-1',
    emotionalTone: 'hopeful',
    timeFrame: 'immediate',
    tripleChoice: {
      optionA: '오늘 신청 (최고 선실 확정)',
      optionB: '내일 신청 (좋은 선실)',
      optionC: '3일 뒤 신청 (표준 선실)',
      psychologyBridge: '가족 재회 + 꿈의 시작',
      expectedConversion: 42,
    },
    emotionalFinish:
      '"당신의 자녀가 배 위에서 보는 일몰을 기억할 거예요. 이것이 바로 당신이 남길 유산입니다."',
    urgencyTrigger: '최고 선실 2개만 남음',
    estimatedConversion: 78,
    notes: '가족 시나리오, 긍정 + 즉시성',
  },
  {
    id: 'h-imm-2',
    emotionalTone: 'hopeful',
    timeFrame: 'immediate',
    tripleChoice: {
      optionA: '지금 신청하세요! (당신의 꿈)',
      optionB: '내일 신청 (충분한 시간)',
      optionC: '주말 신청 (여유 있을 때)',
      psychologyBridge: '꿈 성취 + 희망의 시작',
      expectedConversion: 40,
    },
    emotionalFinish:
      '"평생 꿈꿔던 크루즈, 이제 현실이 될 거예요. 당신의 용기가 당신을 여기까지 이끌었습니다."',
    urgencyTrigger: '이 가격은 오늘까지만',
    estimatedConversion: 76,
    notes: '꿈 시나리오, 희망감 강화',
  },
  {
    id: 'h-imm-3',
    emotionalTone: 'hopeful',
    timeFrame: 'immediate',
    tripleChoice: {
      optionA: '모험을 시작하세요 (지금)',
      optionB: '준비하고 신청 (내일)',
      optionC: '여유 있을 때 신청',
      psychologyBridge: '새로운 경험 + 희망',
      expectedConversion: 41,
    },
    emotionalFinish:
      '"이 여행이 당신의 인생을 바꿀 거예요. 세상을 다른 눈으로 보게 될 겁니다."',
    urgencyTrigger: '이 일정은 올해 마지막',
    estimatedConversion: 75,
    notes: '모험 시나리오, 긍정적 기대감',
  },
];

// 2. 불안감 + 즉시 클로징 (3개)
const fearfulImmediate: ClosingVariant[] = [
  {
    id: 'f-imm-1',
    emotionalTone: 'fearful',
    timeFrame: 'immediate',
    tripleChoice: {
      optionA: '지금 신청 (100% 최고 선실)',
      optionB: '내일 신청 (85% 확률)',
      optionC: '3일 뒤 신청 (60% 확률)',
      psychologyBridge: '확실성 + 위험 제거',
      expectedConversion: 52,
    },
    emotionalFinish:
      '"지금 신청하면 당신은 100% 안전합니다. 우리가 모든 책임을 집니다."',
    urgencyTrigger: '선실 2개 남음 (빠르게 매진)',
    estimatedConversion: 85,
    notes: '손실회피 극대화, 선실 희소성',
  },
  {
    id: 'f-imm-2',
    emotionalTone: 'fearful',
    timeFrame: 'immediate',
    tripleChoice: {
      optionA: '꿈을 놓치지 마세요 (지금)',
      optionB: '일주일 내 신청 (70% 할인)',
      optionC: '나중에 신청 (할인 미보장)',
      psychologyBridge: '손실 + 희소성',
      expectedConversion: 54,
    },
    emotionalFinish:
      '"이 기회를 놓친다면, 당신은 5년 뒤에 분명히 후회할 겁니다."',
    urgencyTrigger: '가격 24시간 후 올라감',
    estimatedConversion: 86,
    notes: '경제적 손실, 시간 압박',
  },
  {
    id: 'f-imm-3',
    emotionalTone: 'fearful',
    timeFrame: 'immediate',
    tripleChoice: {
      optionA: '모험을 놓치지 마세요 (지금)',
      optionB: '72시간 내 (가격 보장)',
      optionC: '나중에 (가격 미보장)',
      psychologyBridge: '시간손실 + 경제손실',
      expectedConversion: 51,
    },
    emotionalFinish:
      '"같은 크루즈, 같은 시간은 내년 이맘때쯤 다시 나옵니다. 당신이 지금 놓친다면."',
    urgencyTrigger: '이 조건은 이번 시즌 마지막',
    estimatedConversion: 84,
    notes: '시간 + 계절성, 복합 손실',
  },
];

// 3. 흥분감 + 즉시 클로징 (3개)
const excitedImmediate: ClosingVariant[] = [
  {
    id: 'e-imm-1',
    emotionalTone: 'excited',
    timeFrame: 'immediate',
    tripleChoice: {
      optionA: '오늘 신청! 🎉 (12시간 확정)',
      optionB: '내일 신청 (추천)',
      optionC: '주말 신청',
      psychologyBridge: '행동유도 + 긴급감',
      expectedConversion: 45,
    },
    emotionalFinish:
      '"지금 신청하면 당신의 크루즈가 확정됩니다! 우리는 이미 준비 중입니다!"',
    urgencyTrigger: '지금 신청하면 오늘 확정',
    estimatedConversion: 82,
    notes: '행동성 강조, 즉각적 보상',
  },
  {
    id: 'e-imm-2',
    emotionalTone: 'excited',
    timeFrame: 'immediate',
    tripleChoice: {
      optionA: '꿈 시작! 지금 신청 🚀',
      optionB: '3일 내 신청',
      optionC: '여유 있을 때 신청',
      psychologyBridge: '몸과 마음의 확신',
      expectedConversion: 48,
    },
    emotionalFinish:
      '"당신의 이 선택이 가장 현명한 선택이 될 겁니다! 함께 하는 게 정말 자랑스럽습니다!"',
    urgencyTrigger: '오늘 52명이 이미 신청했습니다',
    estimatedConversion: 84,
    notes: '사회증명 + 즉각성',
  },
  {
    id: 'e-imm-3',
    emotionalTone: 'excited',
    timeFrame: 'immediate',
    tripleChoice: {
      optionA: '모험 시작! 지금 신청 ⚡',
      optionB: '5일 내 신청 (추천) ✅',
      optionC: '시간 될 때 신청',
      psychologyBridge: '즉시성 + 행동력',
      expectedConversion: 46,
    },
    emotionalFinish:
      '"당신의 결정을 정말 응원합니다! 이 모험이 당신을 새로운 세상으로 이끌 거예요!"',
    urgencyTrigger: '지난 3일간 180명 신청',
    estimatedConversion: 83,
    notes: '행동 채촉, 감정적 지지',
  },
];

// 4. 희망감 + 중간 클로징 (3개)
const hopefulSoon: ClosingVariant[] = [
  {
    id: 'h-soon-1',
    emotionalTone: 'hopeful',
    timeFrame: 'soon',
    tripleChoice: {
      optionA: '이주 내 신청 (최고 선실)',
      optionB: '3주 내 신청 (좋은 선실)',
      optionC: '한달 내 신청',
      psychologyBridge: '설렘의 준비 과정',
      expectedConversion: 38,
    },
    emotionalFinish:
      '"준비하면서 설렘을 느껴보세요. 당신은 정말 현명한 결정을 하고 있습니다."',
    urgencyTrigger: '여름 성수기 성실 70%',
    estimatedConversion: 72,
    notes: '여유 있는 희망감, 준비 과정 강조',
  },
  {
    id: 'h-soon-2',
    emotionalTone: 'hopeful',
    timeFrame: 'soon',
    tripleChoice: {
      optionA: '일주일 내 신청',
      optionB: '2주 내 신청',
      optionC: '여유 있을 때',
      psychologyBridge: '꿈을 곱씹기의 즐거움',
      expectedConversion: 37,
    },
    emotionalFinish:
      '"당신의 꿈은 이미 현실의 한 발 앞에 있습니다. 천천히 걸어가도 괜찮습니다."',
    urgencyTrigger: '8월 성수기 일정 80% 매진',
    estimatedConversion: 70,
    notes: '시간 여유, 신중한 결정',
  },
  {
    id: 'h-soon-3',
    emotionalTone: 'hopeful',
    timeFrame: 'soon',
    tripleChoice: {
      optionA: '5일 내 신청',
      optionB: '2주 내 신청',
      optionC: '한달 내 신청',
      psychologyBridge: '기대감의 건강한 가속',
      expectedConversion: 39,
    },
    emotionalFinish:
      '"이 여행이 당신의 삶을 풍요롭게 할 거라는 것, 이미 느껴지시죠?"',
    urgencyTrigger: '7월 말 특가 (8월부터 일반가)',
    estimatedConversion: 71,
    notes: '희망감 유지, 신중함 존중',
  },
];

// 5. 불안감 + 중간 클로징 (3개)
const fearfulSoon: ClosingVariant[] = [
  {
    id: 'f-soon-1',
    emotionalTone: 'fearful',
    timeFrame: 'soon',
    tripleChoice: {
      optionA: '이주 내 (100% 선실 보장)',
      optionB: '3주 내 (95% 선실 보장)',
      optionC: '한달 내 (80% 선실 보장)',
      psychologyBridge: '보증 폭의 확대',
      expectedConversion: 43,
    },
    emotionalFinish:
      '"시간이 지날수록 선실이 줄어듭니다. 당신은 현명한 결정을 빨리 해야 합니다."',
    urgencyTrigger: '한달 뒤부터 선실 제한',
    estimatedConversion: 76,
    notes: '점진적 손실 강조, 보증 축소',
  },
  {
    id: 'f-soon-2',
    emotionalTone: 'fearful',
    timeFrame: 'soon',
    tripleChoice: {
      optionA: '일주일 내 (70% 할인 보장)',
      optionB: '2주 내 (50% 할인 보장)',
      optionC: '3주 내 (25% 할인 보장)',
      psychologyBridge: '할인액 급감',
      expectedConversion: 45,
    },
    emotionalFinish:
      '"모든 할인은 시간의 흐름에 따라 줄어듭니다. 지금 현재가 최고의 조건입니다."',
    urgencyTrigger: '매주 할인 5% 감소',
    estimatedConversion: 77,
    notes: '경제적 손실 강조, 시간 주기성',
  },
  {
    id: 'f-soon-3',
    emotionalTone: 'fearful',
    timeFrame: 'soon',
    tripleChoice: {
      optionA: '5일 내 신청 (가격 확정)',
      optionB: '2주 내 신청 (가격 미확정)',
      optionC: '한달 내 (가격 인상 위험)',
      psychologyBridge: '불확실성 증가',
      expectedConversion: 44,
    },
    emotionalFinish:
      '"당신이 지금 결정하지 않으면, 다음 결정자는 당신보다 비싼 가격을 낼 겁니다."',
    urgencyTrigger: '매주 수요일 가격 검토',
    estimatedConversion: 75,
    notes: '불확실성 + 경제 손실',
  },
];

// 6. 흥분감 + 중간 클로징 (3개)
const excitedSoon: ClosingVariant[] = [
  {
    id: 'e-soon-1',
    emotionalTone: 'excited',
    timeFrame: 'soon',
    tripleChoice: {
      optionA: '이주 내 신청! 🎊',
      optionB: '3주 내 신청',
      optionC: '한달 내 신청',
      psychologyBridge: '기대감 + 행동성',
      expectedConversion: 40,
    },
    emotionalFinish:
      '"당신의 이 선택이 정말 자랑스럽습니다! 함께하는 게 저희도 너무 행복해요!"',
    urgencyTrigger: '매주 목요일 신청자 200명 이상',
    estimatedConversion: 74,
    notes: '행동성 강조, 공감대 형성',
  },
  {
    id: 'e-soon-2',
    emotionalTone: 'excited',
    timeFrame: 'soon',
    tripleChoice: {
      optionA: '일주일 내 신청 (추천) ✅',
      optionB: '2주 내 신청',
      optionC: '여유 있을 때',
      psychologyBridge: '권위성 + 행동',
      expectedConversion: 39,
    },
    emotionalFinish:
      '"당신의 결정력이 정말 대단합니다! 이런 분들이 우리 커뮤니티의 별입니다!"',
    urgencyTrigger: '지난주 가장 인기 있던 일정',
    estimatedConversion: 72,
    notes: '칭찬 + 소속감',
  },
  {
    id: 'e-soon-3',
    emotionalTone: 'excited',
    timeFrame: 'soon',
    tripleChoice: {
      optionA: '5일 내 신청 (초대 기한)',
      optionB: '2주 내 신청',
      optionC: '한달 내 신청',
      psychologyBridge: '특별함 + 행동',
      expectedConversion: 41,
    },
    emotionalFinish:
      '"당신은 정말 특별한 분입니다. 이 여행에서 당신을 만날 수 있어 정말 기대됩니다!"',
    urgencyTrigger: '특별 신청자 커뮤니티 초대',
    estimatedConversion: 73,
    notes: '프리미엄감, VIP 취급',
  },
];

// 7. 희망감 + 유연한 클로징 (3개)
const hopefulFlexible: ClosingVariant[] = [
  {
    id: 'h-flex-1',
    emotionalTone: 'hopeful',
    timeFrame: 'flexible',
    tripleChoice: {
      optionA: '2주 내 신청',
      optionB: '한달 내 신청',
      optionC: '2달 내 신청',
      psychologyBridge: '계획적 실행',
      expectedConversion: 33,
    },
    emotionalFinish:
      '"당신의 계획이 이루어지는 과정 자체가 이미 행복합니다. 천천히 가도 괜찮습니다."',
    urgencyTrigger: '한달 뒤 특가 이벤트',
    estimatedConversion: 65,
    notes: '느긋한 마음, 장기 계획',
  },
  {
    id: 'h-flex-2',
    emotionalTone: 'hopeful',
    timeFrame: 'flexible',
    tripleChoice: {
      optionA: '한달 내 신청',
      optionB: '2달 내 신청',
      optionC: '분기 내 신청',
      psychologyBridge: '자신의 속도',
      expectedConversion: 32,
    },
    emotionalFinish:
      '"당신의 준비가 될 때까지 기다리겠습니다. 이 여행은 당신 것입니다."',
    urgencyTrigger: '매달 새로운 특가',
    estimatedConversion: 63,
    notes: '여유 있는 선택, 개인의 속도 존중',
  },
  {
    id: 'h-flex-3',
    emotionalTone: 'hopeful',
    timeFrame: 'flexible',
    tripleChoice: {
      optionA: '3주 내 신청',
      optionB: '2달 내 신청',
      optionC: '3달 내 신청',
      psychologyBridge: '계절에 맞춘 선택',
      expectedConversion: 34,
    },
    emotionalFinish:
      '"계절과 시간, 모든 것이 당신을 위해 준비될 거예요. 당신의 속도를 신뢰하세요."',
    urgencyTrigger: '계절 변화에 따른 경험',
    estimatedConversion: 64,
    notes: '계절성 강조, 자연스러운 진행',
  },
];

// 8. 불안감 + 유연한 클로징 (3개)
const fearfulFlexible: ClosingVariant[] = [
  {
    id: 'f-flex-1',
    emotionalTone: 'fearful',
    timeFrame: 'flexible',
    tripleChoice: {
      optionA: '2주 내 (가격 고정)',
      optionB: '한달 내 (가격 미확정)',
      optionC: '2달 내 (가격 위험)',
      psychologyBridge: '점진적 위험',
      expectedConversion: 38,
    },
    emotionalFinish:
      '"당신이 지금 결정하지 않으면, 나중에 당신이 후회할 유일한 순간이 될 거예요."',
    urgencyTrigger: '매주 가격 검토 예정',
    estimatedConversion: 68,
    notes: '여유 있는 불안감, 점진적 압박',
  },
  {
    id: 'f-flex-2',
    emotionalTone: 'fearful',
    timeFrame: 'flexible',
    tripleChoice: {
      optionA: '한달 내 (50% 할인)',
      optionB: '2달 내 (30% 할인)',
      optionC: '3달 내 (10% 할인)',
      psychologyBridge: '할인액 급감',
      expectedConversion: 39,
    },
    emotionalFinish:
      '"모든 기회는 시간에 따라 작아집니다. 당신이 선택할 수 있을 때가 지금입니다."',
    urgencyTrigger: '매달 할인 20% 감소',
    estimatedConversion: 69,
    notes: '경제적 손실, 서서히 증가',
  },
  {
    id: 'f-flex-3',
    emotionalTone: 'fearful',
    timeFrame: 'flexible',
    tripleChoice: {
      optionA: '3주 내 (확정 날짜)',
      optionB: '2달 내 (대기 명단)',
      optionC: '3달 내 (품절 위험)',
      psychologyBridge: '선택지 감소',
      expectedConversion: 37,
    },
    emotionalFinish:
      '"당신이 기다리는 동안, 다른 누군가는 당신의 자리를 차지할 수도 있습니다."',
    urgencyTrigger: '분기별 좌석 제한 공지',
    estimatedConversion: 67,
    notes: '선택지 감소, 불확실성 증가',
  },
];

// 9. 흥분감 + 유연한 클로징 (3개)
const excitedFlexible: ClosingVariant[] = [
  {
    id: 'e-flex-1',
    emotionalTone: 'excited',
    timeFrame: 'flexible',
    tripleChoice: {
      optionA: '2주 내 신청! 🎯',
      optionB: '한달 내 신청',
      optionC: '2달 내 신청',
      psychologyBridge: '유연한 행동성',
      expectedConversion: 36,
    },
    emotionalFinish:
      '"당신의 이 결정이 당신의 인생을 바꿀 거라고 저희는 정말로 믿습니다!"',
    urgencyTrigger: '월간 신청 이벤트',
    estimatedConversion: 66,
    notes: '유연한 행동성, 지속적 응원',
  },
  {
    id: 'e-flex-2',
    emotionalTone: 'excited',
    timeFrame: 'flexible',
    tripleChoice: {
      optionA: '한달 내 신청 (추천) ✅',
      optionB: '2달 내 신청',
      optionC: '분기 내 신청',
      psychologyBridge: '권위성 + 유연함',
      expectedConversion: 35,
    },
    emotionalFinish:
      '"당신처럼 결정할 수 있는 분들이 우리 커뮤니티의 핵심입니다. 함께하고 싶습니다!"',
    urgencyTrigger: '월간 신청자 커뮤니티',
    estimatedConversion: 64,
    notes: '소속감, 월간 리듬',
  },
  {
    id: 'e-flex-3',
    emotionalTone: 'excited',
    timeFrame: 'flexible',
    tripleChoice: {
      optionA: '3주 내 신청 (초대 기한)',
      optionB: '2달 내 신청',
      optionC: '3달 내 신청',
      psychologyBridge: '특별함 + 여유',
      expectedConversion: 37,
    },
    emotionalFinish:
      '"당신의 선택을 정말 응원합니다! 당신의 여행이 정말 특별할 거라고 믿어요!"',
    urgencyTrigger: '특별 신청자 월간 모임',
    estimatedConversion: 65,
    notes: '프리미엄감, 월간 특별함',
  },
];

// 10. 고급 클로징 (3개 - 예외 상황)
const advancedClosing: ClosingVariant[] = [
  {
    id: 'adv-1',
    emotionalTone: 'hopeful',
    timeFrame: 'immediate',
    tripleChoice: {
      optionA: '지금 신청 (평생 기억)',
      optionB: '내일 신청 (소중한 결정)',
      optionC: '3일 뒤 신청 (신중한 선택)',
      psychologyBridge: '모든 선택이 훌륭함 + 긴박감',
      expectedConversion: 50,
    },
    emotionalFinish:
      '"당신이 어떤 선택을 하든, 우리는 당신의 가장 좋은 선택이 되겠습니다. 약속합니다."',
    urgencyTrigger: '당신을 위한 특별 제안 (24시간)',
    estimatedConversion: 80,
    notes: '최고 수준의 신뢰 + 여러 경로 활성화',
  },
  {
    id: 'adv-2',
    emotionalTone: 'fearful',
    timeFrame: 'immediate',
    tripleChoice: {
      optionA: '지금 신청 (100% 위험 제거)',
      optionB: '내일 신청 (90% 위험 제거)',
      optionC: '3일 뒤 신청 (70% 위험 제거)',
      psychologyBridge: '위험도 스펙트럼 선택',
      expectedConversion: 58,
    },
    emotionalFinish:
      '"당신이 선택한 어떤 경로든, 우리가 모든 불안감을 100% 제거해드리겠습니다."',
    urgencyTrigger: '위험도 점진 증가 (매 6시간)',
    estimatedConversion: 88,
    notes: '극도의 불안감 해소 + 위험도 선택',
  },
  {
    id: 'adv-3',
    emotionalTone: 'excited',
    timeFrame: 'immediate',
    tripleChoice: {
      optionA: '지금 신청! 🚀 (최상의 경험)',
      optionB: '내일 신청! ✨ (최고의 선택)',
      optionC: '3일 뒤 신청! 🌟 (모든 것이 준비됨)',
      psychologyBridge: '모든 선택에 행동성 + 긍정',
      expectedConversion: 52,
    },
    emotionalFinish:
      '"당신이 선택하신 그 순간, 당신의 인생이 바뀔 겁니다. 우리가 증명하겠습니다!"',
    urgencyTrigger: '지금이 최고의 순간! (3시간 카운트다운)',
    estimatedConversion: 87,
    notes: '극도의 긍정성 + 모든 경로 우상향',
  },
];

// 모든 변형 통합
export const allL10ClosingVariants: ClosingVariant[] = [
  ...hopefulImmediate,
  ...fearfulImmediate,
  ...excitedImmediate,
  ...hopefulSoon,
  ...fearfulSoon,
  ...excitedSoon,
  ...hopefulFlexible,
  ...fearfulFlexible,
  ...excitedFlexible,
  ...advancedClosing,
];

// 헬퍼 함수들
export function getVariantById(id: string): ClosingVariant | undefined {
  return allL10ClosingVariants.find((v) => v.id === id);
}

export function getVariantsByTone(
  tone: EmotionalTone
): ClosingVariant[] {
  return allL10ClosingVariants.filter((v) => v.emotionalTone === tone);
}

export function getVariantsByTimeFrame(timeFrame: TimeFrame): ClosingVariant[] {
  return allL10ClosingVariants.filter((v) => v.timeFrame === timeFrame);
}

/**
 * 주어진 감정톤과 시간프레임에 맞는 변형 중 전환율이 가장 높은 것을 반환.
 * 조건이 없으면 전체에서 최고 전환율 변형을 반환.
 * (프로덕션용 — 비결정적 Math.random() 사용하지 않음)
 */
export function getBestVariant(
  tone?: EmotionalTone,
  timeFrame?: TimeFrame
): ClosingVariant {
  let pool = allL10ClosingVariants;
  if (tone) pool = pool.filter((v) => v.emotionalTone === tone);
  if (timeFrame) pool = pool.filter((v) => v.timeFrame === timeFrame);
  if (pool.length === 0) pool = allL10ClosingVariants;
  return pool.reduce((best, v) =>
    v.estimatedConversion > best.estimatedConversion ? v : best
  );
}

export function getVariantsByConversionRate(
  minRate: number
): ClosingVariant[] {
  return allL10ClosingVariants.filter((v) => v.estimatedConversion >= minRate);
}

export function getTopPerformingVariants(
  limit: number = 5
): ClosingVariant[] {
  return [...allL10ClosingVariants]
    .sort((a, b) => b.estimatedConversion - a.estimatedConversion)
    .slice(0, limit);
}

export function getVariantSummary(): {
  total: number;
  byTone: Record<EmotionalTone, number>;
  byTimeFrame: Record<TimeFrame, number>;
  averageConversion: number;
  topPerformer: ClosingVariant;
} {
  const byTone = {
    hopeful: getVariantsByTone('hopeful').length,
    fearful: getVariantsByTone('fearful').length,
    excited: getVariantsByTone('excited').length,
  };

  const byTimeFrame = {
    immediate: getVariantsByTimeFrame('immediate').length,
    soon: getVariantsByTimeFrame('soon').length,
    flexible: getVariantsByTimeFrame('flexible').length,
  };

  const averageConversion =
    allL10ClosingVariants.reduce((sum, v) => sum + v.estimatedConversion, 0) /
    allL10ClosingVariants.length;

  const topPerformer = getTopPerformingVariants(1)[0];

  return {
    total: allL10ClosingVariants.length,
    byTone,
    byTimeFrame,
    averageConversion: Math.round(averageConversion),
    topPerformer,
  };
}
