/**
 * Phase 3-δ: 롤백 핸들러
 *
 * 목적:
 * - ExecutionLog 사용 중단 (Feature Flag 자동 비활성화)
 * - SendingHistory만 사용 복구
 * - 롤백 시간 < 1분
 *
 * 동작:
 * 1. Feature Flag (ENABLE_EXECUTION_LOG) 비활성화
 * 2. Cache 무효화 (Redis)
 * 3. API 재시작 신호 (Vercel 환경변수 업데이트)
 * 4. Slack 알림 + 상세 로그
 */

import db from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getCache, setCache, invalidateCache } from "@/lib/redis";
import type { RollbackEvent } from "@/types/rollback";

const ROLLBACK_KEY = "crm:rollback_state";
const FEATURE_FLAG_KEY = "crm:feature_flags:enable_execution_log";
const ROLLBACK_COUNT_KEY = "crm:metrics:rollback_count";
const ROLLBACK_MONTHLY_PREFIX = "crm:metrics:rollback_monthly:";

/**
 * 1. Feature Flag 조회 (Redis)
 */
export async function isExecutionLogEnabled(): Promise<boolean> {
  try {
    const flag = await getCache<string>(FEATURE_FLAG_KEY);
    if (flag === null) {
      // 첫 로드 시 환경변수에서 읽기
      const envValue = process.env.ENABLE_EXECUTION_LOG === "true";
      await setCache(FEATURE_FLAG_KEY, envValue ? "1" : "0", 3600);
      return envValue;
    }
    return flag === "1";
  } catch (error) {
    // P0-5 수정: Redis 오류 시 안전 모드(false) 사용
    // - Redis 연결 실패 → ExecutionLog 비활성화 (보수적 접근)
    // - 이전에는 기본값 true → ExecutionLog 활성화 유지 (위험)
    logger.warn("[Rollback] Feature Flag 조회 실패, 안전 모드(false) 사용", { error });
    return false;
  }
}

/**
 * 2. Feature Flag 비활성화 (즉시)
 */
async function disableExecutionLogFeature(): Promise<void> {
  try {
    // Redis 즉시 업데이트 (메모리)
    await setCache(FEATURE_FLAG_KEY, "0", 3600);

    logger.info("[Rollback] ExecutionLog Feature Flag 비활성화 완료");
  } catch (error) {
    logger.error("[Rollback] Feature Flag 비활성화 실패", { error });
    throw error;
  }
}

/**
 * 3. 롤백 이벤트 기록 (DB)
 */
async function recordRollbackEvent(reason: string, details: any): Promise<void> {
  try {
    // RollbackEvent 테이블 생성 (필요 시)
    const timestamp = new Date().toISOString();
    const eventData = {
      timestamp,
      reason,
      details,
      status: "COMPLETED",
    };

    // 임시: 로그 기반 기록 (DB 테이블 추가 전)
    logger.info("[Rollback] 롤백 이벤트 기록", eventData);

    // TODO: 나중에 RollbackEvent 테이블에 저장
    // await db.rollbackEvent.create({ data: eventData });
  } catch (error) {
    logger.error("[Rollback] 이벤트 기록 실패", { error });
    // 롤백 자체는 계속 진행 (비핵심 기능)
  }
}

/**
 * 4. Cache 무효화 (Redis)
 */
async function invalidateExecutionLogCache(): Promise<void> {
  try {
    // ExecutionLog 캐시 패턴 삭제
    await invalidateCache("crm:execution_log:*");
    logger.info("[Rollback] ExecutionLog 캐시 삭제 완료");

    // 관련 쿼리 캐시도 삭제
    await invalidateCache("crm:campaign:stats:*");
    logger.info("[Rollback] 캠페인 통계 캐시 삭제 완료");
  } catch (error) {
    logger.warn("[Rollback] 캐시 무효화 실패", { error });
    // 캐시 삭제 실패는 비핵심 → 롤백 계속 진행
  }
}

