/**
 * 렌즈 감지 엔진 - 타입 정의
 * @fileoverview Grant Cardone 10렌즈 + PASONA 프레임워크 통합
 * @date 2026-05-27
 */

/**
 * 렌즈 타입 (L0-L10)
 */
export type LensType =
  | 'L0' // 부재중 재활성화
  | 'L1' // 가격이의
  | 'L2' // 준비복잡
  | 'L3' // 경쟁사언급/차별성
  | 'L4' // 세그먼트
  | 'L5' // 자기투영
  | 'L6' // 타이밍/손실회피
  | 'L7' // 동반자설득
  | 'L8' // 재구매/습관화
  | 'L9' // 건강신뢰
  | 'L10'; // 즉시구매

/**
 * 렌즈 점수 결과
 */
export interface LensScore {
  score: number; // 점수 (0+, 보통 0-50, 최대 100+)
  signals: string[]; // 감지된 신호 배열
  threshold: number; // 감지 기준 (모든 렌즈 5점)
}

/**
 * Contact에서 렌즈 감지에 필요한 데이터
 */
export interface ContactLensData {
  id: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
  lastContactedAt: Date | null;
  purchasedAt: Date | null;
  lastCruiseDate: Date | null;
  cruiseCount: number;
  vipStatus: string | null;
  tags: string[];
  lensMetadata: Record<string, any> | null;
  anxietyScore: number;
  preparationStage: string | null;
  healthConcerns: string | null;
  competitorMentioned: boolean;
  competitorNames: string[];
  selfProjectionScore: number;
  selfProjectionType: string | null;
  familyComposition: string | null;
  decisionMaker: string | null;
  ltvTotal: number;
  cruiseReturnInterestLevel: number;
  timingUrgencyScore: number;
  l10ClosingScore: number;
}

/**
 * 렌즈 감지 결과 (전체)
 */
export interface LensDetectionResult {
  primaryLens: LensType;
  confidenceScore: number; // 0-100
  allScores: Record<LensType, number>; // L0~L10 각 점수
  detectedSignals: Record<LensType, string[]>; // 렌즈별 신호 배열
  metadata: {
    identificationMethod: string; // "automated_rules_based"
    dataPoints: number; // Contact에서 사용된 데이터 포인트 개수
    lastUpdated: Date;
  };
}

/**
 * ContactLensClassification 저장용 타입
 */
export interface ContactLensClassificationInput {
  organizationId: string;
  contactId: string;
  lensType: LensType;
  lensLabel: string;
  confidenceScore: number;
  identificationMethod: string;
  tags: string[];
  status: string;
  notes?: string;
}

/**
 * 렌즈 템플릿 타입
 */
export type TemplateType = 'sms' | 'email' | 'call_script';

export interface LensTemplateInput {
  organizationId: string;
  lensType: LensType;
  templateType: TemplateType;
  day: 0 | 1 | 2 | 3;
  title: string;
  body: string;
  psychologyPrinciple: string;
  estimatedClickRate?: number;
  sendDelayMinutes?: number;
}

/**
 * 렌즈 대시보드 메트릭
 */
export interface LensMetric {
  lens: LensType;
  label: string;
  contactCount: number;
  convertedCount: number;
  conversionRate: number; // 0-1
  avgLTV: number;
  totalRevenue: number;
  expectedRevenue: number;
  weeklyTrend: number[]; // 4주 추이
  psychologyPrinciple: string;
}

export interface LensDashboardResponse {
  summary: {
    totalContacts: number;
    classifiedContacts: number;
    classificationRate: number;
    convertedContacts: number;
    totalRevenue: number;
    avgLTV: number;
    expectedRevenue: number;
  };
  lensMetrics: LensMetric[];
  performance: {
    bestPerformingLens: LensType;
    bestConversionRate: number;
    worstPerformingLens: LensType;
    conversionRateGap: number;
    optimizationOpportunity: string;
  };
  timeRange: string;
  generatedAt: Date;
}

/**
 * 렌즈 신호 로그 (감사)
 */
export interface LensSignalLog {
  id?: string;
  contactId: string;
  organizationId: string;
  signalName: string; // "inactive_1y_plus" 형식
  signalValue: any; // 신호 관련 값
  calculatedPoints: number;
  lensType: LensType;
  detectedAt?: Date;
}
