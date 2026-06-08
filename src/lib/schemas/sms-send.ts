import { z } from 'zod';

// ─────────────────────────────────────────────
// SMS 발송 검증 스키마
// ─────────────────────────────────────────────

const PHONE_PATTERN = /^(\+82|0)[0-9]{1,2}[-]?[0-9]{3,4}[-]?[0-9]{4}$/;

// ─── SMS 수신자 정보 ──
const SmsRecipientSchema = z.object({
  phone: z.string()
    .regex(PHONE_PATTERN, '올바른 전화번호 형식입니다 (예: 010-1234-5678)')
    .max(20, '20자 이내여야 합니다.')
    .transform(v => v.trim()),

  name: z.string()
    .max(50, '이름은 50자 이내여야 합니다.')
    .transform(v => v.trim())
    .optional(),
}).strict();

// ─── SMS 일반 발송 ──
export const SmsSendSchema = z.object({
  recipients: z.array(SmsRecipientSchema)
    .min(1, '최소 1명의 수신자가 필요합니다.')
    .max(10000, '최대 10,000명까지 발송 가능합니다.'),

  content: z.string()
    .min(1, '메시지는 필수입니다.')
    .max(100, 'SMS는 최대 90자, LMS는 2000자입니다.')
    .refine(
      msg => msg.trim().length > 0,
      '공백만으로는 전송할 수 없습니다.'
    )
    .transform(v => v.trim()),

  msgType: z.enum(['SMS', 'LMS']).default('SMS').describe('메시지 유형을 선택하세요. (SMS 또는 LMS)'),

  reserveAt: z.string()
    .datetime('유효한 날짜/시간을 선택하세요.')
    .optional()
    .refine(
      date => !date || new Date(date) > new Date(),
      '예약 시간은 현재 시간 이후여야 합니다.'
    ),

  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL').describe('우선순위를 선택하세요.'),

  agentId: z.string()
    .cuid('유효한 담당자 ID 형식이 아닙니다.')
    .optional(),
}).strict();

// ─── SMS 퍼널 발송 (퍼널 기반) ──
export const SmsFunnelSendSchema = SmsSendSchema
  .extend({
    funnelId: z.string()
      .cuid('유효한 퍼널 ID 형식이 아닙니다.')
      .min(1, '퍼널은 필수입니다.'),

    startOrder: z.number()
      .int('회차는 정수여야 합니다.')
      .min(1, '회차는 1 이상이어야 합니다.')
      .max(1000, '회차는 1000 이하여야 합니다.')
      .default(1),
  })
  .omit({ content: true, msgType: true }); // 퍼널이 메시지 결정

// ─── SMS 그룹 발송 ──
export const SmsGroupSendSchema = SmsSendSchema
  .extend({
    groupId: z.string()
      .cuid('유효한 그룹 ID 형식이 아닙니다.')
      .min(1, '그룹은 필수입니다.'),
  })
  .omit({ recipients: true }); // 그룹이 수신자 결정

// ─── SMS 발송 목록 조회 쿼리 ──
export const ListSmsSendQuerySchema = z.object({
  status: z.enum(['PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED']).optional(),
  msgType: z.enum(['SMS', 'LMS']).optional(),
  funnelId: z.string().cuid().optional(),
  groupId: z.string().cuid().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(1000).default(50),
  sortBy: z.enum(['createdAt', 'sentAt', 'recipientCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict();

// ─── SMS 발송 취소 ──
export const CancelSmsSendSchema = z.object({
  sendId: z.string()
    .cuid('유효한 발송 ID 형식이 아닙니다.')
    .min(1, '발송 ID는 필수입니다.'),

  reason: z.string()
    .max(200, '취소 사유는 200자 이내여야 합니다.')
    .optional(),
}).strict();

// ─────────────────────────────────────────────
// Export types
// ─────────────────────────────────────────────

export type SmsRecipient = z.infer<typeof SmsRecipientSchema>;
export type SmsSendInput = z.infer<typeof SmsSendSchema>;
export type SmsFunnelSendInput = z.infer<typeof SmsFunnelSendSchema>;
export type SmsGroupSendInput = z.infer<typeof SmsGroupSendSchema>;
export type ListSmsSendQuery = z.infer<typeof ListSmsSendQuerySchema>;
export type CancelSmsSendInput = z.infer<typeof CancelSmsSendSchema>;
