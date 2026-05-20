import { redirect } from 'next/navigation';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const metadata = {
  title: '연말정산',
  description: '연말정산 정보',
};

interface YearEndReportLayoutProps {
  children: React.ReactNode;
}

/**
 * Year-End Report Layout - P2 (연말정산 정보)
 *
 * 역할 검증:
 * - GLOBAL_ADMIN, OWNER, AGENT만 접근 허용
 * - FREE_SALES 차단 (고객 DB 접근 권한 없음)
 * - 서버 사이드 검증
 * - 비허가 접근 시 /dashboard로 리다이렉트
 *
 * 주의:
 * - AGENT는 자신의 연말정산 정보만 조회 가능
 * - OWNER는 소속 조직의 AGENT들 정산 정보 조회 가능
 * - GLOBAL_ADMIN은 모든 정산 정보 조회 가능
 * - 세금 관련 민감한 정보 포함
 */
export default async function YearEndReportLayout({ children }: YearEndReportLayoutProps) {
  const ctx = await getMabizSession();

  // 세션 없음
  if (!ctx) {
    logger.warn('year-end-report.layout: no session found');
    redirect('/sign-in');
  }

  // 조직 없음
  if (!ctx.organizationId && ctx.role !== 'GLOBAL_ADMIN') {
    logger.warn(`year-end-report.layout: no organization - userId=${ctx.userId}`);
    redirect('/sign-in');
  }

  // FREE_SALES는 접근 불가
  const validRoles = ['GLOBAL_ADMIN', 'OWNER', 'AGENT'];
  if (!validRoles.includes(ctx.role)) {
    logger.warn(
      `year-end-report.layout: unauthorized access - role=${ctx.role}, userId=${ctx.userId}`
    );
    redirect('/dashboard');
  }

  // 권한 확인 완료
  return <>{children}</>;
}
