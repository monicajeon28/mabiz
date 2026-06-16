import { z } from 'zod';

// ─────────────────────────────────────────────
// FunnelEmail 스키마 (자동이메일 시퀀스)
// ─────────────────────────────────────────────

export const FUNNEL_EMAIL_MAX_ORDER = 1000;
export const FUNNEL_EMAIL_MAX_DAYS_AFTER = 3650;
export const FUNNEL_EMAIL_MAX_MESSAGES = 500;

export const FunnelEmailMessageSchema = z.object({
  id: z.string().cuid().optional(),
  order: z.number().int().min(1).max(FUNNEL_EMAIL_MAX_ORDER),
  daysAfter: z.number().int().min(0).max(FUNNEL_EMAIL_MAX_DAYS_AFTER),
  subject: z.string().min(1, '이메일 제목은 필수입니다.').max(200),
  bodyHtml: z.string().min(1, '이메일 내용은 필수입니다.').max(100000),
  previewText: z.string().max(200).nullish(),
});

export const CreateFunnelEmailSchema = z.object({
  title: z.string().min(1, '자동이메일 이름을 입력해주세요.').max(100),
  senderName: z.string().max(100).nullish(),
  senderEmail: z.string().email('올바른 이메일 주소를 입력해주세요.').max(200).nullish(),
  description: z.string().max(500).nullish(),
  sendHour: z.number().int().min(0).max(23).default(10),
  sendMinute: z.number().int().min(0).max(59).default(0),
  messages: z
    .array(FunnelEmailMessageSchema)
    .min(1, '이메일을 최소 1개 이상 등록하세요.')
    .max(FUNNEL_EMAIL_MAX_MESSAGES, `이메일은 최대 ${FUNNEL_EMAIL_MAX_MESSAGES}개까지 등록할 수 있습니다.`),
});

export const UpdateFunnelEmailSchema = CreateFunnelEmailSchema
  .omit({ messages: true })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

export const ReplaceEmailMessagesSchema = z.object({
  messages: z
    .array(FunnelEmailMessageSchema)
    .min(1)
    .max(FUNNEL_EMAIL_MAX_MESSAGES),
});

export const ListFunnelEmailQuerySchema = z.object({
  groupId: z.string().cuid().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(1000).default(100),
});

// ─────────────────────────────────────────────
// Export types
// ─────────────────────────────────────────────

export type FunnelEmailMessageInput = z.infer<typeof FunnelEmailMessageSchema>;
export type CreateFunnelEmailInput = z.infer<typeof CreateFunnelEmailSchema>;
export type UpdateFunnelEmailInput = z.infer<typeof UpdateFunnelEmailSchema>;
export type ReplaceEmailMessagesInput = z.infer<typeof ReplaceEmailMessagesSchema>;
export type ListFunnelEmailQuery = z.infer<typeof ListFunnelEmailQuerySchema>;
