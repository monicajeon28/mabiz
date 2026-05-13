import { z } from 'zod';

// 메시지 채널 옵션
export const MESSAGE_CHANNELS = ['SMS', 'Email', 'Kakao'] as const;
export type MessageChannel = typeof MESSAGE_CHANNELS[number];

// 메시지 정렬 옵션
export const MESSAGE_SORT_BY = ['createdAt', 'stageNumber', 'priority'] as const;
export type MessageSortBy = typeof MESSAGE_SORT_BY[number];

// 메시지 정렬 순서
export const MESSAGE_SORT_ORDER = ['asc', 'desc'] as const;
export type MessageSortOrder = typeof MESSAGE_SORT_ORDER[number];

// 검증 메시지 상수
const FUNNEL_MESSAGE_VALIDATION = {
  funnelId: {
    required: 'Funnel ID는 필수입니다',
    invalid: '유효한 Funnel ID(cuid)가 필요합니다',
  },
  stageNumber: {
    invalid: '스테이지 번호는 0-999 사이여야 합니다',
  },
  title: {
    required: '제목은 필수입니다',
    maxLength: '제목은 200자 이하여야 합니다',
  },
  content: {
    required: '내용은 필수입니다',
    maxLength: '내용은 2000자 이하여야 합니다',
  },
  channel: {
    required: '채널은 필수입니다',
    invalid: '채널은 SMS, Email, Kakao 중 하나여야 합니다',
  },
  daysAfter: {
    invalid: '발송 지연은 0-365 사이여야 합니다',
  },
  timeOfDay: {
    invalid: '시간은 HH:MM 형식이어야 합니다 (예: 10:00)',
  },
  priority: {
    invalid: '우선순위는 0-10 사이여야 합니다',
  },
  variantName: {
    maxLength: 'A/B 테스트 이름은 100자 이하여야 합니다',
  },
  messageId: {
    required: 'Message ID는 필수입니다',
    invalid: '유효한 Message ID(cuid)가 필요합니다',
  },
  page: {
    invalid: '페이지는 1-10000 사이여야 합니다',
  },
  limit: {
    invalid: '제한은 1-100 사이여야 합니다',
  },
} as const;

// 시간 형식 검증 함수 (HH:MM)
const isValidTimeFormat = (time: string): boolean => {
  if (!time) return false;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

// Funnel Messages 목록 조회 검증 (GET 쿼리 파라미터)
export const listFunnelMessagesSchema = z.object({
  funnelId: z.string()
    .min(1, FUNNEL_MESSAGE_VALIDATION.funnelId.required)
    .describe('Funnel ID (cuid 형식)'),
  page: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .refine(
      val => Number.isInteger(val) && val >= 1 && val <= 10000,
      FUNNEL_MESSAGE_VALIDATION.page.invalid
    )
    .describe('페이지 번호 (기본값: 1)'),
  limit: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 20)
    .refine(
      val => Number.isInteger(val) && val >= 1 && val <= 100,
      FUNNEL_MESSAGE_VALIDATION.limit.invalid
    )
    .describe('페이지당 아이템 수 (기본값: 20, 최대: 100)'),
  isActive: z.string()
    .optional()
    .transform(val => val === 'true' ? true : val === 'false' ? false : undefined)
    .describe('활성 상태 필터 (true/false, 선택사항)')
    .refine(val => val === undefined || typeof val === 'boolean', '유효한 boolean 값이 필요합니다'),
  channel: z.string()
    .optional()
    .refine(
      val => val === undefined || MESSAGE_CHANNELS.includes(val as MessageChannel),
      FUNNEL_MESSAGE_VALIDATION.channel.invalid
    )
    .describe('채널 필터 (SMS|Email|Kakao, 선택사항)'),
  sortBy: z.enum(MESSAGE_SORT_BY)
    .optional()
    .default('createdAt')
    .describe('정렬 기준 (createdAt|stageNumber|priority, 기본값: createdAt)'),
  sortOrder: z.enum(MESSAGE_SORT_ORDER)
    .optional()
    .default('desc')
    .describe('정렬 순서 (asc|desc, 기본값: desc)'),
});

export type ListFunnelMessagesQuery = z.infer<typeof listFunnelMessagesSchema>;

