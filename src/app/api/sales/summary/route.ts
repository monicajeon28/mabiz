/**
 * GET /api/sales/summary
 *
 * 대시보드 통계 조회 (권한별)
 * - 관리자: 회사 전체 통계
 * - 대리점장: 자신의 팀 통계
 * - 판매원: 자신의 주문 통계
 *
 * 응답 예시:
 * {
 *   "success": true,
 *   "data": {
 *     "totalOrders": 15,
 *     "totalRevenue": 5250000,
 *     "completedOrders": 10,
 *     "pendingOrders": 5,
 *     "conversionRate": 66.7,
 *     "avgOrderValue": 350000
 *   },
 *   "appliedRole": "OWNER",
 *   "timestamp": "2026-06-18T10:30:00Z"
 * }
 */

import { getServerSession } from 'next-auth/next';
import {
  canViewTeamData,
  getAppliedFilters,
  validatePermission,
} from '@/lib/sales-permissions';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // 📌 Step 1: 현재 사용자 정보 가져오기
    const session = await getServerSession();

    if (!session?.user?.email) {
      return new Response(
        JSON.stringify({
          error: '로그인이 필요합니다',
          code: 'AUTH_REQUIRED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 현재 사용자의 역할, 팀 정보
    const user = await prisma.organizationMember.findFirst({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        role: true,
        managerId: true,
      },
    });

    if (!user) {
      return new Response(
        JSON.stringify({
          error: '사용자를 찾을 수 없습니다',
          code: 'USER_NOT_FOUND',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 📌 Step 2: 권한 체크
    const permissionCheck = validatePermission(
      user.role,
      user.id,
      user.managerId
    );

    if (!permissionCheck.isValid) {
      return new Response(
        JSON.stringify({
          error: permissionCheck.error || '권한이 없습니다',
          code: 'PERMISSION_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 📌 Step 3: 필터 자동 적용
    const filters = getAppliedFilters(user.role, user.email, user.managerId);

    if (filters === null) {
      return new Response(
        JSON.stringify({
          error: '권한이 없습니다',
          code: 'INVALID_ROLE',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 📌 Step 4: 데이터 조회
    // 주문 통계 조회 (필터 적용)
    const orderStats = await prisma.contact.groupBy({
      by: ['status'],
      where: filters as Parameters<typeof prisma.contact.groupBy>[0]['where'],
      _count: {
        id: true,
      },
    });

    // 상태별로 파싱
    const statsByStatus: Record<string, { count: number; totalRevenue: number }> = {};

    orderStats.forEach((stat) => {
      const statusKey = stat.status || 'unknown';
      statsByStatus[statusKey] = {
        count: stat._count?.id ?? 0,
        totalRevenue: 0,
      };
    });

    const completedOrders = statsByStatus['COMPLETED']?.count || 0;
    const pendingOrders = statsByStatus['PENDING']?.count || 0;
    const inProgressOrders = statsByStatus['IN_PROGRESS']?.count || 0;
    const totalOrders =
      completedOrders + pendingOrders + inProgressOrders;

    const totalRevenue = Object.values(statsByStatus).reduce(
      (sum, stat) => sum + stat.totalRevenue,
      0
    );

    // 평균 주문액
    const avgOrderValue =
      totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // 전환율 (완료된 주문 / 전체 주문 × 100)
    const conversionRate =
      totalOrders > 0
        ? parseFloat(((completedOrders / totalOrders) * 100).toFixed(1))
        : 0;

    // 수익률 (성공 주문 기준)
    const profitMargin = completedOrders > 0 ? 15.5 : 0; // 예시값

    // 📌 Step 5: 응답 반환
    const responseData = {
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        completedOrders,
        inProgressOrders,
        pendingOrders,
        conversionRate,
        profitMargin,
        avgOrderValue,
        lastUpdated: new Date().toISOString(),
      },
      metadata: {
        appliedRole: user.role,
        filteredByTeam: user.role === 'OWNER' ? user.managerId : null,
        filteredByUser: user.role === 'AGENT' ? user.id : null,
        executionTime: `${Date.now() - startTime}ms`,
      },
    };

    console.log(
      `[Sales/Summary] User ${user.email} (${user.role}) fetched summary`,
      {
        totalOrders,
        totalRevenue,
      }
    );

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ /api/sales/summary 오류:', error);

    const errorMessage =
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';

    return new Response(
      JSON.stringify({
        error: '서버 오류가 발생했습니다',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
