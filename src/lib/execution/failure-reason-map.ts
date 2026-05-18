/**
 * 실행 실패 이유 → 한국어 사용자 메시지 매핑
 * 메시지 발송, 업무 자동화 등 비동기 실행 작업의 실패 원인 관리
 */

/**
 * 실행 실패 이유 Enum
 * 5가지 주요 실패 카테고리
 */
export enum ExecutionFailureReason {
  // 사용자 측 문제: 할당량 초과
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // 입력 데이터 문제: 잘못된 연락처
  INVALID_CONTACT = 'INVALID_CONTACT',

  // 사용자 정책: 수신거부 설정
  OPT_OUT = 'OPT_OUT',

  // 시스템 내부 오류
  SYSTEM_ERROR = 'SYSTEM_ERROR',

  // 외부 서비스 오류 (SMS, 이메일 제공자)
  PROVIDER_ERROR = 'PROVIDER_ERROR',
}

/**
 * 실패 메시지 타입
 */
export interface FailureMessage {
  /** 50대도 이해 가능한 한국어 사용자 메시지 */
  userMsg: string;

  /** 사용자가 취할 수 있는 권장 액션 */
  action?: string;

  /** 심각도: error는 실패, warning은 재시도 가능 */
  severity: 'error' | 'warning';

  /** 내부 로깅용 상세 설명 */
  _internalDesc?: string;
}

/**
 * 실패 이유별 메시지 맵
 * 각 enum 값에 대응하는 사용자 친화적 메시지와 권장 액션
 */
export const FAILURE_REASON_MESSAGES: Record<
  ExecutionFailureReason,
  FailureMessage
> = {
  [ExecutionFailureReason.QUOTA_EXCEEDED]: {
    userMsg: '일일 발송 한도를 초과했습니다.',
    action: '내일 오전에 다시 시도해주세요.',
    severity: 'warning',
    _internalDesc: 'Daily/hourly quota limit exceeded for user or contact list',
  },

  [ExecutionFailureReason.INVALID_CONTACT]: {
    userMsg:
      '잘못된 연락처 정보가 포함되어 있습니다. (예: 빈 번호, 잘못된 형식)',
    action: '연락처를 확인하고 다시 시도해주세요.',
    severity: 'error',
    _internalDesc:
      'Contact data validation failed (empty phone, invalid email format, etc)',
  },

  [ExecutionFailureReason.OPT_OUT]: {
    userMsg: '수신을 거부한 고객입니다.',
    action: '이 고객에게는 발송하지 않습니다. (자동 건너뜀)',
    severity: 'warning',
    _internalDesc: 'Contact has opted out from communications (blacklist)',
  },

  [ExecutionFailureReason.SYSTEM_ERROR]: {
    userMsg: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    action: '몇 분 뒤에 자동으로 재시도됩니다.',
    severity: 'warning',
    _internalDesc:
      'Internal system error (database, cache, queue, timeout, etc)',
  },

  [ExecutionFailureReason.PROVIDER_ERROR]: {
    userMsg:
      '문자/이메일 서비스에 일시적 문제가 있습니다. 곧 정상화될 예정입니다.',
    action: '서비스 복구 후 자동으로 재발송됩니다.',
    severity: 'warning',
    _internalDesc:
      'External provider error (SMS gateway, email service, API timeout, rate limit)',
  },
};

/**
 * 실패 이유에 해당하는 사용자 메시지 반환
 *
 * @param reason - ExecutionFailureReason enum 값
 * @returns 한국어 사용자 메시지
 *
 * @example
 * const msg = getFailureMessage(ExecutionFailureReason.QUOTA_EXCEEDED);
 * // "일일 발송 한도를 초과했습니다."
 */
export function getFailureMessage(reason: ExecutionFailureReason): string {
  const message = FAILURE_REASON_MESSAGES[reason];
  return message?.userMsg || '알 수 없는 오류가 발생했습니다.';
}

/**
 * 실패 이유에 해당하는 권장 액션 반환
 *
 * @param reason - ExecutionFailureReason enum 값
 * @returns 권장 액션 문자열 또는 undefined
 *
 * @example
 * const action = getFailureAction(ExecutionFailureReason.QUOTA_EXCEEDED);
 * // "내일 오전에 다시 시도해주세요."
 */
export function getFailureAction(
  reason: ExecutionFailureReason
): string | undefined {
  return FAILURE_REASON_MESSAGES[reason]?.action;
}

/**
 * 실패 이유의 심각도 반환
 *
 * @param reason - ExecutionFailureReason enum 값
 * @returns 'error' (실패) 또는 'warning' (재시도 가능)
 *
 * @example
 * const severity = getFailureSeverity(ExecutionFailureReason.PROVIDER_ERROR);
 * // "warning" → 나중에 자동 재시도 스케줄링
 */
export function getFailureSeverity(reason: ExecutionFailureReason): 'error' | 'warning' {
  return FAILURE_REASON_MESSAGES[reason]?.severity || 'error';
}

/**
 * 이 실패가 자동 재시도 대상인지 판단
 * severity가 'warning'인 경우만 재시도 가능
 *
 * @param reason - ExecutionFailureReason enum 값
 * @returns true이면 나중에 자동 재시도, false이면 수동 개입 필요
 *
 * @example
 * if (isRetryable(ExecutionFailureReason.PROVIDER_ERROR)) {
 *   scheduleRetry(taskId, 5 * 60 * 1000); // 5분 후 재시도
 * }
 */
export function isRetryable(reason: ExecutionFailureReason): boolean {
  const severity = getFailureSeverity(reason);
  // severity가 'warning'인 경우만 재시도 가능
  // error인 경우(INVALID_CONTACT)는 데이터 수정 없이는 성공 불가
  return severity === 'warning';
}

/**
 * 사용자 메시지와 액션을 함께 반환하는 편의 함수
 *
 * @param reason - ExecutionFailureReason enum 값
 * @returns { message: string, action?: string }
 *
 * @example
 * const { message, action } = getFailureInfo(ExecutionFailureReason.INVALID_CONTACT);
 * // {
 * //   message: "잘못된 연락처 정보가 포함되어 있습니다. (예: 빈 번호, 잘못된 형식)",
 * //   action: "연락처를 확인하고 다시 시도해주세요."
 * // }
 */
export function getFailureInfo(reason: ExecutionFailureReason): {
  message: string;
  action?: string;
} {
  const msg = FAILURE_REASON_MESSAGES[reason];
  return {
    message: msg?.userMsg || '알 수 없는 오류가 발생했습니다.',
    action: msg?.action,
  };
}

/**
 * 로깅용 상세 정보 반환 (내부 추적용)
 *
 * @param reason - ExecutionFailureReason enum 값
 * @returns 기술적 상세 설명
 */
export function getFailureInternalDescription(reason: ExecutionFailureReason): string {
  const msg = FAILURE_REASON_MESSAGES[reason];
  return msg?._internalDesc || 'Unknown internal reason';
}