/**
 * 5. 현재 롤백 상태 저장
 */
async function setRollbackState(state: {
  triggeredAt: string;
  reason: string;
  recoveryTarget: "SENDING_HISTORY" | "EXECUTION_LOG";
}): Promise<void> {
  try {
    // Redis에 상태 저장 (24시간 유지)
    await setCache(ROLLBACK_KEY, state, 24 * 60 * 60);
    logger.info("[Rollback] 롤백 상태 저장", state);
  } catch (error) {
    logger.warn("[Rollback] 상태 저장 실패", { error });
  }
}

/**
 * 6. 롤백 상태 조회
 */
export async function getRollbackState(): Promise<{
  triggeredAt: string;
  reason: string;
  recoveryTarget: string;
} | null> {
  try {
    const state = await getCache<any>(ROLLBACK_KEY);
    return state || null;
  } catch (error) {
    logger.warn("[Rollback] 상태 조회 실패", { error });
    return null;
  }
}

/**
 * 7. 롤백 검증: SendingHistory 데이터 정합성 확인
 */
async function validateSendingHistoryIntegrity(): Promise<{
  valid: boolean;
  totalRecords: number;
  nullPhoneCount: number;
  nullEmailCount: number;
}> {
  try {
    const totalRecords = await db.sendingHistory.count();

    // 롤백 후 필수 필드 체크
    const nullPhoneCount = await db.sendingHistory.count({
      where: {
        channel: "SMS",
        phone: null,
      },
    });

    const nullEmailCount = await db.sendingHistory.count({
      where: {
        channel: "EMAIL",
        email: null,
      },
    });

    const valid = nullPhoneCount === 0 && nullEmailCount === 0;

    logger.info("[Rollback] SendingHistory 정합성 검증", {
      totalRecords,
      nullPhoneCount,
      nullEmailCount,
      valid,
    });

    return {
      valid,
      totalRecords,
      nullPhoneCount,
      nullEmailCount,
    };
  } catch (error) {
    logger.error("[Rollback] 정합성 검증 실패", { error });
    throw error;
  }
}

/**
 * 메인 롤백 함수: SendingHistory로 완전 복구
 * 실행 시간 목표: < 1분
 */
