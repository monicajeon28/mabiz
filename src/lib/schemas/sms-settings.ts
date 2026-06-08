import { z } from 'zod';

// ─────────────────────────────────────────────
// SMS 설정 검증 스키마
// ─────────────────────────────────────────────

const ALIGO_USER_ID_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // 이메일 형식
const SENDER_PHONE_PATTERN = /^(\+82|0)[0-9]{1,2}[-]?[0-9]{3,4}[-]?[0-9]{4}$/; // 09XX-XXXX-XXXX 또는 +82XX-XXXX-XXXX
const ALIGO_KEY_PATTERN = /^[a-zA-Z0-9]{32,}$/; // 최소 32글자

// ─── 조직 수준 SMS 설정 ──
export const OrgSmsConfigSchema = z.object({
  aligoUserId: z.string()
    .min(1, '알리고 사용자 ID는 필수입니다.')
    .email('유효한 이메일 형식이어야 합니다.')
    .max(100, '100자 이내여야 합니다.')
    .transform(v => v.trim()),

  senderPhone: z.string()
    .min(1, '발신번호는 필수입니다.')
    .regex(SENDER_PHONE_PATTERN, '올바른 전화번호 형식입니다 (예: 031-1234-5678 또는 +82-31-1234-5678)')
    .max(20, '20자 이내여야 합니다.')
    .transform(v => v.trim()),

  aligoKey: z.string()
    .min(1, '알리고 API KEY는 필수입니다.')
    .regex(ALIGO_KEY_PATTERN, 'API KEY는 32자 이상의 영문/숫자여야 합니다.')
    .max(200, '200자 이내여야 합니다.')
    .transform(v => v.trim())
    .optional()
    .or(z.literal('')),
}).strict();

// ─── 사용자 수준 SMS 설정 ──
export const UserSmsConfigSchema = z.object({
  aligoUserId: z.string()
    .min(1, '알리고 사용자 ID는 필수입니다.')
    .email('유효한 이메일 형식이어야 합니다.')
    .max(100, '100자 이내여야 합니다.')
    .transform(v => v.trim()),

  senderPhone: z.string()
    .min(1, '발신번호는 필수입니다.')
    .regex(SENDER_PHONE_PATTERN, '올바른 전화번호 형식입니다 (예: 031-1234-5678 또는 +82-31-1234-5678)')
    .max(20, '20자 이내여야 합니다.')
    .transform(v => v.trim()),

  aligoKey: z.string()
    .min(1, '알리고 API KEY는 필수입니다.')
    .regex(ALIGO_KEY_PATTERN, 'API KEY는 32자 이상의 영문/숫자여야 합니다.')
    .max(200, '200자 이내여야 합니다.')
    .transform(v => v.trim()),
}).strict();

// ─── 재참여 메시지 ──
export const ReEngageMessagesSchema = z.object({
  reEngageMsg1: z.string()
    .min(1, '재참여 메시지 1은 필수입니다.')
    .max(90, '90자 이내여야 합니다 (SMS 기준)')
    .regex(/^[가-힣a-zA-Z0-9\s\-().,!?\n]*$/, '허용되지 않는 문자가 포함되어 있습니다.')
    .transform(v => v.trim()),

  reEngageMsg2: z.string()
    .min(1, '재참여 메시지 2는 필수입니다.')
    .max(90, '90자 이내여야 합니다 (SMS 기준)')
    .regex(/^[가-힣a-zA-Z0-9\s\-().,!?\n]*$/, '허용되지 않는 문자가 포함되어 있습니다.')
    .transform(v => v.trim()),
}).strict();

// ─── SMS 테스트 발송 ──
export const SmsTestSchema = z.object({
  testPhone: z.string()
    .min(1, '테스트 전화번호는 필수입니다.')
    .regex(SENDER_PHONE_PATTERN, '올바른 전화번호 형식입니다 (예: 010-1234-5678 또는 +82-10-1234-5678)')
    .max(20, '20자 이내여야 합니다.')
    .transform(v => v.trim()),

  testMessage: z.string()
    .min(1, '테스트 메시지는 필수입니다.')
    .max(90, '90자 이내여야 합니다 (SMS 기준)')
    .regex(/^[가-힣a-zA-Z0-9\s\-().,!?\n]*$/, '허용되지 않는 문자가 포함되어 있습니다.')
    .transform(v => v.trim())
    .optional(),
}).strict();

// ─────────────────────────────────────────────
// Export types
// ─────────────────────────────────────────────

export type OrgSmsConfig = z.infer<typeof OrgSmsConfigSchema>;
export type UserSmsConfig = z.infer<typeof UserSmsConfigSchema>;
export type ReEngageMessages = z.infer<typeof ReEngageMessagesSchema>;
export type SmsTest = z.infer<typeof SmsTestSchema>;
