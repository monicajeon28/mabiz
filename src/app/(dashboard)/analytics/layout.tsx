import { redirect } from 'next/navigation';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const metadata = {
  title: '분석',
  description: '마케팅 비용 및 성과 분석',
};

interface AnalyticsLayoutProps {
  children: React.ReactNode;
}

/**
 * Analytics Layout - P2 (마케팅 비용/성과 분석)
 *
 * 역할 검증:
 * - GLOBAL_ADMIN, OWNER, AGENT만 접근 허용
 * - FREE_SALES 차단
 * - 서버 사이드 검증
 * - 비허가 접근 시 /dashboard로 리다이렉트
 *
 * 주의:
 * - OWNER/AGENT: 자신의 조직의 마케팅 비용만 조회
 * - GLOBAL_ADMIN: 모든 조직의 마케팅 비용 조회 가능
 * - SMS/Email 비용 데이터 포함 (민감한 비즈니스 정보)
 */
export default async function AnalyticsLayout({ children }: AnalyticsLayoutProps) {
  const ctx = await getMabizSession();

  // 세션 없음
  if (!ctx) {
    logger.warn('analytics.layout: no session found');
    redirect('/sign-in');
  }

  // 조직 없음
  if (!ctx.organizationId && ctx.role !== 'GLOBAL_ADMIN') {
    logger.warn(`analytics.layout: no organization - userId=${ctx.userId}`);
    redirect('/sign-in');
  }

  // FREE_SALES는 접근 불가
  const validRoles = ['GLOBAL_ADMIN', 'OWNER', 'AGENT'];
  if (!validRoles.includes(ctx.role)) {
    logger.warn(
      `analytics.layout: unauthorized access - role=${ctx.role}, userId=${ctx.userId}`
    );
    redirect('/dashboard');
  }

  // 권한 확인 완료
  return <>{children}</>;
}
