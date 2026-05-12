import { z } from 'zod';

// 기본 지출 데이터 (POST/PUT에서 공유)
const baseExpenseData = z.object({
  category: z.string()
    .min(1, '카테고리는 필수입니다')
    .max(50, '카테고리는 50자 이하여야 합니다')
    .default('기타'),
  description: z.string()
    .max(500, '설명은 500자 이하여야 합니다')
    .default(''),
  currency: z.enum(['KRW', 'USD', 'EUR', 'JPY', 'GBP'])
    .default('KRW'),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'])
    .default('CASH'),
  day: z.number()
    .int('일자는 정수여야 합니다')
    .min(1, '일자는 1 이상이어야 합니다')
    .max(31, '일자는 31 이하여야 합니다')
    .optional()
    .default(1),
});

// POST: 지출 생성
export const createExpenseSchema = z.object({
  tripId: z.coerce.number()
    .int('여행 ID는 정수여야 합니다')
    .positive('여행 ID는 양수여야 합니다'),
  amount: z.coerce.number()
    .positive('금액은 0보다 커야 합니다')
    .finite('유효하지 않은 금액입니다')
    .max(999999.99, '금액이 너무 큽니다 (최대 999,999.99)'),
  amountInKRW: z.coerce.number()
    .nonnegative('원화 금액은 0 이상이어야 합니다')
    .finite('유효하지 않은 원화 금액입니다')
    .max(999999999, '원화 금액이 너무 큽니다 (최대 999,999,999)'),
  date: z.string()
    .datetime('유효한 ISO 8601 날짜가 필요합니다')
    .optional()
    .or(z.date().optional())
    .transform(val => {
      if (!val) return new Date();
      if (val instanceof Date) return val;
      const parsed = new Date(val);
      if (isNaN(parsed.getTime())) {
        throw new Error('유효하지 않은 날짜입니다');
      }
      // 날짜 범위 검증은 handler에서 trip.startDate/endDate와 비교
      return parsed;
    }),
  ...baseExpenseData.shape,
});

// PUT: 지출 수정 (모든 필드 선택사항, id 필수)
export const updateExpenseSchema = z.object({
  id: z.coerce.number()
    .int('지출 ID는 정수여야 합니다')
    .positive('지출 ID는 양수여야 합니다'),
  amount: z.coerce.number()
    .positive('금액은 0보다 커야 합니다')
    .finite('유효하지 않은 금액입니다')
    .max(999999.99, '금액이 너무 큽니다')
    .optional(),
  amountInKRW: z.coerce.number()
    .nonnegative('원화 금액은 0 이상이어야 합니다')
    .finite('유효하지 않은 원화 금액입니다')
    .max(999999999, '원화 금액이 너무 큽니다')
    .optional(),
  date: z.string()
    .datetime('유효한 ISO 8601 날짜가 필요합니다')
    .optional()
    .or(z.date().optional())
    .transform(val => {
      if (!val) return undefined;
      if (val instanceof Date) return val;
      const parsed = new Date(val);
      if (isNaN(parsed.getTime())) {
        throw new Error('유효하지 않은 날짜입니다');
      }
      return parsed;
    }),
  category: baseExpenseData.shape.category.optional(),
  description: baseExpenseData.shape.description.optional(),
  currency: baseExpenseData.shape.currency.optional(),
  paymentMethod: baseExpenseData.shape.paymentMethod.optional(),
  day: baseExpenseData.shape.day.optional(),
});

// GET: 쿼리 파라미터 검증
export const getExpensesQuerySchema = z.object({
  tripId: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : undefined)
    .refine(val => val === undefined || (Number.isInteger(val) && val > 0),
      '유효한 여행 ID가 필요합니다'),
  limit: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 50)
    .refine(val => val > 0 && val <= 100, '제한은 1~100 사이여야 합니다'),
  offset: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 0)
    .refine(val => val >= 0 && val <= 10000, 'offset은 0~10000 사이여야 합니다'),
});

// DELETE: 쿼리 파라미터 검증
export const deleteExpensesQuerySchema = z.object({
  id: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : undefined)
    .refine(val => val === undefined || (Number.isInteger(val) && val > 0),
      '유효한 지출 ID가 필요합니다'),
  all: z.string()
    .optional()
    .transform(val => val === 'true'),
  tripId: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : undefined)
    .refine(val => val === undefined || (Number.isInteger(val) && val > 0),
      '유효한 여행 ID가 필요합니다'),
});

// 타입 추론
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type GetExpensesQuery = z.infer<typeof getExpensesQuerySchema>;
export type DeleteExpensesQuery = z.infer<typeof deleteExpensesQuerySchema>;
