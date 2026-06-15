import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

/**
 * GET /api/unsubscribed/stats
 * 수신거부 통계 조회 (RBAC: AGENT 이상)
 *
 * Query Params:
 * - organizationId: string (선택, GLOBAL_ADMIN만 사용 가능)
 *
 * 응답:
 * {
 *   ok: true,
 *   total: number,          // 누적 수신거부 수
 *   thisMonth: number,      // 이번 달 수신거부 수
 *   thisWeek: number,       // 지난 7일 수신거부 수
 *   percentage: string,     // 이번 달 / 누적 비율 (%)
 *   organizationName: string
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getMabizSession();
    if (!session?.userId) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 권한 확인 (AGENT 이상: AGENT, OWNER, GLOBAL_ADMIN)
    const allowedRoles = ['AGENT', 'OWNER', 'GLOBAL_ADMIN'];
    if (!allowedRoles.includes(session.role)) {
      // 감사 로깅: 권한 없음 시도
      logger.warn('[UnsubscribedStats] 권한 없음', {
        userId: session.userId,
        userRole: session.role,
        organizationId: session.organizationId,
      });
      return NextResponse.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 3. 조직 ID 결정
    let organizationId = session.organizationId || '';
    if (!organizationId && session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'Organization not found' },
        { status: 400 }
      );
    }

    // GLOBAL_ADMIN인 경우 쿼리 파라미터의 organizationId를 사용할 수 있음
    if (session.role === 'GLOBAL_ADMIN') {
      const paramOrgId = req.nextUrl.searchParams.get('organizationId');
      if (paramOrgId) {
        organizationId = paramOrgId;
      }
    }

    // 4. 기간별 필터 준비
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 5. 병렬 통계 조회
    const [total, monthCount, weekCount] = await Promise.all([
      prisma.unsubscribed.count({
        where: { organizationId },
      }),
      prisma.unsubscribed.count({
        where: {
          organizationId,
          createdAt: { gte: thisMonth },
        },
      }),
      prisma.unsubscribed.count({
        where: {
          organizationId,
          createdAt: { gte: thisWeek },
        },
      }),
    ]);

    // 6. 조직명 조회
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    // 7. 감사 로깅
    logger.info('[UnsubscribedStats] 통계 조회', {
      organizationId,
      userId: session.userId,
      role: session.role,
      total,
      thisMonth: monthCount,
      thisWeek: weekCount,
    });

    // 8. 응답
    return NextResponse.json({
      ok: true,
      total,
      thisMonth: monthCount,
      thisWeek: weekCount,
      percentage:
        total > 0 ? ((monthCount / total) * 100).toFixed(1) : '0',
      organizationName: organization?.name || '알수없음',
    });
  } catch (error) {
    logger.error('[UnsubscribedStats] 에러:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '조회 실패',
      },
      { status: 500 }
    );
  }
}
