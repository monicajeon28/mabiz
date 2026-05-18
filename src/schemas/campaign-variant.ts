import { z } from 'zod';

/**
 * Variant 생성 스키마
 * A 또는 B 변형만 허용
 */
export const CreateVariantSchema = z.object({
  variantKey: z.enum(['A', 'B'], {
    errorMap: () => ({ message: 'variantKey는 A 또는 B여야 합니다' }),
  }),
  smsBody: z
    .string()
    .max(90, 'SMS는 90자 이하여야 합니다')
    .nullable()
    .optional(),
  emailSubject: z
    .string()
    .max(200, '이메일 제목은 200자 이하여야 합니다')
    .nullable()
    .optional(),
  emailBody: z
    .string()
    .max(5000, '이메일 본문은 5000자 이하여야 합니다')
    .nullable()
    .optional(),
  trafficSplit: z
    .number()
    .min(0.0, 'trafficSplit은 0.0 이상이어야 합니다')
    .max(1.0, 'trafficSplit은 1.0 이하여야 합니다')
    .default(0.5),
});

/**
 * Variant 수정 스키마
 * 모든 필드가 선택사항 (부분 업데이트 가능)
 */
export const UpdateVariantSchema = z.object({
  smsBody: z
    .string()
    .max(90, 'SMS는 90자 이하여야 합니다')
    .nullable()
    .optional(),
  emailSubject: z
    .string()
    .max(200, '이메일 제목은 200자 이하여야 합니다')
    .nullable()
    .optional(),
  emailBody: z
    .string()
    .max(5000, '이메일 본문은 5000자 이하여야 합니다')
    .nullable()
    .optional(),
  trafficSplit: z
    .number()
    .min(0.0, 'trafficSplit은 0.0 이상이어야 합니다')
    .max(1.0, 'trafficSplit은 1.0 이하여야 합니다')
    .optional(),
  isActive: z.boolean().optional(),
});

export type CreateVariantInput = z.infer<typeof CreateVariantSchema>;
export type UpdateVariantInput = z.infer<typeof UpdateVariantSchema>;
