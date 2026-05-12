// 대리점 계약 가격 정책
// 수수료율은 여기서만 정의 — 다른 파일에서 하드코딩 금지

export const CONTRACT_PRICE_TIERS = {
  BASIC: {
    id: 'basic',
    label: '기본 대리점',
    priceKRW: 3_300_000,
    commissionRate: 10,
    description: '기본 수수료 10%',
  },
  STANDARD: {
    id: 'standard',
    label: '표준 대리점',
    priceKRW: 5_400_000,
    commissionRate: 15,
    description: '표준 수수료 15%',
  },
  PREMIUM: {
    id: 'premium',
    label: '프리미엄 대리점',
    priceKRW: 7_500_000,
    commissionRate: 20,
    description: '프리미엄 수수료 20%',
  },
} as const;

export type PriceTierKey = keyof typeof CONTRACT_PRICE_TIERS;

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
