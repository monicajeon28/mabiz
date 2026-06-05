// 회사 정보 / 취소·환불 규정 단일 출처 (서버 route + 클라이언트 컴포넌트 공유)
// 'use client' 없음 — 양쪽에서 import 가능. 한 곳만 고치면 미리보기와 실제 발송 문서가 함께 갱신됨.

export const COMPANY_INFO = {
  name: '크루즈닷',
  ceo: '배연성',
  hqPhone: '010-3289-3800',
  bankName: '국민은행',
  bankAccount: '531301-04-167150',
  bankHolder: '배연성',
} as const;

// 계좌이체 안내 문구 (구매확인/계약서 결제수단 표기 공통)
export const BANK_TRANSFER_LABEL =
  `계좌이체 (${COMPANY_INFO.bankName} ${COMPANY_INFO.bankAccount} / 예금주: ${COMPANY_INFO.bankHolder})`;

// 환불 입금 계좌 안내 문구 (환불증서 companyAccount 표기용)
export const REFUND_ACCOUNT_LABEL =
  `${COMPANY_INFO.bankName} ${COMPANY_INFO.bankAccount} (${COMPANY_INFO.bankHolder}/${COMPANY_INFO.name})`;

// 취소·환불 규정 (관광진흥법 시행령 기준 요약) — 미리보기/실제 계약서 공통
export const CANCELLATION_POLICY: { label: string; value: string }[] = [
  { label: '출발 30일 이전', value: '위약금 없음' },
  { label: '출발 20일 이전', value: '여행 요금의 10%' },
  { label: '출발 10일 이전', value: '여행 요금의 15%' },
  { label: '출발 8일 이전', value: '여행 요금의 20%' },
  { label: '출발 1일 이전', value: '여행 요금의 30%' },
  { label: '출발 당일', value: '여행 요금의 50%' },
];

// 서버 generatedData 저장용 문자열 배열 ("출발 30일 이전: 위약금 없음")
export const CANCELLATION_POLICY_LINES = CANCELLATION_POLICY.map(
  (p) => `${p.label}: ${p.value}`,
);
