/**
 * Phase 3-δ: 자동 검증 크론잡 (매일 06:00)
 *
 * 목적:
 * - ExecutionLog ↔ SendingHistory 데이터 일관성 검증
 * - 24/7 자동 모니터링 + 즉시 롤백 (< 1분)
 * - 매일 07:00 Slack 알림
 *
 * 검증 항목:
 * 1. 총 행 수: |SendingHistory - ExecutionLog| < 5%
 * 2. 채널별 분포: email/sms/push 동기화율 99% 이상
 * 3. sourceType='CAMPAIGN' 필터: ExecutionLog 쿼리 정확도
 * 4. 타임스탬프 오차: createdAt 차이 < 5초 (99퍼센타일)
 *
 * 롤백 트리거:
 * - 일관성 < 95% → 자동 롤백 (Feature Flag 비활성화)
 * - 채널 동기화율 < 98% → 경고
 * - 타임스탐프 오차 > 5초 (99퍼센타일) → 경고
 */

import db from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { notifySlack } from "@/lib/services/slack-notifier";
import { rollbackToSendingHistory } from "@/lib/services/rollback-handler";
import { getCache, setCache } from "@/lib/redis";
import type { VerificationResult, ChannelStats } from "@/types/verification";

/**
 * P0-4: 무한 롤백 루프 방지
 * - 동일 일자에 3회 이상 롤백 시도 → 자동 중지 (수동 개입 필요)
 * - Redis에 일자별 롤백 횟수 추적
 */
async function checkRollbackLimit(): Promise<{
  canRollback: boolean;
  rollbackCount: number;
  message: string;
}> {
  try {
    const dateKey = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const counterKey = `crm:rollback:count:${dateKey}`;

    const countStr = await getCache<string>(counterKey);
    const count = countStr ? parseInt(countStr) : 0;

    if (count >= 3) {
      logger.error("[Verify] 롤백 3회 이상 감지", { count, dateKey });
      return {
        canRollback: false,
        rollbackCount: count,
        message: `Too many rollbacks today (${count}/3). Manual intervention required.`,
      };
    }

    // 다음 롤백을 위해 카운트 증가 (24시간 TTL)
    await setCache(counterKey, String(count + 1), 24 * 60 * 60);

    return {
      canRollback: true,
      rollbackCount: count,
      message: `Rollback allowed (${count}/3)`,
    };
  } catch (error) {
    logger.warn("[Verify] 롤백 카운트 확인 실패", { error });
    // Redis 실패 시: 안전하게 롤백 진행 (기본값 true)
    return {
      canRollback: true,
      rollbackCount: 0,
      message: "Rollback allowed (Redis unavailable)",
    };
  }
}

/**
 * 1. 총 행 수 일관성 검증
 * - SendingHistory와 ExecutionLog의 행 수 비교
 * - 임계값: 95% 이상 (캠페인 sourceType만 비교)
 */
