import { z } from 'zod';

// ─────────────────────────────────────────────
// FunnelSms 공통 스키마
// ─────────────────────────────────────────────

// 무제한 커스터마이징: 최대 1000회차 / 100년(36500일) / 500개 메시지
export const FUNNEL_SMS_MAX_ORDER = 1000;
export const FUNNEL_SMS_MAX_DAYS_AFTER = 36500;
export const FUNNEL_SMS_MAX_MESSAGES = 500;

export const FunnelSmsMessageSchema = z.object({
  id: z.string().cuid().optional(),
  order: z.number().int().min(1).max(FUNNEL_SMS_MAX_ORDER),
  daysAfter: z.number().int().min(0).max(FUNNEL_SMS_MAX_DAYS_AFTER),
  content: z.string().min(1).max(2000),
  msgType: z.enum(['SMS', 'LMS']),
});

export const CreateFunnelSmsSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다.').max(100, '100자 이하여야 합니다.'),
  senderPhone: z.string().max(20).nullish(),
  category: z.string().max(50).nullish(),
  description: z.string().max(500).nullish(),
  sendHour: z.number().int().min(0).max(23).default(10),
  sendMinute: z.number().int().min(0).max(59).default(0),
  arsNum: z.string().max(20).nullish(),
  messages: z
    .array(FunnelSmsMessageSchema)
    .min(1, '메시지를 최소 1개 이상 등록하세요.')
    .max(FUNNEL_SMS_MAX_MESSAGES, `메시지는 최대 ${FUNNEL_SMS_MAX_MESSAGES}개까지 등록할 수 있습니다.`),
});

export const UpdateFunnelSmsSchema = CreateFunnelSmsSchema
  .omit({ messages: true })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

export const ReplaceMessagesSchema = z.object({
  messages: z
    .array(FunnelSmsMessageSchema)
    .min(1)
    .max(FUNNEL_SMS_MAX_MESSAGES, `메시지는 최대 ${FUNNEL_SMS_MAX_MESSAGES}개까지 등록할 수 있습니다.`),
});

export const ListFunnelSmsQuerySchema = z.object({
  groupId: z.string().cuid().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(1000).default(100),
});

// ─────────────────────────────────────────────
// Export types
// ─────────────────────────────────────────────

export type FunnelSmsMessageInput = z.infer<typeof FunnelSmsMessageSchema>;
export type CreateFunnelSmsInput = z.infer<typeof CreateFunnelSmsSchema>;
export type UpdateFunnelSmsInput = z.infer<typeof UpdateFunnelSmsSchema>;
export type ReplaceMessagesInput = z.infer<typeof ReplaceMessagesSchema>;
export type ListFunnelSmsQuery = z.infer<typeof ListFunnelSmsQuerySchema>;
