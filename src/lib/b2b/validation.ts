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

/**
 * B2BProspect.status 허용 enum 값 (SSOT — /api/b2b와 /api/b2b-prospects 양쪽 참조)
 * NOTE: /api/b2b GET의 ALLOWED_B2B_STATUSES에는 'ACTIVE'가 포함되나
 *       /api/b2b-prospects PATCH에서는 ACTIVE 미포함. 정책 통일 필요.
 *       현재는 ACTIVE를 포함하여 두 쪽 모두 이 상수를 사용하도록 변경.
 */
export const B2B_PROSPECT_STATUSES = [
  'PENDING', 'CONTACTED', 'CONVERTED', 'REJECTED', 'FOLLOW_UP', 'ACTIVE'
] as const;
export type B2BProspectStatus = typeof B2B_PROSPECT_STATUSES[number];
