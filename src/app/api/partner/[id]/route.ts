export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// 파트너 업데이트 스키마 검증
const partnerUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  commissionRate: z.number().min(0).max(100).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

type PartnerUpdate = z.infer<typeof partnerUpdateSchema>;

// IDOR 방지: 파트너 소유권 검증
async function validatePartnerOwnership(id: string, orgId: string) {
  const existing = await prisma.partner.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (!existing || existing.organizationId !== orgId) {
    return null;
  }

  return existing;
}

// PATCH /api/partner/[id] — 파트너 정보 수정
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // 권한 확인
    const ownership = await validatePartnerOwnership(id, orgId);
    if (!ownership) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    const body = await req.json();

    // 입력값 검증
    let updateData: Record<string, any>;
    try {
      updateData = partnerUpdateSchema.parse(body);
    } catch (validationErr) {
      logger.warn('[PATCH /api/partner/[id]] Validation failed', { body });
      return NextResponse.json(
        { ok: false, message: '입력값이 유효하지 않습니다' },
        { status: 400 }
      );
    }

    // 업데이트 데이터 구성
    const data: Record<string, any> = {};
    if (updateData.name) data.name = updateData.name.trim();
    if (updateData.email !== undefined) data.email = updateData.email?.trim() || null;
    if (updateData.phone !== undefined) data.phone = updateData.phone?.trim() || null;
    if (updateData.commissionRate !== undefined) data.commissionRate = updateData.commissionRate;
    if (updateData.status) data.status = updateData.status;

    // updateMany로 organizationId 포함 (TOCTOU 방지: validatePartnerOwnership → update 사이 원자화)
    const updateResult = await prisma.partner.updateMany({
      where: { id, organizationId: orgId },
      data,
    });
    if (updateResult.count === 0) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }
    const updated = await prisma.partner.findUnique({ where: { id } });
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
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // 권한 확인
    const ownership = await validatePartnerOwnership(id, orgId);
    if (!ownership) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }

    // deleteMany로 organizationId 포함 (TOCTOU 방지: validatePartnerOwnership → delete 사이 원자화)
    const deleteResult = await prisma.partner.deleteMany({
      where: { id, organizationId: orgId },
    });
    if (deleteResult.count === 0) {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }
    return NextResponse.json({ ok: true, message: '파트너가 삭제되었습니다.' });
  } catch (err) {
    logger.error('[DELETE /api/partner/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
