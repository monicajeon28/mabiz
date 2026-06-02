/**
 * 크루즈닷 랜딩페이지 렌즈 감지 엔진
 *
 * 랜딩폼 입력값 (문제, 여행유형, 예산) → Grant Cardone 렌즈 자동 분류
 * 목적: Day 0-3 SMS 시퀀스 자동 선택
 */

export type LandingLensType = 'L0' | 'L1' | 'L2' | 'L6' | 'L10';

interface LandingFormData {
  problem?: string | null | undefined;
  travelType?: string | null | undefined;
  budget?: string | null | undefined;
}

const LENS_CONFIDENCE: Record<LandingLensType, string> = {
  L0: '부재중', // 신규 고객
  L1: '가격이의', // 예산 민감
  L2: '준비불안', // 복잡도
  L6: '타이밍', // 긴박감
  L10: '클로징' // 의사결정 가능
};

/**
 * 랜딩폼 데이터 기반 렌즈 감지
 *
 * 우선순위 (상위부터 체크):
 * 1. L6 (타이밍) - "긴박감"이 있는 경우
 * 2. L10 (클로징) - "지금 바로", "할인", "한정" 등 긴박감 + 예산 명확
 * 3. L1 (가격이의) - 예산이 낮은 경우
 * 4. L2 (준비불안) - 복잡도 높음 (여권, 출국, 등)
 * 5. L0 (부재중/신규) - 기본값
 */
export function detectLandingLens(data: LandingFormData): LandingLensType {
  const problem = data.problem ?? '';
  const travelType = data.travelType ?? '';
  const budget = data.budget ?? '';
  const textToAnalyze = `${problem} ${travelType} ${budget}`.toLowerCase();

  // 1. L6 감지: 타이밍 & 긴박감
  if (hasTimingUrgency(textToAnalyze)) {
    return 'L6';
  }

  // 2. L10 감지: 클로징 신호 (명확한 의사결정)
  if (hasClosingSignals(problem || undefined, budget || undefined, travelType || undefined)) {
    return 'L10';
  }

  // 3. L1 감지: 가격 민감도
  if (hasPriceSensitivity(budget || undefined, textToAnalyze)) {
    return 'L1';
  }

  // 4. L2 감지: 준비 복잡도
  if (hasPreparationAnxiety(textToAnalyze)) {
    return 'L2';
  }

  // 5. L0 기본값: 신규 고객
  return 'L0';
}

/**
 * L6: 타이밍 & 긴박감 감지
 * 키워드: "지금", "빨리", "내일", "이번주", "한정", "남았", "마감"
 */
function hasTimingUrgency(text: string | null | undefined): boolean {
  if (!text) return false;

  const urgencyKeywords = [
    '지금',
    '빨리',
    '내일',
    '이번주',
    '한정',
    '남았',
    '마감',
    '곧',
    '급하',
    '서둘러'
  ];

  return urgencyKeywords.some(kw => text.includes(kw));
}

/**
 * L10: 클로징 신호 (구매 의지 + 예산 명확)
 * 조건:
 * - 예산이 구체적이고 명확함
 * - 여행 유형이 정해져 있음
 * - "지금 가고 싶다" 같은 적극적 신호
 */
function hasClosingSignals(
  problem: string | undefined,
  budget: string | undefined,
  travelType: string | undefined
): boolean {
  const text = `${problem || ''} ${budget || ''} ${travelType || ''}`.toLowerCase();

  // 예산이 구체적 (숫자 포함)
  const hasBudgetAmount: boolean =
    budget != null && /\d+/.test(budget);

  // 여행 유형이 정해짐
  const hasTravelType: boolean = travelType != null &&
    (travelType.includes('국내') ||
     travelType.includes('해외') ||
     travelType.includes('프리미엄'));

  // 적극적 신호
  const hasActiveSignal = [
    '가고싶',
    '예약하고싶',
    '지금바로',
    '꼭가고',
    '꼭가야'
  ].some(kw => text.includes(kw));

  return hasBudgetAmount && hasTravelType && hasActiveSignal;
}

/**
 * L1: 가격 민감도 감지
 * 조건:
 * - 예산이 낮음 (20-30만원)
 * - 또는 "저렴", "싼", "할인" 키워드
 */
function hasPriceSensitivity(
  budget: string | undefined,
  text: string
): boolean {
  const priceKeywords = ['저렴', '싼', '할인', '저가', '싸다'];

  // 낮은 예산대
  const isLowBudget: boolean = budget != null &&
    (budget.includes('20') ||
     budget.includes('30') ||
     budget.includes('경제'));

  // 가격 관련 키워드
  const hasPriceKeyword = priceKeywords.some(kw => text.includes(kw));

  return isLowBudget || hasPriceKeyword;
}

