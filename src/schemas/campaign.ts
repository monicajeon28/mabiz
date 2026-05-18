import { z } from 'zod';

/**
 * Campaign 생성 스키마
 */
export const CampaignCreateSchema = z.object({
  groupId: z.string()
    .min(1, "그룹 ID는 필수입니다."),
  title: z.string()
    .min(1, "캠페인명은 필수입니다.")
    .max(100, "100자 이하여야 합니다."),
  sendSms: z.boolean().default(false),
  smsBody: z.string()
    .max(1000, "SMS 본문은 1000자 이하여야 합니다.")
    .optional()
    .nullable(),
  sendEmail: z.boolean().default(false),
  emailSubject: z.string()
    .max(200, "이메일 제목은 200자 이하여야 합니다.")
    .optional()
    .nullable(),
  emailBody: z.string()
    .max(5000, "이메일 본문은 5000자 이하여야 합니다.")
    .optional()
    .nullable(),
  includeLanding: z.boolean().default(false),
  landingUrl: z.string()
    .url("유효한 URL 형식이어야 합니다.")
    .optional()
    .nullable(),
  landingLinkText: z.string()
    .max(100, "랜딩 링크 텍스트는 100자 이하여야 합니다.")
    .optional()
    .nullable(),
  sendAt: z.string()
    .datetime({ message: "유효한 ISO 8601 datetime 형식이어야 합니다." }),
  repeatRule: z.enum(['ONCE', 'WEEKLY_MON', 'WEEKLY_WED', 'WEEKLY_FRI', 'MONTHLY_1', 'MONTHLY_15'], {
    errorMap: () => ({ message: "유효한 반복 규칙을 선택해주세요." })
  }).optional(),
});

/**
 * Campaign 수정 스키마
 */
export const CampaignUpdateSchema = CampaignCreateSchema.partial().omit({ groupId: true });

/**
 * Campaign 목록 쿼리 스키마
 */
export const CampaignListQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENT', 'FAILED']).optional(),
  createdByMe: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Phase 4: Delta SMS 캠페인 설정 스키마
 */
export const CreateDeltaCampaignSchema = z.object({
  campaignId: z.string()
    .cuid("유효한 캠페인 ID여야 합니다."),
  triggerType: z.enum(['PURCHASE', 'ABANDONED'], {
    errorMap: () => ({ message: "PURCHASE 또는 ABANDONED 중 선택해주세요." })
  }).default('PURCHASE'),
  deltaDay0Message: z.string()
    .max(90, "Day 0 메시지는 90자 이하여야 합니다.")
    .optional(),
  deltaDay1Message: z.string()
    .max(160, "Day 1 메시지는 160자 이하여야 합니다.")
    .optional(),
  deltaDay2Message: z.string()
    .max(160, "Day 2 메시지는 160자 이하여야 합니다.")
    .optional(),
  deltaDay3Message: z.string()
    .max(160, "Day 3 메시지는 160자 이하여야 합니다.")
    .optional(),
});

export const UpdateDeltaCampaignSchema = CreateDeltaCampaignSchema.partial().omit({ campaignId: true });

export type CreateDeltaCampaignData = z.infer<typeof CreateDeltaCampaignSchema>;
export type UpdateDeltaCampaignData = z.infer<typeof UpdateDeltaCampaignSchema>;

export type CampaignCreateData = z.infer<typeof CampaignCreateSchema>;
export type CampaignUpdateData = z.infer<typeof CampaignUpdateSchema>;
export type CampaignListQuery = z.infer<typeof CampaignListQuerySchema>;
