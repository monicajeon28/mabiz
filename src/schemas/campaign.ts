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

export type CampaignCreateData = z.infer<typeof CampaignCreateSchema>;
export type CampaignUpdateData = z.infer<typeof CampaignUpdateSchema>;
export type CampaignListQuery = z.infer<typeof CampaignListQuerySchema>;
