import { redirect } from 'next/navigation';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '팀',
  description: '팀 관리',
};

interface TeamLayoutProps {
  children: React.ReactNode;
}

/**
 * Team Layout - P2 (팀 관리 페이지)
 *
 * 역할 검증:
 * - OWNER, AGENT 역할만 접근 허용
 * - FREE_SALES 차단
 * - 서버 사이드 검증 (매 로드마다 실시, 캐시 없음)
 * - 비허가 접근 시 /dashboard로 리다이렉트
 *
 * 보호되는 페이지:
 * - /team (팀 대시보드)
 * - /team/affiliate (제휴사 관리)
 */
export default async function TeamLayout({ children }: TeamLayoutProps) {
  const ctx = await getMabizSession();

  // 세션 없음 → 로그인 페이지로
  if (!ctx) {
    logger.warn('team.layout: no session found');
    redirect('/sign-in');
  }

  // 조직 없음 → 로그인 페이지로
  if (!ctx.organizationId) {
    logger.warn(`team.layout: no organization - userId=${ctx.userId}`);
    redirect('/sign-in');
  }

  // FREE_SALES는 팀 관리 접근 불가
  const validRoles = ['OWNER', 'AGENT', 'GLOBAL_ADMIN'];
  if (!validRoles.includes(ctx.role)) {
    logger.warn(
      `team.layout: unauthorized access - role=${ctx.role}, userId=${ctx.userId}, orgId=${ctx.organizationId}`
    );
    redirect('/dashboard');
  }

  // 권한 확인 완료 - 콘텐츠 렌더링
  return <>{children}</>;
}
