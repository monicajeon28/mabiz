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
  errorType: 'segment' | 'product' | 'playbook' | 'network' | 'validation' | 'unknown',
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
