export const dynamic = 'force-dynamic';

// app/api/admin/refund-policy-groups/[groupId]/route.ts
// 환불/취소 규정 그룹 상세 조회/삭제 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/auth';
import { validateCsrfFromRequest } from '@/lib/api-middleware';
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

    const group = await prisma.refundPolicyGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        description: true,
        content: true,
        createdAt: true
      }
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
        content: group.content,
        createdAt: group.createdAt.toISOString()
      }
    });
  } catch (error: any) {
    logger.error('[Refund Policy Group Detail API] Error:', error);
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

    if (!await validateCsrfFromRequest(req)) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.INVALID_CSRF }, { status: 403 });
    }

    const groupId = parseInt(params.groupId);
    if (isNaN(groupId)) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.INVALID_ID }, { status: 400 });
    }

    // 소유권 검증 (IDOR 방지)
    const group = await prisma.refundPolicyGroup.findUnique({
      where: { id: groupId },
      select: { adminId: true }
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.NOT_FOUND }, { status: 404 });
    }

    if (group.adminId !== adminUser.id) {
      return NextResponse.json({ ok: false, error: ADMIN_ERRORS.FORBIDDEN }, { status: 403 });
    }

    await prisma.refundPolicyGroup.delete({
      where: { id: groupId }
    });

    return NextResponse.json({
      ok: true,
      message: 'Group deleted successfully'
    });
  } catch (error: any) {
    logger.error('[Refund Policy Group Delete API] Error:', error);
    return NextResponse.json(
      { ok: false, error: ADMIN_ERRORS.FAILED_TO_DELETE },
      { status: 500 }
    );
  }
}
