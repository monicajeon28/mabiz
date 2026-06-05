import { z } from 'zod';

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

/**
 * Track 4: 에러 처리 & 동시성 제어
 * Zod 스키마 정의
 */

// [E-004] 폼 유효성 검사: callForm.content 필수 검증
export const AddCallLogSchema = z.object({
  content: z.string()
    .min(1, '콜 기록 내용을 입력하세요')
    .trim(),
  result: z.enum(["INTERESTED", "PENDING", "REJECTED", "RESCHEDULED"])
    .optional()
    .nullable(),
  convictionScore: z.string()
    .regex(/^\d+$/, '신뢰도는 숫자여야 합니다')
    .optional(),
  nextAction: z.string().optional(),
  scheduledAt: z.string().optional(),
  objectionId: z.string().optional(),
  customerReaction: z.enum(["positive", "neutral", "negative"]).optional(),
  recovered: z.boolean().optional(),
  recoveryTime: z.string().optional(),
});

export type AddCallLogInput = z.infer<typeof AddCallLogSchema>;

// [S-001] SQL Injection 방지: 쿼리 파라미터 검증
export const CallLogIdSchema = z.object({
  logId: z.string().min(1, '유효한 ID 형식이 아닙니다'),
  contactId: z.string().min(1, '유효한 Contact ID 형식이 아닙니다'),
});

export type CallLogIdInput = z.infer<typeof CallLogIdSchema>;

// SMS 로그 조회 페이지네이션
export const SmsLogQuerySchema = z.object({
  contactId: z.string().uuid('유효한 Contact ID 형식이 아닙니다'),
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .optional(),
  page: z.number()
    .int()
    .min(1)
    .default(1)
    .optional(),
});

export type SmsLogQueryInput = z.infer<typeof SmsLogQuerySchema>;

// [S-002] CSRF 토큰 검증
export const CsrfTokenSchema = z.object({
  csrfToken: z.string().min(1, 'CSRF 토큰이 필요합니다'),
});

export type CsrfTokenInput = z.infer<typeof CsrfTokenSchema>;

// [S-002] DB 전달 요청 검증
export const SendDbTargetSchema = z.object({
  targetUserId: z.string().uuid('유효한 대상 사용자 ID 형식이 아닙니다'),
});

export type SendDbTargetInput = z.infer<typeof SendDbTargetSchema>;
