/**
 * Delta SMS 헬퍼 함수 모음
 * 메시지 검증, 포맷팅, 상태 계산 등 재사용 가능한 유틸리티
 */

import { MESSAGE_LIMITS } from '@/constants/delta';
import type { MessageStatusType, ValidationResult } from '@/types/delta';

/**
 * 메시지 길이 유효성 검증
 *
 * @param day Day 번호 (0-3)
 * @param message 메시지 내용
 * @returns 유효성 검사 결과 및 에러 메시지
 *
 * @example
 * const result = validateMessageLength(0, 'Hello');
 * if (!result.isValid) console.log(result.error); // Day 0 메시지는 필수입니다.
 */
export function validateMessageLength(
  day: 0 | 1 | 2 | 3,
  message: string
): ValidationResult {
  // WHY: Day별 최대 길이를 배열로 정의하여 매직 넘버 제거
  const maxLengths = [MESSAGE_LIMITS.DAY_0, MESSAGE_LIMITS.DAY_1, MESSAGE_LIMITS.DAY_2, MESSAGE_LIMITS.DAY_3];
  const maxLength = maxLengths[day];

  // 빈 메시지 검증
  if (message.trim().length === 0) {
    return {
      isValid: false,
      error: `Day ${day} 메시지는 필수입니다.`,
    };
  }

  // 길이 범위 검증
  if (message.length > maxLength) {
    return {
      isValid: false,
      error: `Day ${day} 메시지는 ${maxLength}자 이하여야 합니다. (현재: ${message.length}자)`,
    };
  }

  return { isValid: true };
}

/**
 * 시간을 한국시간(KST) 형식으로 포맷팅
 *
 * @param hour 시간 (0-23)
 * @returns "오전/오후 H:MM" 형식의 문자열
 *
 * @example
 * formatTimeKST(9); // "오전 9:00"
 * formatTimeKST(14); // "오후 2:00"
 * formatTimeKST(19); // "오후 7:00"
 */
export function formatTimeKST(hour: number): string {
  // WHY: JavaScript Date의 Intl.DateTimeFormat을 사용하여 로케일 기반 포맷팅
  // 이를 통해 시간대 변경 시에도 자동으로 올바른 형식 유지
  const time = new Date();
  time.setHours(hour, 0, 0, 0);

  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(time);
}

/**
 * 예상 발송 건수 계산
 *
 * @param hour Cron 시간 (9, 14, 19 등)
 * @returns 시간대별 예상 발송 건수
 *
 * @example
 * const { estimate, variance } = estimateSendingCount(9);
 * // { estimate: '약 2,400건', variance: '(±25%, 지난 7일 평균)' }
 */
export function estimateSendingCount(
  hour: number,
  variance: string = '(±25%, 지난 7일 평균)'
): { estimate: string; variance: string } {
  // WHY: 시간대별 발송 건수를 상수로 정의하여 마이그레이션 용이성 향상
  // 데이터가 변경되면 여기만 수정하면 됨
  const estimates: Record<number, string> = {
    9: '약 2,400건',
    14: '약 1,800건',
    19: '약 1,200건',
  };

  return {
    estimate: estimates[hour] || '알 수 없음',
    variance,
  };
}

/**
 * 메시지 상태 계산 (길이 기반)
 *
 * @param length 현재 메시지 길이
 * @param maxLength 최대 길이
 * @returns 상태 타입 ('safe' | 'warning' | 'danger')
 *
 * @example
 * getMessageStatus(50, 90); // 'safe' (56%)
 * getMessageStatus(75, 90); // 'warning' (83%)
 * getMessageStatus(95, 90); // 'danger' (106%)
 */
export function getMessageStatus(length: number, maxLength: number): MessageStatusType {
  // WHY: 백분율 기반 상태 결정으로 Day별 다른 maxLength 대응
  // Day 0: 90자, Day 1-3: 160자 모두 적절히 처리
  const percent = (length / maxLength) * 100;

  if (percent <= 80) return 'safe';
  if (percent <= 95) return 'warning';
  return 'danger';
}

/**
 * 모든 메시지가 유효하게 입력되었는지 확인
 *
 * @param messages Day 0-3 메시지 객체
 * @returns 모든 메시지가 입력되었으면 true
 *
 * @example
 * const valid = areAllMessagesValid({
 *   day0: 'Hello',
 *   day1: 'World',
 *   day2: 'Test',
 *   day3: 'Complete'
 * });
 * // true
 */
export function areAllMessagesValid(messages: {
  day0: string;
  day1: string;
  day2: string;
  day3: string;
}): boolean {
  // WHY: 모든 메시지가 공백 제거 후 최소 1자 이상 필요
  // trim()을 사용하여 공백만 있는 입력은 제외
  return (
    !!messages.day0.trim() &&
    !!messages.day1.trim() &&
    !!messages.day2.trim() &&
    !!messages.day3.trim()
  );
}

/**
 * 메시지 길이 비율(%) 계산
 *
 * @param length 현재 메시지 길이
 * @param maxLength 최대 길이
 * @returns 비율 (0-100+)
 *
 * @example
 * getMessagePercent(90, 160); // 56
 * getMessagePercent(160, 160); // 100
 * getMessagePercent(180, 160); // 113
 */
export function getMessagePercent(length: number, maxLength: number): number {
  return Math.round((length / maxLength) * 100);
}

/**
 * 메시지 길이를 "current/max" 형식으로 포맷팅
 *
 * @param length 현재 메시지 길이
 * @param maxLength 최대 길이
 * @returns "123/160" 형식의 문자열
 *
 * @example
 * formatMessageLength(123, 160); // "123/160"
 */
export function formatMessageLength(length: number, maxLength: number): string {
  return `${length}/${maxLength}`;
}

/**
 * 여러 메시지의 전체 유효성 검증
 *
 * @param messages Day 0-3 메시지 객체
 * @returns 각 Day별 검증 결과
 *
 * @example
 * const results = validateAllMessages({
 *   day0: 'Hi',
 *   day1: 'Hello',
 *   day2: '',
 *   day3: 'Test'
 * });
 * // { day0: { isValid: true }, day1: { isValid: true }, day2: { isValid: false }, day3: { isValid: true } }
 */
export function validateAllMessages(messages: {
  day0: string;
  day1: string;
  day2: string;
  day3: string;
}): Record<string, ValidationResult> {
  // WHY: 모든 Day별 메시지를 동시에 검증하여 정확한 에러 리포팅 가능
  // UI에서 어떤 Day의 메시지가 문제인지 구체적으로 표시할 수 있음
  return {
    day0: validateMessageLength(0, messages.day0),
    day1: validateMessageLength(1, messages.day1),
    day2: validateMessageLength(2, messages.day2),
    day3: validateMessageLength(3, messages.day3),
  };
}

/**
 * Trigger Type이 유효한지 확인
 *
 * @param triggerType 트리거 타입
 * @returns 유효한 타입이면 true
 *
 * @example
 * isValidTriggerType('PURCHASE'); // true
 * isValidTriggerType('INVALID'); // false
 */
export function isValidTriggerType(triggerType: string): boolean {
  return triggerType === 'PURCHASE' || triggerType === 'ABANDONED';
}