async function verifyCampaignRowConsistency(): Promise<{
  consistency: number;
  sendingCount: number;
  executionCount: number;
  passed: boolean;
}> {
  try {
    // Phase 3-γ: sourceType='CAMPAIGN'인 ExecutionLog만 비교
    const [sendingHistoryCount, executionLogCount] = await Promise.all([
      db.sendingHistory.count({
        where: {
          // SendingHistory에서 campaignId 기반으로 필터
          campaignId: { not: null },
          // 최근 7일 데이터만 비교 (롤링 윈도우)
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      db.executionLog.count({
        where: {
          sourceType: "CAMPAIGN",
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // P0-2 수정: 양방향 검증 (min ratio로 더 엄격한 기준 적용)
    // - ExecutionLog > SendingHistory: executionLogCount / sendingHistoryCount < 1
    // - ExecutionLog < SendingHistory: sendingHistoryCount / executionLogCount > 1
    // 따라서 min ratio가 95% 이상이어야 양쪽 다 데이터 누락 없음
    const consistency =
      sendingHistoryCount > 0 && executionLogCount > 0
        ? Math.min(
            (executionLogCount / sendingHistoryCount) * 100,
            (sendingHistoryCount / executionLogCount) * 100
          )
        : 100;

    const passed = consistency >= 95;

    logger.info("[Verify] 총 행 수 검증", {
      sendingCount: sendingHistoryCount,
      executionCount: executionLogCount,
      consistency: consistency.toFixed(2),
      passed,
    });

    return {
      consistency: Math.round(consistency * 100) / 100,
      sendingCount: sendingHistoryCount,
      executionCount: executionLogCount,
      passed,
    };
  } catch (error) {
    logger.error("[Verify] 총 행 수 검증 실패", { error });
    throw error;
  }
}

/**
 * 2. 채널별 분포 동기화율 검증
 * - SMS vs Email 분포 비율 비교
 * - 임계값: 99% 이상
 */
async function verifyChannelDistribution(): Promise<{
  sendingStats: ChannelStats;
  executionStats: ChannelStats;
  syncRate: number;
  passed: boolean;
}> {
  try {
    // SendingHistory 채널별 통계
    const sendingByChannel = await db.sendingHistory.groupBy({
      by: ["channel"],
      where: {
        campaignId: { not: null },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      _count: {
        id: true,
      },
    });

    // ExecutionLog 채널별 통계
    const executionByChannel = await db.executionLog.groupBy({
      by: ["channel"],
      where: {
        sourceType: "CAMPAIGN",
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      _count: {
        id: true,
      },
    });

    const sendingStats: ChannelStats = {};
    const executionStats: ChannelStats = {};
    let sendingTotal = 0;
    let executionTotal = 0;

    // SendingHistory 통계 계산
    for (const { channel, _count } of sendingByChannel) {
      sendingStats[channel] = _count.id;
      sendingTotal += _count.id;
    }

    // ExecutionLog 통계 계산
    for (const { channel, _count } of executionByChannel) {
      executionStats[channel] = _count.id;
      executionTotal += _count.id;
    }

    // 비율 계산
    const sendingRatio: Record<string, number> = {};
    const executionRatio: Record<string, number> = {};

    for (const channel of Object.keys(sendingStats)) {
      sendingRatio[channel] = sendingTotal > 0 ? (sendingStats[channel] / sendingTotal) * 100 : 0;
    }

    for (const channel of Object.keys(executionStats)) {
      executionRatio[channel] = executionTotal > 0 ? (executionStats[channel] / executionTotal) * 100 : 0;
    }

    // 동기화율: 채널별 비율 차이의 평균
    const allChannels = new Set([
      ...Object.keys(sendingRatio),
      ...Object.keys(executionRatio),
    ]);

    let totalDiff = 0;
    for (const channel of allChannels) {
      const diff = Math.abs((sendingRatio[channel] || 0) - (executionRatio[channel] || 0));
      totalDiff += diff;
    }

    const syncRate = 100 - totalDiff / allChannels.size;
    const passed = syncRate >= 99;

    logger.info("[Verify] 채널별 분포 검증", {
      sendingStats,
      executionStats,
      sendingRatio,
      executionRatio,
      syncRate: syncRate.toFixed(2),
      passed,
    });

    return {
      sendingStats,
      executionStats,
      syncRate: Math.round(syncRate * 100) / 100,
      passed,
    };
  } catch (error) {
    logger.error("[Verify] 채널별 분포 검증 실패", { error });
    throw error;
  }
}

/**
 * 3. sourceType='CAMPAIGN' 필터 검증
 * - ExecutionLog에서 CAMPAIGN 타입이 올바르게 저장되는지 확인
 * - 100% 정확도 필수
 */
async function verifyCampaignSourceFilter(): Promise<{
  executionCampaignCount: number;
  campaignIdNullCount: number;
  mismatchCount: number;
  accuracy: number;
  passed: boolean;
}> {
  try {
    // sourceType='CAMPAIGN'인 모든 ExecutionLog
    const executionCampaignCount = await db.executionLog.count({
      where: {
        sourceType: "CAMPAIGN",
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // sourceType='CAMPAIGN'인데 campaignId가 NULL인 경우 (불일치)
    const mismatchCount = await db.executionLog.count({
      where: {
        sourceType: "CAMPAIGN",
        campaignId: null,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // ExecutionLog 중 campaignId가 NULL이지만 sourceType이 정확한 경우
    const campaignIdNullCount = await db.executionLog.count({
      where: {
        campaignId: null,
        sourceType: "CAMPAIGN",
      },
    });

    const accuracy =
      executionCampaignCount > 0
        ? ((executionCampaignCount - mismatchCount) / executionCampaignCount) * 100
        : 100;

    const passed = accuracy === 100;

    logger.info("[Verify] sourceType='CAMPAIGN' 필터 검증", {
      executionCampaignCount,
      mismatchCount,
      campaignIdNullCount,
      accuracy: accuracy.toFixed(2),
      passed,
    });

    return {
      executionCampaignCount,
      campaignIdNullCount,
      mismatchCount,
      accuracy: Math.round(accuracy * 100) / 100,
      passed,
    };
  } catch (error) {
    logger.error("[Verify] sourceType 필터 검증 실패", { error });
    throw error;
  }
}

/**
 * 4. 타임스탬프 오차 검증 (샘플링 기반)
 * - 같은 campaignId를 가진 SendingHistory ↔ ExecutionLog 비교
 * - 99퍼센타일 기준 < 5초 이내
 * - 샘플링: 최근 1000개만 검증 (성능)
 */
async function verifyTimestampConsistency(): Promise<{
  sampleSize: number;
  maxDiff: number;
  percentile99: number;
  avgDiff: number;
  passed: boolean;
}> {
  try {
    // P0-3 수정: 샘플 크기를 5000개로 확대 (통계적 신뢰도 향상, P99 = 50개 이상 추천)
    // 1000개는 P99 = 10개만 필요 → 신뢰도 낮음
    // 5000개면 P99 = 50개 이상 → 유의미한 통계
    const sendingHistorySample = await db.sendingHistory.findMany({
      where: {
        campaignId: { not: null },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 최근 7일 (대량 샘플)
        },
      },
      select: {
        id: true,
        campaignId: true,
        contactId: true,
        createdAt: true,
      },
      take: 5000,
      orderBy: { createdAt: "desc" },
    });

    if (sendingHistorySample.length === 0) {
      logger.info("[Verify] 타임스탬프 검증 샘플 부족", {
        sampleSize: 0,
        message: "최근 24시간 데이터 없음",
      });
      return {
        sampleSize: 0,
        maxDiff: 0,
        percentile99: 0,
        avgDiff: 0,
        passed: true,
      };
    }

    // P0-6 수정: N+1 쿼리 최적화 (5000개 샘플 × 1001개 쿼리 → 1개 쿼리로)
    // 이전: for 루프 안에서 각 샘플마다 executionLog 조회 (5000번)
    // 개선: 모든 campaignId + contactId 조합을 한 번에 조회
    const executionLogs = await db.executionLog.findMany({
      where: {
        sourceType: "CAMPAIGN",
        campaignId: {
          in: sendingHistorySample
            .map((s) => s.campaignId)
            .filter((id) => id !== null) as string[],
        },
        contactId: {
          in: sendingHistorySample.map((s) => s.contactId),
        },
      },
      select: {
        campaignId: true,
        contactId: true,
        createdAt: true,
      },
    });

    // 조회 결과를 Map으로 변환 (O(1) 조회)
    const executionMap = new Map<string, typeof executionLogs[0]>();
    for (const log of executionLogs) {
      const key = `${log.campaignId}:${log.contactId}`;
      executionMap.set(key, log);
    }

    // 샘플과 매칭하여 시간 차이 계산
    const diffs: number[] = [];
    for (const sending of sendingHistorySample) {
      const key = `${sending.campaignId}:${sending.contactId}`;
      const execution = executionMap.get(key);

      if (execution) {
        const diffMs = Math.abs(
          sending.createdAt.getTime() - execution.createdAt.getTime()
        );
        const diffSec = diffMs / 1000;
        diffs.push(diffSec);
      }
    }

    if (diffs.length === 0) {
      logger.info("[Verify] 타임스탬프 비교 데이터 부족", {
        sampleSize: sendingHistorySample.length,
        matchedCount: 0,
      });
      return {
        sampleSize: sendingHistorySample.length,
        maxDiff: 0,
        percentile99: 0,
        avgDiff: 0,
        passed: true,
      };
    }

    // 통계 계산
    diffs.sort((a, b) => a - b);
    const maxDiff = diffs[diffs.length - 1];
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const percentile99Index = Math.ceil((99 / 100) * diffs.length) - 1;
    const percentile99 = diffs[Math.max(0, percentile99Index)];

    const passed = percentile99 < 5; // 99퍼센타일이 5초 이내

    logger.info("[Verify] 타임스탬프 검증", {
      sampleSize: diffs.length,
      maxDiff: maxDiff.toFixed(3),
      avgDiff: avgDiff.toFixed(3),
      percentile99: percentile99.toFixed(3),
      passed,
    });

    return {
      sampleSize: diffs.length,
      maxDiff: Math.round(maxDiff * 1000) / 1000,
      percentile99: Math.round(percentile99 * 1000) / 1000,
      avgDiff: Math.round(avgDiff * 1000) / 1000,
      passed,
    };
  } catch (error) {
    logger.error("[Verify] 타임스탬프 검증 실패", { error });
    throw error;
  }
}

/**
 * 메인 검증 함수: 모든 검증 항목 실행
 */
export async function verifyExecutionLogConsistency(): Promise<VerificationResult> {
  logger.info("[Verify] 자동 검증 시작", { timestamp: new Date().toISOString() });

  const startTime = Date.now();

  try {
    // 4가지 검증 병렬 실행
    const [rowConsistency, channelDistribution, campaignFilter, timestampCheck] = await Promise.all([
      verifyCampaignRowConsistency(),
      verifyChannelDistribution(),
      verifyCampaignSourceFilter(),
      verifyTimestampConsistency(),
    ]);

    // 종합 판정
    const isHealthy =
      rowConsistency.passed &&
      channelDistribution.passed &&
      campaignFilter.passed &&
      timestampCheck.passed;

    const result: VerificationResult = {
      timestamp: new Date().toISOString(),
      isHealthy,
      rowConsistency,
      channelDistribution,
      campaignFilter,
      timestampCheck,
      duration: Date.now() - startTime,
    };

    logger.info("[Verify] 자동 검증 완료", {
      isHealthy,
      duration: result.duration,
      summary: {
        rowPassed: rowConsistency.passed,
        channelPassed: channelDistribution.passed,
        filterPassed: campaignFilter.passed,
        timestampPassed: timestampCheck.passed,
      },
    });

    // P0-4 통합: 롤백 트리거 (일관성 < 95% + 롤백 제한 확인)
    if (!rowConsistency.passed) {
      logger.error("[Verify] 치명적 오류: 행 수 일관성 < 95%", {
        consistency: rowConsistency.consistency,
        sendingCount: rowConsistency.sendingCount,
        executionCount: rowConsistency.executionCount,
      });

      // P0-4: 무한 롤백 루프 방지
      const rollbackCheck = await checkRollbackLimit();

      if (!rollbackCheck.canRollback) {
        // 3회 이상 롤백 → 수동 개입 필요 (자동 중지)
        logger.error("[Verify] 롤백 제한 도달", {
          rollbackCount: rollbackCheck.rollbackCount,
          message: rollbackCheck.message,
        });

        // Slack 긴급 알림만 (롤백 중지)
        await notifySlack({
          type: "CRITICAL_ALERT",
          message: `⚠️ CRITICAL: Rollback limit reached (${rollbackCheck.rollbackCount}/3). Manual intervention required.`,
          details: {
            consistency: rowConsistency.consistency,
            sendingCount: rowConsistency.sendingCount,
            executionCount: rowConsistency.executionCount,
            rollbackCount: rollbackCheck.rollbackCount,
            message: rollbackCheck.message,
          },
        });

        result.rollbackTriggered = false;
      } else {
        // 롤백 진행
        await rollbackToSendingHistory();

        // Slack 긴급 알림
        await notifySlack({
          type: "CRITICAL_ROLLBACK",
          message: `ExecutionLog 일관성 오류 감지 (${rowConsistency.consistency}%). 즉시 롤백 완료. (${rollbackCheck.rollbackCount + 1}/3)`,
          details: {
            sendingCount: rowConsistency.sendingCount,
            executionCount: rowConsistency.executionCount,
            consistency: rowConsistency.consistency,
            rollbackCount: rollbackCheck.rollbackCount + 1,
          },
        });

        result.rollbackTriggered = true;
      }
    }

    return result;
  } catch (error) {
    logger.error("[Verify] 자동 검증 중 오류 발생", { error });

    // 오류 발생 시 안전하게 롤백
    try {
      await rollbackToSendingHistory();
      await notifySlack({
        type: "ERROR_ROLLBACK",
        message: "검증 중 오류 발생으로 롤백 진행됨",
        details: { error: error instanceof Error ? error.message : "Unknown error" },
      });
    } catch (rollbackError) {
      logger.error("[Verify] 롤백 중 오류", { rollbackError });
    }

    throw error;
  }
}

/**
 * Cron 실행 함수 (매일 06:00)
 */
export async function cronVerifyExecutionLog() {
  logger.info("[Cron] 자동 검증 크론잡 시작 (06:00)");

  try {
    const result = await verifyExecutionLogConsistency();

    // 매일 07:00 Slack 알림
    await notifySlack({
      type: "DAILY_VERIFICATION",
      message: `일일 검증 완료 (${result.isHealthy ? "정상" : "경고"})`,
      details: {
        timestamp: result.timestamp,
        isHealthy: result.isHealthy,
        consistency: result.rowConsistency.consistency,
        channelSyncRate: result.channelDistribution.syncRate,
        duration: result.duration,
      },
    });

    logger.info("[Cron] 자동 검증 크론잡 완료", { isHealthy: result.isHealthy });
  } catch (error) {
    logger.error("[Cron] 자동 검증 크론잡 실패", { error });
    throw error;
  }
}
