import { redirect } from 'next/navigation';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '계약서 관리',
  description: '계약서 템플릿 관리 페이지',
};

interface ContractsLayoutProps {
  children: React.ReactNode;
}

/**
 * Contracts Layout - 관리자 전용
 *
 * 역할 검증:
 * - GLOBAL_ADMIN만 접근 허용
 * - 서버 사이드 검증 (캐시되지 않음)
 * - 비허가 접근 시 /dashboard로 리다이렉트
 *
 * 보호되는 페이지:
 * - /contracts
 * - /contracts/templates
 */
export default async function ContractsLayout({ children }: ContractsLayoutProps) {
  const ctx = await getMabizSession();

  // 세션 없음 → 로그인 페이지로
  if (!ctx?.organizationId && ctx?.role !== 'GLOBAL_ADMIN') {
    logger.warn('contracts.layout: unauthorized access attempt - no session');
    redirect('/sign-in');
  }

  // GLOBAL_ADMIN이 아님 → 대시보드로
  if (ctx.role !== 'GLOBAL_ADMIN') {
    logger.warn(`contracts.layout: unauthorized access - role=${ctx.role}, userId=${ctx.userId}`);
    redirect('/dashboard');
  }

  // 권한 확인 완료 - 콘텐츠 렌더링
  return <>{children}</>;
}
