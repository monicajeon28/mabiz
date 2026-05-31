/**
 * Phase 4C: Risk Flag 자동 감지 (10개 신호 + 가중치)
 * 거래 위험도를 0-100점으로 산출 → 자동 개입 트리거
 */

export type RiskFlagType =
  | "INACTIVE_1WEEK"      // L0: 1주 부재중
  | "INACTIVE_1MONTH"     // L0: 1개월 부재중
  | "INACTIVE_6MONTH"     // L0: 6개월 부재중
  | "PRICE_OBJECTION"     // L1: 가격 이의 미해결
  | "PREP_INCOMPLETE"     // L2: 준비 미흡
  | "COMPETITOR_STRONG"   // L3: 경쟁사 강력 언급
  | "DEPOSIT_OVERDUE"     // L6: 예약금 미입금
  | "DEPARTURE_URGENT"    // L6: 출발 30일 이내
  | "FAMILY_UNCONFIRMED"  // L7: 가족 동의 미확보
  | "MEDICAL_UNCONFIRMED" // L5: 의료 미확인
  | "CHURN_RISK";         // L8: 재구매 위험

interface RiskFlag {
  flag: RiskFlagType;
  label: string;
  severity: "P0" | "P1" | "P2"; // P0: 즉시 개입, P1: 24시간, P2: 48시간
  weight: number; // 0-100
  action: string; // 추천 액션
}

const RISK_FLAGS: Record<RiskFlagType, RiskFlag> = {
  // L0: 부재중 (최우선 - 고객 이탈 위험)
  INACTIVE_1WEEK: {
    flag: "INACTIVE_1WEEK",
    label: "1주 이상 부재중",
    severity: "P1",
    weight: 20,
    action: "Day 0-3 재활성화 SMS 시작 또는 전화 콜",
  },
  INACTIVE_1MONTH: {
    flag: "INACTIVE_1MONTH",
    label: "1개월 이상 부재중",
    severity: "P0",
    weight: 35,
    action: "긴급 전화 콜 + 특별 할인 제안",
  },
  INACTIVE_6MONTH: {
    flag: "INACTIVE_6MONTH",
    label: "6개월 이상 부재중",
    severity: "P0",
    weight: 50,
    action: "이탈 고객 재획득 캠페인 (프리미엄 패키지 제안)",
  },

  // L1: 가격 이의 (중요도 높음)
  PRICE_OBJECTION: {
    flag: "PRICE_OBJECTION",
    label: "가격 이의 미해결",
    severity: "P1",
    weight: 25,
    action: "가격 재협상 또는 가치 추가 (업그레이드 등)",
  },

  // L2: 준비 미흡 (후속 조치 필요)
  PREP_INCOMPLETE: {
    flag: "PREP_INCOMPLETE",
    label: "준비 미흡 (여권/비자 미확인)",
    severity: "P1",
    weight: 22,
    action: "여권/비자 확인 면담 + 신청 대행 안내",
  },

  // L3: 경쟁사 (즉시 개입)
  COMPETITOR_STRONG: {
    flag: "COMPETITOR_STRONG",
    label: "경쟁사 강력 언급",
    severity: "P0",
    weight: 30,
    action: "차별성 강조 + 추가 혜택 제안 (객실 업그레이드 등)",
  },

  // L6: 예약금 미입금 (거래 완성도 낮음)
  DEPOSIT_OVERDUE: {
    flag: "DEPOSIT_OVERDUE",
    label: "예약금 미입금 (결정 후 3일+)",
    severity: "P1",
    weight: 28,
    action: "결제 링크 재전송 + 결제 절차 확인",
  },

  // L6: 출발 임박 (미최종 확인)
  DEPARTURE_URGENT: {
    flag: "DEPARTURE_URGENT",
    label: "출발 30일 이내 (미최종 확인)",
    severity: "P0",
    weight: 40,
    action: "여권/탑승권/특수식 최종 확인 + 여행 안내",
  },

  // L7: 가족 동의 미확보 (의사결정 미완)
  FAMILY_UNCONFIRMED: {
    flag: "FAMILY_UNCONFIRMED",
    label: "가족 동의 미확보",
    severity: "P2",
    weight: 18,
    action: "배우자/가족 함께 상담 초대 + 가족 혜택 설명",
  },

  // L5: 의료 미확인 (배멀미 등)
  MEDICAL_UNCONFIRMED: {
    flag: "MEDICAL_UNCONFIRMED",
    label: "의료 요청 미확인 (배멀미/약 등)",
    severity: "P2",
    weight: 15,
    action: "의료 담당자 상담 + 배멀미약 사전 처방",
  },

  // L8: 재구매 위험 (고객 이탈)
  CHURN_RISK: {
    flag: "CHURN_RISK",
    label: "재구매 위험 (1년 이상 미구매 또는 VIP 활동 저하)",
    severity: "P1",
    weight: 32,
    action: "VIP 특별 혜택 제안 + 로열티 프로그램 재활성화",
  },
};

