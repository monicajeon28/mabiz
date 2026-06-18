/**
 * POST /api/sales/dispute
 * GET /api/sales/dispute
 *
 * 정산 이의 제기 관리 (관리자/대리점장만)
 * - 정산 내역에 대한 이의 제기
 * - 이의 현황 조회
 * - 이의 처리 (승인/거절)
 *
 * 요청 본문 (POST):
 * {
 *   "settlementMonth": "2026-06",
 *   "userId": "user_123",
 *   "reason": "수수료 계산 오류",
 *   "description": "주문 2건이 중복 계산되었습니다",
 *   "attachedFiles": ["file_123"]
 * }
 *
 * 응답 예시:
 * {
 *   "success": true,
 *   "data": {
 *     "disputeId": "dispute_123",
 *     "settlementMonth": "2026-06",
 *     "userId": "user_123",
 *     "reason": "수수료 계산 오류",
 *     "status": "PENDING",
 *     "createdAt": "2026-07-02T10:30:00Z",
 *     "updatedAt": "2026-07-02T10:30:00Z"
 *   }
 * }
 */

import { getServerSession } from 'next-auth/next';
import { canDispute, validatePermission } from '@/lib/sales-permissions';
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
      select: { id: true, email: true, role: true, managerId: true, organizationId: true, displayName: true },
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
      user.email,
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

    // 📌 Step 3: 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const settlementMonth = searchParams.get('month');
    const status = searchParams.get('status'); // PENDING, APPROVED, REJECTED
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '10', 10)));

    // 📌 Step 4: 필터 구성
    let whereFilter: Record<string, any> = {};

    if (user.role === 'GLOBAL_ADMIN') {
      // 관리자: 전체 이의 조회
    } else if (user.role === 'OWNER') {
      // 대리점장: 자신의 직속 팀원 이의만 (managerId = user.id)
      whereFilter = {
        user: {
          managerId: user.id,
        },
      };
    } else {
      // 판매원: 자신의 이의만
      whereFilter = {
        userEmail: user.email,
      };
    }

    // 월별 필터
    if (settlementMonth) {
      whereFilter.settlementMonth = settlementMonth;
    }

    // 상태 필터
    if (status) {
      whereFilter.status = status;
    }

    // 📌 Step 5: 데이터 조회 (Dispute 테이블 가정)
    // 실제 구현 시 테이블 추가 필요
    // 현재는 구조만 제시

    const disputes: Record<string, any>[] = []; // await prisma.dispute.findMany({ where: whereFilter, ... })
    const totalCount = 0; // await prisma.dispute.count({ where: whereFilter })

    // 📌 Step 6: 응답 반환
    const responseData = {
      success: true,
      data: disputes,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      metadata: {
        appliedRole: user.role,
        executionTime: `${Date.now() - startTime}ms`,
      },
    };

    console.log(
      `[Sales/Dispute] User ${user.email} (${user.role}) fetched disputes`,
      {
        month: settlementMonth,
        status,
        count: disputes.length,
      }
    );

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ /api/sales/dispute GET 오류:', error);

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
      select: { id: true, email: true, role: true, managerId: true, organizationId: true, displayName: true },
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

    // 📌 Step 2: 권한 체크 (이의 제기 권한: 관리자/대리점장)
    if (!canDispute(user.role)) {
      return new Response(
        JSON.stringify({
          error: '이의를 제기할 권한이 없습니다 (관리자/대리점장만)',
          code: 'DISPUTE_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 📌 Step 3: 요청 본문 파싱
    const body = await request.json();
    const {
      settlementMonth,
      userId,
      reason,
      description,
      attachedFiles,
    } = body;

    // 필수 필드 검증
    if (!settlementMonth || !userId || !reason) {
      return new Response(
        JSON.stringify({
          error: '정산월, 사용자, 사유는 필수입니다',
          code: 'INVALID_INPUT',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!/^\d{4}-\d{2}$/.test(settlementMonth)) {
      return new Response(
        JSON.stringify({
          error: '올바른 월 형식이 아닙니다 (YYYY-MM)',
          code: 'INVALID_MONTH',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 📌 Step 4: 대리점장 권한 체크
    // 대리점장은 자신의 팀원 이의만 제기 가능
    if (user.role === 'OWNER') {
      const targetUser = await prisma.organizationMember.findUnique({
        where: { id: userId },
        select: { managerId: true },
      });

      // 대리점장은 자신이 관리하는 팀원(managerId = 본인 id)의 이의만 제기 가능
      if (!targetUser || targetUser.managerId !== user.id) {
        return new Response(
          JSON.stringify({
            error: '다른 팀의 이의를 제기할 수 없습니다',
            code: 'TEAM_MISMATCH',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 📌 Step 5: 이의 생성
    // 실제 구현 시 Dispute 테이블 추가 필요
    const disputeId = `dispute_${Date.now()}`;

    const newDispute = {
      disputeId,
      settlementMonth,
      userId,
      reason,
      description: description || null,
      status: 'PENDING',
      attachedFiles: attachedFiles || [],
      createdBy: user.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 실제: await prisma.dispute.create({ data: newDispute })

    // 📌 Step 6: 알림 발송 (옵션)
    console.log(
      `[Sales/Dispute] User ${user.email} (${user.role}) created dispute`,
      {
        disputeId,
        settlementMonth,
        userId,
        reason,
      }
    );

    // 📌 Step 7: 감사 로그 기록 (성공)
    const duration = Date.now() - startTime;
    const userOrgId = user.organizationId || user.id || '';
    await createAuditLog({
      organizationId: userOrgId,
      userId: user.id,
      userEmail: user.email || 'unknown@example.com',
      userName: user.displayName || undefined,
      action: 'DISPUTE',
      resource: 'SETTLEMENT',
      resourceId: disputeId,
      status: 'SUCCESS',
      changes: {
        before: {},
        after: { status: 'PENDING', reason },
      },
      duration,
    });

    // 📌 Step 8: 응답 반환
    const responseData = {
      success: true,
      data: newDispute,
      metadata: {
        createdBy: user.email,
        timestamp: new Date().toISOString(),
        executionTime: `${duration}ms`,
      },
    };

    return new Response(JSON.stringify(responseData), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ /api/sales/dispute POST 오류:', error);

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
          action: 'DISPUTE',
          resource: 'SETTLEMENT',
          status: 'FAILURE',
          errorCode: 'DISPUTE_ERROR',
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
