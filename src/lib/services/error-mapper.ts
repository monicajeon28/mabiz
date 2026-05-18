/**
 * Menu #38 Phase 3-β: 통합 에러 매핑 함수
 *
 * 목적:
 * - Aligo/Email 에러 코드를 SendingFailureReason으로 중앙화
 * - contact-template-sender.ts & execute-campaigns.ts 중복 제거
 * - 향후 Aligo API 변경 시 한 곳만 수정
 *
 * 사용:
 * import { mapAligoErrorToFailureReason, mapEmailErrorToFailureReason }
 *   from "../services/error-mapper";
 */

import type { SendingFailureReason } from "@prisma/client";
import { logger } from "../logger";

// ─────────────────────────────────────────────────────────────────
// Aligo SMS 에러 매핑
// ─────────────────────────────────────────────────────────────────

/**
 * Aligo 결과 코드를 SendingFailureReason으로 변환
 *
 * @param resultCode - Aligo 결과 코드
 * @returns SendingFailureReason
 *
 * @example
 * const reason = mapAligoErrorToFailureReason(-99);
 * // OPT_OUT
 */
export function mapAligoErrorToFailureReason(
  resultCode: number
): SendingFailureReason {
  switch (resultCode) {
    case 1:
      // 성공 (이 함수는 실패 케이스에만 호출되므로 비정상)
      logger.warn("[ErrorMapper] Unexpected success code in error mapping", {
        resultCode,
      });
      return "SYSTEM_ERROR";

    case -99:
      // 수신거부
      return "OPT_OUT";

    case -98:
      // 야간 차단 또는 시간대 제약
      return "SYSTEM_ERROR";

    case -96:
      // 잘못된 휴대폰 번호
      return "INVALID_PHONE";

    case -97:
      // 설정 미완료 (발신번호 미등록 등)
      return "SYSTEM_ERROR";

    case 0:
      // 일반 오류
      return "PROVIDER_ERROR";

    default:
      // 알 수 없는 코드
      logger.warn("[ErrorMapper] Unknown Aligo error code", { resultCode });
      return "PROVIDER_ERROR";
  }
}

// ─────────────────────────────────────────────────────────────────
// Email 에러 매핑
// ─────────────────────────────────────────────────────────────────

/**
 * Email 결과 코드를 SendingFailureReason으로 변환
 *
 * @param resultCode - Email 발송 결과 코드
 * @returns SendingFailureReason
 *
 * @example
 * const reason = mapEmailErrorToFailureReason(-96);
 * // INVALID_EMAIL
 */
export function mapEmailErrorToFailureReason(
  resultCode: number
): SendingFailureReason {
  switch (resultCode) {
    case 1:
      // 성공 (이 함수는 실패 케이스에만 호출되므로 비정상)
      logger.warn("[ErrorMapper] Unexpected success code in error mapping", {
        resultCode,
      });
      return "SYSTEM_ERROR";

    case -96:
      // 잘못된 이메일 주소
      return "INVALID_EMAIL";

    case -97:
      // 설정 미완료 (발송자 메일 미등록 등)
      return "SYSTEM_ERROR";

    default:
      // 알 수 없는 코드
      logger.warn("[ErrorMapper] Unknown Email error code", { resultCode });
      return "PROVIDER_ERROR";
  }
}

// ─────────────────────────────────────────────────────────────────
// 헬퍼: 에러 분류 (Category & Retryability)
// ─────────────────────────────────────────────────────────────────

/**
 * 에러 카테고리 정의
 *
 * @category NETWORK - 네트워크 오류 (DNS, 타임아웃, 연결 실패)
 * @category VALIDATION - 입력 검증 오류 (invalid email, phone)
 * @category RATE_LIMIT - 속도 제한 (Aligo, Email provider)
 * @category STORAGE - 저장소 오류 (DB, Redis)
 * @category TYPE_ERROR - TypeScript 타입 오류 (typeof 불일치)
 * @category RUNTIME_ERROR - 런타임 오류 (일반 Error)
 * @category UNKNOWN - 알 수 없는 오류
 */
export type ErrorCategory =
  | "NETWORK"
  | "VALIDATION"
  | "RATE_LIMIT"
  | "STORAGE"
  | "TYPE_ERROR"
  | "RUNTIME_ERROR"
  | "UNKNOWN";

