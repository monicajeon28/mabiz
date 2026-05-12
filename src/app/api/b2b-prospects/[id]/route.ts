import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgIdOrNull, canDelete } from '@/lib/rbac';
import { logger } from '@/lib/logger';

const VALID_STATUSES = ['잠재고객', '문자', '부재', '3일부재', '소통', '구매완료', 'VIP', '수신거부', 'NEW'];

type Params = { params: Promise<{ id: string }> };

/** GET /api/b2b-prospects/[id] — 개별 조회 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx);
    const { id } = await params;

    const prospect = await prisma.b2BProspect.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
    });
    if (!prospect) return NextResponse.json({ ok: false }, { status: 404 });
    return NextResponse.json({ ok: true, prospect });
  } catch (err) {
    logger.error('[GET /api/b2b-prospects/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/** PATCH /api/b2b-prospects/[id] — 수정 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx); // GLOBAL_ADMIN → null (전체 접근)
    const { id } = await params;
    const body  = await req.json();

    const existing = await prisma.b2BProspect.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
    });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 상태값입니다.' }, { status: 400 });
    }

    const { name, phone, email, companyName, position, status, notes,
            assignedUserId, productName, paymentAmount, paymentDate } = body;

    const prospect = await prisma.b2BProspect.update({
      where: { id },
      data: {
        ...(name           !== undefined ? { name }           : {}),
        ...(phone          !== undefined ? { phone }          : {}),
        ...(email          !== undefined ? { email }          : {}),
        ...(companyName    !== undefined ? { companyName }    : {}),
        ...(position       !== undefined ? { position }       : {}),
        ...(status         !== undefined ? { status }         : {}),
        ...(notes          !== undefined ? { notes }          : {}),
        ...(assignedUserId !== undefined ? { assignedUserId } : {}),
        ...(productName    !== undefined ? { productName }    : {}),
        ...(paymentAmount  !== undefined ? { paymentAmount }  : {}),
        ...(paymentDate    !== undefined ? { paymentDate }    : {}),
      },
    });
    logger.log('[PATCH /api/b2b-prospects/[id]]', { id, status: body.status });
    return NextResponse.json({ ok: true, prospect });
  } catch (err) {
    logger.error('[PATCH /api/b2b-prospects/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/** DELETE /api/b2b-prospects/[id] — 삭제 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    if (!canDelete(ctx)) {
      return NextResponse.json({ ok: false, message: '삭제 권한이 없습니다.' }, { status: 403 });
    }
    const orgId = resolveOrgIdOrNull(ctx);
    const { id } = await params;

    const existing = await prisma.b2BProspect.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
    });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    await prisma.b2BProspect.delete({ where: { id } });
    logger.log('[DELETE /api/b2b-prospects/[id]]', { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /api/b2b-prospects/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
