/**
 * Menu #38 Phase 4 Track 2 Wave 1 — Agent δ
 * CampaignCost 비용 추적 유틸리티
 */

/**
 * 현재 월 기준 비용 기간 계산 (YYYY-MM 형식)
 */
export function calculateCampaignCostPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * SMS 비용 계산
 * @param count 발송 건수
 * @param rate 건당 비용 (기본값: 90원)
 */
export function calculateSmsCost(count: number, rate: number = 90): number {
  return count * rate;
}

/**
 * 이메일 비용 계산
 * @param count 발송 건수
 * @param rate 건당 비용 (기본값: 10원)
 */
export function calculateEmailCost(count: number, rate: number = 10): number {
  return count * rate;
}

/**
 * 총 비용 계산 (SMS + Email)
 */
export function calculateTotalCost(smsCost: number, emailCost: number): number {
  return smsCost + emailCost;
}

/**
 * 성공 건당 비용 계산
 * @param totalCost 총 비용
 * @param successCount 성공 건수
 */
export function calculateCostPerSuccess(totalCost: number, successCount: number): number {
  if (successCount === 0) return 0;
  return totalCost / successCount;
}

/**
 * 예상 ROI 계산
 * @param totalCost 총 비용
 * @param revenue 예상 수익
 */
export function calculateEstimatedRoi(totalCost: number, revenue: number): number {
  if (totalCost === 0) return 0;
  return (revenue / totalCost) * 100;
}

/**
 * 비용 요약 객체 생성
 */
export interface CostSummary {
  period: string;
  smsSent: number;
  emailSent: number;
  smsCostTotal: number;
  emailCostTotal: number;
  actualCostTotal: number;
  successCount: number;
  costPerSuccess: number;
  estimatedRoi: number;
}

/**
 * CampaignCost 데이터로부터 비용 요약 생성
 */
export function buildCostSummary(cost: {
  period: string;
  smsSent: number;
  emailSent: number;
  smsCostTotal: number;
  emailCostTotal: number;
  actualCostTotal: number;
  successCount: number;
  costPerSuccess: number;
  estimatedRoi: number;
}): CostSummary {
  return {
    period: cost.period,
    smsSent: cost.smsSent,
    emailSent: cost.emailSent,
    smsCostTotal: cost.smsCostTotal,
    emailCostTotal: cost.emailCostTotal,
    actualCostTotal: cost.actualCostTotal,
    successCount: cost.successCount,
    costPerSuccess: cost.costPerSuccess,
    estimatedRoi: cost.estimatedRoi,
  };
}

/**
 * 비용 효율 평가 함수
 * ROI가 높을수록 효율적 (기준값: 300%)
 */
export function evaluateCostEfficiency(roi: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (roi >= 300) return 'excellent';
  if (roi >= 100) return 'good';
  if (roi >= 0) return 'fair';
  return 'poor';
}
