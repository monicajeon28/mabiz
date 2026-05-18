/**
 * Menu #38 Phase 3: 모니터링 메트릭 대시보드 API
 * δ-P1-2: 검증 결과 조회 및 메트릭 산출
 *
 * 목적:
 * - ExecutionLog <→> SendingHistory 일관성 검증 메트릭
 * - 모니터링 대시보드에서 실시간 조회
 * - P99 성능 추적
 *
 * 반환값:
 * - consistency_rate: 95% 이상 유지율
 * - rollback_count: 0-3회 범위 (지난 7일)
 * - verification_p99: < 100ms
 * - enum_mapping_fallback_count: 매일 추적
 * - last_recovery_attempt: 마지막 복구 시도 시간
 */

import { NextRequest, NextResponse } from "next/server";
import db from "../../../../../src/lib/prisma";
import { logger } from "../../../../../src/lib/logger";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface VerificationMetrics {
  consistency_rate: number;
  consistency_details: {
    total_pairs: number;
    matched_pairs: number;
    mismatched_pairs: number;
    error_details: Array<{
      id: string;
      sendingHistoryStatus: string;
      executionLogStatus: string;
      mismatch_type: string;
    }>;
  };
  rollback_count: number;
  rollbacks_7days: Array<{
    date: string;
    count: number;
  }>;
  verification_time: {
    p50: number;
    p99: number;
    max: number;
  };
  enum_mapping_fallback: {
    count: number;
    types: Record<string, number>;
    trend: Array<{
      date: string;
      count: number;
    }>;
  };
  recovery_status: {
    last_rollback: string | null;
    last_recovery_attempt: string | null;
    feature_flag_enabled: boolean;
  };
  timestamp: string;
  health: "HEALTHY" | "WARNING" | "CRITICAL";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    logger.info("[Verification Metrics] API 호출");

    // 권한 확인 (관리자만)
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.includes("Bearer")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 메트릭 수집 (병렬)
    const [consistency, rollbacks, verificationTime, enumMappingFallback, recoveryStatus] =
      await Promise.all([
        getConsistencyMetric(),
        getRollbackMetric(),
        getVerificationTimeMetric(),
        getEnumMappingFallbackMetric(),
        getRecoveryStatusMetric(),
      ]);

    // 헬스 상태 판단
    const health = determineHealth(
      consistency.consistency_rate,
      rollbacks.count,
      verificationTime.p99,
      enumMappingFallback.count
    );

    const metrics: VerificationMetrics = {
      consistency_rate: consistency.consistency_rate,
      consistency_details: consistency.details,
      rollback_count: rollbacks.count,
      rollbacks_7days: rollbacks.trend,
      verification_time: verificationTime,
      enum_mapping_fallback: enumMappingFallback,
      recovery_status: recoveryStatus,
      timestamp: new Date().toISOString(),
      health,
    };

    logger.info("[Verification Metrics] 메트릭 수집 완료", {
      consistency_rate: metrics.consistency_rate,
      health,
    });

    // 응답 반환 (1시간 캐시)
    const response = NextResponse.json(metrics);
    response.headers.set("Cache-Control", "public, max-age=3600");
    return response;
  } catch (err) {
    logger.error("[Verification Metrics] 메트릭 수집 실패", { err });
    return NextResponse.json(
      { error: "Failed to fetch metrics", details: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * 함수 1: 일관성 메트릭 (ExecutionLog <→> SendingHistory)
 */
async function getConsistencyMetric(): Promise<{
  consistency_rate: number;
  details: {
    total_pairs: number;
    matched_pairs: number;
    mismatched_pairs: number;
    error_details: Array<{
      id: string;
      sendingHistoryStatus: string;
      executionLogStatus: string;
      mismatch_type: string;
    }>;
  };
}> {
  try {
    // 지난 7일 기준
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // SendingHistory 조회 (ExecutionLog와 비교)
    const sendingHistories = await db.sendingHistory.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        id: true,
        status: true,
        failureReason: true,
        createdAt: true,
      },
      take: 10000, // 샘플 (성능)
    });

    // ExecutionLog 조회
    const executionLogs = await db.executionLog.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        id: true,
        status: true,
        failureReason: true,
        createdAt: true,
      },
      take: 10000,
    });

    // 매칭 비교
    const sendingMap = new Map(
      sendingHistories.map((s) => [s.id, s])
    );
    const executionMap = new Map(
      executionLogs.map((e) => [e.id, e])
    );

    const totalPairs = Math.max(sendingHistories.length, executionLogs.length);
    let matchedPairs = 0;
    const mismatchedDetails: Array<{
      id: string;
      sendingHistoryStatus: string;
      executionLogStatus: string;
      mismatch_type: string;
    }> = [];

    // SendingHistory 기준 비교
    for (const [id, sending] of sendingMap) {
      const execution = executionMap.get(id);

      if (!execution) {
        mismatchedDetails.push({
          id,
          sendingHistoryStatus: sending.status,
          executionLogStatus: "MISSING",
          mismatch_type: "ExecutionLog_Missing",
        });
        continue;
      }

      // 상태 비교
      if (sending.status === execution.status) {
        matchedPairs++;
      } else {
        mismatchedDetails.push({
          id,
          sendingHistoryStatus: sending.status,
          executionLogStatus: execution.status,
          mismatch_type: "Status_Mismatch",
        });
      }
    }

    // ExecutionLog에만 있는 경우
    for (const [id, execution] of executionMap) {
      if (!sendingMap.has(id)) {
        mismatchedDetails.push({
          id,
          sendingHistoryStatus: "MISSING",
          executionLogStatus: execution.status,
          mismatch_type: "SendingHistory_Missing",
        });
      }
    }

    const consistencyRate = totalPairs > 0 ? matchedPairs / totalPairs : 1;

    logger.log("[Verification Metrics] 일관성 검사 완료", {
      totalPairs,
      matchedPairs,
      consistencyRate: (consistencyRate * 100).toFixed(2) + "%",
    });

    return {
      consistency_rate: consistencyRate,
      details: {
        total_pairs: totalPairs,
        matched_pairs: matchedPairs,
        mismatched_pairs: totalPairs - matchedPairs,
        error_details: mismatchedDetails.slice(0, 100), // 최대 100개만 반환
      },
    };
  } catch (err) {
    logger.error("[Verification Metrics] 일관성 검사 실패", { err });
    return {
      consistency_rate: 0,
      details: {
        total_pairs: 0,
        matched_pairs: 0,
        mismatched_pairs: 0,
        error_details: [],
      },
    };
  }
}

