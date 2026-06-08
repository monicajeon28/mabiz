import { z } from 'zod';

// ─────────────────────────────────────────────
// Contact (고객) 검증 스키마
// ─────────────────────────────────────────────

const PHONE_PATTERN = /^(\+82|0)[0-9]{1,2}[-]?[0-9]{3,4}[-]?[0-9]{4}$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const RESIDENT_NUM_PATTERN = /^\d{6}[-]?\d{7}$/;

// ─── Contact 생성 스키마 ──
export const CreateContactSchema = z.object({
  name: z.string()
    .min(1, '이름은 필수입니다.')
    .max(50, '이름은 50자 이내여야 합니다.')
    .transform(v => v.trim()),

  phone: z.string()
    .regex(PHONE_PATTERN, '올바른 전화번호 형식입니다 (예: 010-1234-5678 또는 +82-10-1234-5678)')
    .max(20, '20자 이내여야 합니다.')
    .transform(v => v.trim())
    .optional()
    .or(z.literal('')),

  email: z.string()
    .email('올바른 이메일 형식입니다')
    .max(100, '이메일은 100자 이내여야 합니다.')
    .transform(v => v.trim())
    .optional()
    .or(z.literal('')),

  residentNum: z.string()
    .regex(RESIDENT_NUM_PATTERN, '올바른 주민번호 형식입니다 (예: 000000-0000000)')
    .max(14, '14자 이내여야 합니다.')
    .transform(v => v.trim())
    .optional()
    .or(z.literal('')),

  contactType: z.enum(['CUSTOMER', 'PROSPECT', 'INQUIRY', 'PARTNER']).describe('유효한 고객 유형을 선택하세요.'),

  status: z.enum(['ACTIVE', 'INACTIVE', 'LOST']).default('ACTIVE').describe('유효한 상태를 선택하세요.'),

  notes: z.string()
    .max(500, '메모는 500자 이내여야 합니다.')
    .transform(v => v.trim())
    .optional()
    .or(z.literal('')),

  tags: z.array(z.string().max(20))
    .max(10, '태그는 최대 10개까지 추가 가능합니다.')
    .optional(),
}).strict();

// ─── Contact 업데이트 스키마 (모두 선택사항) ──
export const UpdateContactSchema = CreateContactSchema.partial();

// ─── Contact 검색 쿼리 ──
export const ListContactsQuerySchema = z.object({
  q: z.string().max(100, '검색어는 100자 이내여야 합니다.').optional(),
  contactType: z.enum(['CUSTOMER', 'PROSPECT', 'INQUIRY', 'PARTNER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOST']).optional(),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(1000).default(50),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).strict();

// ─────────────────────────────────────────────
// Export types
// ─────────────────────────────────────────────

export type CreateContactInput = z.infer<typeof CreateContactSchema>;
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;
export type ListContactsQuery = z.infer<typeof ListContactsQuerySchema>;
