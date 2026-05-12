import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

/** GET /api/b2b-prospects/[id] — 개별 조회 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    const prospect = await prisma.b2BProspect.findFirst({
      where: { id, organizationId: orgId },
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
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.b2BProspect.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    const { name, phone, email, companyName, position, status, notes, assignedUserId } = body;
    const prospect = await prisma.b2BProspect.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(companyName !== undefined ? { companyName } : {}),
        ...(position !== undefined ? { position } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(assignedUserId !== undefined ? { assignedUserId } : {}),
      },
    });
    return NextResponse.json({ ok: true, prospect });
  } catch (err) {
    logger.error('[PATCH /api/b2b-prospects/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/** DELETE /api/b2b-prospects/[id] — 삭제 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id } = await params;

    const existing = await prisma.b2BProspect.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    await prisma.b2BProspect.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /api/b2b-prospects/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
