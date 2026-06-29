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

/**
 * 상품별 환불정책(RefundPolicyJson {slots})을 계약서/인증서 표시용 {label,value}[] 로 변환.
 * - product-info API, ContractTab, purchase-contract route 가 동일 규칙으로 사용 (3곳 일관)
 * - daysBeforeDep=0 은 "출발 당일", penaltyRate=0 은 "위약금 없음" 으로 사람이 읽는 라벨 생성.
 * - slot 에 명시적 label/value 가 있으면 그대로 우선 사용(원문 보존).
 * - slots 가 비어 있으면 빈 배열 반환(호출부에서 폴백 처리).
 */
export function refundPolicyToLines(
  policy: RefundPolicyJson | null | undefined,
): { label: string; value: string }[] {
  if (!policy || !Array.isArray(policy.slots) || policy.slots.length === 0) return [];
  const sorted = [...policy.slots].sort((a, b) => b.daysBeforeDep - a.daysBeforeDep);
  // 각 구간의 라벨을 "범위"로 생성 — 인접 slot 경계로 상한을 계산해 표시.
  //   예: [91:0%, 58:30%, 51:50%, 0:100%] →
  //       "출발 91일 이전=위약없음 / 58~90일 전=30% / 51~57일 전=50% / 50일 전~당일=100%"
  //   (기존엔 "출발 58일 이전 / 당일 포함"처럼 상한을 안 보여줘 실제 정책을 오해하게 했음 = 버그 수정)
  return sorted.map((s, i) => {
    const d = s.daysBeforeDep;
    let label: string;
    if (i === 0) {
      // 최상위(가장 이른) 구간: 그 이전 전부
      label = d > 0 ? `출발 ${d}일 이전` : '출발 당일';
    } else {
      const upper = sorted[i - 1].daysBeforeDep - 1; // 바로 위(더 이른) 구간 시작 -1 = 이 구간 상한
      if (d <= 0) {
        label = upper > 0 ? `출발 ${upper}일 전 ~ 당일` : '출발 당일';
      } else if (upper > d) {
        label = `출발 ${d}~${upper}일 전`;
      } else {
        label = `출발 ${d}일 전`;
      }
    }
    const value = s.penaltyRate > 0 ? `여행 요금의 ${s.penaltyRate}%` : '위약금 없음';
    return { label, value };
  });
}

/**
 * 임의의 refundPolicy 입력값을 RefundPolicyJson({slots}) 으로 정규화.
 * - 이미 {slots} 객체면 그대로 반환
 * - 배열({label,value}[] 또는 RefundSlot[])이면 slots 로 감싸 반환(레거시 호환)
 * - 그 외(null/undefined/형식불명)면 null
 */
export function normalizeRefundPolicy(raw: unknown): RefundPolicyJson | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as RefundPolicyJson).slots)) {
    return raw as RefundPolicyJson;
  }
  if (Array.isArray(raw) && raw.length > 0) {
    // RefundSlot[] (daysBeforeDep/penaltyRate 보유) 형태면 구조화로 인정
    const first = raw[0] as Record<string, unknown>;
    if (typeof first?.daysBeforeDep === 'number' && typeof first?.penaltyRate === 'number') {
      return { slots: raw as RefundSlot[], isStructured: true };
    }
  }
  return null;
}

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
