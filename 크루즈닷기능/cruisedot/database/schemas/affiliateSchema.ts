import { z } from 'zod';

/**
 * 사업자번호 체크디지트 검증 함수
 * 참고: https://www.fenanel.com/document/checksum
 */
function validateBusinessNumber(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;

  const digits = value.split('').map(Number);
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i];
  }

  const checksum = Math.floor((10 - (sum % 10)) % 10) * 2;
  return checksum === digits[9];
}

/**
 * 한국 전화번호 검증 (010-1234-5678 또는 01012345678)
 */
function validatePhoneNumber(value: string): boolean {
  const phoneRegex = /^(01[0-9])-?(\d{3,4})-?(\d{4})$/;
  return phoneRegex.test(value);
}

// ============================================================================
// 기본 어필리에이트 데이터 (공유 필드)
// ============================================================================
const baseAffiliateData = z.object({
  name: z.string()
    .min(2, '이름은 최소 2자 이상이어야 합니다')
    .max(100, '이름은 100자 이하여야 합니다')
    .trim(),

  email: z.string()
    .email('유효한 이메일 주소를 입력해주세요')
    .max(255, '이메일은 255자 이하여야 합니다')
    .toLowerCase()
    .trim(),

  phone: z.string()
    .refine(validatePhoneNumber, '유효한 한국 전화번호를 입력해주세요 (예: 010-1234-5678)')
    .transform(val => val.replace(/-/g, '')), // 하이픈 제거하여 저장

  businessNumber: z.string()
    .length(10, '사업자번호는 10자리여야 합니다')
    .regex(/^\d{10}$/, '사업자번호는 숫자만 포함해야 합니다')
    .refine(validateBusinessNumber, '유효하지 않은 사업자번호입니다 (체크디지트 검증 실패)'),

  bankAccount: z.string()
    .min(5, '계좌번호는 최소 5자 이상이어야 합니다')
    .max(20, '계좌번호는 20자 이하여야 합니다')
    .trim(),

  bankName: z.string()
    .min(2, '은행명은 최소 2자 이상이어야 합니다')
    .max(50, '은행명은 50자 이하여야 합니다')
    .trim(),
});

// ============================================================================
// POST: 어필리에이트 등록
// ============================================================================
export const createAffiliateSchema = z.object({
  ...baseAffiliateData.shape,
}).strict(); // 추가 필드 금지

// ============================================================================
// PATCH: 어필리에이트 정보 수정
// ============================================================================
export const updateAffiliateSchema = z.object({
  phone: baseAffiliateData.shape.phone.optional(),
  bankAccount: baseAffiliateData.shape.bankAccount.optional(),
  bankName: baseAffiliateData.shape.bankName.optional(),
}).strict().refine(
  obj => Object.keys(obj).length > 0,
  '수정할 필드가 최소 하나 이상 필요합니다'
);

// ============================================================================
// GET: 쿼리 파라미터 검증
// ============================================================================
export const getAffiliatesQuerySchema = z.object({
  limit: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 20)
    .refine(val => val > 0 && val <= 100, '제한은 1~100 사이여야 합니다'),

  page: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .refine(val => val > 0, 'page는 1 이상이어야 합니다'),

  status: z.string()
    .optional()
    .refine(
      val => !val || ['PENDING', 'CONFIRMED', 'SETTLED', 'PAID', 'REJECTED', 'SUSPENDED'].includes(val),
      '유효한 상태를 선택해주세요'
    ),
});

// ============================================================================
// 타입 추론
// ============================================================================
export type CreateAffiliateInput = z.infer<typeof createAffiliateSchema>;
export type UpdateAffiliateInput = z.infer<typeof updateAffiliateSchema>;
export type GetAffiliatesQuery = z.infer<typeof getAffiliatesQuerySchema>;
