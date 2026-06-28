import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/links/[id]  — 링크 소프트삭제(휴지통)
 * isActive=false 로만 바꿈(레코드·클릭통계 보존). 목록 GET이 isActive:true만 조회하므로 자동으로 숨겨짐.
 * 본인이 만든 링크만 삭제 가능(createdBy). 복원 가능(PATCH).
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const res = await prisma.shortLink.updateMany({
      where: { id, createdBy: ctx.userId, isActive: true },
      data:  { isActive: false },
    });
    if (res.count === 0) {
      return NextResponse.json({ ok: false, message: '링크를 찾을 수 없습니다.' }, { status: 404 });
    }
    logger.log('[Links DELETE] 소프트삭제', { id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('[Links DELETE] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * PATCH /api/links/[id]  { action: 'restore' }  — 삭제한 링크 복원(원복)
 * isActive=true 로 되돌림. 본인 링크만.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as { action?: string };
    if (body.action !== 'restore') {
      return NextResponse.json({ ok: false, message: '지원하지 않는 작업입니다.' }, { status: 400 });
    }
    const res = await prisma.shortLink.updateMany({
      where: { id, createdBy: ctx.userId, isActive: false },
      data:  { isActive: true },
    });
    if (res.count === 0) {
      return NextResponse.json({ ok: false, message: '복원할 링크를 찾을 수 없습니다.' }, { status: 404 });
    }
    logger.log('[Links PATCH] 복원', { id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('[Links PATCH] 오류', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
