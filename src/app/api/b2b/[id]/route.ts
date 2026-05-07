import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId, canDelete } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES = ['잠재고객', '문자', '부재', '3일부재', '소통', '구매완료', 'VIP', '수신거부'];

// PATCH /api/b2b/[id]
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES' || ctx.role === 'AGENT') {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }
    const orgId = ctx.role === 'GLOBAL_ADMIN' ? undefined : requireOrgId(ctx);
    const { id } = await params;

    const [existing] = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "CrmB2BProspect"
      WHERE id = ${id} ${orgId ? Prisma.sql`AND "organizationId" = ${orgId}` : Prisma.sql``}
    `);
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    const body = await req.json() as {
      status?: string; notes?: string; name?: string; phone?: string; email?: string;
      productName?: string; paymentAmount?: number | null; paymentDate?: string;
      assignedUserId?: string;
    };

    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 상태값입니다.' }, { status: 400 });
    }

    // Build SET clauses dynamically
    const sets: Prisma.Sql[] = [Prisma.sql`"updatedAt" = NOW()`];
    if (body.status         !== undefined) sets.push(Prisma.sql`status = ${body.status}`);
    if (body.notes          !== undefined) sets.push(Prisma.sql`notes = ${body.notes}`);
    if (body.name           !== undefined) sets.push(Prisma.sql`name = ${body.name}`);
    if (body.phone          !== undefined) sets.push(Prisma.sql`phone = ${body.phone}`);
    if (body.email          !== undefined) sets.push(Prisma.sql`email = ${body.email}`);
    if (body.productName    !== undefined) sets.push(Prisma.sql`"productName" = ${body.productName}`);
    if (body.paymentAmount  !== undefined) sets.push(Prisma.sql`"paymentAmount" = ${body.paymentAmount}`);
    if (body.paymentDate    !== undefined) sets.push(Prisma.sql`"paymentDate" = ${body.paymentDate}`);
    if (body.assignedUserId !== undefined) sets.push(Prisma.sql`"assignedUserId" = ${body.assignedUserId}`);

    await prisma.$executeRaw(Prisma.sql`
      UPDATE "CrmB2BProspect" SET ${Prisma.join(sets, ', ')} WHERE id = ${id}
    `);

    const [updated] = await prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      SELECT * FROM "CrmB2BProspect" WHERE id = ${id}
    `);

    logger.log('[PATCH /api/b2b/[id]]', { id, status: body.status });
    return NextResponse.json({ ok: true, prospect: updated });
  } catch (err) {
    logger.error('[PATCH /api/b2b/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/b2b/[id]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    if (!canDelete(ctx)) {
      return NextResponse.json({ ok: false, message: '삭제 권한이 없습니다.' }, { status: 403 });
    }
    const orgId = ctx.role === 'GLOBAL_ADMIN' ? undefined : requireOrgId(ctx);
    const { id } = await params;

    const [existing] = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "CrmB2BProspect"
      WHERE id = ${id} ${orgId ? Prisma.sql`AND "organizationId" = ${orgId}` : Prisma.sql``}
    `);
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    await prisma.$executeRaw(Prisma.sql`DELETE FROM "CrmB2BProspect" WHERE id = ${id}`);
    logger.log('[DELETE /api/b2b/[id]]', { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /api/b2b/[id]]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