/**
 * 에러 분류 정보 인터페이스
 *
 * @property category - 에러 카테고리
 * @property retryable - 재시도 가능 여부
 * @property code - 에러 코드 (Aligo, Email provider 등)
 * @property message - 에러 메시지
 */
export interface ClassifiedError {
  category: ErrorCategory;
  retryable: boolean;
  code?: string | number;
  message: string;
}

/**
 * JavaScript 에러 객체를 ErrorCategory로 분류
 *
 * 재시도 가능 여부도 함께 판단:
 * - NETWORK: ✅ 재시도 가능 (임시 오류)
 * - VALIDATION: ❌ 재시도 불가 (영구 오류)
 * - RATE_LIMIT: ✅ 재시도 가능 (지수 백오프)
 * - STORAGE: ⚠️ 경우에 따라 (락, 데드락 가능)
 * - TYPE_ERROR: ❌ 재시도 불가 (코드 버그)
 * - RUNTIME_ERROR: ⚠️ 경우에 따라 (메모리 부족 등)
 *
 * @param err - 에러 객체
 * @param code - 에러 코드 (Aligo, Email provider 등, 선택적)
 * @returns {ClassifiedError} 분류된 에러 정보
 *
 * @example
 * try {
 *   await sendSms(params);
 * } catch (err) {
 *   const classified = classifyError(err, -99);
 *   if (classified.retryable) {
 *     await scheduleRetry(id, retryCount);
 *   } else {
 *     logger.warn(`[Unretryable] ${classified.category}: ${classified.message}`);
 *   }
 * }
 */
export function classifyError(
  err: unknown,
  code?: string | number
): ClassifiedError {
  // 1. TypeError 체크
  if (err instanceof TypeError) {
    return {
      category: "TYPE_ERROR",
      retryable: false,
      code,
      message: err instanceof Error ? err.message : "Type mismatch",
    };
  }

  // 2. 특정 에러 메시지 패턴으로 분류
  const message = getErrorMessage(err);

  if (
    message.includes("ENOTFOUND") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT") ||
    message.includes("EHOSTUNREACH")
  ) {
    return {
      category: "NETWORK",
      retryable: true,
      code,
      message,
    };
  }

  if (message.includes("429") || message.includes("rate limit")) {
    return {
      category: "RATE_LIMIT",
      retryable: true,
      code,
      message,
    };
  }

  if (
    message.includes("database") ||
    message.includes("deadlock") ||
    message.includes("transaction")
  ) {
    return {
      category: "STORAGE",
      retryable: true,
      code,
      message,
    };
  }

  // 3. 일반 Error
  if (err instanceof Error) {
    return {
      category: "RUNTIME_ERROR",
      retryable: true,
      code,
      message: err.message,
    };
  }

  // 4. 불명확한 경우
  return {
    category: "UNKNOWN",
    retryable: false,
    code,
    message: typeof err === "string" ? err : "Unknown error",
  };
}

/**
 * JavaScript 에러 객체를 ErrorType으로 분류 (하위 호환성)
 *
 * @deprecated classifyError() 사용 권장
 * @param err - 에러 객체
 * @returns ErrorType ("TYPE_ERROR" | "REFERENCE_ERROR" | "RUNTIME_ERROR" | "UNKNOWN_ERROR")
 */
export function classifyErrorType(
  err: unknown
): "TYPE_ERROR" | "REFERENCE_ERROR" | "RUNTIME_ERROR" | "UNKNOWN_ERROR" {
  if (err instanceof TypeError) {
    return "TYPE_ERROR";
  }

  if (err instanceof ReferenceError) {
    return "REFERENCE_ERROR";
  }

  if (err instanceof Error) {
    return "RUNTIME_ERROR";
  }

  return "UNKNOWN_ERROR";
}

/**
 * 에러 객체에서 메시지 추출
 *
 * @param err - 에러 객체
 * @returns 에러 메시지
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }

  return "Unknown error";
}

// ─────────────────────────────────────────────────────────────────
// 테스트용 내보내기
// ─────────────────────────────────────────────────────────────────

export const errorMapperTests = {
  mapAligo: mapAligoErrorToFailureReason,
  mapEmail: mapEmailErrorToFailureReason,
  classifyError: classifyErrorType,
  getMessage: getErrorMessage,
};