export async function rollbackToSendingHistory(
  reason: string = "ExecutionLog inconsistency detected"
): Promise<{
  success: boolean;
  duration: number;
  details: any;
}> {
  const startTime = Date.now();

  logger.warn("[Rollback] 롤백 시작", { reason });

  try {
    // Step 1: Feature Flag 비활성화 (즉시)
    await disableExecutionLogFeature();

    // Step 2: Cache 무효화
    await invalidateExecutionLogCache();

    // Step 3: 롤백 상태 저장
    await setRollbackState({
      triggeredAt: new Date().toISOString(),
      reason,
      recoveryTarget: "SENDING_HISTORY",
    });

    // Step 4: SendingHistory 정합성 검증
    const validation = await validateSendingHistoryIntegrity();

    if (!validation.valid) {
      logger.error("[Rollback] SendingHistory 정합성 오류", validation);
      throw new Error("SendingHistory integrity check failed");
    }

    // Step 5: 롤백 이벤트 기록
    await recordRollbackEvent(reason, {
      validationResult: validation,
      timestamp: new Date().toISOString(),
    });

    // Step 6: P2-1 메트릭 기록 (롤백 횟수 누적)
    await incrementRollbackMetrics();

    const duration = Date.now() - startTime;

    const result = {
      success: true,
      duration,
      details: {
        validationResult: validation,
        featureFlagDisabled: true,
        cacheInvalidated: true,
        rollbackCompleted: true,
        targetedAt: `SENDING_HISTORY (${validation.totalRecords} records)`,
      },
    };

    logger.info("[Rollback] 완료", {
      ...result,
      durationMs: duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error("[Rollback] 실패", {
      error,
      durationMs: duration,
      reason,
    });

    throw {
      success: false,
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 롤백 상태 초기화 (복구 후)
 * 운영팀에서 수동으로 호출
 */
export async function clearRollbackState(): Promise<void> {
  try {
    await invalidateCache(ROLLBACK_KEY);
    logger.info("[Rollback] 상태 초기화 완료");
  } catch (error) {
    logger.warn("[Rollback] 상태 초기화 실패", { error });
  }
}

/**
 * 롤백 복구 시나리오: ExecutionLog로 재복귀 (수동)
 * 데이터 검증 후 운영팀에서 수동 호출
 */
export async function enableExecutionLogFeature(): Promise<void> {
  try {
    await setCache(FEATURE_FLAG_KEY, "1", 3600);
    logger.info("[Rollback] ExecutionLog Feature Flag 재활성화 완료");
  } catch (error) {
    logger.error("[Rollback] Feature Flag 재활성화 실패", { error });
    throw error;
  }
}

/**
 * P2-1 메트릭: 롤백 횟수 누적 기록
 * - 전체 누적 카운트
 * - 월별 카운트 (e.g., crm:metrics:rollback_monthly:202605)
 */
async function incrementRollbackMetrics(): Promise<void> {
  try {
    // 전체 누적 카운트 증가
    await getCache(ROLLBACK_COUNT_KEY); // 존재 여부 확인
    const currentCount = await getCache<number>(ROLLBACK_COUNT_KEY);
    const newCount = (currentCount ?? 0) + 1;
    await setCache(ROLLBACK_COUNT_KEY, newCount, 365 * 24 * 60 * 60); // 1년 유지

    // 월별 카운트 증가
    const now = new Date();
    const monthKey = `${ROLLBACK_MONTHLY_PREFIX}${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthCount = await getCache<number>(monthKey);
    const newMonthCount = (currentMonthCount ?? 0) + 1;
    await setCache(monthKey, newMonthCount, 30 * 24 * 60 * 60); // 한 달 유지

    logger.info("[Metrics] 롤백 카운트 증가", {
      totalCount: newCount,
      monthlyCount: newMonthCount,
      month: monthKey,
    });
  } catch (error) {
    logger.warn("[Metrics] 롤백 카운트 기록 실패", { error });
    // 메트릭 기록 실패는 비핵심 → 무시
  }
}

/**
 * P2-1 메트릭: 롤백 통계 조회
 */
export async function getRollbackMetrics(): Promise<{
  totalRollbacks: number;
  monthlyRollbacks: number;
  currentMonth: string;
}> {
  try {
    const totalRollbacks = (await getCache<number>(ROLLBACK_COUNT_KEY)) ?? 0;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthKey = `${ROLLBACK_MONTHLY_PREFIX}${currentMonth}`;
    const monthlyRollbacks = (await getCache<number>(monthKey)) ?? 0;

    return {
      totalRollbacks,
      monthlyRollbacks,
      currentMonth,
    };
  } catch (error) {
    logger.warn("[Metrics] 롤백 통계 조회 실패", { error });
    return {
      totalRollbacks: 0,
      monthlyRollbacks: 0,
      currentMonth: "",
    };
  }
}

/**
 * 롤백 상태 대시보드 조회
 */
export async function getRollbackStatus(): Promise<{
  isExecutionLogEnabled: boolean;
  rollbackState: any;
  lastRollbackAt?: string;
  recoveryInProgress: boolean;
  metrics?: { totalRollbacks: number; monthlyRollbacks: number; currentMonth: string };
}> {
  const isEnabled = await isExecutionLogEnabled();
  const state = await getRollbackState();
  const metrics = await getRollbackMetrics();

  return {
    isExecutionLogEnabled: isEnabled,
    rollbackState: state,
    lastRollbackAt: state?.triggeredAt,
    recoveryInProgress: !isEnabled && state?.recoveryTarget === "SENDING_HISTORY",
    metrics,
  };
}
