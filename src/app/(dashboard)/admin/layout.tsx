import { redirect } from 'next/navigation';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '관리자',
  description: '관리자 페이지',
};

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Admin Layout - P2 (관리자 페이지 전용)
 *
 * 역할 검증:
 * - GLOBAL_ADMIN만 접근 허용
 * - 서버 사이드 검증 (캐시되지 않음)
 * - 비허가 접근 시 /dashboard로 리다이렉트
 *
 * 보호되는 페이지:
 * - /admin/organizations
 * - /admin/partner-applications
 * - /admin/partner-suspensions
 * - /admin/affiliate-sales-by-partner
 * - /admin/groups-stats
 * - /admin/backup-status
 * - /admin/sending-monitor
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const ctx = await getMabizSession();

  // 세션 없음 → 로그인 페이지로
  if (!ctx) {
    logger.warn('admin.layout: 세션 없음 → 로그인으로');
    redirect('/sign-in');
  }

  // GLOBAL_ADMIN이 아님 → 대시보드로
  if (ctx.role !== 'GLOBAL_ADMIN') {
    logger.warn(`admin.layout: 권한 없음 — role=${ctx.role}, userId=${ctx.userId}`);
    redirect('/dashboard');
  }

  // 권한 확인 완료 - 콘텐츠 렌더링
  return <>{children}</>;
}
