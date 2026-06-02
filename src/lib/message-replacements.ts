/**
 * 메시지 플레이스홀더 치환 유틸
 *
 * [고객명] / [이름] 치환이 여러 파일에 흩어지는 것을 방지하기 위해
 * 단일 헬퍼로 통합합니다.
 */

/**
 * SMS/이메일 메시지 내 공통 플레이스홀더를 치환합니다.
 *
 * @param msg     원본 메시지 문자열
 * @param contact 연락처 정보 (name 미제공 시 '고객님' 사용)
 * @returns       치환된 메시지 문자열
 *
 * @example
 * replaceMessagePlaceholders('[고객명]님 안녕하세요', { name: '홍길동' })
 * // → '홍길동님 안녕하세요'
 */
export function replaceMessagePlaceholders(
  msg: string,
  contact: { name?: string | null }
): string {
  const displayName = contact.name?.trim() || '고객님';
  return msg
    .replace(/\[고객명\]/g, displayName)
    .replace(/\[이름\]/g, displayName);
}