/**
 * L2: 준비 불안감 감지
 * 키워드: "여권", "준비", "출국", "비자", "불안", "처음", "어떻게"
 */
function hasPreparationAnxiety(text: string | null | undefined): boolean {
  if (!text) return false;

  const anxietyKeywords = [
    '여권',
    '준비',
    '출국',
    '비자',
    '불안',
    '처음',
    '어떻게',
    '걱정',
    '몰라',
    '복잡',
    '어렵',
    '처음인데'
  ];

  return anxietyKeywords.some(kw => text.includes(kw));
}

/**
 * 렌즈별 Day 0-3 메시지 템플릿 (추후 SMS 자동화와 연계)
 */
export const LENS_SMS_TEMPLATES: Record<LandingLensType, Record<string, string>> = {
  L0: {
    day0: '[크루즈닷] 신규 고객님, 환영합니다! 🎉\n당신의 크루즈 여행을 100% 안전하게 준비해드릴 준비가 되어있습니다.\n2시간 내 매니저 연락을 기다려주세요.',
    day1: '혹시 크루즈 여행 준비, 어렵지 않으세요? 마비즈 매니저가 처음부터 끝까지 도와드립니다.',
    day2: '지난주 142명이 크루즈닷으로 신청했습니다. 당신도 안전한 크루즈 여행을 경험해보세요.',
    day3: '[마감 임박] 이번주 할인 10석 남았습니다. 지금 신청하면 평생 30% 할인! 📞'
  },
  L1: {
    day0: '[크루즈닷] 월 33,000원부터 크루즈 여행 시작하세요! 💳\n국내 크루즈, 금융으로 부담 없이 즐기세요.',
    day1: '저렴한 패키지만 고르면 후회합니다. 왜 마비즈가 더 비싼지 알려드릴게요.',
    day2: '같은 가격이면 더 좋은 서비스를 받으세요. 크루즈닷의 차별성을 알아보세요.',
    day3: '[한정] 금주 신청 시 첫 달 30% 할인! 지금 바로 신청하세요. 🎁'
  },
  L2: {
    day0: '[크루즈닷] 크루즈 여행, 처음이어도 괜찮습니다! 👋\n여권부터 출국까지, 우리가 도와드립니다.',
    day1: '여권 준비, 비자, 출국 절차... 복잡하면 우리에게 맡기세요.',
    day2: '지난 3년, 1,200명이 안전하게 크루즈를 즐겼습니다. 당신도 할 수 있습니다.',
    day3: '[지금 신청] 첫 여행자 특가 159만원 (3박 프리미엄) + 여행 가이드 무료! 📘'
  },
  L6: {
    day0: '[크루즈닷] ⏰ 이번주 마감입니다!\n남은 10석, 지금 신청하면 평생 30% 할인!',
    day1: '내일 마감됩니다. 더 이상 기다리지 마세요.',
    day2: '딱 24시간 남았습니다. 지금 신청하세요. 📞',
    day3: '[최종] 오늘 23:59까지만 신청 가능합니다. 💥'
  },
  L10: {
    day0: '[크루즈닷] 확정하시겠습니까? 🎯\n지금 신청하면 예약금 0원, 월 할부로 시작합니다.',
    day1: '결정하셨나요? 매니저가 예약 확정을 도와드립니다. 📋',
    day2: '당신의 크루즈는 준비되어 있습니다. 이제 결정만 하세요.',
    day3: '[최종 오퍼] 지금 신청하면 보험료 무료 + 사진 에디팅 무료! ✨'
  }
};

/**
 * 렌즈별 매니저 콜 스크립트 (추후 연동)
 */
export const LENS_CALL_SCRIPTS: Record<LandingLensType, string> = {
  L0: '[신규] 안녕하세요, 마비즈 매니저 ★입니다. 크루즈닷 신청해주셨네요. 어떤 크루즈를 꿈꾸세요?',
  L1: '[가격] 안녕하세요. 저희가 더 비싼 이유를 5분만에 설명해드릴게요. 지금 시간 괜찮으세요?',
  L2: '[준비] 안녕하세요. 여행 준비 때문에 걱정이시군요. 저희는 처음부터 끝까지 도와드립니다.',
  L6: '[타이밍] 안녕하세요! 남은 석수가 10석뿐이거든요. 지금 신청하면 평생 할인을 해드립니다.',
  L10: '[클로징] 안녕하세요, 매니저 ★입니다. 예약 확정해드릴게요. 선호하는 크루즈가 있으세요?'
};
