import { redirect } from 'next/navigation';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const metadata = {
  title: '급여명세',
  description: '급여 및 수수료 명세',
};

interface PayslipsLayoutProps {
  children: React.ReactNode;
}

/**
 * Payslips Layout - P2 (급여/수수료 정보)
 *
 * 역할 검증:
 * - GLOBAL_ADMIN, OWNER, AGENT만 접근 허용
 * - FREE_SALES 차단 (고객 DB 접근 권한 없음)
 * - 서버 사이드 검증
 * - 비허가 접근 시 /dashboard로 리다이렉트
 *
 * 주의:
 * - AGENT는 자신의 급여/수수료만 조회 가능 (API 레벨에서 필터링)
 * - OWNER는 소속 조직의 AGENT들 급여 조회 가능
 * - GLOBAL_ADMIN은 모든 급여 조회 가능
 */
export default async function PayslipsLayout({ children }: PayslipsLayoutProps) {
  const ctx = await getMabizSession();

  // 세션 없음
  if (!ctx) {
    logger.warn('payslips.layout: no session found');
    redirect('/sign-in');
  }

  // 조직 없음 (FREE_SALES 또는 인증 실패)
  if (!ctx.organizationId && ctx.role !== 'GLOBAL_ADMIN') {
    logger.warn(`payslips.layout: no organization - userId=${ctx.userId}`);
    redirect('/sign-in');
  }

  // FREE_SALES는 접근 불가
  const validRoles = ['GLOBAL_ADMIN', 'OWNER', 'AGENT'];
  if (!validRoles.includes(ctx.role)) {
    logger.warn(
      `payslips.layout: unauthorized access - role=${ctx.role}, userId=${ctx.userId}`
    );
    redirect('/dashboard');
  }

  // 권한 확인 완료
  return <>{children}</>;
}
