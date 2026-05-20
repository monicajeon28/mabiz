/**
 * PNR Layout - Public Customer + Authenticated Agent
 *
 * 특수한 케이스:
 * - 공개 페이지 (고객이 휴대폰으로 본인인증 후 접근)
 * - 또는 로그인한 에이전트/관리자 (빠른 테스트 목적)
 *
 * 접근 흐름:
 * 1. 공개 모드 (기본):
 *    - 휴대폰 번호 입력 → 예약 정보 조회 → PNR 작성
 *    - 세션 불필요
 *
 * 2. 에이전트 모드 (선택사항):
 *    - /api/auth/me 호출로 로그인 상태 확인
 *    - OWNER/AGENT/GLOBAL_ADMIN 역할만 허용
 *    - 공개 예약 정보 조회 가능
 *
 * 주의: 이 레이아웃은 기본적으로 공개이며,
 * 세션 검증은 클라이언트 컴포넌트에서 처리됨
 */

export const metadata = {
  title: 'PNR 등록',
  description: '여행자 정보 및 객실 배정 등록',
};

interface PnrLayoutProps {
  children: React.ReactNode;
}

export default function PnrLayout({ children }: PnrLayoutProps) {
  // 이 레이아웃은 공개 페이지이므로 서버 사이드 리다이렉트 없음
  // 클라이언트 로직에서 인증 상태 확인 후 처리
  return <>{children}</>;
}
