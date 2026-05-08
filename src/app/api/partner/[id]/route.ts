export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// PATCH /api/partner/[id] — 파트너 정보 수정
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    // 권한 확인: 해당 조직의 파트너인지
    const existing = await prisma.partner.findUnique({
      where: { id },
    });

    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, phone, commissionRate, status } = body;

    const updated = await prisma.partner.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(commissionRate !== undefined && { commissionRate: commissionRate ? parseFloat(commissionRate) : null }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    logger.error('[PATCH /api/partner/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/partner/[id] — 파트너 삭제
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    // 권한 확인
    const existing = await prisma.partner.findUnique({
      where: { id },
    });

    if (!existing || existing.organizationId !== orgId) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    await prisma.partner.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true, message: '파트너가 삭제되었습니다.' });
  } catch (err) {
    logger.error('[DELETE /api/partner/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
