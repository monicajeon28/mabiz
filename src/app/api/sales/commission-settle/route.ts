/**
 * GET /api/sales/commission-settle
 * POST /api/sales/commission-settle
 *
 * 월별 정산 관리 (관리자만)
 * - 월별 정산 현황 조회
 * - 정산 내역 생성/승인/거절
 *
 * 쿼리 파라미터 (GET):
 * - month: YYYY-MM 형식 (예: 2026-06)
 * - status: PENDING, APPROVED, REJECTED (선택사항)
 *
 * 요청 본문 (POST):
 * {
 *   "month": "2026-06",
 *   "teamId": "team_a",
 *   "action": "APPROVE" | "REJECT" | "CALCULATE"
 * }
 *
 * 응답 예시:
 * {
 *   "success": true,
 *   "data": {
 *     "month": "2026-06",
 *     "settlementId": "settle_123",
 *     "totalSalesRevenue": 52500000,
 *     "totalCommission": 7875000,
 *     "members": [
 *       {
 *         "userId": "user_123",
 *         "name": "김철수",
 *         "salesRevenue": 5250000,
 *         "commissionRate": 15,
 *         "commission": 787500,
 *         "status": "APPROVED",
 *         "paidDate": "2026-07-05T10:30:00Z"
 *       }
 *     ],
 *     "createdAt": "2026-06-30T18:00:00Z"
 *   }
 * }
 */

