/**
 * Menu #38 Phase 4 Track 1: Delta SMS Cron Scheduler
 *
 * 목적:
 * - 렌탈 고객 3일 SMS 시퀀스 자동 스케줄링
 * - 3개 Cron: 09:00 / 14:00 / 19:00 KST (일일 반복)
 *
 * 실행 방식:
 * - Vercel Cron 또는 외부 스케줄러 (Zapier, AWS EventBridge)
 * - GET /api/cron/delta-sms?schedule=morning|afternoon|evening
 *
 * 처리:
 * 1. 활성 렌탈 캠페인 조회
 * 2. 각 캠페인별 executeDeltagSms() 호출
 * 3. 발송 결과 집계 및 로깅
 * 4. 오류 처리 및 재시도
 */

import { logger } from "@/lib/logger";
import { executeDeltagSms, getActiveDeltaCampaigns } from "../delta-sms";

export interface DeltaSmsScheduleResult {
  timestamp: string;
  schedule: "morning" | "afternoon" | "evening";
  campaignsProcessed: number;
  totalSent: number;
  totalFailed: number;
  totalSkipped: number;
  duration: string;
  campaigns: Array<{
    campaignId: string;
    sent: number;
    failed: number;
    skipped: number;
  }>;
}

/**
 * 스케줄별 Cron 실행 함수
 *
 * @param schedule "morning" (09:00) | "afternoon" (14:00) | "evening" (19:00)
 * @returns 처리 결과
 */
export async function scheduleDeltaSms(
  schedule: "morning" | "afternoon" | "evening"
): Promise<DeltaSmsScheduleResult> {
  const startTime = Date.now();

  try {
    logger.info("[DeltaSmsCron] 시작", {
      schedule,
      timestamp: new Date().toISOString(),
    });

    // 1. 활성 렌탈 캠페인 조회
    const campaigns = await getActiveDeltaCampaigns();

    if (campaigns.length === 0) {
      logger.info("[DeltaSmsCron] 활성 렌탈 캠페인이 없습니다", { schedule });
      return {
        timestamp: new Date().toISOString(),
        schedule,
        campaignsProcessed: 0,
        totalSent: 0,
        totalFailed: 0,
        totalSkipped: 0,
        duration: "0.00s",
        campaigns: [],
      };
    }

    logger.info("[DeltaSmsCron] 캠페인 조회 완료", {
      schedule,
      count: campaigns.length,
    });

    // 2. 각 캠페인별 병렬 처리 (Promise.allSettled로 부분 실패 격리)
    const results = await Promise.allSettled(
      campaigns.map((campaign) => executeDeltagSms(campaign.id))
    );

    // 3. 결과 집계
    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    const campaignResults = campaigns.map((campaign, index) => {
      const result = results[index];

      // rejected 상태 처리 (한 캠페인 실패 시에도 다른 캠페인 결과는 유지)
      if (result.status === "rejected") {
        logger.error("[DeltaSmsCron] Campaign 실패", {
          campaignId: campaign.id,
          reason: result.reason instanceof Error ? result.reason.message : result.reason,
        });
        return {
          campaignId: campaign.id,
          sent: 0,
          failed: 0,
          skipped: 0,
        };
      }

      const value = result.value;
      totalSent += value.sent || 0;
      totalFailed += value.failed || 0;
      totalSkipped += value.skipped || 0;

      return {
        campaignId: campaign.id,
        sent: value.sent || 0,
        failed: value.failed || 0,
        skipped: value.skipped || 0,
      };
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    const response: DeltaSmsScheduleResult = {
      timestamp: new Date().toISOString(),
      schedule,
      campaignsProcessed: campaigns.length,
      totalSent,
      totalFailed,
      totalSkipped,
      duration: `${duration}s`,
      campaigns: campaignResults,
    };

    logger.info("[DeltaSmsCron] 완료", response);

    return response;
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.error("[DeltaSmsCron] 오류", { schedule, err });

    return {
      timestamp: new Date().toISOString(),
      schedule,
      campaignsProcessed: 0,
      totalSent: 0,
      totalFailed: 0,
      totalSkipped: 0,
      duration: `${duration}s`,
      campaigns: [],
    };
  }
}

/**
 * 시간대별 Cron 함수 래퍼
 * (API 라우트에서 직접 호출용)
 */

export async function deltaSmsScheduleMorning() {
  return scheduleDeltaSms("morning");
}

export async function deltaSmsScheduleAfternoon() {
  return scheduleDeltaSms("afternoon");
}

export async function deltaSmsScheduleEvening() {
  return scheduleDeltaSms("evening");
}
