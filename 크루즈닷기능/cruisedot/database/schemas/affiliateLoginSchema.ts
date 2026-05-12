import { z } from 'zod';

export const affiliateLoginSchema = z.object({
  phone: z
    .string()
    .min(1, { message: '전화번호는 필수입니다' })
    .max(50, { message: '전화번호는 50자 이내여야 합니다' }),

  password: z
    .string()
    .min(1, { message: '비밀번호는 필수입니다' })
    .max(20, { message: '비밀번호는 20자 이내여야 합니다' }),

  name: z
    .string()
    .min(1, { message: '이름은 필수입니다' })
    .max(100, { message: '이름은 100자 이내여야 합니다' })
    .optional(),

  mode: z
    .enum(['partner', 'customer', 'affiliate'], {
      message: '유효한 로그인 모드를 선택해주세요'
    })
    .optional()
    .default('customer'),
});

export type AffiliateLoginInput = z.infer<typeof affiliateLoginSchema>;
