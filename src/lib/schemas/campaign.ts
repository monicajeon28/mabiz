import { z } from 'zod';

// ─────────────────────────────────────────────
// Campaign (캠페인) 검증 스키마
// ─────────────────────────────────────────────

// ─── Campaign 생성 스키마 ──
export const CreateCampaignSchema = z.object({
  name: z.string()
    .min(1, '캠페인명은 필수입니다.')
    .max(100, '캠페인명은 100자 이내여야 합니다.')
    .transform(v => v.trim()),

  description: z.string()
    .max(500, '설명은 500자 이내여야 합니다.')
    .transform(v => v.trim())
    .optional()
    .or(z.literal('')),

  channel: z.enum(['SMS', 'EMAIL', 'PUSH', 'KAKAO', 'PHONE']).describe('채널을 선택하세요. (SMS, EMAIL, PUSH, KAKAO, PHONE)'),

  targetGroupId: z.string()
    .cuid('유효한 그룹 ID 형식이 아닙니다.')
    .min(1, '대상 그룹은 필수입니다.'),

  startDate: z.string()
    .datetime('유효한 시작 날짜/시간을 선택하세요.')
    .refine(
      date => new Date(date) > new Date(),
      '시작 날짜는 현재 시간 이후여야 합니다.'
    ),

  endDate: z.string()
    .datetime('유효한 종료 날짜/시간을 선택하세요.')
    .optional(),

  status: z.enum(['DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED', 'CANCELLED']).default('DRAFT').describe('상태를 선택하세요.'),

  budget: z.number()
    .positive('예산은 0보다 커야 합니다.')
    .max(999999999, '예산은 999,999,999 이하여야 합니다.')
    .optional(),

  targetAudience: z.string()
    .max(200, '타겟 오디언스 설명은 200자 이내여야 합니다.')
    .optional(),

  expectedReachCount: z.number()
    .int('예상 도달 수는 정수여야 합니다.')
    .positive('예상 도달 수는 0보다 커야 합니다.')
    .optional(),

  conversionGoal: z.string()
    .max(100, '전환 목표는 100자 이내여야 합니다.')
    .optional(),

  expectedConversionRate: z.number()
    .min(0, '기대 전환율은 0 이상이어야 합니다.')
    .max(100, '기대 전환율은 100 이하여야 합니다.')
    .optional(),
}).strict()
  .refine(
    data => !data.endDate || new Date(data.endDate) > new Date(data.startDate),
    { message: '종료 날짜는 시작 날짜 이후여야 합니다.', path: ['endDate'] }
  );

// ─── Campaign 업데이트 스키마 ──
export const UpdateCampaignSchema = CreateCampaignSchema.partial();

// ─── Campaign 검색 쿼리 ──
export const ListCampaignsQuerySchema = z.object({
  q: z.string()
    .max(100, '검색어는 100자 이내여야 합니다.')
    .optional(),

  channel: z.enum(['SMS', 'EMAIL', 'PUSH', 'KAKAO', 'PHONE']).optional(),

  status: z.enum(['DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED', 'CANCELLED']).optional(),

  groupId: z.string()
    .cuid('유효한 그룹 ID 형식이 아닙니다.')
    .optional(),

  fromDate: z.string()
    .datetime('유효한 시작 날짜를 선택하세요.')
    .optional(),

  toDate: z.string()
    .datetime('유효한 종료 날짜를 선택하세요.')
    .optional(),

  page: z.coerce.number().int().min(0).default(0),

  pageSize: z.coerce.number().int().min(1).max(1000).default(50),

  sortBy: z.enum(['name', 'startDate', 'createdAt', 'expectedReachCount']).default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict();

// ─── Campaign 복제 ──
export const DuplicateCampaignSchema = z.object({
  campaignId: z.string()
    .cuid('유효한 캠페인 ID 형식이 아닙니다.')
    .min(1, '원본 캠페인 ID는 필수입니다.'),

  newName: z.string()
    .min(1, '새 캠페인명은 필수입니다.')
    .max(100, '캠페인명은 100자 이내여야 합니다.')
    .transform(v => v.trim()),

  startDate: z.string()
    .datetime('유효한 시작 날짜/시간을 선택하세요.')
    .optional(),
}).strict();

// ─── Campaign 상태 변경 ──
export const UpdateCampaignStatusSchema = z.object({
  campaignId: z.string()
    .cuid('유효한 캠페인 ID 형식이 아닙니다.')
    .min(1, '캠페인 ID는 필수입니다.'),

  status: z.enum(['DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED', 'CANCELLED']).describe('유효한 상태를 선택하세요.'),

  reason: z.string()
    .max(200, '사유는 200자 이내여야 합니다.')
    .optional(),
}).strict();

// ─────────────────────────────────────────────
// Export types
// ─────────────────────────────────────────────

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;
export type ListCampaignsQuery = z.infer<typeof ListCampaignsQuerySchema>;
export type DuplicateCampaignInput = z.infer<typeof DuplicateCampaignSchema>;
export type UpdateCampaignStatusInput = z.infer<typeof UpdateCampaignStatusSchema>;
