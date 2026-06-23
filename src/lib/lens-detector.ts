/**
 * 렌즈 감지 엔진: Contact 데이터 → Grant Cardone 10렌즈 자동 분류
 * L0-L10: 부재중→가격→준비→경쟁→피처→의료→타이밍→동반자→재구매→신뢰→클로징
 */

export type LensType = "L0" | "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7" | "L8" | "L9" | "L10";

const LENS_LABELS: Record<LensType, string> = {
  L0: "부재중", L1: "가격이의", L2: "준비불안", L3: "경쟁사",
  L4: "피처중심", L5: "의료신뢰", L6: "타이밍", L7: "동반자",
  L8: "재구매", L9: "신뢰도", L10: "클로징",
};

interface ContactData {
  id?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  type?: string;
  cruiseInterest?: string | null;
  budgetRange?: string | null;
  lastContactedAt?: Date | string | null;
  createdAt?: Date | string | null;
  callLogs?: Array<{ content: string | null; createdAt: Date | string }>;
  memos?: Array<{ content: string; createdAt: Date | string }>;
  sourceType?: string | null;
  age?: number | null;
  maritalStatus?: string | null;
  childrenCount?: number | null;
  segment?: string | null;
  affiliateManagerId?: string | null;
  affiliateAgentId?: string | null;
}

/**
 * L0: 부재중 고객 (마지막 접촉 3개월 이상 전)
 */
function detectL0(data: ContactData): boolean {
  if (!data.lastContactedAt && !data.createdAt) return false;

  const lastContact = data.lastContactedAt
    ? new Date(data.lastContactedAt).getTime()
    : new Date(data.createdAt || 0).getTime();

  const now = new Date().getTime();
  const diffMs = now - lastContact;
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30);

  return diffMonths >= 3; // 3개월 이상 부재중
}

/**
 * L1: 가격 이의 (상담 기록/메모에서 "비싸", "가격" 등)
 */
function detectL1(data: ContactData): boolean {
  const priceKeywords = ["비싸", "가격", "비용", "저렴", "할인", "저가", "원가", "가성비"];
  const contentToAnalyze = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
  ].join(" ");

  return priceKeywords.some((kw) => contentToAnalyze.includes(kw));
}

/**
 * L2: 준비 불안 (예약, 여권, 준비, 불안, 복잡 등)
 */
function detectL2(data: ContactData): boolean {
  const prepKeywords = ["준비", "여권", "불안", "복잡", "어렵", "걱정", "몰라", "처음", "생소"];
  const contentToAnalyze = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
  ].join(" ");

  return prepKeywords.some((kw) => contentToAnalyze.includes(kw));
}

/**
 * L3: 경쟁사 언급 (다른 크루즈사 또는 경쟁 상품 언급)
 */
function detectL3(data: ContactData): boolean {
  const competitors = ["코스타", "로열", "노르웨이", "카니발", "디즈니", "싱가포르", "다른", "경쟁"];
  const contentToAnalyze = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
  ].join(" ");

  return competitors.some((comp) => contentToAnalyze.includes(comp));
}

/**
 * L4: 피처 중심 (객실, 기항지, 시설, 식사 등 구체적 요청)
 */
function detectL4(data: ContactData): boolean {
  const featureKeywords = [
    "객실", "발콩", "발코니", "기항지", "항구", "이탈리아", "그리스", "스위트",
    "식사", "다이닝", "라운지", "시설", "수영장", "엔터", "야외",
  ];
  const contentToAnalyze = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
    data.cruiseInterest || "",
  ].join(" ");

  return featureKeywords.some((feat) => contentToAnalyze.includes(feat));
}

/**
 * L5: 의료/건강 (배멀미, 당뇨, 고혈압, 약, 건강)
 */
function detectL5(data: ContactData): boolean {
  const healthKeywords = ["배멀미", "멀미", "당뇨", "고혈압", "약", "건강", "의료", "진료", "병원", "약먹"];
  const contentToAnalyze = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
  ].join(" ");

  return healthKeywords.some((kw) => contentToAnalyze.includes(kw));
}

/**
 * L6: 타이밍 (출발일, 시간 제약, "언제", "11월", "겨울" 등)
 */
function detectL6(data: ContactData): boolean {
  const timingKeywords = [
    "출발", "언제", "시간", "일정", "휴가", "연휴", "휴무", "봄", "여름", "가을", "겨울",
    "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월",
  ];
  const contentToAnalyze = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
    data.cruiseInterest || "",
  ].join(" ");

  return timingKeywords.some((kw) => contentToAnalyze.includes(kw));
}

/**
 * L7: 동반자 (가족, 부모, 배우자, 친구, "같이", "동의" 등)
 */
