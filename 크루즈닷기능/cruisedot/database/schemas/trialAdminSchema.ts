/**
 * lib/schemas/trialAdminSchema.ts
 * Trial Admin API 입력 검증 스키마
 *
 * P0: Admin 권한 검증 + CSRF 토큰 검증
 * P1: 입력값 길이/형식 제한 (DoS 방지)
 */

import { z } from 'zod';

export const updateTrialStatusSchema = z.object({
  status: z.enum(['EXPIRED', 'CONVERTED', 'CANCELLED']),
  reason: z
    .string()
    .min(5, '사유는 최소 5자 이상')
    .max(500, '사유는 최대 500자')
    .optional(),
  csrfToken: z.string().min(32, 'CSRF 토큰이 유효하지 않습니다'),
});

export type UpdateTrialStatusInput = z.infer<typeof updateTrialStatusSchema>;

export const trialFilterSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'CONVERTED', 'CANCELLED']).optional(),
  email: z.string().email('유효한 이메일 주소가 아닙니다').optional(),
  affiliateCode: z.string().max(4, '이하 코드는 최대 4자').optional(),
  page: z.coerce.number().int().positive('페이지는 1 이상').default(1),
  limit: z.coerce
    .number()
    .int()
    .min(10, '최소 10개')
    .max(100, '최대 100개')
    .default(20),
});

export type TrialFilterInput = z.infer<typeof trialFilterSchema>;

/**
 * Trial 상태 변경 감시 로그 입력 스키마
 */
export const trialAuditLogSchema = z.object({
  trialId: z.number().int().positive(),
  action: z.enum([
    'STATUS_CHANGED',
    'EXTENDED',
    'DELETED',
    'TRIAL_EXPIRED_BY_ADMIN',
    'TRIAL_CONVERTED_BY_ADMIN',
    'TRIAL_CANCELLED_BY_ADMIN',
  ]),
  performedBy: z.number().int().positive(),
  previousState: z.record(z.any()).optional(),
  newState: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type TrialAuditLogInput = z.infer<typeof trialAuditLogSchema>;
