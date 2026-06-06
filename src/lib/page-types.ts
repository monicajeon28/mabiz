// B2B/B2C 구분 정의
export const PAGE_TYPES = {
  B2B: 'b2b',  // 랜딩페이지 + 페이앱 결제
} as const;

// B2B 페이지 판단 함수
export function isB2BPage(slug: string): boolean {
  return slug.startsWith(PAGE_TYPES.B2B);
}

// B2B 버튼 텍스트
export const B2B_CTA_TEXT = '지금 신청하기 (조조 할인 보장)';

// B2B 완료 메시지
export const B2B_COMPLETION_MESSAGE = '조조 할인은 6월 말까지만 유효합니다. 담당자가 빠르면 1시간 이내로 연락드립니다.';
