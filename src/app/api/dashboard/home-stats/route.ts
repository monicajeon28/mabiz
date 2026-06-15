/**
 * GET /api/dashboard/home-stats
 *
 * 50대 관리자용 홈 대시보드 메트릭
 *
 * 역할별 필터링:
 * - GLOBAL_ADMIN: 전체 조직 데이터
 * - OWNER: 팀 에이전트 담당 고객만
 * - AGENT: 본인 담당 고객만
 *
 * 반환:
 * {
 *   ok: boolean,
 *   stats: DashboardHomeStats,
 *   error?: string
 * }
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { getHomeDashboardMetrics } from '@/lib/dashboard-home-metrics';

export async function GET() {
  try {
    const ctx = await getMabizSession();
    if (!ctx || !ctx.organizationId) {
      return NextResponse.json(
        { ok: false, error: '인증 필요' },
        { status: 401 }
      );
    }

    // 메트릭 계산
    const stats = await getHomeDashboardMetrics({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      role: (ctx.role || 'GLOBAL_ADMIN') as 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT',
    });

    return NextResponse.json({
      ok: true,
      stats,
    });
  } catch (err) {
    console.error('[dashboard/home-stats] error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : '서버 오류',
      },
      { status: 500 }
    );
  }
}
