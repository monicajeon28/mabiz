/**
 * 사용자 친화적 에러 메시지 모음
 * API 에러 → 사용자 메시지 매핑
 */

export const ERROR_MESSAGES = {
  // 세그먼트 감지
  SEGMENT_DETECTION_FAILED: '고객 정보가 부족하여 추천을 생성할 수 없습니다. 나이, 결혼상태, 자녀 수를 입력해주세요.',
  INVALID_SEGMENT_DATA: '입력하신 고객 정보가 올바르지 않습니다. 다시 확인해주세요.',

  // 상품 추천
  NO_PRODUCTS_FOUND: '현재 추천 가능한 상품이 없습니다.',
  PRODUCT_NOT_FOUND: '요청하신 상품을 찾을 수 없습니다.',
  INVALID_PRODUCT_CODE: '유효하지 않은 상품 코드입니다.',

  // 플레이북
  PLAYBOOK_LOAD_FAILED: '스크립트를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.',
  PLAYBOOK_FILTER_EMPTY: '선택한 조건에 맞는 스크립트가 없습니다.',
  PLAYBOOK_PARSE_ERROR: '스크립트 데이터를 읽을 수 없습니다.',

  // 네트워크
  NETWORK_ERROR: '네트워크 연결을 확인해주세요.',
  TIMEOUT_ERROR: '요청 시간이 초과되었습니다. 다시 시도해주세요.',
  SERVER_ERROR: '서버에 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',

  // 입력값
  INVALID_INPUT: '입력값이 올바르지 않습니다.',
  REQUIRED_FIELD: '필수 항목을 입력해주세요.',
  INVALID_AGE: '나이는 1~150 사이의 숫자여야 합니다.',
  INVALID_CHILDREN_COUNT: '자녀 수는 0 이상의 숫자여야 합니다.',

  // 권한
  UNAUTHORIZED: '접근 권한이 없습니다.',
  FORBIDDEN: '이 작업을 수행할 수 없습니다.',

  // 기타
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다. 관리자에게 문의해주세요.',
} as const;

/**
 * HTTP 상태 코드 → 에러 메시지 매핑
 */
export function getErrorMessageByStatusCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return ERROR_MESSAGES.INVALID_INPUT;
    case 401:
      return ERROR_MESSAGES.UNAUTHORIZED;
    case 403:
      return ERROR_MESSAGES.FORBIDDEN;
    case 404:
      return ERROR_MESSAGES.PRODUCT_NOT_FOUND;
    case 408:
      return ERROR_MESSAGES.TIMEOUT_ERROR;
    case 500:
    case 502:
    case 503:
    case 504:
      return ERROR_MESSAGES.SERVER_ERROR;
    default:
      return ERROR_MESSAGES.UNKNOWN_ERROR;
  }
}

/**
 * 에러 상황별 메시지 선택
 */
export function getErrorMessage(
  errorType: 'segment' | 'product' | 'playbook' | 'network' | 'validation' | 'unknown' | string,
  details?: string
): string {
  const messages: Record<string, string> = {
    segment: ERROR_MESSAGES.SEGMENT_DETECTION_FAILED,
    product: ERROR_MESSAGES.PRODUCT_NOT_FOUND,
    playbook: ERROR_MESSAGES.PLAYBOOK_LOAD_FAILED,
    network: ERROR_MESSAGES.NETWORK_ERROR,
    validation: ERROR_MESSAGES.INVALID_INPUT,
    unknown: ERROR_MESSAGES.UNKNOWN_ERROR,
  };

  const message = messages[errorType] || messages.unknown;
  return details ? `${message} (${details})` : message;
}

/**
 * 네트워크 에러 타입 구분 및 사용자 메시지 생성
 */
export function getNetworkErrorMessage(err: any, context: string = ''): string {
  const prefix = context ? `[${context}] ` : '';

  // 네트워크 연결 오류
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return `${prefix}네트워크 연결을 확인해주세요`;
  }

  // 타임아웃 (AbortError)
  if (err.name === 'AbortError') {
    return `${prefix}요청이 타임아웃되었습니다. 다시 시도해주세요`;
  }

  // HTTP 상태 코드 기반
  if (err.status === 400 || err.status === 422) {
    return `${prefix}입력값을 확인해주세요`;
  }

  if (err.status === 401) {
    return `${prefix}재로그인이 필요합니다`;
  }

  if (err.status === 429) {
    // Rate limit - 시간 정보 추출 시도
    const resetTime = err.resetAt || err.headers?.['retry-after'];
    if (resetTime) {
      return `${prefix}일일 발송 제한을 초과했습니다. ${resetTime}부터 가능합니다`;
    }
    return `${prefix}일일 발송 제한을 초과했습니다`;
  }

  if (err.status && err.status >= 500) {
    return `${prefix}서버 오류입니다. 잠시 후 다시 시도해주세요`;
  }

  // 기본
  return `${prefix}${err.message || '알 수 없는 오류가 발생했습니다'}`;
}

/**
 * 타임아웃이 포함된 fetch 함수
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 15000, ...fetchOpts } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOpts,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 메시지 텍스트 입력 검증 (XSS, 금지 패턴)
 */
export function validateMessage(msg: string): { valid: boolean; error?: string } {
  if (!msg.trim()) {
    return { valid: false, error: '메시지를 입력해주세요' };
  }

  if (msg.length > 1000) {
    return { valid: false, error: '메시지는 1000자 이하여야 합니다' };
  }

  // XSS 및 스크립트 인젝션 방지
  const forbiddenPatterns = [
    /javascript:/i,
    /on\w+\s*=/i, // onload=, onclick= 등
    /<script/i,
    /[<>{}]/,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(msg)) {
      return {
        valid: false,
        error: '사용할 수 없는 문자가 포함되어 있습니다',
      };
    }
  }

  return { valid: true };
}
