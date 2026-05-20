import { redirect } from 'next/navigation';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const metadata = {
  title: '매출현황',
  description: '수수료 및 매출 현황',
};

interface StatementsLayoutProps {
  children: React.ReactNode;
}

/**
 * Statements Layout - P2 (매출/수수료 현황)
 *
 * 역할 검증:
 * - GLOBAL_ADMIN, OWNER, AGENT만 접근 허용
 * - FREE_SALES 차단
 * - 서버 사이드 검증
 * - 비허가 접근 시 /dashboard로 리다이렉트
 *
 * 주의:
 * - AGENT: 자신의 매출/수수료 현황만 조회 가능
 * - OWNER: 소속 조직의 AGENT들 매출 현황 조회 가능
 * - GLOBAL_ADMIN: 모든 매출 현황 조회 가능
 * - 수수료율, 완료/승인 상태 등 민감한 데이터 포함
 */
export default async function StatementsLayout({ children }: StatementsLayoutProps) {
  const ctx = await getMabizSession();

  // 세션 없음
  if (!ctx) {
    logger.warn('statements.layout: no session found');
    redirect('/sign-in');
  }

  // 조직 없음
  if (!ctx.organizationId && ctx.role !== 'GLOBAL_ADMIN') {
    logger.warn(`statements.layout: no organization - userId=${ctx.userId}`);
    redirect('/sign-in');
  }

  // FREE_SALES는 접근 불가 (자신의 매출만 조회 가능하지만, 일단 차단)
  const validRoles = ['GLOBAL_ADMIN', 'OWNER', 'AGENT'];
  if (!validRoles.includes(ctx.role)) {
    logger.warn(
      `statements.layout: unauthorized access - role=${ctx.role}, userId=${ctx.userId}`
    );
    redirect('/dashboard');
  }

  // 권한 확인 완료
  return <>{children}</>;
}
