import { z } from 'zod';

// 통화 옵션 (ISO 4217 코드)
export const CURRENCY_OPTIONS = [
  'USD', 'EUR', 'GBP', 'JPY', 'KRW', 'CNY', 'INR', 'AUD', 'CAD', 'CHF',
  'SEK', 'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'DKK', 'THB', 'VND', 'PHP',
  'IDR', 'MYR', 'ZAR', 'BRL', 'AED', 'QAR', 'SAR', 'TRY', 'RUB', 'NGN',
] as const;

// 검증 메시지 상수
const TRIP_VALIDATION = {
  name: {
    required: '여행명은 필수입니다',
    maxLength: '여행명은 100자 이하여야 합니다',
  },
  description: {
    maxLength: '설명은 500자 이하여야 합니다',
  },
  date: {
    required: '날짜는 필수입니다',
    invalid: '유효한 ISO 8601 날짜가 필요합니다',
    endBeforeStart: '종료 날짜는 시작 날짜 이후여야 합니다',
  },
  budget: {
    invalid: '예산은 음수가 될 수 없습니다',
    maxValue: '예산은 99999999.99 이하여야 합니다',
  },
  currency: {
    invalid: '통화 코드는 3자 대문자여야 합니다',
  },
  countryCode: {
    invalid: '국가 코드는 2자 대문자여야 합니다',
  },
  regionName: {
    maxLength: '지역명은 100자 이하여야 합니다',
  },
  status: {
    invalid: '상태는 active, archived, deleted 중 하나여야 합니다',
  },
} as const;

// 여행 상태 enum
export const TRIP_STATUS = ['active', 'archived', 'deleted'] as const;
export type TripStatus = typeof TRIP_STATUS[number];

// 여행 생성 검증 (POST)
export const createTripSchema = z.object({
  name: z.string()
    .trim()
    .min(1, TRIP_VALIDATION.name.required)
    .max(100, TRIP_VALIDATION.name.maxLength),
  description: z.string()
    .trim()
    .max(500, TRIP_VALIDATION.description.maxLength)
    .default(''),
  startDate: z.string()
    .datetime(TRIP_VALIDATION.date.invalid)
    .transform(val => {
      const parsed = new Date(val);
      if (isNaN(parsed.getTime())) {
        throw new Error(TRIP_VALIDATION.date.invalid);
      }
      return parsed;
    }),
  endDate: z.string()
    .datetime(TRIP_VALIDATION.date.invalid)
    .transform(val => {
      const parsed = new Date(val);
      if (isNaN(parsed.getTime())) {
        throw new Error(TRIP_VALIDATION.date.invalid);
      }
      return parsed;
    }),
  budget: z.string()
    .optional()
    .transform(val => val ? parseFloat(val) : undefined)
    .refine(
      val => val === undefined || (val >= 0 && val <= 99999999.99),
      TRIP_VALIDATION.budget.maxValue
    ),
  currency: z.string()
    .optional()
    .default('USD')
    .refine(
      val => /^[A-Z]{3}$/.test(val),
      TRIP_VALIDATION.currency.invalid
    ),
  countryCode: z.string()
    .optional()
    .refine(
      val => val === undefined || /^[A-Z]{2}$/.test(val),
      TRIP_VALIDATION.countryCode.invalid
    )
    .transform(val => val || undefined),
  regionName: z.string()
    .max(100, TRIP_VALIDATION.regionName.maxLength)
    .optional()
    .transform(val => (val && val.trim()) || undefined),
}).refine(
  data => data.startDate < data.endDate,
  {
    message: TRIP_VALIDATION.date.endBeforeStart,
    path: ['endDate'],
  }
);

export type CreateTripInput = z.infer<typeof createTripSchema>;

// 여행 수정 검증 (PATCH) - name, description, budget만 수정 가능
export const updateTripSchema = z.object({
  name: z.string()
    .trim()
    .min(1, TRIP_VALIDATION.name.required)
    .max(100, TRIP_VALIDATION.name.maxLength)
    .optional(),
  description: z.string()
    .trim()
    .max(500, TRIP_VALIDATION.description.maxLength)
    .optional(),
  budget: z.string()
    .optional()
    .transform(val => val ? parseFloat(val) : undefined)
    .refine(
      val => val === undefined || (val >= 0 && val <= 99999999.99),
      TRIP_VALIDATION.budget.maxValue
    ),
}).refine(
  data => Object.keys(data).length > 0,
  '수정할 필드를 지정해주세요'
);

export type UpdateTripInput = z.infer<typeof updateTripSchema>;

// GET 쿼리 파라미터 검증
export const getTripQuerySchema = z.object({
  userId: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : undefined)
    .refine(
      val => val === undefined || (Number.isInteger(val) && val > 0),
      '유효한 사용자 ID가 필요합니다'
    ),
  status: z.string()
    .optional()
    .refine(
      val => val === undefined || TRIP_STATUS.includes(val as TripStatus),
      TRIP_VALIDATION.status.invalid
    ),
  limit: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 50)
    .refine(val => val > 0 && val <= 100, '제한은 1-100 사이여야 합니다'),
  offset: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 0)
    .refine(val => val >= 0 && val <= 10000, 'offset은 0-10000 사이여야 합니다'),
  cursor: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : undefined)
    .refine(
      val => val === undefined || (Number.isInteger(val) && val > 0),
      'cursor는 양수여야 합니다'
    ),
});

export type GetTripQuery = z.infer<typeof getTripQuerySchema>;
