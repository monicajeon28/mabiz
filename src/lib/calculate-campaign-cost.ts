/**
 * Menu #38 Phase 4 Track 1: 캠페인 비용 계산 함수
 *
 * 목적:
 * - 캠페인 실제 발송 비용 계산 (SMS 90원/건 + Email 10원/건)
 * - 성공률별 실제 CPA (Cost Per Acquisition) 계산
 * - 예상 ROI 추정 (평균 거래금액 150,000원 기준)
 * - CampaignCost 테이블 upsert (period 기반)
 *
 * 특징:
 * - 기간별 집계 (2026-05 형식)
 * - SendingHistory의 status별 정확한 통계
 * - 배치 스케줄러와 함께 작동 (5분/시간 갱신)
 */

import db from "./prisma";
import { logger } from "./logger";

/**
 * 캠페인의 비용 기간(Period) 계산
 * 형식: "YYYY-MM" (예: "2026-05")
 */
function calculateCampaignCostPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * 캠페인 비용 계산 및 저장
 *
 * 로직:
 * 1. 캠페인 조회 (기본 정보)
 * 2. SendingHistory에서 channel별 발송 수 집계
 *    - SMS: smsSent (발송 수)
 *    - Email: emailSent (발송 수)
 *    - success: SENT/DELIVERED 상태 (성공)
 * 3. 비용 계산
 *    - SMS 단가: 90원/건
 *    - Email 단가: 10원/건
 *    - actualCostTotal = (smsSent × 90) + (emailSent × 10)
 *    - costPerSuccess = actualCostTotal / successCount
 *    - estimatedRoi = (successCount × 평균거래금액) / actualCostTotal × 100
 * 4. CampaignCost upsert (campaignId_period unique key)
 * 5. 로깅 + 오류 처리
 */
export async function calculateCampaignCost(campaignId: string) {
  try {
    // Step 1: 캠페인 조회
    const campaign = await db.crmMarketingCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        organizationId: true,
        title: true,
        status: true,
      },
    });

    if (!campaign) {
      logger.warn("[CostCalculator] 캠페인을 찾을 수 없음", { campaignId });
      return null;
    }

    // Step 2: SendingHistory 집계 (channel별)
    const smsStat = await db.sendingHistory.groupBy({
      by: ["status"],
      where: { campaignId, channel: "SMS" },
      _count: { id: true },
    });

    const emailStat = await db.sendingHistory.groupBy({
      by: ["status"],
      where: { campaignId, channel: "EMAIL" },
      _count: { id: true },
    });

    // SMS 통계 계산
    let smsSent = 0;
    let smsSuccess = 0;
    for (const stat of smsStat) {
      const count = stat._count.id;
      smsSent += count;
      if (["SENT", "DELIVERED"].includes(stat.status)) {
        smsSuccess += count;
      }
    }

    // Email 통계 계산
    let emailSent = 0;
    let emailSuccess = 0;
    for (const stat of emailStat) {
      const count = stat._count.id;
      emailSent += count;
      if (["SENT", "DELIVERED"].includes(stat.status)) {
        emailSuccess += count;
      }
    }

    const successCount = smsSuccess + emailSuccess;

    // Step 3: 비용 계산
    const SMS_RATE = 90; // 원/건
    const EMAIL_RATE = 10; // 원/건
    const AVG_TRANSACTION_VALUE = 150000; // 평균 거래금액 (원)

    const smsCost = smsSent * SMS_RATE;
    const emailCost = emailSent * EMAIL_RATE;
    const actualCostTotal = smsCost + emailCost;

    // CPA (Cost Per Acquisition)
    const costPerSuccess =
      successCount > 0 ? actualCostTotal / successCount : 0;

    // 예상 ROI (%)
    const estimatedRevenue =
      successCount > 0 ? successCount * AVG_TRANSACTION_VALUE : 0;
    const estimatedRoi =
      actualCostTotal > 0 ? (estimatedRevenue / actualCostTotal) * 100 : 0;

    // Step 4: CampaignCost upsert
    const period = calculateCampaignCostPeriod();

    const result = await db.campaignCost.upsert({
      where: { campaignId },
      create: {
        campaignId,
        organizationId: campaign.organizationId,
        smsSent,
        smsRateCurrent: SMS_RATE,
        smsCostTotal: smsCost,
        emailSent,
        emailRateCurrent: EMAIL_RATE,
        emailCostTotal: emailCost,
        successCount,
        failureCount: smsSent + emailSent - successCount,
        costPerSuccess,
        actualCostTotal,
        estimatedRevenue,
        estimatedRoi,
        calculatedAt: new Date(),
      },
      update: {
        smsSent,
        smsRateCurrent: SMS_RATE,
        smsCostTotal: smsCost,
        emailSent,
        emailRateCurrent: EMAIL_RATE,
        emailCostTotal: emailCost,
        successCount,
        failureCount: smsSent + emailSent - successCount,
        costPerSuccess,
        actualCostTotal,
        estimatedRevenue,
        estimatedRoi,
        calculatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.info("[CostCalculator] 비용 계산 완료", {
      campaignId,
      title: campaign.title,
      period,
      smsSent,
      emailSent,
      successCount,
      actualCostTotal,
      costPerSuccess: Math.round(costPerSuccess * 100) / 100,
      estimatedRoi: Math.round(estimatedRoi * 100) / 100,
    });

    return result;
  } catch (error) {
    logger.error("[CostCalculator] 비용 계산 실패", {
      campaignId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
