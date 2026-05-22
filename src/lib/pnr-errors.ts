/**
 * PNR 에러 처리 상수화 및 메시지 매핑
 *
 * 목표: 서버 기술 에러가 사용자 UI에 노출되지 않도록 표준화
 * - 서버 로그: 기술 정보 기록
 * - 사용자 UI: 일반 메시지만 표시
 */

export const PNR_ERROR_CODES = {
  INVALID_RESERVATION_ID: 'INVALID_RESERVATION_ID',
  RESERVATION_NOT_FOUND: 'RESERVATION_NOT_FOUND',
  PHONE_VERIFICATION_FAILED: 'PHONE_VERIFICATION_FAILED',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SUBMISSION_FAILED: 'SUBMISSION_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  DATA_PARSE_ERROR: 'DATA_PARSE_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
} as const;

/**
 * 사용자에게 노출할 공개 에러 메시지
 * - 기술 용어 완전 제거
 - 친화적이고 이해하기 쉬운 한국어
 */
export const PUBLIC_ERROR_MESSAGES: Record<string, string> = {
  [PNR_ERROR_CODES.INVALID_RESERVATION_ID]: '예약 번호가 올바르지 않습니다.',
  [PNR_ERROR_CODES.RESERVATION_NOT_FOUND]: '예약 정보를 찾을 수 없습니다.',
  [PNR_ERROR_CODES.PHONE_VERIFICATION_FAILED]: '입력하신 전화번호가 일치하지 않습니다.',
  [PNR_ERROR_CODES.UNAUTHORIZED_ACCESS]: '이 정보에 접근할 권한이 없습니다.',
  [PNR_ERROR_CODES.VALIDATION_ERROR]: '입력하신 정보가 올바르지 않습니다.',
  [PNR_ERROR_CODES.SUBMISSION_FAILED]: 'PNR 정보 저장에 실패했습니다.',
  [PNR_ERROR_CODES.NETWORK_ERROR]: '네트워크 연결을 확인해주세요.',
  [PNR_ERROR_CODES.DATA_PARSE_ERROR]: '응답 데이터 처리 중 오류가 발생했습니다.',
  [PNR_ERROR_CODES.AUTH_ERROR]: '인증 중 오류가 발생했습니다.',
  [PNR_ERROR_CODES.SESSION_EXPIRED]: '세션이 만료되었습니다.',
};

/**
 * 에러를 공개 메시지로 매핑
 * @param error 에러 코드 또는 Error 객체
 * @param fallback 기본값 (기본: SUBMISSION_FAILED)
 * @returns 사용자에게 노출할 메시지
 */
export function mapErrorToPublicMessage(
  error: unknown,
  fallback: string = PNR_ERROR_CODES.SUBMISSION_FAILED
): string {
  if (typeof error === 'string' && error in PUBLIC_ERROR_MESSAGES) {
    return PUBLIC_ERROR_MESSAGES[error];
  }
  return PUBLIC_ERROR_MESSAGES[fallback] || PUBLIC_ERROR_MESSAGES[PNR_ERROR_CODES.SUBMISSION_FAILED];
}

/**
 * 에러 상수 내보내기 (컴포넌트에서 사용)
 */
export const ERROR_MESSAGES = {
  LOAD_FAILED: PUBLIC_ERROR_MESSAGES[PNR_ERROR_CODES.RESERVATION_NOT_FOUND],
  PHONE_VERIFICATION_FAILED: PUBLIC_ERROR_MESSAGES[PNR_ERROR_CODES.PHONE_VERIFICATION_FAILED],
  SUBMISSION_FAILED: PUBLIC_ERROR_MESSAGES[PNR_ERROR_CODES.SUBMISSION_FAILED],
  AUTH_ERROR: PUBLIC_ERROR_MESSAGES[PNR_ERROR_CODES.AUTH_ERROR],
  NETWORK_ERROR: PUBLIC_ERROR_MESSAGES[PNR_ERROR_CODES.NETWORK_ERROR],
} as const;