interface ContactRiskData {
  id?: string;
  name?: string;
  type?: string;
  lastContactedAt?: string | Date | null;
  createdAt?: string | Date;
  segment?: string | null;
  leadScore?: number;
  adminMemo?: string | null;
  callLogs?: Array<{ content: string | null; createdAt: string | Date }>;
  memos?: Array<{ content: string; createdAt: string | Date }>;
  departureDate?: string | null;
  purchasedAt?: string | Date | null; // 구매 날짜 (재구매 판단)
  tags?: string[] | null;
}

/**
 * INACTIVE_1WEEK: 1주 이상 부재중
 */
function checkInactive1Week(data: ContactRiskData): boolean {
  if (!data.lastContactedAt) return false;
  const lastContact = new Date(data.lastContactedAt).getTime();
  const now = new Date().getTime();
  const diffDays = (now - lastContact) / (1000 * 60 * 60 * 24);
  return diffDays >= 7;
}

/**
 * INACTIVE_1MONTH: 1개월 이상 부재중
 */
function checkInactive1Month(data: ContactRiskData): boolean {
  if (!data.lastContactedAt) return false;
  const lastContact = new Date(data.lastContactedAt).getTime();
  const now = new Date().getTime();
  const diffDays = (now - lastContact) / (1000 * 60 * 60 * 24);
  return diffDays >= 30;
}

/**
 * INACTIVE_6MONTH: 6개월 이상 부재중
 */
function checkInactive6Month(data: ContactRiskData): boolean {
  if (!data.lastContactedAt) return false;
  const lastContact = new Date(data.lastContactedAt).getTime();
  const now = new Date().getTime();
  const diffDays = (now - lastContact) / (1000 * 60 * 60 * 24);
  return diffDays >= 180;
}

/**
 * PRICE_OBJECTION: 가격 이의 키워드 포함 + 미해결
 */
function checkPriceObjection(data: ContactRiskData): boolean {
  const keywords = ["비싸", "가격", "비용", "저렴해", "할인 안 되"];
  const content = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
  ].join(" ");

  const hasPriceKeyword = keywords.some((kw) => content.includes(kw));
  const recentCallLog = (data.callLogs || []).find((log) => {
    const diff = (new Date().getTime() - new Date(log.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7; // 지난 7일
  });

  return hasPriceKeyword && Boolean(recentCallLog);
}

/**
 * PREP_INCOMPLETE: 준비 미흡 신호 (여권, 비자 미확인)
 */
function checkPrepIncomplete(data: ContactRiskData): boolean {
  const keywords = ["여권", "비자", "준비", "서류", "미확인", "언제까지"];
  const content = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
  ].join(" ");

  return keywords.some((kw) => content.includes(kw));
}

/**
 * COMPETITOR_STRONG: 경쟁사 강력 언급
 */
function checkCompetitorStrong(data: ContactRiskData): boolean {
  const competitors = ["코스타", "로열", "노르웨이", "다른 회사", "경쟁사"];
  const negativeWords = ["더 싸다", "더 좋다", "가봐야", "비교"];
  const content = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
  ].join(" ");

  const hasCompetitor = competitors.some((comp) => content.includes(comp));
  const hasNegative = negativeWords.some((word) => content.includes(word));

  return hasCompetitor && hasNegative;
}

/**
 * DEPOSIT_OVERDUE: 예약금 미입금 (결정 후 3일+)
 */
