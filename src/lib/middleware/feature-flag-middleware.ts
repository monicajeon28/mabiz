/**
 * Phase 3-δ: Feature Flag 미들웨어
 *
 * 목적:
 * - ExecutionLog 사용 여부 동적 제어
 * - 롤백 상황에서 자동으로 SendingHistory로 전환
 * - API 요청 시 실시간 Feature Flag 확인
 */

import { logger } from "@/lib/logger";
import { isExecutionLogEnabled, getRollbackState } from "@/lib/services/rollback-handler";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Feature Flag 상태 타입
 */
export interface FeatureFlagStatus {
  executionLogEnabled: boolean;
  rollbackInProgress: boolean;
  recoveryTarget: "EXECUTION_LOG" | "SENDING_HISTORY";
  message?: string;
}

/**
 * Feature Flag 확인 (요청 시점에 실시간 확인)
 */
export async function checkFeatureFlag(): Promise<FeatureFlagStatus> {
  try {
    const isEnabled = await isExecutionLogEnabled();
    const rollbackState = await getRollbackState();

    const status: FeatureFlagStatus = {
      executionLogEnabled: isEnabled,
      rollbackInProgress: !isEnabled && rollbackState?.recoveryTarget === "SENDING_HISTORY",
      recoveryTarget: isEnabled ? "EXECUTION_LOG" : "SENDING_HISTORY",
    };

    if (!isEnabled && rollbackState) {
      status.message = `Rollback in progress since ${rollbackState.triggeredAt}: ${rollbackState.reason}`;
    }

    return status;
  } catch (error) {
    logger.error("[FeatureFlag] 확인 실패, 안전 모드로 전환", { error });
    // 오류 발생 시 안전 모드 (SendingHistory)
    return {
      executionLogEnabled: false,
      rollbackInProgress: true,
      recoveryTarget: "SENDING_HISTORY",
      message: "Feature flag check failed, switched to safe mode",
    };
  }
}

/**
 * API 응답에 Feature Flag 상태 추가
 */
export function addFeatureFlagHeader(
  response: NextResponse,
  status: FeatureFlagStatus
): NextResponse {
  response.headers.set(
    "X-Feature-Flag-ExecutionLog",
    status.executionLogEnabled ? "true" : "false"
  );
  response.headers.set(
    "X-Rollback-InProgress",
    status.rollbackInProgress ? "true" : "false"
  );
  response.headers.set("X-Recovery-Target", status.recoveryTarget);

  return response;
}

/**
 * 래퍼 함수: API 핸들러에서 Feature Flag 자동 확인
 *
 * 사용 예:
 * ```typescript
 * export async function POST(req: NextRequest) {
 *   return withFeatureFlagCheck(async (flagStatus) => {
 *     if (!flagStatus.executionLogEnabled) {
 *       // SendingHistory 사용
 *     }
 *     // ...
 *   });
 * }
 * ```
 */
export async function withFeatureFlagCheck<T>(
  handler: (flagStatus: FeatureFlagStatus) => Promise<T>
): Promise<T> {
  const flagStatus = await checkFeatureFlag();
  logger.info("[FeatureFlag] API 요청 시 상태", flagStatus);
  return handler(flagStatus);
}

/**
 * 캠페인 발송 시 자동 라우팅
 *
 * - ExecutionLog 활성: ExecutionLog 사용
 * - ExecutionLog 비활성: SendingHistory로 폴백
 */
export async function routeBySendingTable(
  executionLogQuery: () => Promise<any>,
  sendingHistoryQuery: () => Promise<any>
): Promise<any> {
  const flagStatus = await checkFeatureFlag();

  if (flagStatus.executionLogEnabled) {
    logger.info("[FeatureFlag] ExecutionLog 사용");
    return executionLogQuery();
  } else {
    logger.info("[FeatureFlag] SendingHistory로 폴백");
    return sendingHistoryQuery();
  }
}

/**
 * 검증 API: 현재 Feature Flag 상태 조회
 */
export async function getFeatureFlagStatus(): Promise<FeatureFlagStatus> {
  return checkFeatureFlag();
}
