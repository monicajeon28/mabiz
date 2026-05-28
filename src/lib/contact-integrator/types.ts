/**
 * Customer Integrator Types
 * 360도 고객 통합 뷰 데이터 모델
 */

export interface Contact360Response {
  contact: Contact360Contact;
  goldMember: Contact360GoldMember | null;
  partner: Contact360Partner | null;
  groups: Contact360Group[];
  orders: Contact360Order[];
  communications: Contact360Communications;
  psychologyProfile: Contact360PsychologyProfile;
  riskProfile: Contact360RiskProfile;
  affiliateTracking: Contact360AffiliateTracking | null;
  metadata: Contact360Metadata;
}

/**
 * Contact 기본 정보
 */
export interface Contact360Contact {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  organizationId: string;
  type: 'LEAD' | 'CUSTOMER' | 'VIP';
  segment: string | null;
  autoSegment: string;
  createdAt: Date;
  updatedAt: Date;
  lastContactedAt: Date | null;
  tags: string[];
}

/**
 * GoldMember 정보
 */
export interface Contact360GoldMember {
  id: string;
  memberCode: string;
  courseType: string;
  status: string;
  joinDate: Date;
  totalPayments: number;
  paidCount: number;
  maxPaymentCount: number | null;
  tier: number;
  consultations: {
    id: string;
    content: string;
    authorId: string;
    createdAt: Date;
  }[];
}

/**
 * Partner 정보
 */
export interface Contact360Partner {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  commissionRate: number;
  totalRevenue: number;
  onboardingStatus: string;
  incomeLevel: string;
  monthlyIncomeGoal: number | null;
  automationRate: number;
  metrics: {
    thisMonth: PartnerMetric;
    lastMonth: PartnerMetric;
  };
  riskFlags: {
    suspensionRisk: 'GREEN' | 'YELLOW' | 'RED';
    automationGap: number;
    churnRisk: boolean;
  };
}

export interface PartnerMetric {
  customerCount: number;
  leadCount: number;
  revenue: number;
}

/**
 * 고객이 속한 그룹
 */
export interface Contact360Group {
  id: string;
  name: string;
  color: string;
  ownerId: string | null;
  memberCount: number;
  addedAt: Date;
}

/**
 * 거래 주문 정보
 */
export interface Contact360Order {
  id: string;
  type: 'cruise_package' | 'accommodation' | 'activity';
  productCode: string;
  productName: string;
  quotedPrice: number;
  priceAcceptedAt: Date | null;
  departureDate: Date | null;
  cruiseInterest: string | null;
  status: 'INQUIRY' | 'QUOTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  paymentStatus: string;
  paymentAmount: number;
  paymentDate: Date | null;
  remainingBalance: number;
  cabinType: string | null;
  satisfactionScore: number | null;
  createdAt: Date;
}

/**
 * 커뮤니케이션 로그
 */
export interface Contact360Communications {
  smsLogs: SMSLog[];
  emailLogs: EmailLog[];
  callLogs: CallLog[];
  totalInteractions: number;
  lastInteractionAt: Date | null;
}

export interface SMSLog {
  id: string;
  messageType: string;
  lensType: string | null;
  content: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  sentAt: Date;
  openedAt: Date | null;
  clickedAt: Date | null;
  convertedAt: Date | null;
}

export interface EmailLog {
  id: string;
  subject: string;
  status: string;
  sentAt: Date;
  openedAt: Date | null;
}

export interface CallLog {
  id: string;
  duration: number;
  result: string;
  convictionScore: number | null;
  callPhase: string | null;
  callStartedAt: Date;
  callEndedAt: Date;
  scriptVersion: string | null;
  recordingConsent: boolean;
}

/**
 * 심리학 렌즈 프로필
 */
export interface Contact360PsychologyProfile {
  lensClassifications: LensClassification[];
  sequenceStatus: Record<string, SequenceStatus>;
}

export interface LensClassification {
  lensType: string;
  lensLabel: string;
  confidenceScore: number;
  status: 'ACTIVE' | 'INACTIVE' | 'CONVERTED';
  identifiedAt: Date;
  readinessScore: number;
  priorityLevel: 'P0' | 'P1' | 'P2';
}

export interface SequenceStatus {
  day0: DayStatus;
  day1?: DayStatus;
  day2?: DayStatus;
  day3?: DayStatus;
}

export interface DayStatus {
  sent: boolean;
  clicked: boolean;
  converted: boolean;
  convertedAt?: Date;
}

/**
 * 위험도 프로필
 */
export interface Contact360RiskProfile {
  riskScore: number; // 0-100 (낮을수록 좋음)
  flags: RiskFlag[];
  recommendedActions: RecommendedAction[];
}

export interface RiskFlag {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detectedAt: Date;
  description: string;
}

export interface RecommendedAction {
  action: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
  resources?: string[];
  nextScheduledAt?: Date;
}

/**
 * Affiliate 추적 정보
 */
export interface Contact360AffiliateTracking {
  affiliateLinkId: string | null;
  affiliateManagerId: string | null;
  affiliateAgentId: string | null;
  commissionAmount: number;
  commissionStatus: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
  attributionModel: 'last_touch' | 'time_decay' | 'data_driven';
  attributionChain: AttributionTouch[];
}

export interface AttributionTouch {
  step: number;
  source: string;
  touchedAt: Date;
  credited: boolean;
}

/**
 * 메타데이터
 */
export interface Contact360Metadata {
  dataQuality: {
    completeness: number;
    lastValidatedAt: Date;
    issues: string[];
  };
  cacheInfo: {
    cachedAt: Date;
    ttl: number;
    source: 'redis' | 'database';
  };
}

/**
 * PII 마스킹 옵션
 */
export interface MaskOptions {
  level: 'full' | 'partial' | 'none';
  roles: string[];
  orgId: string;
}

/**
 * 위험도 계산 결과
 */
export interface RiskCalculationResult {
  riskScore: number;
  flags: RiskFlag[];
  recommendedActions: RecommendedAction[];
}

/**
 * DataLoader 배치 결과
 */
export interface BatchLoadResult {
  contacts: Map<string, Contact360Contact>;
  goldMembers: Map<string | null, Contact360GoldMember>;
  partners: Map<string, Contact360Partner>;
  groups: Map<string, Contact360Group[]>;
}

/**
 * API 에러 응답
 */
export interface Contact360Error {
  error: string;
  code: string;
  statusCode: number;
  details?: Record<string, any>;
}

/**
 * 캐시 설정
 */
export interface CacheConfig {
  ttl: number; // 초 단위
  keyPrefix: string;
  enabled: boolean;
  strategy: 'lru' | 'fifo' | 'lifo';
}

/**
 * 성능 메트릭
 */
export interface Contact360Metrics {
  responseTime: number;
  cacheHitRate: number;
  dbQueryTime: number;
  dataFetchTime: number;
  maskingTime: number;
  totalTime: number;
  queryCounts: {
    total: number;
    cached: number;
    fresh: number;
  };
}
