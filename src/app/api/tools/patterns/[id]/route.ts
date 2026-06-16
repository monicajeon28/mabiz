import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// PATCH /api/tools/patterns/[id]
// { status: 'APPROVED' | 'REJECTED' | 'DRAFT' }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }
    const orgId = resolveOrgId(ctx);
    const { id } = await params;
    const body = await req.json() as { status?: string; conversionRate?: number };

    const existing = await prisma.scriptPattern.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, message: '패턴을 찾을 수 없습니다.' }, { status: 404 });
    }

    const validStatuses = ['DRAFT', 'APPROVED', 'REJECTED'];
    const updateData: Record<string, unknown> = {};
    if (body.status && validStatuses.includes(body.status)) {
      updateData.status = body.status;
    }
    if (typeof body.conversionRate === 'number') {
      updateData.conversionRate = body.conversionRate;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ok: false, message: '업데이트할 항목이 없습니다.' }, { status: 400 });
    }

    await prisma.scriptPattern.update({ where: { id }, data: updateData });
    logger.log('[patterns PATCH] 패턴 업데이트', { id, ...updateData });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('[patterns PATCH]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/tools/patterns/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    const existing = await prisma.scriptPattern.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, message: '패턴을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.scriptPattern.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('[patterns DELETE]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
