import { z } from 'zod';

// Trial 상태 유효성 검증
export const trialStatusEnum = z.enum(['ACTIVE', 'EXPIRED', 'CONVERTED', 'CANCELLED']);

// POST: Trial 시작 (3일 무료체험 신청)
export const startTrialSchema = z.object({
  consentVersion: z.string()
    .min(1, '동의 버전은 필수입니다')
    .max(10, '동의 버전은 10자 이하여야 합니다')
    .default('1.0'),
});

// PATCH: Trial 종료/변환
export const updateTrialSchema = z.object({
  status: trialStatusEnum
    .refine(s => s !== 'ACTIVE', '상태는 EXPIRED, CONVERTED, CANCELLED 중 하나여야 합니다'),
  reason: z.string()
    .min(1, '사유는 필수입니다')
    .max(500, '사유는 500자 이하여야 합니다')
    .optional(),
});

// GET: Trial 상태 조회
export const getTrialStatusSchema = z.object({
  userId: z.coerce.number()
    .int('사용자 ID는 정수여야 합니다')
    .positive('사용자 ID는 양수여야 합니다'),
});

// POST: Consent 기록
export const recordConsentSchema = z.object({
  consentVersion: z.string()
    .min(1, '동의 버전은 필수입니다')
    .max(10, '동의 버전은 10자 이하여야 합니다'),
  consentedAt: z.string()
    .datetime('유효한 ISO 8601 날짜가 필요합니다')
    .optional()
    .or(z.date().optional())
    .transform(val => {
      if (!val) return new Date();
      if (val instanceof Date) return val;
      const parsed = new Date(val);
      if (isNaN(parsed.getTime())) {
        throw new Error('유효하지 않은 날짜입니다');
      }
      return parsed;
    }),
});

// 타입 추론
export type StartTrialInput = z.infer<typeof startTrialSchema>;
export type UpdateTrialInput = z.infer<typeof updateTrialSchema>;
export type GetTrialStatusInput = z.infer<typeof getTrialStatusSchema>;
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;
export type TrialStatus = z.infer<typeof trialStatusEnum>;
