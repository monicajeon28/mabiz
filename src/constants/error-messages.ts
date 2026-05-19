/**
 * 사용자 친화적 에러 메시지 상수
 *
 * 네트워크, 검증, 서버 오류를 사용자 입장에서 이해하기 쉬운 메시지로 변환
 */

export const ERROR_MESSAGES = {
  NETWORK: {
    TIMEOUT: '요청이 시간초과되었습니다. 네트워크 연결을 확인하고 다시 시도하세요.',
    NOT_FOUND: '네트워크에 연결할 수 없습니다.',
    OFFLINE: '오프라인 상태입니다. 인터넷 연결을 확인하세요.',
  },
  VALIDATION: {
    MISSING_FIELD: '필수 필드가 비어있습니다.',
    INVALID_LENGTH: '메시지 길이가 범위를 벗어났습니다.',
    INVALID_TYPE: '입력값 형식이 잘못되었습니다.',
  },
  SERVER: {
    INTERNAL_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.',
    UNAUTHORIZED: '권한이 없습니다.',
    FORBIDDEN: '접근이 거부되었습니다.',
    NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
  },
  UNKNOWN: '알 수 없는 오류가 발생했습니다. 다시 시도하세요.',
} as const;

/**
 * 에러 객체를 사용자 친화적 메시지로 변환
 *
 * @param error - Error 객체 또는 문자열
 * @param defaultKey - 기본값 키 (선택사항)
 * @returns 사용자 친화적 에러 메시지
 *
 * @example
 * try {
 *   const data = await fetch('/api/...');
 * } catch (err) {
 *   const msg = getErrorMessage(err);
 *   toast({ description: msg });
 * }
 */
export function getErrorMessage(error: Error | string): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // 네트워크 에러 감지
    if (message.includes('timeout') || message.includes('abort')) {
      return ERROR_MESSAGES.NETWORK.TIMEOUT;
    }
    if (message.includes('offline')) {
      return ERROR_MESSAGES.NETWORK.OFFLINE;
    }
    if (message.includes('not found')) {
      return ERROR_MESSAGES.SERVER.NOT_FOUND;
    }

    // 검증 에러 감지
    if (message.includes('validation')) {
      return ERROR_MESSAGES.VALIDATION.INVALID_TYPE;
    }

    // HTTP 상태 코드 감지
    if (message.includes('http 408')) {
      return ERROR_MESSAGES.NETWORK.TIMEOUT;
    }
    if (message.includes('http 401')) {
      return ERROR_MESSAGES.SERVER.UNAUTHORIZED;
    }
    if (message.includes('http 403')) {
      return ERROR_MESSAGES.SERVER.FORBIDDEN;
    }
    if (message.includes('http 404')) {
      return ERROR_MESSAGES.SERVER.NOT_FOUND;
    }
    if (message.includes('http 5')) {
      return ERROR_MESSAGES.SERVER.INTERNAL_ERROR;
    }

    return ERROR_MESSAGES.UNKNOWN;
  }

  return String(error) || ERROR_MESSAGES.UNKNOWN;
}
