/**
 * A/B Test Type Definitions
 * Used across API and Dashboard components
 */

/**
 * Metrics snapshot for a single group (A or B)
 */
export interface MetricsSnapshot {
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
  responded: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
  responseRate: number;
  avgResponseTime?: number;
}

/**
 * Statistical result for A/B test
 */
export interface ABTestStatistics {
  pValue: number;
  zScore: number;
  chiSquare: number;
  relativeRisk: number;
  oddsRatio: number;
  isStatisticallySignificant: boolean;
  confidenceIntervals: {
    A: { lower: number; upper: number };
    B: { lower: number; upper: number };
    difference: { lower: number; upper: number };
  };
}

/**
 * DTO for A/B Test returned from API
 */
export interface SmsABTestDTO {
  id: string;
  name: string;
  objectiveType: string;
  psychologyLens?: string;
  copyAngle?: string;
  variantATemplate: string;
  variantBTemplate: string;
  segmentCode?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
  startedAt: string; // ISO date
  endedAt?: string;
  testDays: number;
  minSampleSize: number;
  pValueThreshold: number;
  confidenceLevel: number;
  declaredWinner?: 'A' | 'B';
  declaredAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  currentMetrics: {
    groupA: MetricsSnapshot;
    groupB: MetricsSnapshot;
  };
  statistics: ABTestStatistics;
  recommendation: string;
}

/**
 * Timeline entry for day-by-day tracking
 */
export interface TimelineEntryDTO {
  date: string; // YYYY-MM-DD
  day: number;
  groupA: {
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
    rate: number; // conversion rate
  };
  groupB: {
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
    rate: number;
  };
  statistics: {
    pValue: number;
    isSignificant: boolean;
  };
  recommendation?: string;
}

/**
 * Comparison table row
 */
export interface ComparisonRow {
  metric: string;
  valueA: number | string;
  valueB: number | string;
  difference: number | string;
  percentChange?: string;
  isHighlighted?: boolean;
}

/**
 * API Response Types
 */
export interface ABTestListResponse {
  data: SmsABTestDTO[];
}

export interface ABTestDetailResponse {
  data: SmsABTestDTO;
}

export interface ABTestTimelineResponse {
  data: TimelineEntryDTO[];
}

export interface ABTestCreateRequest {
  name: string;
  objectiveType: 'OPEN_RATE' | 'CLICK_RATE' | 'CONVERSION' | 'RESPONSE_TIME';
  variantATemplate: string;
  variantBTemplate: string;
  psychologyLens?: string;
  copyAngle?: string;
  segmentCode?: string;
  testDays?: number;
  minSampleSize?: number;
  pValueThreshold?: number;
  confidenceLevel?: number;
  notes?: string;
}

export interface ABTestCreateResponse {
  data: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
  };
}

/**
 * Dashboard state
 */
export interface ABTestDashboardState {
  tests: SmsABTestDTO[];
  selectedTestId: string | null;
  selectedTest: SmsABTestDTO | null;
  timeline: TimelineEntryDTO[];
  loading: boolean;
  error: string | null;
  days: number;
}
