/**
 * Day 0-3 SMS Sequence Type Definitions
 * Supports PASONA framework + psychology lens integration
 */

export type SequenceStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type SequenceInstanceStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'FAILED';
export type TriggerType = 'PURCHASE' | 'OBJECTION' | 'INQUIRY';
export type PsychologyLens = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8' | 'L9' | 'L10';
export type PasonaStage = 'P' | 'A' | 'S' | 'O' | 'N'; // Problem, Agitate, Solution, Offer, Narrow
export type VariantCode = 'A' | 'B' | 'C' | 'D' | 'E';

/**
 * SMS Sequence Template DTO
 * Represents a Day 0-3 sequence configuration
 */
export interface SmsSequenceTemplateDTO {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  productCode?: string | null;
  psychologyLens?: PsychologyLens | null;
  sequenceType: string;

  // Template IDs
  day0TemplateId?: string | null;
  day1TemplateId?: string | null;
  day2TemplateId?: string | null;
  day3TemplateId?: string | null;

  // Delays (minutes)
  day0Delay: number;
  day1Delay: number;
  day2Delay: number;
  day3Delay: number;

  // Conditions
  conditions?: Record<string, any> | null;
  triggerOn: TriggerType;

  // Metrics
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalConverted: number;

  // Status
  status: SequenceStatus;
  isSystem: boolean;
  createdByUserId?: string | null;
  deployedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Contact Sequence Instance DTO
 * Tracks active Day 0-3 sequences for a specific contact
 */
export interface ContactSequenceInstanceDTO {
  id: string;
  organizationId: string;
  contactId: string;
  sequenceId: string;

  // Send timestamps
  day0SentAt?: Date | null;
  day1SentAt?: Date | null;
  day2SentAt?: Date | null;
  day3SentAt?: Date | null;

  // Open timestamps
  day0OpenedAt?: Date | null;
  day1OpenedAt?: Date | null;
  day2OpenedAt?: Date | null;
  day3OpenedAt?: Date | null;

  // Conversion
  convertedAt?: Date | null;
  conversionDay?: number | null;

  // Status
  status: SequenceInstanceStatus;
  nextSendAt?: Date | null;
  failureReason?: string | null;
  pausedAt?: Date | null;
  pausedBy?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * SMS Sequence Variant DTO
 * A/B test variant for a specific day
 */
export interface SmsSequenceVariantDTO {
  id: string;
  sequenceId: string;
  variantCode: VariantCode;
  day: number; // 0-3

  messageContent: string;
  psychology?: string | null;
  lensName?: string | null;
  pasonaStage?: PasonaStage | null;

  // Metrics
  sentCount: number;
  openCount: number;
  clickCount: number;
  convertCount: number;

