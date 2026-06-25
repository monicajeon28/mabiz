export interface CallLog {
  id: string;
  content: string | null;
  result: string | null;
  duration: number | null;
  convictionScore: number | null;
  nextAction: string | null;
  scheduledAt: string | null;
  createdAt: string;
  _sharedFrom?: string;
  _authorName?: string | null;
}

export interface Memo {
  id: string;
  content: string;
  createdAt: string;
  _authorName?: string | null;
}

export interface InquiryTracking {
  timestamp?: string | null;
  capturedAt?: string | null;
  source?: string | null;
  productName?: string | null;
  productCode?: string | null;
  pageUrl?: string | null;
  userAgent?: string | null;
  deviceType?: string | null;
  ip?: string | null;
  isGold?: boolean | null;
}

export interface SurveyData {
  q1?: string | null;
  q2?: string | null;
  q3?: string | null;
  inquiryTracking?: InquiryTracking | null;
  [key: string]: unknown;
}

export interface SignupHistoryEntry {
  index?: number;
  landingPageId?: string | null;
  landingPageTitle?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  createdAt?: string;
  email?: string;
  phone?: string;
  date: string;
  responseTime?: number;
}

export type ContactVisibility = 'SHARED' | 'ADMIN_ONLY';

export interface ContactShare {
  id: string;
  sharedBy: string;
  sharedTo: string;
  createdAt: string; // DateTime → string (ISO 8601)
}

export interface Contact {
  // ===== P0: 기본 필드 (필수) =====
  id: string;
  name: string;
  phone: string;
  email: string | null;
  organizationId: string; // P0 추가: 조직 ID (멀티테넌트)
  type: string;
  leadScore: number;

  // ===== 기본 정보 =====
  cruiseInterest: string | null;
  budgetRange: string | null;
  adminMemo: string | null;
  assignedUserId: string | null;
  productName: string | null;
  bookingRef: string | null;
  tags: string[];
  sourceOrgId: string | null;

  // ===== 연락처 추적 =====
  lastContactedAt: string | null;
  departureDate: string | null;
  purchasedAt: string | null;

  // ===== 결제 상태 =====
  lastPaymentStatus?: string | null;
  lastPaymentAt?: string | null;
  lastRefundedAt?: string | null;
  paymentStatusNote?: string | null;

  // ===== 엑셀 가져오기 =====
  inflowDate?: string | null;
  surveyData?: SurveyData | null;

  // ===== 신청 이력 =====
  signupCount?: number;
  signupHistory?: SignupHistoryEntry[];

  // ===== 인구통계 =====
  age?: number | null;
  maritalStatus?: string | null;
  childrenCount?: number | null;
  gender?: string | null;
  segmentOverride?: string | null;

  // ===== 유입 출처 =====
  sourceType?: string | null;

  // ===== P1: RBAC 공유 설정 =====
  visibility?: ContactVisibility;
  sharedWith?: ContactShare[];
  createdBy?: string | null; // P1 추가: 생성자 사용자 ID
  managerId?: string | null; // P1 추가: 담당 관리자 (지사장)
  userId?: number | null; // P1 추가: GmUser ID

  // ===== P1: 메타데이터 =====
  createdAt?: string; // DateTime → string
  updatedAt?: string; // DateTime → string
  deletedAt?: string | null; // 소프트삭제 추적
  deletedBy?: string | null;
  deletedByName?: string | null;

  // ===== P1: 관계 필드 (필수: API 응답에 항상 포함) =====
  groups: { group: { id: string; name: string } }[];
  callLogs: CallLog[];
  memos: Memo[];
  sharedCallLogs: (CallLog & { _sharedFrom: string })[];
  vipSequences: { id: string; funnelId: string; status: string; startDate: string }[];

  // ===== P1: 기타 필드 =====
  riskScore?: number; // 0-100 (낮을수록 정상)
  lensInfo?: Record<string, number>; // Json → Record (L0-L10 점수: 0-100)
  channel?: string; // 기본값: "direct"
  status?: string | null; // "ACTIVE", "INACTIVE", "PENDING_DELETION"
  affiliateCode?: string | null;
  partnerId?: string | null;

  // ===== P2: L0 렌즈 - 부재중 고객 재활성화 (Menu #47) =====
  reactivationSegment?: string | null; // "3-6m", "6-12m", "1y+"
  reactivationLikelihood?: number;
  lastCruiseDate?: string | null;
  lastSatisfactionScore?: number | null;
  cruiseCount?: number;
  vipStatus?: string | null;
  smsDay0Sent?: boolean;
  smsDay0SentAt?: string | null;
  smsDay1Sent?: boolean;
  smsDay1SentAt?: string | null;
  smsDay2Sent?: boolean;
  smsDay2SentAt?: string | null;
  smsDay3Sent?: boolean;
  smsDay3SentAt?: string | null;
  smsDay7Sent?: boolean;
  smsDay7SentAt?: string | null;
  emailDay0Sent?: boolean;
  emailDay0SentAt?: string | null;
  emailDay1Sent?: boolean;
  emailDay1SentAt?: string | null;
  emailDay2Sent?: boolean;
  emailDay2SentAt?: string | null;
  emailDay3Sent?: boolean;
  emailDay3SentAt?: string | null;

