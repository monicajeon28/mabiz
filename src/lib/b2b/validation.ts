import { z } from 'zod';

export const B2BProspectCreateSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다').max(100, '이름은 100자 이하여야 합니다'),
  phone: z.string()
    .min(10, '전화번호가 너무 짧습니다')
    .max(20, '전화번호가 너무 깁니다')
    .refine(val => /^[\d\-\+\(\)]+$/.test(val), '전화번호 형식이 올바르지 않습니다'),
  email: z.string().email('이메일 형식이 올바르지 않습니다').optional().or(z.literal('')),
  productName: z.string().max(200, '상품명은 200자 이하여야 합니다').optional().or(z.literal('')),
  paymentAmount: z.number().positive('결제금액은 양수여야 합니다').optional(),
  paymentDate: z.string().datetime().optional().or(z.literal('')),
  notes: z.string().max(500, '메모는 500자 이하여야 합니다').optional().or(z.literal('')),
  status: z.string().min(1, '상태는 필수입니다'),
  eduType: z.enum(['BUYER', 'INQUIRER'], { message: 'eduType은 BUYER 또는 INQUIRER여야 합니다' }),
});

export const B2BProspectUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  productName: z.string().max(200).optional().or(z.literal('')),
  paymentAmount: z.number().positive().optional(),
  paymentDate: z.string().datetime().optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  status: z.string().min(1).optional(),
});

export type B2BProspectCreateInput = z.infer<typeof B2BProspectCreateSchema>;
export type B2BProspectUpdateInput = z.infer<typeof B2BProspectUpdateSchema>;