import { getServerSession } from 'next-auth/next';
import { canSettleCommission, validateSettlementPermission } from '@/lib/sales-permissions';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit-logger';

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // 📌 Step 1: 사용자 확인
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

    const user = await prisma.organizationMember.findFirst({
      where: { email: session.user.email },
      select: { id: true, email: true, role: true, organizationId: true, displayName: true },
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

    // 📌 Step 2: 권한 체크 (관리자만)
    const permissionCheck = validateSettlementPermission(user.role);

    if (!permissionCheck.isValid) {
      return new Response(
        JSON.stringify({
          error: permissionCheck.error || '정산 관리 권한이 없습니다',
          code: 'SETTLEMENT_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 📌 Step 3: URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM
    const status = searchParams.get('status'); // PENDING, APPROVED, REJECTED

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return new Response(
        JSON.stringify({
          error: '올바른 월 형식이 아닙니다 (YYYY-MM)',
          code: 'INVALID_MONTH',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 📌 Step 4: 정산 현황 조회
    // 실제 구현 시 Settlement 테이블 추가 필요
    // 여기서는 Contact 데이터로 동적 계산

    const [startDate, endDate] = getMonthDateRange(month);

    const contacts = await prisma.contact.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
        status: 'COMPLETED',
      },
      select: { id: true, createdBy: true },
    });

    // 팀원별 정산 내역 계산
    const settlementMap = new Map<
      string,
      {
        userId: string;
        email: string | null;
        name: string;
        salesRevenue: number;
        orderCount: number;
      }
    >();

    for (const contact of contacts) {
      if (contact.createdBy) {
        const member = await prisma.organizationMember.findFirst({
          where: { email: contact.createdBy },
          select: { id: true, email: true, displayName: true },
        });

        if (member) {
          const key = member.id;
          if (!settlementMap.has(key)) {
            settlementMap.set(key, {
              userId: key,
              email: member.email,
              name: member.displayName || '미정',
              salesRevenue: 0,
              orderCount: 0,
            });
          }

          const item = settlementMap.get(key)!;
          // Contact에 금액 필드가 없으므로 건수만 집계
          item.salesRevenue += 0;
          item.orderCount += 1;
        }
      }
    }

    // 수수료 계산 (기본값: 15%)
    const commissionRate = 15;
    const members = Array.from(settlementMap.values()).map((item) => ({
      ...item,
      commissionRate,
      commission: Math.round(item.salesRevenue * (commissionRate / 100)),
      status: status || 'PENDING',
      paidDate: null,
    }));

    const totalSalesRevenue = members.reduce((sum, m) => sum + m.salesRevenue, 0);
    const totalCommission = members.reduce((sum, m) => sum + m.commission, 0);

    // 📌 Step 5: 응답 반환
    const responseData = {
      success: true,
      data: {
        month,
        settlementId: `settle_${month.replace('-', '')}`,
        totalSalesRevenue,
        totalCommission,
        memberCount: members.length,
        members: members.sort((a, b) => b.salesRevenue - a.salesRevenue),
        summary: {
          avgSalesPerMember: Math.round(totalSalesRevenue / Math.max(1, members.length)),
          avgCommissionPerMember: Math.round(totalCommission / Math.max(1, members.length)),
        },
        createdAt: new Date().toISOString(),
      },
      metadata: {
        executionTime: `${Date.now() - startTime}ms`,
      },
    };

    console.log(
      `[Sales/CommissionSettle] Admin ${user.email} fetched settlement for ${month}`,
      {
        totalSalesRevenue,
        totalCommission,
        memberCount: members.length,
      }
    );

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ /api/sales/commission-settle GET 오류:', error);

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

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // 📌 Step 1: 사용자 확인
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

    const user = await prisma.organizationMember.findFirst({
      where: { email: session.user.email },
      select: { id: true, email: true, role: true, organizationId: true, displayName: true },
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
    if (!canSettleCommission(user.role)) {
      return new Response(
        JSON.stringify({
          error: '정산을 처리할 권한이 없습니다',
          code: 'SETTLEMENT_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 📌 Step 3: 요청 본문 파싱
    const body = await request.json();
    const { month, userId, action } = body;

    if (!month || !action) {
      return new Response(
        JSON.stringify({
          error: '월과 액션은 필수입니다',
          code: 'INVALID_INPUT',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return new Response(
        JSON.stringify({
          error: '올바른 월 형식이 아닙니다 (YYYY-MM)',
          code: 'INVALID_MONTH',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validActions = ['APPROVE', 'REJECT', 'RECALCULATE'];
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({
          error: `유효한 액션이 아닙니다: ${validActions.join(', ')}`,
          code: 'INVALID_ACTION',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 📌 Step 4: 액션 처리
    let result: Record<string, any> = {
      month,
      action,
      processedAt: new Date().toISOString(),
    };

    if (action === 'APPROVE') {
      // 정산 승인 로직
      result.status = 'APPROVED';
      result.message = `${month} 정산이 승인되었습니다`;

      console.log(
        `[Sales/CommissionSettle] Admin ${user.email} approved settlement for ${month}`
      );
    } else if (action === 'REJECT') {
      // 정산 거절 로직
      result.status = 'REJECTED';
      result.message = `${month} 정산이 거절되었습니다`;

      console.log(
        `[Sales/CommissionSettle] Admin ${user.email} rejected settlement for ${month}`
      );
    } else if (action === 'RECALCULATE') {
      // 정산 재계산 로직
      result.status = 'RECALCULATING';
      result.message = `${month} 정산을 재계산 중입니다`;

      console.log(
        `[Sales/CommissionSettle] Admin ${user.email} recalculated settlement for ${month}`
      );
    }

    // 📌 Step 5: 감사 로그 기록 (성공)
    const duration = Date.now() - startTime;
    const userOrgId = user.organizationId || user.id || '';
    await createAuditLog({
      organizationId: userOrgId,
      userId: user.id,
      userEmail: user.email || 'unknown@example.com',
      userName: user.displayName || undefined,
      action: 'SETTLE',
      resource: 'COMMISSION',
      resourceId: `settle_${month}`,
      status: 'SUCCESS',
      changes: {
        before: { status: 'PENDING' },
        after: { status: result.status },
      },
      duration,
    });

    // 📌 Step 6: 응답 반환
    const responseData = {
      success: true,
      data: {
        ...result,
        executionTime: `${duration}ms`,
      },
      metadata: {
        processedBy: user.email,
        timestamp: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ /api/sales/commission-settle POST 오류:', error);

    const errorMessage =
      error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';

    // 감사 로그 기록 (실패)
    const duration = Date.now() - startTime;
    try {
      const session = await getServerSession();
      const user = await prisma.organizationMember.findFirst({
        where: { email: session?.user?.email },
        select: { id: true, email: true, organizationId: true },
      });

      if (user) {
        const userOrgId = user.organizationId || user.id || '';
        await createAuditLog({
          organizationId: userOrgId,
          userId: user.id,
          userEmail: user.email || 'unknown@example.com',
          action: 'SETTLE',
          resource: 'COMMISSION',
          status: 'FAILURE',
          errorCode: 'SETTLE_ERROR',
          errorMessage: errorMessage,
          duration,
        });
      }
    } catch (auditError) {
      console.error('감사 로그 기록 실패:', auditError);
    }

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

// ============================================
// 유틸리티: 월의 시작과 끝 날짜
// ============================================

function getMonthDateRange(month: string): [Date, Date] {
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 1);
  return [startDate, endDate];
}
