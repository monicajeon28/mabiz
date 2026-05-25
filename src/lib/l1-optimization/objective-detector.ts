/**
 * L1 렌즈: 가격 이의 유형 감지
 *
 * 고객의 이의 텍스트에서 다음 5가지 유형을 자동으로 감지합니다:
 * 1. PRICE_HIGH: "비싸요", "가격이 높아요", "예상했던 가격보다 높네요"
 * 2. PAYMENT_TERMS: "한 번에 내기 힘들어요", "분할 결제 되나요"
 * 3. ROI_DOUBT: "이 가격에 그 정도 가치가 있나?", "효과가 있을까"
 * 4. COMPETITOR_COMPARE: "다른 곳은 더 싸던데", "경쟁사는..."
 * 5. AFFORD_DOUBT: "우리는 감당 못할 것 같은데", "재정이..."
 */

type ObjectiveType = 'PRICE_HIGH' | 'PAYMENT_TERMS' | 'ROI_DOUBT' | 'COMPETITOR_COMPARE' | 'AFFORD_DOUBT';

// 각 유형별 키워드 감지
const OBJECTIVE_KEYWORDS: Record<ObjectiveType, string[]> = {
  PRICE_HIGH: [
    '비싸', '가격', '높', '비용이 많이', '금액', '너무 비', '예상보다 비',
    '가격대', '금액 부담', '너무 많', '고가', '값이',
  ],
  PAYMENT_TERMS: [
    '분할', '할부', '한 번에', '나눠서', '월 단위', '결제', '분납', '내기 힘',
    '한 번에 내', '분할 결제', '할부 가능', '월별',
  ],
  ROI_DOUBT: [
    '효과', '가치', '효율', '돈값', '의미', '괜찮을까', '좋을까', '도움',
    '효과가 있을', '가치가 있을', '과연', '정말', '효과 본', 'ROI', '투자 수익',
  ],
  COMPETITOR_COMPARE: [
    '다른 곳', '경쟁', '비교', '더 싸', '더 좋', '대신', '다른 회사',
    '얘들은', '경쟁사', '비교 대상', '같은 상품', '유사한',
  ],
  AFFORD_DOUBT: [
    '감당', '재정', '여유', '현금', '대출', '신용', '능력', '여의치 않',
    '무리', '어렵', '버거', '부담스러', '힘들', '안 되',
  ],
};

// 부정 표현 (이의를 약화시킴)
const NEGATION_KEYWORDS = [
  '아니에요', '그런 건 아니고', '사실', '그런데도', '하지만', '근데',
  '아니 그게 아니라', '오해', '생각해보니',
];

export function detectL1ObjectiveType(text: string): ObjectiveType {
  if (!text || text.trim().length === 0) {
    return 'PRICE_HIGH'; // 기본값
  }

  const lowerText = text.toLowerCase();

  // 부정 표현이 있으면 신뢰도 낮춤
  const hasNegation = NEGATION_KEYWORDS.some(neg => lowerText.includes(neg.toLowerCase()));

  // 각 유형별 점수 계산
  const scores: Record<ObjectiveType, number> = {
    PRICE_HIGH: 0,
    PAYMENT_TERMS: 0,
    ROI_DOUBT: 0,
    COMPETITOR_COMPARE: 0,
    AFFORD_DOUBT: 0,
  };

  let typeKey: ObjectiveType;
  for (typeKey in OBJECTIVE_KEYWORDS) {
    const keywords = OBJECTIVE_KEYWORDS[typeKey];
    const matchCount = keywords.filter(keyword =>
      lowerText.includes(keyword.toLowerCase())
    ).length;

    scores[typeKey] = matchCount * (hasNegation ? 0.7 : 1.0); // 부정 표현은 70%만 가중
  }

  // 가장 높은 점수의 유형 반환
  let maxType: ObjectiveType = 'PRICE_HIGH';
  let maxScore = 0;

  for (typeKey in scores) {
    if (scores[typeKey] > maxScore) {
      maxScore = scores[typeKey];
      maxType = typeKey;
    }
  }

  return maxType;
}

/**
 * 고급: Contact의 과거 이의 패턴 기반 감지
 * 같은 고객이 반복해서 나타내는 이의 유형이 있다면 그 가능성을 높임
 */
export function detectL1ObjectiveTypeWithHistory(
  text: string,
  contactHistory?: Array<{
    objectiveType: ObjectiveType;
    count: number;
  }>
): ObjectiveType {
  const baseType = detectL1ObjectiveType(text);

  if (!contactHistory || contactHistory.length === 0) {
    return baseType;
  }

  // Contact의 과거 이의 유형 중 가장 빈번한 것 (가중치 0.3)
  const mostFrequent = contactHistory.reduce((prev, current) =>
    current.count > prev.count ? current : prev
  );

  // 만약 기본 감지 유형과 과거 패턴이 다르면, 70% 확률로 기본 감지 / 30% 확률로 과거 패턴
  if (baseType !== mostFrequent.objectiveType && Math.random() < 0.3) {
    return mostFrequent.objectiveType;
  }

  return baseType;
}

/**
 * 음성 텍스트에서 감정 강도 분석 (0-100)
 */
export function analyzeObjectionIntensity(text: string): number {
  const lowerText = text.toLowerCase();

  // 강한 표현
  const strongExpressions = ['절대 안', '정말 싫', '말도 안', '완전히 불가', '못 해'];
  const strongCount = strongExpressions.filter(expr =>
    lowerText.includes(expr.toLowerCase())
  ).length;

  // 약한 표현
  const weakExpressions = ['좀', '혹시', '혹시나', '생각만', '그럼'];
  const weakCount = weakExpressions.filter(expr =>
    lowerText.includes(expr.toLowerCase())
  ).length;

  // 기본 강도: 50 (중간)
  let intensity = 50;

  // 강한 표현 추가 (+10 each, max 30)
  intensity += Math.min(30, strongCount * 10);

  // 약한 표현 감소 (-10 each, min 0)
  intensity = Math.max(0, intensity - weakCount * 10);

  return intensity;
}