  isWinner: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Day Configuration Input
 * Used when creating/updating sequences
 */
export interface DayConfig {
  day: number; // 0-3
  delay: number; // minutes (0-4320)
  message: string;
  psychology?: string;
  lensName?: string;
  pasonaStage?: PasonaStage;
  variants: VariantInput[];
}

/**
 * Variant Input
 * Used when creating/updating sequence variants
 */
export interface VariantInput {
  code: VariantCode;
  message: string;
  psychology?: string;
}

/**
 * Create Sequence Request
 */
export interface CreateSequenceRequest {
  name: string;
  description?: string;
  productCode?: string;
  psychologyLens?: PsychologyLens;
  day0Delay?: number;
  day1Delay?: number;
  day2Delay?: number;
  day3Delay?: number;
  days: DayConfig[];
  conditions?: Record<string, any>;
  triggerOn?: TriggerType;
}

/**
 * Update Sequence Request
 */
export interface UpdateSequenceRequest {
  name?: string;
  description?: string;
  productCode?: string;
  psychologyLens?: PsychologyLens;
  day0Delay?: number;
  day1Delay?: number;
  day2Delay?: number;
  day3Delay?: number;
  conditions?: Record<string, any>;
  triggerOn?: TriggerType;
  status?: SequenceStatus;
}

/**
 * Deploy Sequence Request
 */
export interface DeploySequenceRequest {
  contactIds?: string[];
  segmentCode?: string;
  deployMessage?: string;
}

/**
 * Test SMS Request
 */
export interface TestSequenceRequest {
  contactPhone: string;
  startDay?: number;
  delaySeconds?: number;
}

/**
 * Sequence with Full Details
 * Used for detailed view/analytics
 */
export interface SequenceDetails extends SmsSequenceTemplateDTO {
  days: DayDetail[];
  performance: PerformanceMetrics;
}

/**
 * Day Detail with Variants
 */
export interface DayDetail {
  day: number;
  delay: number;
  message: string;
  psychology?: string;
  lens?: string;
  framework: string; // e.g., "PASONA P+A"
  expectedOpenRate: string;
  expectedClickRate: string;
  variants: SmsSequenceVariantDTO[];
  actualStats?: {
    opened: number;
    clicked: number;
    converted: number;
    openRate: string;
    clickRate: string;
  };
}

/**
 * Performance Metrics
 */
export interface PerformanceMetrics {
  day0: DayMetrics;
  day1: DayMetrics;
  day2: DayMetrics;
  day3: DayMetrics;
  overall: OverallMetrics;
}

/**
 * Day Metrics
 */
export interface DayMetrics {
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  openRate: string; // "31.6%"
  clickRate: string; // "8.97%"
  convertRate: string; // "4.99%"
  avgTimeToOpen?: string;
}

/**
 * Overall Metrics
 */
export interface OverallMetrics {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalConverted: number;
  cumulativeOpenRate: string;
  cumulativeClickRate: string;
  cumulativeConvertRate: string;
}

/**
 * Analytics Response
 */
export interface AnalyticsResponse {
  ok: boolean;
  analytics?: {
    overallPerformance: OverallMetrics;
    byDay: DayMetrics[];
    byLens?: LensPerformance[];
    variantPerformance: VariantPerformance[];
  };
  error?: string;
}

/**
 * Lens Performance
 */
export interface LensPerformance {
  lens: string;
  sent: number;
  openRate: string;
  clickRate: string;
  convertRate: string;
}

/**
 * Variant Performance
 */
export interface VariantPerformance {
  variant: VariantCode;
  psychology: string;
  totalSent: number;
  openRate: string;
  clickRate: string;
  convertRate: string;
  winner: boolean;
}

/**
 * List Sequences Response
 */
export interface ListSequencesResponse {
  ok: boolean;
  sequences?: SmsSequenceTemplateDTO[];
  total?: number;
  page?: number;
  limit?: number;
  error?: string;
}

/**
 * Get Sequence Response
 */
export interface GetSequenceResponse {
  ok: boolean;
  sequence?: SequenceDetails;
  error?: string;
}

/**
 * Create/Update Sequence Response
 */
export interface SequenceResponse {
  ok: boolean;
  id?: string;
  message?: string;
  error?: string;
}

/**
 * Deploy Response
 */
export interface DeployResponse {
  ok: boolean;
  deployed?: number;
  scheduled?: number;
  message?: string;
  error?: string;
}

/**
 * Test Response
 */
export interface TestResponse {
  ok: boolean;
  message?: string;
  schedule?: Array<{
    day: number;
    sendAt: string;
  }>;
  error?: string;
}

/**
 * Conditions Type
 * Flexible conditions for sequence targeting
 */
export interface SequenceConditions {
  productCode?: string[];
  lens?: PsychologyLens[];
  minValue?: number;
  maxValue?: number;
  triggerOn?: TriggerType;
  segmentCode?: string[];
  [key: string]: any;
}

/**
 * PASONA Stage Mapping
 */
export const PASONA_STAGES: Record<number, { stage: PasonaStage; name: string; description: string }> = {
  0: {
    stage: 'P',
    name: 'Problem + Agitate',
    description: '문제 정의 + 긴급도 조성'
  },
  1: {
    stage: 'S',
    name: 'Solution',
    description: '해결책 제시'
  },
  2: {
    stage: 'O',
    name: 'Offer',
    description: '오퍼/가치 제시'
  },
  3: {
    stage: 'N',
    name: 'Action + Narrow',
    description: '행동 촉구 + 범위 좁히기'
  }
};

/**
 * Expected Performance Benchmarks
 */
export const PERFORMANCE_BENCHMARKS = {
  day0: { openRate: '28-35%', clickRate: '8-12%', convertRate: '3-5%' },
  day1: { openRate: '18-22%', clickRate: '6-10%', convertRate: '2-4%' },
  day2: { openRate: '12-15%', clickRate: '3-8%', convertRate: '1-3%' },
  day3: { openRate: '8-12%', clickRate: '2-5%', convertRate: '1-2%' }
};

/**
 * Default Delays (in minutes)
 */
export const DEFAULT_DELAYS = {
  day0: 0,
  day1: 1440, // 1 day
  day2: 2880, // 2 days
  day3: 4320  // 3 days
};
