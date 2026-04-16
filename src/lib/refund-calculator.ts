/**
 * 크루즈 상품 환불 금액 계산기
 * 법정 기준: 국외여행 특수약관 (관광진흥법 시행령)
 */

export type RefundSlot = {
  daysBeforeDep: number;
  penaltyRate: number;
  label?: string;
};

export type RefundPolicyJson = {
  slots: RefundSlot[];
  displayText?: string;
  isStructured?: boolean;
};

// 법정 기준 (국외여행 특수약관)
export const LEGAL_REFUND_POLICY: RefundPolicyJson = {
  slots: [
    { daysBeforeDep: 30, penaltyRate: 0,  label: '위약금 없음' },
    { daysBeforeDep: 20, penaltyRate: 10 },
    { daysBeforeDep: 10, penaltyRate: 15 },
    { daysBeforeDep: 8,  penaltyRate: 20 },
    { daysBeforeDep: 1,  penaltyRate: 30 },
    { daysBeforeDep: 0,  penaltyRate: 50 },
  ],
  isStructured: true,
};

export type RefundCalcResult = {
  refundAmount: number;
  penaltyRate: number;
  penaltyAmount: number;
  daysBeforeDep: number;
  basis: string;
  appliedSlot: RefundSlot;
  calcDate: string;
  departureDate: string;
};

/**
 * 환불 금액 계산
 * @param totalAmount 결제 총액 (원)
 * @param departureDate 출발일
 * @param refundPolicyJson 상품별 구조화 환불정책 (없으면 법정 기준 적용)
 * @param baseDate 계산 기준일 (테스트용, 생략 시 오늘)
 */
export function calcRefundAmount(
  totalAmount: number,
  departureDate: Date,
  refundPolicyJson: RefundPolicyJson | null,
  baseDate?: Date,
): RefundCalcResult {
  const today = baseDate ? new Date(baseDate) : new Date();
  today.setUTCHours(0, 0, 0, 0); // setHours 금지 — UTC 기준

  const dep = new Date(departureDate);
  dep.setUTCHours(0, 0, 0, 0); // setHours 금지 — UTC 기준

  const daysBeforeDep = Math.floor((dep.getTime() - today.getTime()) / 86400000);

  const policy =
    refundPolicyJson?.isStructured && refundPolicyJson.slots?.length
      ? refundPolicyJson
      : LEGAL_REFUND_POLICY;

  const sorted = [...policy.slots].sort((a, b) => b.daysBeforeDep - a.daysBeforeDep);
  const appliedSlot: RefundSlot =
    sorted.find((s) => daysBeforeDep >= s.daysBeforeDep) ??
    sorted[sorted.length - 1] ??
    { daysBeforeDep: 0, penaltyRate: 100, label: '당일 취소' };

  const penaltyAmount = Math.round((totalAmount * appliedSlot.penaltyRate) / 100);

  return {
    refundAmount: totalAmount - penaltyAmount,
    penaltyRate: appliedSlot.penaltyRate,
    penaltyAmount,
    daysBeforeDep,
    basis: refundPolicyJson?.isStructured
      ? '상품별 환불정책'
      : '법정기준(관광진흥법 시행령)',
    appliedSlot,
    calcDate: today.toISOString().split('T')[0] ?? '',
    departureDate: dep.toISOString().split('T')[0] ?? '',
  };
}
