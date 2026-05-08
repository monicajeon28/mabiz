export const dynamic = 'force-dynamic';

// app/api/admin/inclusion-groups/[groupId]/route.ts
// 포함/불포함 그룹 상세 조회/삭제 API

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/auth';
import { validateCsrfToken } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { ADMIN_ERRORS } from '@/lib/constants/admin-errors';

// GET: 그룹 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const groupId = parseInt(params.groupId);
    if (isNaN(groupId)) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.INVALID_ID }, { status: 400 });
    }

    const group = await prisma.inclusionExclusionGroup.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.NOT_FOUND }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        includes: Array.isArray(group.includes) ? group.includes : [],
        excludes: Array.isArray(group.excludes) ? group.excludes : [],
        createdAt: group.createdAt.toISOString()
      }
    });
  } catch (error: any) {
    logger.error('[Inclusion Group Detail API] Error:', error);
    return NextResponse.json(
      { ok: false, error: ADMIN_ERRORS.FAILED_TO_FETCH },
      { status: 500 }
    );
  }
}

// DELETE: 그룹 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const { user: adminUser, isAdmin } = await checkAdminAuth();
    if (!isAdmin || !adminUser) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.UNAUTHORIZED }, { status: 401 });
    }

    const cookieStore = await cookies();
    const csrfTokenFromCookie = cookieStore.get('csrf-token')?.value;
    const csrfTokenFromHeader = req.headers.get('x-csrf-token');
    if (!validateCsrfToken(csrfTokenFromCookie, csrfTokenFromHeader)) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.INVALID_CSRF }, { status: 403 });
    }

    const groupId = parseInt(params.groupId);
    if (isNaN(groupId)) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.INVALID_ID }, { status: 400 });
    }

    // 소유권 검증 (IDOR 방지)
    const group = await prisma.inclusionExclusionGroup.findUnique({
      where: { id: groupId },
      select: { adminId: true }
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.NOT_FOUND }, { status: 404 });
    }

    if (group.adminId !== adminUser.id) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.FORBIDDEN }, { status: 403 });
    }

    await prisma.inclusionExclusionGroup.delete({
      where: { id: groupId }
    });

    return NextResponse.json({
      ok: true,
      message: 'Group deleted successfully'
    });
  } catch (error: any) {
    logger.error('[Inclusion Group Delete API] Error:', error);
    return NextResponse.json(
      { ok: false, error: ADMIN_ERRORS.FAILED_TO_DELETE },
      { status: 500 }
    );
  }
}
