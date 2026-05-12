import { z } from 'zod';

// 검증 메시지 상수
const SCHEDULE_VALIDATION = {
  title: {
    required: '제목은 필수입니다',
    maxLength: '제목은 200자 이내여야 합니다',
  },
  date: {
    required: '날짜는 필수입니다',
    invalid: '유효한 날짜 형식입니다 (YYYY-MM-DD)',
  },
  time: {
    required: '시간은 필수입니다',
    invalid: '유효한 시간 형식입니다 (HH:MM, 24시간)',
  },
  tripId: {
    invalid: '유효한 여행 ID가 필요합니다',
  },
} as const;

// 일정 카테고리 (향후 마이그레이션)
export const SCHEDULE_CATEGORIES = ['🍽️', '✈️', '🏨', '🎭', '🏖️', '📍', '🚗', '🎒'] as const;
export type ScheduleCategory = typeof SCHEDULE_CATEGORIES[number];

export const SCHEDULE_CATEGORY_LABELS: Record<ScheduleCategory, string> = {
  '🍽️': '식사',
  '✈️': '항공',
  '🏨': '숙박',
  '🎭': '액티비티',
  '🏖️': '여행',
  '📍': '장소',
  '🚗': '교통',
  '🎒': '준비',
};

// 리마인더 옵션 (향후 마이그레이션)
export const REMINDER_OPTIONS = ['15분 전', '1시간 전', '1일 전'] as const;
export type ReminderOption = typeof REMINDER_OPTIONS[number];

// 일정 생성 검증 (POST) - 기본 필드 (현재 UserSchedule 스키마)
export const createScheduleSchema = z.object({
  title: z.string()
    .trim()
    .min(1, SCHEDULE_VALIDATION.title.required)
    .max(200, SCHEDULE_VALIDATION.title.maxLength),
  date: z.string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, SCHEDULE_VALIDATION.date.invalid),
  time: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, SCHEDULE_VALIDATION.time.invalid),
  alarm: z.boolean().optional().default(false),
  alarmTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, SCHEDULE_VALIDATION.time.invalid)
    .optional()
    .nullable(),
  tripId: z.coerce.number()
    .int(SCHEDULE_VALIDATION.tripId.invalid)
    .positive(SCHEDULE_VALIDATION.tripId.invalid)
    .optional(),
  // 향후 추가 필드 (마이그레이션 후)
  startTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, SCHEDULE_VALIDATION.time.invalid)
    .optional(),
  endTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, SCHEDULE_VALIDATION.time.invalid)
    .optional(),
  description: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  category: z.enum(SCHEDULE_CATEGORIES).optional(),
  reminders: z.array(z.enum(REMINDER_OPTIONS)).optional(),
});

// 일정 수정 검증 (PATCH)
export const updateScheduleSchema = z.object({
  title: z.string()
    .trim()
    .min(1, SCHEDULE_VALIDATION.title.required)
    .max(200, SCHEDULE_VALIDATION.title.maxLength)
    .optional(),
  date: z.string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, SCHEDULE_VALIDATION.date.invalid)
    .optional(),
  time: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, SCHEDULE_VALIDATION.time.invalid)
    .optional(),
  alarm: z.boolean().optional(),
  alarmTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, SCHEDULE_VALIDATION.time.invalid)
    .optional()
    .nullable(),
  // 향후 추가 필드
  startTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, SCHEDULE_VALIDATION.time.invalid)
    .optional(),
  endTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, SCHEDULE_VALIDATION.time.invalid)
    .optional(),
  description: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  category: z.enum(SCHEDULE_CATEGORIES).optional(),
  reminders: z.array(z.enum(REMINDER_OPTIONS)).optional(),
}).refine(data => Object.keys(data).length > 0, '수정할 필드를 지정해주세요');

// GET 쿼리 파라미터 검증
export const getScheduleQuerySchema = z.object({
  startDate: z.string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, SCHEDULE_VALIDATION.date.invalid)
    .optional(),
  endDate: z.string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, SCHEDULE_VALIDATION.date.invalid)
    .optional(),
  tripId: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : undefined)
    .refine(val => val === undefined || (Number.isInteger(val) && val > 0), SCHEDULE_VALIDATION.tripId.invalid),
  limit: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 50)
    .refine(val => val > 0 && val <= 100, '제한은 1-100 사이여야 합니다'),
  offset: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 0)
    .refine(val => val >= 0 && val <= 10000, 'offset은 0-10000 사이여야 합니다'),
});

// 타입 추론
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type GetScheduleQuery = z.infer<typeof getScheduleQuerySchema>;
