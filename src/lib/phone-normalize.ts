/**
 * 전화번호를 010-1234-5678 형식으로 통일
 * 입력: 01012345678, 010-1234-5678, 010 1234 5678, +82-10-1234-5678 등
 * 출력: 010-1234-5678
 */
export function normalizePhone(phone: string): string {
  if (!phone) return phone;

  const digits = phone.replace(/[^0-9]/g, '');

  // +82 국제번호 처리
  let normalized = digits.startsWith('82') ? '0' + digits.slice(2) : digits;

  // 선두 0 중복 제거 (예: +82010... → 0010... → 010...)
  if (normalized.startsWith('00')) {
    normalized = normalized.slice(1);
  }

  // 11자리: 010-1234-5678
  if (normalized.length === 11) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }

  // 10자리: 02-123-4567 등
  if (normalized.length === 10) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }

  // 정규화 불가능하면 원본 반환
  return phone;
}
