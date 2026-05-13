export const CONTRACT_PRICE_TIERS = {
  BASIC: {
    id: 'basic',
    label: '기본 대리점',
    priceKRW: 3300000, // 330만원
    commissionRate: 10,
    description: '기본 수수료 10%',
  },
  STANDARD: {
    id: 'standard',
    label: '표준 대리점',
    priceKRW: 5400000, // 540만원
    commissionRate: 15,
    description: '표준 수수료 15%',
  },
  PREMIUM: {
    id: 'premium',
    label: '프리미엄 대리점',
    priceKRW: 7500000, // 750만원
    commissionRate: 20,
    description: '프리미엄 수수료 20%',
  },
} as const;

export type PriceTierKey = keyof typeof CONTRACT_PRICE_TIERS;

export function getPriceTierByAmount(amount: number): PriceTierKey | null {
  for (const [key, tier] of Object.entries(CONTRACT_PRICE_TIERS)) {
    if (tier.priceKRW === amount) {
      return key as PriceTierKey;
    }
  }
  return null;
}

export function getPriceTierInfo(tierId: PriceTierKey) {
  return CONTRACT_PRICE_TIERS[tierId];
}
