/**
 * Source Type Constants
 *
 * 고객 출처별 상수 정의
 * - EDUCATION: 교육 고객
 * - GOLD_MEMBER: VIP/골드 회원 (CruiseDot 컨택)
 */

export const SOURCE_TYPES = {
  EDUCATION: 'education',
  GOLD_MEMBER: 'gold_member',
} as const;

export type SourceType = typeof SOURCE_TYPES[keyof typeof SOURCE_TYPES];

/**
 * 고객 출처 정규화 함수
 * @param sourceType 원본 sourceType (null/undefined 가능)
 * @returns 소문자 정규화된 값
 */
export function normalizeSourceType(sourceType?: string | null): string | undefined {
  return sourceType?.toLowerCase();
}

/**
 * VIP 고객 판별 함수
 * @param sourceType 고객 출처
 * @returns VIP 여부 (골드 회원 = true)
 */
export function isVIPCustomer(sourceType?: string | null): boolean {
  return normalizeSourceType(sourceType) === SOURCE_TYPES.GOLD_MEMBER;
}
