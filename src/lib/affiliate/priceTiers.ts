// 대리점/판매원 계약 가격 정책
// 수수료율·역할 등급은 여기서만 정의 — 다른 파일에서 하드코딩 금지

export const CONTRACT_PRICE_TIERS = {
  /** 직속마케터 330만 */
  SALES_330: {
    label: '직속마케터',
    priceKRW: 3_300_000,
    commissionRate: 10,
    memberType: 'SALES_AGENT' as const,
    description: '직속마케터 계약 · 330만원',
    contractTitle: '직속마케터 판매 계약서',
  },
  /** 직속인솔스탭 540만 */
  SALES_540: {
    label: '직속인솔스탭',
    priceKRW: 5_400_000,
    commissionRate: 15,
    memberType: 'SALES_AGENT' as const,
    description: '직속인솔스탭 계약 · 540만원',
    contractTitle: '직속인솔스탭 판매 계약서',
  },
  /** 대리점 */
  BRANCH_750: {
    label: '대리점',
    priceKRW: 7_500_000,
    commissionRate: 20,
    memberType: 'BRANCH_MANAGER' as const,
    description: '대리점 계약',
    contractTitle: 'B2B 대리점장 계약서',
  },
} as const;

export type PriceTierKey = keyof typeof CONTRACT_PRICE_TIERS;
export type MemberType = (typeof CONTRACT_PRICE_TIERS)[PriceTierKey]['memberType'];

export type ValidTierAmount = 3_300_000 | 5_400_000 | 7_500_000;

export const VALID_AMOUNTS = Object.values(CONTRACT_PRICE_TIERS).map(
  (t) => t.priceKRW,
) as ValidTierAmount[];

export const VALID_AMOUNTS_LABEL = VALID_AMOUNTS.map((a) =>
  (a / 10_000).toLocaleString() + '만원',
).join('/');

export function getPriceTierByAmount(amount: number): PriceTierKey | null {
  for (const [key, tier] of Object.entries(CONTRACT_PRICE_TIERS)) {
    if (tier.priceKRW === amount) return key as PriceTierKey;
  }
  return null;
}

export function getPriceTierInfo(tierId: PriceTierKey) {
  return CONTRACT_PRICE_TIERS[tierId];
}
