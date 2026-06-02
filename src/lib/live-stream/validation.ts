/**
 * Live Stream Form Validation
 */

export interface ValidationResult {
  valid: boolean;
  errors?: Record<string, string>;
}

export function validateLiveStreamForm(data: any): ValidationResult {
  const errors: Record<string, string> = {};

  // 이름 검증
  if (!data.name || data.name.trim().length < 2) {
    errors.name = '이름을 2글자 이상 입력해주세요.';
  }

  // 전화번호 검증 (010-1234-5678 또는 01012345678)
  const phoneRegex = /^01[0-9]-?\d{3,4}-?\d{4}$/;
  if (!data.phone || !phoneRegex.test(data.phone.replace(/-/g, ''))) {
    errors.phone = '유효한 휴대폰 번호를 입력해주세요. (예: 010-1234-5678)';
  }

  // 이메일 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.email = '유효한 이메일을 입력해주세요.';
  }

  // 세그먼트 검증
  const validSegments = ['LOW_PRICE', 'FILIAL', 'HONEYMOON'];
  if (!data.segment || !validSegments.includes(data.segment)) {
    errors.segment = '유효한 여행 유형을 선택해주세요.';
  }

  // 이벤트 날짜 검증
  if (!data.eventDate) {
    errors.eventDate = '라이브방송 날짜를 입력해주세요.';
  }

  // 동의 확인
  if (!data.consent || typeof data.consent !== 'boolean') {
    errors.consent = 'SMS 수신 동의가 필요합니다.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * 한국 전화번호 포맷 정규화
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/-/g, '').trim();
}

/**
 * 이메일 소문자 정규화
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * 이름 공백 정규화
 */
export function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}
