/**
 * PII (Personally Identifiable Information) Masking Functions
 * S-003: 민감정보 표시 제한
 */

/**
 * 전화번호 마스킹
 * 예시: 010-1234-5678 → 010-****-5678
 * 예시: 01012345678 → 0101****5678
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '---';

  // 숫자만 추출
  const digits = phone.replace(/\D/g, '');

  // 길이 검증 (한국 핸드폰 기준)
  if (digits.length < 10) return phone; // 너무 짧으면 원본 반환

  // 010-1234-5678 형식 재구성 후 마스킹
  if (digits.length === 10) {
    // 02X-XXX-XXXX 형식의 지역번호
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  }

  if (digits.length === 11) {
    // 010-XXXX-XXXX
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  }

  // 기타 형식
  return phone.replace(/(?<=.{7}).(?=.{4})/g, '*');
}

/**
 * 이메일 마스킹
 * 예시: example@gmail.com → exa***@gmail.com
 * 예시: john.doe@company.co.kr → joh***@company.co.kr
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '---';

  const [local, domain] = email.split('@');

  if (!domain) return email; // @ 없으면 원본 반환

  // local part: 처음 3글자 + 별표 (나머지 길이 만큼)
  const visibleChars = Math.min(3, local.length);
  const maskLength = Math.max(1, local.length - visibleChars);
  const masked = local.slice(0, visibleChars) + '*'.repeat(maskLength);

  return `${masked}@${domain}`;
}

/**
 * 이름 마스킹 (선택사항)
 * 예시: 김민형 → 김***
 */
export function maskName(name: string | null | undefined): string {
  if (!name) return '---';

  if (name.length <= 2) return name; // 1-2글자는 마스킹하지 않음

  const firstChar = name.charAt(0);
  const maskLength = name.length - 1;
  return firstChar + '*'.repeat(maskLength);
}

/**
 * 예약번호 마스킹
 * 예시: ABC123456 → ABC****56
 */
export function maskBookingRef(ref: string | null | undefined): string {
  if (!ref) return '---';

  if (ref.length <= 4) return ref;

  const visible = Math.ceil(ref.length / 3); // 처음 1/3만 표시
  return ref.slice(0, visible) + '*'.repeat(ref.length - visible - 2) + ref.slice(-2);
}
