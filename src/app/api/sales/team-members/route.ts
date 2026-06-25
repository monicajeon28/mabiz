/**
 * GET /api/sales/team-members
 * POST /api/sales/team-members (팀원 추가)
 *
 * 팀원 목록 조회 및 관리
 * - 관리자: 전체 팀원 또는 특정 팀원
 * - 지사장: 자신의 팀원만
 * - 대리점장: 자신의 정보만
 *
 * 쿼리 파라미터:
 * - teamId: 팀 ID (선택사항, 관리자만 사용)
 * - search: 이름/이메일 검색 (선택사항)
 * - page: 페이지 번호 (기본값: 1)
 * - limit: 페이지당 항목 수 (기본값: 10)
 *
 * 응답 예시:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "user_123",
 *       "name": "김철수",
 *       "email": "kim@example.com",
 *       "role": "AGENT",
 *       "teamId": "team_a",
 *       "totalRevenue": 5250000,
 *       "orderCount": 15,
 *       "createdAt": "2026-01-15T10:30:00Z"
 *     }
 *   ],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 10,
 *     "total": 25
 *   }
 * }
 */

import { getServerSession } from 'next-auth/next';
import {
  canViewTeamId,
  maskSensitiveData,
  validatePermission,
} from '@/lib/sales-permissions';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // 📌 Step 1: 사용자 정보 가져오기
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
      select: {
        id: true,
        email: true,
        role: true,
        managerId: true,
        organizationId: true,
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

    // 📌 Step 3: URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const requestedTeamId = searchParams.get('teamId');
    const searchQuery = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));

    // 📌 Step 4: 팀 조회 권한 체크
    if (requestedTeamId && !canViewTeamId(user.role, user.managerId, requestedTeamId)) {
      return new Response(
        JSON.stringify({
          error: '다른 팀의 데이터를 볼 권한이 없습니다',
          code: 'TEAM_ACCESS_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 📌 Step 5: 데이터 조회 필터 구성
    let whereFilter: Record<string, any> = {
      organizationId: user.organizationId,
    };

    if (user.role === 'GLOBAL_ADMIN') {
      // 관리자: 요청된 팀이 있으면 그 팀만, 없으면 전체
      if (requestedTeamId) {
        whereFilter = { ...whereFilter, managerId: requestedTeamId };
      }
    } else if (user.role === 'OWNER') {
      // 지사장: 자신이 관리하는 팀원만 (managerId = 본인 id)
      whereFilter = { ...whereFilter, managerId: user.id };
    } else if (user.role === 'AGENT') {
      // 대리점장: 자신의 정보만 (팀원 목록 조회 권한 없음)
      return new Response(
        JSON.stringify({
          error: '대리점장은 팀원 목록을 조회할 수 없습니다',
          code: 'AGENT_LIST_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 검색 필터 추가
    if (searchQuery) {
      whereFilter = {
        ...whereFilter,
        OR: [
          { displayName: { contains: searchQuery, mode: 'insensitive' } },
          { email: { contains: searchQuery, mode: 'insensitive' } },
        ],
      };
    }

    // 📌 Step 6: 데이터 조회
    const [teamMembers, totalCount] = await Promise.all([
      prisma.organizationMember.findMany({
        where: whereFilter,
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
          managerId: true,
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.organizationMember.count({ where: whereFilter }),
    ]);

    // 📌 Step 7: 각 팀원의 판매 통계 추가
    const membersWithStats = await Promise.all(
      teamMembers.map(async (member) => {
        const stats = await prisma.contact.aggregate({
          where: { createdBy: member.email ?? undefined },
          _count: true,
        });

        const orderCount = stats._count ?? 0;

        return {
          ...member,
          name: member.displayName ?? '미정',
          totalRevenue: 0,
          orderCount,
          totalRevenueFormatted: '₩0',
        };
      })
    );

    // 📌 Step 8: 민감정보 마스킹
    const maskedMembers = membersWithStats.map((member) =>
      maskSensitiveData(member, user.role)
    );

    // 📌 Step 9: 응답 반환
    const responseData = {
      success: true,
      data: maskedMembers,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      metadata: {
        appliedRole: user.role,
        filteredByTeam: requestedTeamId || user.managerId,
        searchQuery: searchQuery || null,
        executionTime: `${Date.now() - startTime}ms`,
      },
    };

    console.log(
      `[Sales/TeamMembers] User ${user.email} (${user.role}) fetched ${maskedMembers.length} team members`,
      {
        searchQuery,
        page,
        limit,
        total: totalCount,
      }
    );

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ /api/sales/team-members 오류:', error);

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

// ============================================
// POST: 팀원 추가 (관리자/지사장만)
// ============================================

export async function POST(request: Request) {
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
      select: {
        id: true,
        email: true,
        role: true,
        managerId: true,
        organizationId: true,
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

    // 📌 Step 2: 권한 체크 (관리자 또는 지사장만)
    if (user.role !== 'GLOBAL_ADMIN' && user.role !== 'OWNER') {
      return new Response(
        JSON.stringify({
          error: '팀원을 추가할 권한이 없습니다',
          code: 'PERMISSION_DENIED',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 📌 Step 3: 요청 본문 파싱
    const body = await request.json();
    const { email, name, role: newUserRole } = body;

    if (!email || !name) {
      return new Response(
        JSON.stringify({
          error: '이메일과 이름은 필수입니다',
          code: 'INVALID_INPUT',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 📌 Step 4: 중복 확인
    const existingUser = await prisma.organizationMember.findFirst({
      where: { email, organizationId: user.organizationId },
    });

    if (existingUser) {
      return new Response(
        JSON.stringify({
          error: '이미 존재하는 이메일입니다',
          code: 'EMAIL_EXISTS',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 📌 Step 5: 임시 비밀번호 생성
    const tempPassword = Math.random().toString(36).substring(2, 10);

    // 📌 Step 6: 새 팀원 생성
    const newUser = await prisma.organizationMember.create({
      data: {
        email,
        displayName: name,
        role: newUserRole || 'AGENT',
        managerId: user.role === 'OWNER' ? user.id : null,
        organizationId: user.organizationId,
        userId: email, // userId는 필수 unique 필드 — email 사용
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        managerId: true,
      },
    });

    console.log(
      `[Sales/TeamMembers] User ${user.email} created new team member ${newUser.id}`,
      { email, role: newUserRole }
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: newUser,
        tempPassword: tempPassword, // 관리자에게만 전달
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ /api/sales/team-members POST 오류:', error);

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