// Funnel Message 생성 검증 (POST 바디)
export const createFunnelMessageSchema = z.object({
  funnelId: z.string()
    .min(1, FUNNEL_MESSAGE_VALIDATION.funnelId.required)
    .describe('Funnel ID (cuid 형식)'),
  stageNumber: z.number()
    .int('스테이지 번호는 정수여야 합니다')
    .refine(
      val => val >= 0 && val <= 999,
      FUNNEL_MESSAGE_VALIDATION.stageNumber.invalid
    )
    .describe('스테이지 번호 (0-999)'),
  title: z.string()
    .trim()
    .min(1, FUNNEL_MESSAGE_VALIDATION.title.required)
    .max(200, FUNNEL_MESSAGE_VALIDATION.title.maxLength)
    .describe('메시지 제목 (1-200자)'),
  content: z.string()
    .trim()
    .min(1, FUNNEL_MESSAGE_VALIDATION.content.required)
    .max(2000, FUNNEL_MESSAGE_VALIDATION.content.maxLength)
    .describe('메시지 내용 (1-2000자)'),
  channel: z.enum(MESSAGE_CHANNELS)
    .describe('발송 채널 (SMS|Email|Kakao)'),
  daysAfter: z.number()
    .int('발송 지연은 정수여야 합니다')
    .optional()
    .refine(
      val => val === undefined || (val >= 0 && val <= 365),
      FUNNEL_MESSAGE_VALIDATION.daysAfter.invalid
    )
    .default(0)
    .describe('이벤트 이후 발송까지의 일수 (0-365, 기본값: 0)'),
  timeOfDay: z.string()
    .optional()
    .refine(
      val => val === undefined || isValidTimeFormat(val),
      FUNNEL_MESSAGE_VALIDATION.timeOfDay.invalid
    )
    .describe('발송 시간 (HH:MM 형식, 예: 10:00, 선택사항)'),
  priority: z.number()
    .int('우선순위는 정수여야 합니다')
    .optional()
    .refine(
      val => val === undefined || (val >= 0 && val <= 10),
      FUNNEL_MESSAGE_VALIDATION.priority.invalid
    )
    .default(5)
    .describe('메시지 우선순위 (0-10, 기본값: 5)'),
  isActive: z.boolean()
    .optional()
    .default(true)
    .describe('활성화 여부 (기본값: true)'),
  variantName: z.string()
    .trim()
    .max(100, FUNNEL_MESSAGE_VALIDATION.variantName.maxLength)
    .optional()
    .transform(val => (val && val.trim()) || undefined)
    .describe('A/B 테스트 변형명 (100자 이하, 선택사항)'),
});

export type CreateFunnelMessageInput = z.infer<typeof createFunnelMessageSchema>;

// Funnel Message 수정 검증 (PATCH 바디)
export const updateFunnelMessageSchema = z.object({
  messageId: z.string()
    .min(1, FUNNEL_MESSAGE_VALIDATION.messageId.required)
    .describe('Message ID (cuid 형식)'),
  title: z.string()
    .trim()
    .min(1, FUNNEL_MESSAGE_VALIDATION.title.required)
    .max(200, FUNNEL_MESSAGE_VALIDATION.title.maxLength)
    .optional()
    .describe('메시지 제목 (1-200자)'),
  content: z.string()
    .trim()
    .min(1, FUNNEL_MESSAGE_VALIDATION.content.required)
    .max(2000, FUNNEL_MESSAGE_VALIDATION.content.maxLength)
    .optional()
    .describe('메시지 내용 (1-2000자)'),
  channel: z.enum(MESSAGE_CHANNELS)
    .optional()
    .describe('발송 채널 (SMS|Email|Kakao)'),
  daysAfter: z.number()
    .int('발송 지연은 정수여야 합니다')
    .optional()
    .refine(
      val => val === undefined || (val >= 0 && val <= 365),
      FUNNEL_MESSAGE_VALIDATION.daysAfter.invalid
    )
    .describe('이벤트 이후 발송까지의 일수 (0-365)'),
  timeOfDay: z.string()
    .optional()
    .refine(
      val => val === undefined || isValidTimeFormat(val),
      FUNNEL_MESSAGE_VALIDATION.timeOfDay.invalid
    )
    .describe('발송 시간 (HH:MM 형식, 예: 10:00)'),
  priority: z.number()
    .int('우선순위는 정수여야 합니다')
    .optional()
    .refine(
      val => val === undefined || (val >= 0 && val <= 10),
      FUNNEL_MESSAGE_VALIDATION.priority.invalid
    )
    .describe('메시지 우선순위 (0-10)'),
  isActive: z.boolean()
    .optional()
    .describe('활성화 여부'),
  variantName: z.string()
    .trim()
    .max(100, FUNNEL_MESSAGE_VALIDATION.variantName.maxLength)
    .optional()
    .transform(val => (val && val.trim()) || undefined)
    .describe('A/B 테스트 변형명 (100자 이하)'),
}).refine(
  data => Object.keys(data).length > 1,
  '수정할 필드를 지정해주세요 (messageId 제외)'
);

export type UpdateFunnelMessageInput = z.infer<typeof updateFunnelMessageSchema>;

// Funnel Message 삭제 검증 (DELETE 바디/쿼리)
export const deleteFunnelMessageSchema = z.object({
  messageId: z.string()
    .min(1, FUNNEL_MESSAGE_VALIDATION.messageId.required)
    .describe('Message ID (cuid 형식)'),
});

export type DeleteFunnelMessageInput = z.infer<typeof deleteFunnelMessageSchema>;
