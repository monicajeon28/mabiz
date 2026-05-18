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
// 헬퍼: 에러 타입 분류
// ─────────────────────────────────────────────────────────────────

/**
 * JavaScript 에러 객체를 ErrorType으로 분류
 *
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
