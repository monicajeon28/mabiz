import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// PATCH /api/tools/call-logs/[id]
// { converted: true|false } — 성약 여부 업데이트
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
    const body = await req.json() as { converted: boolean };

    if (typeof body.converted !== 'boolean') {
      return NextResponse.json({ ok: false, message: 'converted 값이 필요합니다.' }, { status: 400 });
    }

    // 같은 조직의 로그인지 확인
    const log = await prisma.aiCallLog.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!log) {
      return NextResponse.json({ ok: false, message: '기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.aiCallLog.update({
      where: { id },
      data: { converted: body.converted },
    });

    logger.log('[call-logs PATCH] 성약 업데이트', { id, converted: body.converted });
    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('[call-logs PATCH]', { e });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
