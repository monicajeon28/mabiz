/**
 * ExecutionLog 검증 타입 정의
 */

export interface ChannelStats {
  [channel: string]: number;
}

export interface RowConsistencyResult {
  consistency: number; // 0-100%
  sendingCount: number;
  executionCount: number;
  passed: boolean;
}

export interface ChannelDistributionResult {
  sendingStats: ChannelStats;
  executionStats: ChannelStats;
  syncRate: number; // 0-100%
  passed: boolean;
}

export interface CampaignFilterResult {
  executionCampaignCount: number;
  campaignIdNullCount: number;
  mismatchCount: number;
  accuracy: number; // 0-100%
  passed: boolean;
}

export interface TimestampCheckResult {
  sampleSize: number;
  maxDiff: number; // 초
  percentile99: number; // 초
  avgDiff: number; // 초
  passed: boolean;
}

export interface VerificationResult {
  timestamp: string; // ISO 8601
  isHealthy: boolean; // 모든 검증 통과 여부
  rowConsistency: RowConsistencyResult;
  channelDistribution: ChannelDistributionResult;
  campaignFilter: CampaignFilterResult;
  timestampCheck: TimestampCheckResult;
  duration: number; // ms
  rollbackTriggered?: boolean;
}