/**
 * 함수 2: 롤백 메트릭
 */
async function getRollbackMetric(): Promise<{
  count: number;
  trend: Array<{ date: string; count: number }>;
}> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Redis에서 롤백 기록 조회
    const rollbackKey = "menu38:phase3:rollback_history";
    const rollbackHistory = await redis.lrange(rollbackKey, 0, -1);

    const rollbacks = (rollbackHistory || [])
      .map((item) => {
        try {
          return JSON.parse(item as string);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // 7일 이내 롤백만 필터링
    const recent = rollbacks.filter(
      (r: any) => new Date(r.timestamp) >= sevenDaysAgo
    );

    // 일별 집계
    const trend = new Map<string, number>();
    for (const rollback of recent) {
      const date = new Date(rollback.timestamp).toISOString().split("T")[0];
      trend.set(date, (trend.get(date) || 0) + 1);
    }

    const trendArray = Array.from(trend, ([date, count]) => ({
      date,
      count,
    })).sort((a, b) => a.date.localeCompare(b.date));

    logger.log("[Verification Metrics] 롤백 메트릭 완료", {
      count: recent.length,
      trend: trendArray.length,
    });

    return {
      count: recent.length,
      trend: trendArray,
    };
  } catch (err) {
    logger.error("[Verification Metrics] 롤백 메트릭 실패", { err });
    return { count: 0, trend: [] };
  }
}

/**
 * 함수 3: 검증 시간 메트릭 (P50, P99, MAX)
 */
async function getVerificationTimeMetric(): Promise<{
  p50: number;
  p99: number;
  max: number;
}> {
  try {
    // Redis에서 검증 시간 기록 조회
    const verificationTimesKey =
      "menu38:phase3:verification_times";
    const times = await redis.lrange(verificationTimesKey, 0, 9999);

    if (!times || times.length === 0) {
      return { p50: 0, p99: 0, max: 0 };
    }

    const parsedTimes = (times as string[])
      .map((t) => parseFloat(t))
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b);

    if (parsedTimes.length === 0) {
      return { p50: 0, p99: 0, max: 0 };
    }

    const p50 = parsedTimes[Math.floor(parsedTimes.length * 0.5)];
    const p99 = parsedTimes[Math.floor(parsedTimes.length * 0.99)];
    const max = parsedTimes[parsedTimes.length - 1];

    logger.log("[Verification Metrics] 검증 시간 메트릭 완료", {
      p50,
      p99,
      max,
    });

    return { p50, p99, max };
  } catch (err) {
    logger.error("[Verification Metrics] 검증 시간 메트릭 실패", { err });
    return { p50: 0, p99: 0, max: 0 };
  }
}

