/**
 * 통합 에러 코드 및 분류 시스템
 * HTTP 상태 코드별 표준화된 에러 처리
 *
 * 사용법:
 * import { ERROR_CODES, getErrorResponse } from '@/lib/error-codes';
 *
 * // API에서
 * return NextResponse.json(
 *   getErrorResponse('VALIDATION_ERROR', {
 *     message: '전화번호 형식이 올바르지 않습니다',
 *     field: 'phone'
 *   }),
 *   { status: 400 }
 * );
 */

export const ERROR_CODES = {
  // ─── 400 Bad Request (클라이언트 입력 오류) ────────────────────
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    status: 400,
    retryable: false,
    userMessage: '입력값을 확인해주세요',
    icon: 'alert-circle',
    color: 'red',
  },
  MISSING_REQUIRED_FIELD: {
    code: 'MISSING_REQUIRED_FIELD',
    status: 400,
    retryable: false,
    userMessage: '필수 항목을 입력해주세요',
    icon: 'alert-circle',
    color: 'red',
  },
  INVALID_PHONE_FORMAT: {
    code: 'INVALID_PHONE_FORMAT',
    status: 400,
    retryable: false,
    userMessage: '전화번호 형식이 올바르지 않습니다 (예: 010-1234-5678)',
    icon: 'alert-circle',
    color: 'red',
  },
  INVALID_EMAIL_FORMAT: {
    code: 'INVALID_EMAIL_FORMAT',
    status: 400,
    retryable: false,
    userMessage: '이메일 형식이 올바르지 않습니다 (예: user@example.com)',
    icon: 'alert-circle',
    color: 'red',
  },
  INVALID_AGE: {
    code: 'INVALID_AGE',
    status: 400,
    retryable: false,
    userMessage: '나이는 1~150 사이의 숫자여야 합니다',
    icon: 'alert-circle',
    color: 'red',
  },
  INVALID_JSON: {
    code: 'INVALID_JSON',
    status: 400,
    retryable: false,
    userMessage: 'JSON 형식이 올바르지 않습니다',
    icon: 'alert-circle',
    color: 'red',
  },
  INVALID_SEGMENT_DATA: {
    code: 'INVALID_SEGMENT_DATA',
    status: 400,
    retryable: false,
    userMessage: '입력하신 고객 정보가 올바르지 않습니다. 다시 확인해주세요',
    icon: 'alert-circle',
    color: 'red',
  },

  // ─── 409 Conflict ────────────────────────────────────────────────
  DUPLICATE_ENTRY: {
    code: 'DUPLICATE_ENTRY',
    status: 409,
    retryable: false,
    userMessage: '이미 존재하는 항목입니다',
    icon: 'alert-circle',
    color: 'red',
  },
  DUPLICATE_PHONE: {
    code: 'DUPLICATE_PHONE',
    status: 409,
    retryable: false,
    userMessage: '이미 등록된 전화번호입니다',
    icon: 'alert-circle',
    color: 'red',
  },

  // ─── 413 Payload Too Large (데이터 크기 초과) ──────────────────
  PAYLOAD_TOO_LARGE: {
    code: 'PAYLOAD_TOO_LARGE',
    status: 413,
    retryable: false,
    userMessage: '요청 데이터가 너무 큽니다. 작은 단위로 분할해주세요',
    icon: 'alert-triangle',
    color: 'yellow',
  },
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    status: 413,
    retryable: false,
    userMessage: '파일이 너무 큽니다. 작은 크기로 분할해주세요',
    icon: 'alert-triangle',
    color: 'yellow',
  },
  TOO_MANY_ITEMS: {
    code: 'TOO_MANY_ITEMS',
    status: 413,
    retryable: false,
    userMessage: '항목이 너무 많습니다. 배치를 분할해주세요',
    icon: 'alert-triangle',
    color: 'yellow',
  },

  // ─── 401/403 인증 & 권한 ────────────────────────────────────
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    status: 401,
    retryable: false,
    userMessage: '로그인이 필요합니다',
    icon: 'lock',
    color: 'red',
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    status: 403,
    retryable: false,
    userMessage: '이 작업을 수행할 권한이 없습니다',
    icon: 'lock',
    color: 'red',
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    status: 401,
    retryable: false,
    userMessage: '인증 토큰이 유효하지 않습니다. 다시 로그인해주세요',
    icon: 'lock',
    color: 'red',
  },

  // ─── 404 Not Found ───────────────────────────────────────────
  NOT_FOUND: {
    code: 'NOT_FOUND',
    status: 404,
    retryable: false,
    userMessage: '요청하신 항목을 찾을 수 없습니다',
    icon: 'search',
    color: 'red',
  },
  PRODUCT_NOT_FOUND: {
    code: 'PRODUCT_NOT_FOUND',
    status: 404,
    retryable: false,
    userMessage: '요청하신 상품을 찾을 수 없습니다',
    icon: 'search',
    color: 'red',
  },
  CONTACT_NOT_FOUND: {
    code: 'CONTACT_NOT_FOUND',
    status: 404,
    retryable: false,
    userMessage: '요청하신 고객을 찾을 수 없습니다',
    icon: 'search',
    color: 'red',
  },

  // ─── 429 Too Many Requests (레이트 제한) ──────────────────
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    status: 429,
    retryable: true,
    userMessage: '요청이 많습니다. 잠시 후 다시 시도해주세요',
    icon: 'clock',
    color: 'yellow',
  },
  SMS_DAILY_LIMIT: {
    code: 'SMS_DAILY_LIMIT',
    status: 429,
    retryable: true,
    userMessage: '일일 SMS 발송 제한을 초과했습니다. 내일 다시 시도해주세요',
    icon: 'clock',
    color: 'yellow',
  },
  API_RATE_LIMIT: {
    code: 'API_RATE_LIMIT',
    status: 429,
    retryable: true,
    userMessage: '요청이 많습니다. 몇 초 후에 다시 시도해주세요',
    icon: 'clock',
    color: 'yellow',
  },

  // ─── 500+ 서버 오류 (자동 재시도 권장) ───────────────────
  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    status: 500,
    retryable: true,
    userMessage: '일시적인 오류가 발생했습니다. 자동으로 재시도 중입니다',
    icon: 'alert-triangle',
    color: 'orange',
  },
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    status: 500,
    retryable: true,
    userMessage: '데이터베이스 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
    icon: 'alert-triangle',
    color: 'orange',
    externalService: '데이터베이스',
  },
  DATABASE_UNAVAILABLE: {
    code: 'DATABASE_UNAVAILABLE',
    status: 503,
    retryable: true,
    userMessage: '데이터베이스가 일시적으로 사용 불가능합니다. 다시 시도해주세요',
    icon: 'alert-triangle',
    color: 'orange',
  },

  // ─── 외부 서비스 에러 ────────────────────────────────────────
  CRUISEDOT_API_ERROR: {
    code: 'CRUISEDOT_API_ERROR',
    status: 502,
    retryable: true,
    userMessage: 'Cruisedot 연동 오류입니다. 잠시 후 다시 시도해주세요',
    icon: 'alert-triangle',
    color: 'orange',
    externalService: 'Cruisedot',
  },
  PAYAPP_API_ERROR: {
    code: 'PAYAPP_API_ERROR',
    status: 502,
    retryable: true,
    userMessage: 'PayApp 결제 시스템 오류입니다. 잠시 후 다시 시도해주세요',
    icon: 'alert-triangle',
    color: 'orange',
    externalService: 'PayApp',
  },
  ALIGO_SMS_ERROR: {
    code: 'ALIGO_SMS_ERROR',
    status: 502,
    retryable: true,
    userMessage: 'SMS 발송 서비스 오류입니다. 잠시 후 다시 시도해주세요',
    icon: 'alert-triangle',
    color: 'orange',
    externalService: '알리고 SMS',
  },
  EXTERNAL_SERVICE_ERROR: {
    code: 'EXTERNAL_SERVICE_ERROR',
    status: 502,
    retryable: true,
    userMessage: '외부 서비스 연동 오류입니다. 잠시 후 다시 시도해주세요',
    icon: 'alert-triangle',
    color: 'orange',
  },

  // ─── 503 Service Unavailable ──────────────────────────────
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    status: 503,
    retryable: true,
    userMessage: '서비스가 일시적으로 점검 중입니다. 잠시 후 다시 시도해주세요',
    icon: 'alert-triangle',
    color: 'orange',
  },

  // ─── 504 Gateway Timeout ──────────────────────────────────
  GATEWAY_TIMEOUT: {
    code: 'GATEWAY_TIMEOUT',
    status: 504,
    retryable: true,
    userMessage: '요청이 시간초과되었습니다. 다시 시도해주세요',
    icon: 'alert-triangle',
    color: 'orange',
  },
} as const;

