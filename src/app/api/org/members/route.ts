import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type MemberRow = {
  userId: string;
  displayName: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  phone: string | null;
  createdAt: Date;
  invitedAt: Date | null;
};

type PaginationParams = {
  page?: string;
  limit?: string;
};

/**
 * GET /api/org/members
 * 조직의 멤버 목록 조회 (페이지네이션)
 *
 * 쿼리 파라미터:
 *   - page: 페이지 번호 (기본 1, min 1)
 *   - limit: 페이지 당 항목 수 (기본 20, max 100)
 *
 * 응답:
 *   {
 *     ok: true,
 *     members: [
 *       {
 *         id: string,
 *         userId: string,
 *         email: string | null,
 *         displayName: string | null,
 *         role: string,
 *         status: "active" | "inactive",
 *         invitedAt: ISO string | null,
 *         joinedAt: ISO string | null,
 *         lastActivityAt: ISO string | null
 *       }
 *     ],
 *     pagination: {
 *       page: number,
 *       limit: number,
 *       total: number,
 *       totalPages: number
 *     }
 *   }
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // RBAC: 인증만 필요 (모든 역할 조회 가능)
    const url = new URL(req.url);
    const searchParams = url.searchParams as unknown as PaginationParams;
    let page = Math.max(1, parseInt(searchParams.page || '1', 10));
    let limit = Math.min(100, Math.max(1, parseInt(searchParams.limit || '20', 10)));

    if (isNaN(page)) page = 1;
    if (isNaN(limit)) limit = 20;

    const skip = (page - 1) * limit;

    // 병렬 쿼리: count + list
    const [totalCount, members] = await Promise.all([
      prisma.organizationMember.count({
        where: { organizationId: orgId },
      }),
      prisma.organizationMember.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          userId: true,
          email: true,
          displayName: true,
          role: true,
          isActive: true,
          phone: true,
        },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const formattedMembers = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.email,
      displayName: m.displayName,
      role: m.role,
      status: m.isActive ? 'active' : 'inactive',
      lastActivityAt: null, // 추후 확장: 로그인/활동 기록 추가
    }));

    logger.log('[OrgMembers GET]', { orgId, page, limit, total: totalCount });
    return NextResponse.json({
      ok: true,
      members: formattedMembers,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
      },
      myRole: ctx.role,
    });
  } catch (e) {
    logger.error('[OrgMembers GET]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * PATCH /api/org/members
 * 멤버 권한 수정
 *
 * 요청 본문:
 *   {
 *     memberId: string,  // OrganizationMember.id
 *     role: "OWNER" | "MANAGER" | "MEMBER"
 *   }
 *
 * RBAC: OWNER 또는 GLOBAL_ADMIN만 가능
 * 검증: 자신의 권한은 변경 불가
 */
export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // RBAC: OWNER 또는 GLOBAL_ADMIN만 권한 수정 가능
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, message: '권한 수정 권한이 없습니다' },
        { status: 403 }
      );
    }

    const body = await req.json() as { memberId?: string; role?: string };
    const { memberId, role } = body;

    // 검증: memberId와 role 필수
    if (!memberId || !role) {
      return NextResponse.json(
        { ok: false, message: 'memberId와 role은 필수입니다' },
        { status: 400 }
      );
    }

    // 검증: role은 유효한 값만 허용
    const validRoles = ['OWNER', 'MANAGER', 'MEMBER', 'AGENT'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 role입니다' },
        { status: 400 }
      );
    }

    // 소유권 검증 (IDOR 방지)
    const member = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: orgId },
      select: { userId: true, role: true },
    });

    if (!member) {
      return NextResponse.json(
        { ok: false, message: '멤버를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 검증: 자신의 권한은 변경 불가
    if (member.userId === ctx.userId) {
      return NextResponse.json(
        { ok: false, message: '본인의 권한은 변경할 수 없습니다' },
        { status: 400 }
      );
    }

    // 업데이트
    await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
    });

    logger.log('[OrgMembers PATCH]', {
      orgId,
      memberId: memberId.substring(0, 8),
      userId: member.userId.substring(0, 8),
      newRole: role,
      oldRole: member.role,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('[OrgMembers PATCH]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * DELETE /api/org/members
 * 멤버 삭제/초대 취소
 *
 * 요청 본문:
 *   {
 *     memberId: string  // OrganizationMember.id
 *   }
 *
 * RBAC: OWNER 또는 GLOBAL_ADMIN만 가능
 * 검증:
 *   - 자신은 삭제 불가
 *   - 마지막 OWNER는 삭제 불가
 */
export async function DELETE(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // RBAC: OWNER 또는 GLOBAL_ADMIN만 삭제 가능
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, message: '멤버 삭제 권한이 없습니다' },
        { status: 403 }
      );
    }

    const body = await req.json() as { memberId?: string };
    const { memberId } = body;

    // 검증: memberId 필수
    if (!memberId) {
      return NextResponse.json(
        { ok: false, message: 'memberId는 필수입니다' },
        { status: 400 }
      );
    }

    // 소유권 검증 (IDOR 방지)
    const member = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: orgId },
      select: { userId: true, role: true, isActive: true },
    });

    if (!member) {
      return NextResponse.json(
        { ok: false, message: '멤버를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 검증: 자신은 삭제 불가
    if (member.userId === ctx.userId) {
      return NextResponse.json(
        { ok: false, message: '본인은 삭제할 수 없습니다' },
        { status: 400 }
      );
    }

    // 검증: 마지막 OWNER는 삭제 불가
    if (member.role === 'OWNER') {
      const ownerCount = await prisma.organizationMember.count({
        where: { organizationId: orgId, role: 'OWNER', isActive: true },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { ok: false, message: '조직의 마지막 대리점장은 삭제할 수 없습니다' },
          { status: 400 }
        );
      }
    }

    // 삭제
    await prisma.organizationMember.delete({
      where: { id: memberId },
    });

    logger.log('[OrgMembers DELETE]', {
      orgId,
      memberId: memberId.substring(0, 8),
      userId: member.userId.substring(0, 8),
      role: member.role,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('[OrgMembers DELETE]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