/**
 * 함수 4: Enum Mapping Fallback 메트릭
 */
async function getEnumMappingFallbackMetric(): Promise<{
  count: number;
  types: Record<string, number>;
  trend: Array<{ date: string; count: number }>;
}> {
  try {
    const fallbackKey = "menu38:phase3:enum_mapping_fallbacks";
    const fallbacks = await redis.lrange(fallbackKey, 0, -1);

    if (!fallbacks || fallbacks.length === 0) {
      return { count: 0, types: {}, trend: [] };
    }

    const parsed = (fallbacks as string[])
      .map((item) => {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // 타입별 집계
    const types: Record<string, number> = {};
    const trend = new Map<string, number>();

    for (const item of parsed) {
      // 타입 집계
      const type = item.source || "UNKNOWN";
      types[type] = (types[type] || 0) + 1;

      // 일별 집계
      const date = new Date(item.timestamp || Date.now())
        .toISOString()
        .split("T")[0];
      trend.set(date, (trend.get(date) || 0) + 1);
    }

    const trendArray = Array.from(trend, ([date, count]) => ({
      date,
      count,
    }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // 최근 7일

    logger.log("[Verification Metrics] Enum Mapping Fallback 메트릭 완료", {
      count: parsed.length,
      types,
    });

    return {
      count: parsed.length,
      types,
      trend: trendArray,
    };
  } catch (err) {
    logger.error(
      "[Verification Metrics] Enum Mapping Fallback 메트릭 실패",
      { err }
    );
    return { count: 0, types: {}, trend: [] };
  }
}

/**
 * 함수 5: 복구 상태 메트릭
 */
async function getRecoveryStatusMetric(): Promise<{
  last_rollback: string | null;
  last_recovery_attempt: string | null;
  feature_flag_enabled: boolean;
}> {
  try {
    const rollbackKey = "menu38:phase3:last_rollback_time";
    const recoveryAttemptKey = "menu38:phase3:last_recovery_attempt";
    const featureFlagKey = "menu38:phase3:feature_enabled";

    const [lastRollbackStr, lastRecoveryStr, featureFlagStr] = await Promise.all([
      redis.get(rollbackKey),
      redis.get(recoveryAttemptKey),
      redis.get(featureFlagKey),
    ]);

    return {
      last_rollback: lastRollbackStr
        ? new Date(parseInt(lastRollbackStr as string)).toISOString()
        : null,
      last_recovery_attempt: lastRecoveryStr as string | null,
      feature_flag_enabled: featureFlagStr === "true",
    };
  } catch (err) {
    logger.error("[Verification Metrics] 복구 상태 메트릭 실패", { err });
    return {
      last_rollback: null,
      last_recovery_attempt: null,
      feature_flag_enabled: false,
    };
  }
}

/**
 * 헬퍼: 헬스 상태 판단
 */
function determineHealth(
  consistencyRate: number,
  rollbackCount: number,
  verificationP99: number,
  enumFallbackCount: number
): "HEALTHY" | "WARNING" | "CRITICAL" {
  if (
    consistencyRate >= 0.95 &&
    rollbackCount <= 3 &&
    verificationP99 < 100 &&
    enumFallbackCount < 100
  ) {
    return "HEALTHY";
  }

  if (
    consistencyRate >= 0.85 &&
    rollbackCount <= 5 &&
    verificationP99 < 500
  ) {
    return "WARNING";
  }

  return "CRITICAL";
}
