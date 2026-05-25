import { redirect } from 'next/navigation';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '대리점현황',
  description: '대리점 현황 및 관리',
};

interface PartnerDashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Partner Dashboard Layout - P2 (대리점 현황 관리)
 *
 * 역할 검증:
 * - GLOBAL_ADMIN, OWNER만 접근 허용
 * - AGENT, FREE_SALES 차단
 * - 서버 사이드 검증
 * - 비허가 접근 시 /dashboard로 리다이렉트
 *
 * 주의:
 * - OWNER: 자신의 조직 소속 AGENT들의 현황만 조회 가능
 * - GLOBAL_ADMIN: 모든 대리점/AGENT 현황 조회 가능
 * - 수수료, 계약 상태, 처리 상황 등 민감한 비즈니스 데이터 포함
 */
export default async function PartnerDashboardLayout({ children }: PartnerDashboardLayoutProps) {
  const ctx = await getMabizSession();

  // 세션 없음
  if (!ctx) {
    logger.warn('partner-dashboard.layout: no session found');
    redirect('/sign-in');
  }

  // 조직 없음
  if (!ctx.organizationId && ctx.role !== 'GLOBAL_ADMIN') {
    logger.warn(`partner-dashboard.layout: no organization - userId=${ctx.userId}`);
    redirect('/sign-in');
  }

  // OWNER 또는 GLOBAL_ADMIN만 접근 가능
  const validRoles = ['GLOBAL_ADMIN', 'OWNER'];
  if (!validRoles.includes(ctx.role)) {
    logger.warn(
      `partner-dashboard.layout: unauthorized access - role=${ctx.role}, userId=${ctx.userId}`
    );
    redirect('/dashboard');
  }

  // 권한 확인 완료
  return <>{children}</>;
}
