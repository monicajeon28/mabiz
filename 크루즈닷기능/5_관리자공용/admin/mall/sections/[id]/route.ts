export const dynamic = 'force-dynamic';

// app/api/admin/mall/sections/[id]/route.ts
// 섹션 개별 관리 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { User: true },
    });

    if (session && session.User.role === 'admin') {
      return session.User;
    }
  } catch (error) {
    logger.error('[Admin Auth] Error:', error);
  }

  return null;
}

/**
 * PUT: 섹션 수정
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: idStr } = await params; const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 섹션 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { content, order, isActive } = body;

    const updated = await prisma.mallContent.update({
      where: { id },
      data: {
        ...(content !== undefined && { content }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      ok: true,
      section: {
        id: updated.id,
        section: updated.section,
        key: updated.key,
        type: updated.type,
        content: updated.content as any,
        order: updated.order,
        isActive: updated.isActive,
      },
    });
  } catch (error: any) {
    logger.error('[Sections API] PUT Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '섹션 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 섹션 삭제
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: idStr } = await params; const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 섹션 ID입니다.' },
        { status: 400 }
      );
    }

    await prisma.mallContent.delete({
      where: { id },
    });

    return NextResponse.json({
      ok: true,
      message: '섹션이 삭제되었습니다.',
    });
  } catch (error: any) {
    logger.error('[Sections API] DELETE Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || '섹션 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