function detectL7(data: ContactData): boolean {
  const companionKeywords = [
    "가족", "부모", "배우자", "남편", "아내", "친구", "같이", "동의", "허락",
    "자녀", "아이", "아들", "딸", "함께",
  ];
  const contentToAnalyze = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
  ].join(" ");

  // maritalStatus, childrenCount도 고려
  const hasFamily =
    (data.maritalStatus && data.maritalStatus !== "SINGLE") || (data.childrenCount && data.childrenCount > 0);

  return companionKeywords.some((kw) => contentToAnalyze.includes(kw)) || Boolean(hasFamily);
}

/**
 * L8: 재구매/습관 (구매 이력 있거나 type=CUSTOMER, sourceType=user)
 */
function detectL8(data: ContactData): boolean {
  const isRepeat = data.type === "CUSTOMER" || data.sourceType === "user";
  const repeatKeywords = ["재구매", "다시", "전에", "이전", "또", "습관", "정기"];
  const contentToAnalyze = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
  ].join(" ");

  return isRepeat || repeatKeywords.some((kw) => contentToAnalyze.includes(kw));
}

/**
 * L9: 신뢰도/권위성 (제휴 매니저가 있거나, 고예산, VIP 태그)
 */
function detectL9(data: ContactData): boolean {
  const hasAffiliateManager = !!data.affiliateManagerId;
  const isHighBudget = data.budgetRange && (data.budgetRange.includes("300") || data.budgetRange.includes("400"));
  const isVip = data.segment === "VIP" || (data.callLogs || []).length >= 5;

  return hasAffiliateManager || isHighBudget || isVip;
}

/**
 * L10: 즉시 구매 클로징 (마지막 접촉 최근 7일 내, 긍정적 신호)
 */
function detectL10(data: ContactData): boolean {
  if (!data.lastContactedAt) return false;

  const lastContact = new Date(data.lastContactedAt).getTime();
  const now = new Date().getTime();
  const diffDays = (now - lastContact) / (1000 * 60 * 60 * 24);

  // 최근 7일 내 접촉 + 긍정적 신호
  const recentContact = diffDays <= 7;
  const positiveKeywords = ["관심", "좋", "괜찮", "가능", "예약", "결정", "확정", "동의"];
  const contentToAnalyze = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
  ].join(" ");

  return recentContact && positiveKeywords.some((kw) => contentToAnalyze.includes(kw));
}

/**
 * 메인 함수: Contact 데이터 → 렌즈 배열
 */
export function detectLenses(data: ContactData): LensType[] {
  const detectors: Array<[LensType, (d: ContactData) => boolean]> = [
    ["L0", detectL0],
    ["L1", detectL1],
    ["L2", detectL2],
    ["L3", detectL3],
    ["L4", detectL4],
    ["L5", detectL5],
    ["L6", detectL6],
    ["L7", detectL7],
    ["L8", detectL8],
    ["L9", detectL9],
    ["L10", detectL10],
  ];

  return detectors.filter(([_, detector]) => detector(data)).map(([lens]) => lens);
}

/**
 * 렌즈 배열 → 한글 라벨 배열
 */
export function getLensLabels(lenses: LensType[]): string[] {
  return lenses.map((lens) => LENS_LABELS[lens]);
}

/**
 * 우선순위 순서 (가장 먼저 대응해야 할 렌즈)
 */
export function sortLensesByPriority(lenses: LensType[]): LensType[] {
  const priority: Record<LensType, number> = {
    L0: 1,  // 부재중 - 즉시 재활성화
    L10: 2, // 클로징 - 즉시 클로징
    L6: 3,  // 타이밍 - 긴박감
    L1: 4,  // 가격이의 - 가치 재정의
    L2: 5,  // 준비불안 - 불안 해소
    L5: 6,  // 의료신뢰 - 권위성
    L7: 7,  // 동반자 - 가족 설득
    L3: 8,  // 경쟁사 - 차별성 강조
    L4: 9,  // 피처 - 요청 충족
    L8: 10, // 재구매 - 습관화
    L9: 11, // 신뢰도 - 이미 높음
  };

  return [...lenses].sort((a, b) => priority[a] - priority[b]);
}

/**
 * ContactLensTab용 렌즈 점수 객체 생성
 * 감지된 렌즈: 100점, 미감지: 0점
 */
export function getLensScores(data: ContactData): Record<LensType, number> {
  const lenses = detectLenses(data);
  const scores: Record<LensType, number> = {
    L0: 0, L1: 0, L2: 0, L3: 0, L4: 0,
    L5: 0, L6: 0, L7: 0, L8: 0, L9: 0, L10: 0,
  };

  // 감지된 렌즈는 100점
  for (const lens of lenses) {
    scores[lens] = 100;
  }

  return scores;
}