  // ===== P2: L2 렌즈 - 준비 불안도 평가 (Menu #48) =====
  anxietyScore?: number;
  anxietyCategory?: string | null; // "low", "medium", "high"
  preparationStage?: string | null;
  visaRequired?: boolean;
  passportDaysLeft?: number | null;
  firstTimeCruise?: boolean;
  familyWithKids?: boolean;
  healthConcerns?: string | null;
  anxietyAssessmentAt?: string | null;
  anxietySequenceStartedAt?: string | null;

  // ===== P2: L3 렌즈 - 차별성 미인지형 고객 (Menu #49) =====
  competitorMentioned?: boolean;
  competitorNames?: string[];
  lastCompetitorMentionAt?: string | null;
  lastCompetitorName?: string | null;
  differentiationScore?: number;
  hotelExperienceLevel?: string | null;
  preparationFrameworkLevel?: string | null;
  differentiationResponseSent?: boolean;
  lastDifferentiationResponseAt?: string | null;
  comparisonDocumentId?: string | null;
  differentiationSequenceStartedAt?: string | null;

  // ===== P2: L5 렌즈 - 자기투영 (Menu #55 - Part 1) =====
  selfProjectionScore?: number;
  selfProjectionType?: string | null;
  personalHealthCondition?: string | null;
  personalHealthConcern?: string | null;
  compoundHealthRisk?: boolean;
  spouseHealthCondition?: string | null;
  spouseHealthConcern?: string | null;
  familyHealthProfile?: Record<string, unknown> | null;
  selfProjectionAssessmentAt?: string | null;
  selfProjectionSequenceStartedAt?: string | null;

  // ===== P2: L6 렌즈 - 타이밍/손실회피 (Menu #55 - Part 2) =====
  timingUrgencyScore?: number;
  timingType?: string | null;
  priceDeadlineDate?: string | null;
  seatAvailability?: number | null;
  ageRelevanceScore?: number;
  healthWindowStatus?: string | null;
  lastDecisionWindow?: string | null;
  decisionWindowExpiresAt?: string | null;
  lossAversionPhrase?: string | null;
  medicalAuthorityCredential?: string | null;
  medicalAuthorityName?: string | null;
  timingUrgencyAssessmentAt?: string | null;
  timingUrgencySequenceStartedAt?: string | null;
  l5l6CombinedScore?: number;
  l5l6MedicalRiskLevel?: string | null;
  l5l6SmsDay0Sent?: boolean;
  l5l6SmsDay0SentAt?: string | null;
  l5l6SmsDay1Sent?: boolean;
  l5l6SmsDay1SentAt?: string | null;
  l5l6SmsDay2Sent?: boolean;
  l5l6SmsDay2SentAt?: string | null;
  l5l6SmsDay3Sent?: boolean;
  l5l6SmsDay3SentAt?: string | null;
  l5l6ConversionAt?: string | null;

  // ===== P2: L7 렌즈 - 동반자 설득 (Menu #50) =====
  familyComposition?: string | null;
  decisionMaker?: string | null;
  familyInfluenceScore?: number;
  companionPersuasionStage?: string | null;
  spouseName?: string | null;
  spousePhone?: string | null;
  spouseEngagement?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  parentEngagement?: string | null;
  friendName?: string | null;
  friendPhone?: string | null;
  friendEngagement?: string | null;
  familyObjections?: string[];
  companionSmsDay0Sent?: boolean;
  companionSmsDay0SentAt?: string | null;
  companionSmsDay1Sent?: boolean;
  companionSmsDay1SentAt?: string | null;
  companionSmsDay2Sent?: boolean;
  companionSmsDay2SentAt?: string | null;
  companionSmsDay3Sent?: boolean;
  companionSmsDay3SentAt?: string | null;
  familyAssessmentCompletedAt?: string | null;
  companionPersuasionStartedAt?: string | null;

  // ===== P2: L8 렌즈 - 재방문 습관화 (Menu #51) =====
  cruiseClubTier?: string | null;
  ltvTotal?: number;
  nextCruiseRecommendation?: string | null;
  lastCruiseSatisfactionScore?: number | null;
  lastCruiseEndDate?: string | null;
  cruiseReturnInterestLevel?: number;
  returnVisitScheduledDate?: string | null;
  smsDay10ReturnSent?: boolean;
  smsDay10ReturnSentAt?: string | null;
  smsDay30ReturnSent?: boolean;
  smsDay30ReturnSentAt?: string | null;
  smsDay60ReturnSent?: boolean;
  smsDay60ReturnSentAt?: string | null;
  smsDay90ReturnSent?: boolean;
  smsDay90ReturnSentAt?: string | null;
  ltvCalculatedAt?: string | null;

  // ===== P2: L10 렌즈 - 즉시 구매 클로징 (Menu #56) =====
  closingStage?: string | null;
  emotionalConnectionScore?: number;
  emotionalTriggers?: string[];
  urgencyLevel?: number;
  urgencyType?: string | null;
  urgencyExpiresAt?: string | null;
  l10ClosingScore?: number;
  tripleChoiceOffered?: boolean;
  tripleChoiceSelectedAt?: string | null;
  tripleChoiceSelection?: string | null;
  emotionalFinishSentAt?: string | null;
  emotionalFinishType?: string | null;
  l10ClosingAttempts?: number;
  l10ConversionAt?: string | null;
}

export interface ContactWithSharing extends Contact {
  visibility: ContactVisibility;
  sharedWith: ContactShare[];
}

export interface ContactShareRequest {
  sharedTo: string;
}
