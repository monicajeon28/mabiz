/** 검증 결과 */
export type ValidationResult = { valid: true } | { valid: false; message: string };

/** 그룹 이름 검증 */
export function validateGroupName(name: unknown): ValidationResult {
  if (!name || typeof name !== 'string' || !name.trim()) return { valid: false, message: '그룹 이름은 필수입니다' };
  if (name.length > 100) return { valid: false, message: '그룹 이름은 100자 이하여야 합니다' };
  return { valid: true };
}

/** HEX 색상 검증 */
export function validateHexColor(color: unknown): ValidationResult {
  if (!color || typeof color !== 'string') return { valid: false, message: 'color는 필수입니다' };
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { valid: false, message: 'color는 #RRGGBB 형식이어야 합니다' };
  return { valid: true };
}

/** 필수값 검증 */
export function validateRequired(value: unknown, fieldName: string): ValidationResult {
  if (!value || (typeof value === 'string' && !value.trim())) return { valid: false, message: `${fieldName}은(는) 필수입니다` };
  return { valid: true };
}

/** 문자열 길이 검증 */
export function validateMaxLength(value: unknown, maxLen: number, fieldName: string): ValidationResult {
  if (typeof value === 'string' && value.length > maxLen) return { valid: false, message: `${fieldName}은(는) ${maxLen}자 이하여야 합니다` };
  return { valid: true };
}

/** 전화번호 기본 검증 */
export function validatePhone(phone: unknown): ValidationResult {
  if (!phone || typeof phone !== 'string') return { valid: false, message: '전화번호는 필수입니다' };
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 10 || digits.length > 15) return { valid: false, message: '전화번호 형식이 올바르지 않습니다' };
  return { valid: true };
}

/** 이메일 검증 (optional — 값이 없으면 통과) */
export function validateEmail(email: unknown): ValidationResult {
  if (!email) return { valid: true };
  if (typeof email !== 'string') return { valid: false, message: '이메일 형식이 올바르지 않습니다' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { valid: false, message: '이메일 형식이 올바르지 않습니다' };
  return { valid: true };
}