function checkDepositOverdue(data: ContactRiskData): boolean {
  const lastPositiveCall = (data.callLogs || []).find((log) => {
    const content = log.content || "";
    const keywords = ["관심", "좋다", "예약", "확정"];
    return keywords.some((kw) => content.includes(kw));
  });

  if (!lastPositiveCall) return false;

  const diff = (new Date().getTime() - new Date(lastPositiveCall.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 3 && data.leadScore !== undefined && data.leadScore >= 70; // 긍정 신호 이후 3일+
}

/**
 * DEPARTURE_URGENT: 출발 30일 이내 (미최종 확인)
 */
function checkDepartureUrgent(data: ContactRiskData): boolean {
  if (!data.departureDate) return false;

  const diff = (new Date(data.departureDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
  const isUrgent = diff > 0 && diff <= 30;

  if (!isUrgent) return false;

  // 최근 여권/탑승권 관련 기록이 없으면 미최종 확인
  const content = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
  ].join(" ");

  const recentDays = 7;
  const recentLog = (data.callLogs || []).find(
    (log) => (new Date().getTime() - new Date(log.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= recentDays
  );

  return isUrgent && !recentLog;
}

/**
 * FAMILY_UNCONFIRMED: 가족 동의 미확보
 */
function checkFamilyUnconfirmed(data: ContactRiskData): boolean {
  const content = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
  ].join(" ");

  const familyKeywords = ["배우자", "남편", "아내", "가족", "동의"];
  const hasFamilyMention = familyKeywords.some((kw) => content.includes(kw));

  // 가족 언급 있지만 "동의했다" 같은 긍정 신호 없으면
  return hasFamilyMention && !content.includes("동의");
}

/**
 * MEDICAL_UNCONFIRMED: 의료 미확인 (배멀미 등)
 */
function checkMedicalUnconfirmed(data: ContactRiskData): boolean {
  const content = [
    ...((data.callLogs || []).map((l) => l.content || "") || []),
    ...((data.memos || []).map((m) => m.content || "") || []),
  ].join(" ");

  const medicalKeywords = ["배멀미", "멀미", "건강", "약", "의료"];
  const hasMedicalMention = medicalKeywords.some((kw) => content.includes(kw));

  // 의료 언급 있지만 "해결됐다" 같은 긍정 신호 없으면
  return hasMedicalMention && !content.includes("괜찮");
}

/**
 * CHURN_RISK: 재구매 위험 (1년 이상 미구매 또는 VIP 활동 저하)
 */
function checkChurnRisk(data: ContactRiskData): boolean {
  // Case 1: 이전 구매 고객 (type=CUSTOMER)이지만 1년 이상 미구매
  const isPrevCustomer = data.type === "CUSTOMER";
  if (isPrevCustomer && data.purchasedAt) {
    const diff = (new Date().getTime() - new Date(data.purchasedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (diff >= 365) return true;
  }

  // Case 2: VIP 고객이지만 leadScore 떨어짐 또는 부재중
  const isVip = data.segment === "VIP" || (data.leadScore !== undefined && data.leadScore >= 70);
  if (isVip && data.leadScore !== undefined && data.leadScore < 30) return true;

  // Case 3: VIP이지만 최근 활동 없음
  if (isVip && data.lastContactedAt) {
    const diff = (new Date().getTime() - new Date(data.lastContactedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (diff >= 30) return true; // 30일 이상 부재중
  }

  return false;
}

/**
 * 메인 함수: Contact 데이터 → Risk Flag 배열 + 점수
 */
export function detectRiskFlags(data: ContactRiskData): {
  flags: RiskFlagType[];
  riskScore: number; // 0-100
  severity: "GREEN" | "YELLOW" | "RED"; // GREEN: 0-30, YELLOW: 31-70, RED: 71-100
} {
  const detectors: Array<[RiskFlagType, (d: ContactRiskData) => boolean]> = [
    ["INACTIVE_6MONTH", checkInactive6Month],
    ["INACTIVE_1MONTH", checkInactive1Month],
    ["INACTIVE_1WEEK", checkInactive1Week],
    ["PRICE_OBJECTION", checkPriceObjection],
    ["PREP_INCOMPLETE", checkPrepIncomplete],
    ["COMPETITOR_STRONG", checkCompetitorStrong],
    ["DEPOSIT_OVERDUE", checkDepositOverdue],
    ["DEPARTURE_URGENT", checkDepartureUrgent],
    ["FAMILY_UNCONFIRMED", checkFamilyUnconfirmed],
    ["MEDICAL_UNCONFIRMED", checkMedicalUnconfirmed],
    ["CHURN_RISK", checkChurnRisk],
  ];

  const flags = detectors
    .filter(([_, detector]) => detector(data))
    .map(([flag]) => flag);

  // 점수 계산 (가중치 합산)
  const riskScore = Math.min(
    100,
    flags.reduce((sum, flag) => sum + (RISK_FLAGS[flag]?.weight || 0), 0)
  );

  const severity = riskScore >= 71 ? "RED" : riskScore >= 31 ? "YELLOW" : "GREEN";

  return { flags, riskScore, severity };
}

/**
 * Risk Flag 상세 정보 조회
 */
export function getRiskFlagDetails(flag: RiskFlagType): RiskFlag {
  return RISK_FLAGS[flag];
}

/**
 * Risk Flag 배열 → 상세 배열
 */
export function getRiskFlagDetails_Array(flags: RiskFlagType[]): RiskFlag[] {
  return flags.map((flag) => RISK_FLAGS[flag]).filter((f): f is RiskFlag => !!f);
}

/**
 * P0 우선순위 Flag만 추출 (즉시 개입)
 */
export function getP0Flags(flags: RiskFlagType[]): RiskFlagType[] {
  return flags.filter((flag) => RISK_FLAGS[flag]?.severity === "P0");
}
