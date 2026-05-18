/**
 * Menu #38 Phase 4 Track 1: 캠페인 비용 배치 스케줄러
 *
 * 목적:
 * - 5분마다: 진행중(SENDING) 캠페인의 실시간 비용 계산
 * - 시간마다: 진행중/완료(SENDING/SENT) 캠페인의 월별 집계
 *
 * 특징:
 * - 병렬 처리 (Promise.all 배치)
 * - 개별 캠페인 오류 격리 (한 캠페인 실패가 전체 영향 안함)
 * - 로깅 (완료/오류/통계)
 * - Cron API (/api/cron/cost-calculator)에 의해 호출됨
 */

import db from "../prisma";
import { logger } from "../logger";
import { calculateCampaignCost } from "../calculate-campaign-cost";

/**
 * 스케줄러 1: 5분마다 실행 (실시간 대시보드용)
 * - 진행중(SENDING) 캠페인만 처리
 * - 빠른 응답 시간 필요 (대시보드 새로고침용)
 */
export async function scheduleCostCalculationRealtime() {
  try {
    logger.info("[CostScheduler:Realtime] 시작");

    // SENDING 상태 캠페인 조회
    const campaigns = await db.crmMarketingCampaign.findMany({
      where: { status: "SENDING" },
      select: { id: true, title: true, organizationId: true },
    });

    if (campaigns.length === 0) {
      logger.info("[CostScheduler:Realtime] 진행중인 캠페인 없음");
      return {
        total: 0,
        success: 0,
        failed: 0,
        errors: [] as Array<{ campaignId: string; error: string }>,
      };
    }

    logger.info("[CostScheduler:Realtime] 처리 대상", { count: campaigns.length });

    // 배치 처리 (10개씩 병렬)
    const BATCH_SIZE = 10;
    let successCount = 0;
    const errors: Array<{ campaignId: string; error: string }> = [];

    for (let i = 0; i < campaigns.length; i += BATCH_SIZE) {
      const batch = campaigns.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((c) => calculateCampaignCost(c.id))
      );

      results.forEach((result, index) => {
        const campaign = batch[index];
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          errors.push({
            campaignId: campaign.id,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          });
        }
      });
    }

    logger.info("[CostScheduler:Realtime] 완료", {
      total: campaigns.length,
      success: successCount,
      failed: errors.length,
      errorDetails: errors.slice(0, 5), // 최대 5개까지만 기록
    });

    return {
      total: campaigns.length,
      success: successCount,
      failed: errors.length,
      errors,
    };
  } catch (error) {
    logger.error("[CostScheduler:Realtime] 스케줄러 오류", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 스케줄러 2: 시간마다 실행 (월별 집계용)
 * - 진행중/완료(SENDING/SENT) 캠페인 모두 처리
 * - 더 무거운 작업이므로 배치 크기 더 큼
 * - 월별 ROI 정산용
 */
export async function scheduleCostCalculationHourly() {
  try {
    logger.info("[CostScheduler:Hourly] 시작");

    // SENDING 또는 SENT 상태 캠페인 조회
    const campaigns = await db.crmMarketingCampaign.findMany({
      where: { status: { in: ["SENDING", "SENT"] } },
      select: { id: true, title: true, organizationId: true },
    });

    if (campaigns.length === 0) {
      logger.info("[CostScheduler:Hourly] 처리 대상 캠페인 없음");
      return {
        total: 0,
        success: 0,
        failed: 0,
        errors: [] as Array<{ campaignId: string; error: string }>,
      };
    }

    logger.info("[CostScheduler:Hourly] 처리 대상", { count: campaigns.length });

    // 배치 처리 (20개씩 병렬)
    const BATCH_SIZE = 20;
    let successCount = 0;
    const errors: Array<{ campaignId: string; error: string }> = [];

    for (let i = 0; i < campaigns.length; i += BATCH_SIZE) {
      const batch = campaigns.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((c) => calculateCampaignCost(c.id))
      );

      results.forEach((result, index) => {
        const campaign = batch[index];
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          errors.push({
            campaignId: campaign.id,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          });
        }
      });
    }

    logger.info("[CostScheduler:Hourly] 완료", {
      total: campaigns.length,
      success: successCount,
      failed: errors.length,
      errorDetails: errors.slice(0, 5),
    });

    return {
      total: campaigns.length,
      success: successCount,
      failed: errors.length,
      errors,
    };
  } catch (error) {
    logger.error("[CostScheduler:Hourly] 스케줄러 오류", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
