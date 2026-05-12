import { z } from 'zod';

export const createDiarySchema = z.object({
  tripId: z.coerce.number()
    .int('여행 ID는 정수여야 합니다')
    .positive('여행 ID는 양수여야 합니다')
    .optional(),
  countryCode: z.string()
    .min(1, '국가 코드는 필수입니다')
    .max(10, '국가 코드는 10자 이하여야 합니다'),
  countryName: z.string()
    .min(1, '국가명은 필수입니다')
    .max(100, '국가명은 100자 이하여야 합니다'),
  title: z.string()
    .min(1, '제목은 필수입니다')
    .max(200, '제목은 200자 이하여야 합니다'),
  content: z.string()
    .max(500, '내용은 500자 이하여야 합니다')
    .default(''),
  visitDate: z.string()
    .datetime('유효한 ISO 8601 날짜가 필요합니다')
    .optional()
    .transform(val => {
      if (!val) return new Date();
      const parsed = new Date(val);
      if (isNaN(parsed.getTime())) {
        throw new Error('유효하지 않은 날짜입니다');
      }
      return parsed;
    }),
});

export type CreateDiaryInput = z.infer<typeof createDiarySchema>;

// P0-SEC-5: Pagination query validation for diary GET
export const getDiaryQuerySchema = z.object({
  limit: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 50)
    .refine(val => val > 0 && val <= 100, '제한은 1-100 사이여야 합니다'),
  offset: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 0)
    .refine(val => val >= 0 && val <= 10000, 'offset은 0-10000 사이여야 합니다'),
  tripId: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : undefined)
    .refine(val => val === undefined || (Number.isInteger(val) && val > 0), 'Valid tripId required'),
  countryCode: z.string()
    .optional()
    .refine(val => val === undefined || (val.length > 0 && val.length <= 10), 'Country code 1-10 chars'),
});

export type GetDiaryQuery = z.infer<typeof getDiaryQuerySchema>;
