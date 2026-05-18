/**
 * Menu #38 Phase 3: Enum Mapping
 *
 * ExecutionLog <→> SendingHistory 열거형 상호 변환
 *
 * 호환성:
 * - Status: 100% (동일)
 * - FailureReason: 95% (INVALID_CONTACT → INVALID_PHONE 매핑)
 */

import { logger } from "./logger";
import type {
  SendingFailureReason,
  ExecutionFailureReason,
  SendingStatus,
  ExecutionStatus,
} from "@prisma/client";

/**
 * ExecutionLog Status → SendingHistory Status
 * 호환성: 100% (1:1 매핑)
 */
export function mapExecutionToSendingStatus(
  status: ExecutionStatus | string
): SendingStatus {
  const statusMap: Record<string, SendingStatus> = {
    PENDING: "PENDING",
    SENT: "SENT",
    FAILED: "FAILED",
    SKIPPED: "SKIPPED",
    RETRY_SCHEDULED: "RETRY_SCHEDULED",
    ABANDONED: "ABANDONED",
  };

  const mapped = statusMap[status];
  if (!mapped) {
    logger.warn("[Enum Mapping] Unknown ExecutionStatus", { status });
    return "FAILED"; // 안전 기본값
  }

  return mapped;
}

/**
 * SendingHistory Status → ExecutionLog Status
 * 호환성: 100% (1:1 매핑)
 */
export function mapSendingToExecutionStatus(
  status: SendingStatus | string
): ExecutionStatus {
  const statusMap: Record<string, ExecutionStatus> = {
    PENDING: "PENDING",
    SENT: "SENT",
    FAILED: "FAILED",
    SKIPPED: "SKIPPED",
    RETRY_SCHEDULED: "RETRY_SCHEDULED",
    ABANDONED: "ABANDONED",
  };

  const mapped = statusMap[status];
  if (!mapped) {
    logger.warn("[Enum Mapping] Unknown SendingStatus", { status });
    return "FAILED"; // 안전 기본값
  }

  return mapped;
}

/**
 * ExecutionLog FailureReason → SendingHistory FailureReason
 * 호환성: 95% (INVALID_CONTACT는 INVALID_PHONE으로 매핑, 정보 손실 경고)
 */
export function mapExecutionToSendingFailureReason(
  reason: ExecutionFailureReason | string | null | undefined
): SendingFailureReason | null {
  if (!reason) return null;

  const reasonMap: Record<string, SendingFailureReason> = {
    INVALID_EMAIL: "INVALID_EMAIL",
    INVALID_PHONE: "INVALID_PHONE",
    INVALID_CONTACT: "INVALID_PHONE", // ⚠️ 매핑 (정보 손실 가능)
    OPT_OUT: "OPT_OUT",
    QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
    SYSTEM_ERROR: "SYSTEM_ERROR",
    PROVIDER_ERROR: "PROVIDER_ERROR",
    NETWORK_ERROR: "NETWORK_ERROR",
    BOUNCE: "BOUNCE",
  };

  const mapped = reasonMap[reason];
  if (!mapped) {
    logger.warn("[Enum Mapping] Unknown ExecutionFailureReason", { reason });
    return "SYSTEM_ERROR"; // 안전 기본값
  }

  // INVALID_CONTACT 매핑 시 경고
  if (reason === "INVALID_CONTACT") {
    logger.warn(
      "[Enum Mapping] INVALID_CONTACT mapped to INVALID_PHONE",
      {
        reason,
        mapped,
        note: "정보 손실 가능성 있음 (자동화/퍼널용)",
      }
    );
  }

  return mapped;
}

/**
 * SendingHistory FailureReason → ExecutionLog FailureReason
 * 호환성: 100% (SendingHistory는 INVALID_CONTACT를 사용하지 않음)
 */
export function mapSendingToExecutionFailureReason(
  reason: SendingFailureReason | string | null | undefined
): ExecutionFailureReason | null {
  if (!reason) return null;

  const reasonMap: Record<string, ExecutionFailureReason> = {
    INVALID_EMAIL: "INVALID_EMAIL",
    INVALID_PHONE: "INVALID_PHONE",
    OPT_OUT: "OPT_OUT",
    QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
    SYSTEM_ERROR: "SYSTEM_ERROR",
    PROVIDER_ERROR: "PROVIDER_ERROR",
    NETWORK_ERROR: "NETWORK_ERROR",
    BOUNCE: "BOUNCE",
  };

  const mapped = reasonMap[reason];
  if (!mapped) {
    logger.warn("[Enum Mapping] Unknown SendingFailureReason", { reason });
    return "SYSTEM_ERROR"; // 안전 기본값
  }

  return mapped;
}

/**
 * 단위 테스트용 내보내기
 */
export const enumMappingTests = {
  status: {
    forward: mapExecutionToSendingStatus,
    backward: mapSendingToExecutionStatus,
  },
  failureReason: {
    forward: mapExecutionToSendingFailureReason,
    backward: mapSendingToExecutionFailureReason,
  },
};