/**
 * HTTP 상태 코드에서 에러 코드 찾기
 */
export function getErrorCodeByStatus(status: number): keyof typeof ERROR_CODES | null {
  return (
    Object.entries(ERROR_CODES).find(
      ([, def]) => def.status === status
    )?.[0] as keyof typeof ERROR_CODES | null
  ) || null;
}

/**
 * 표준 에러 응답 생성
 *
 * 사용 예:
 * return NextResponse.json(
 *   getErrorResponse('VALIDATION_ERROR', {
 *     message: '전화번호가 필요합니다',
 *     field: 'phone',
 *     suggestion: '010-XXXX-XXXX 형식으로 입력해주세요'
 *   }),
 *   { status: 400 }
 * );
 */
export function getErrorResponse(
  code: keyof typeof ERROR_CODES,
  details?: {
    message?: string;
    field?: string;
    suggestion?: string;
    currentSize?: number;
    maxSize?: number;
    retryAfter?: number;
  }
) {
  const errorDef = ERROR_CODES[code];
  const operationId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  return {
    ok: false,
    error: {
      code,
      message: details?.message || errorDef.userMessage,
      operationId,
      retryable: errorDef.retryable,
      ...(details?.field && { field: details.field }),
      ...(details?.suggestion && { suggestion: details.suggestion }),
      ...(details?.currentSize !== undefined && { currentSize: details.currentSize }),
      ...(details?.maxSize !== undefined && { maxSize: details.maxSize }),
      ...(details?.retryAfter !== undefined && { retryAfterMs: details.retryAfter }),
    },
  };
}

/**
 * 재시도 가능한 에러인지 확인
 */
export function isRetryable(code: keyof typeof ERROR_CODES): boolean {
  return ERROR_CODES[code].retryable;
}

/**
 * HTTP 상태 코드가 재시도 가능한지 확인
 */
export function isRetryableStatus(status: number): boolean {
  const code = getErrorCodeByStatus(status);
  return code ? isRetryable(code) : [408, 429, 500, 502, 503, 504].includes(status);
}

/**
 * 에러 코드의 HTTP 상태 코드 반환
 */
export function getStatusCode(code: keyof typeof ERROR_CODES): number {
  return ERROR_CODES[code].status;
}
