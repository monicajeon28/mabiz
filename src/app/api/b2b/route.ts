export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// OWNER + GLOBAL_ADMIN only
const VALID_STATUSES = ['잠재고객', '문자', '부재', '3일부재', '소통', '구매완료', 'VIP', '수신거부'];
const VALID_EDU_TYPES = ['BUYER', 'INQUIRER'];

type ProspectRow = {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  email: string | null;
  productName: string | null;
  paymentAmount: number | null;
  paymentDate: string | null;
  notes: string | null;
  status: string;
  eduType: string;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CountRow = { eduType: string; status: string; cnt: bigint };

// GET /api/b2b?eduType=BUYER|INQUIRER&status=잠재고객&q=검색어&page=1
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES' || ctx.role === 'AGENT') {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }
    const orgId = ctx.role === 'GLOBAL_ADMIN' ? undefined : requireOrgId(ctx);

    const { searchParams } = new URL(req.url);
    const eduType = searchParams.get('eduType') ?? undefined;
    const status  = searchParams.get('status')  ?? undefined;
    const q       = searchParams.get('q')?.trim() ?? undefined;
    const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit   = 30;
    const offset  = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: Prisma.Sql[] = [];
    if (orgId)   conditions.push(Prisma.sql`"organizationId" = ${orgId}`);
    if (eduType && VALID_EDU_TYPES.includes(eduType)) {
      conditions.push(Prisma.sql`"eduType" = ${eduType}`);
    }
    if (status && VALID_STATUSES.includes(status)) {
      conditions.push(Prisma.sql`status = ${status}`);
    }
    if (q) {
      conditions.push(Prisma.sql`(name ILIKE ${'%' + q + '%'} OR phone ILIKE ${'%' + q + '%'} OR email ILIKE ${'%' + q + '%'})`);
    }

    const whereClause = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.sql``;

    const [prospects, totalRows, countRows] = await Promise.all([
      prisma.$queryRaw<ProspectRow[]>(Prisma.sql`
        SELECT id, "organizationId", name, phone, email,
               "productName", "paymentAmount", "paymentDate",
               notes, status, "eduType", source, "createdAt", "updatedAt"
        FROM "CrmB2BProspect"
        ${whereClause}
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<{ cnt: bigint }[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS cnt FROM "CrmB2BProspect" ${whereClause}
      `),
      prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT "eduType", status, COUNT(*)::bigint AS cnt FROM "CrmB2BProspect"
        ${orgId ? Prisma.sql`WHERE "organizationId" = ${orgId}` : Prisma.sql``}
        GROUP BY "eduType", status
      `),
    ]);

    const total = Number(totalRows[0]?.cnt ?? 0);
    const counts = countRows.map(r => ({ eduType: r.eduType, status: r.status, count: Number(r.cnt) }));

    return NextResponse.json({ ok: true, prospects, total, page, counts });
  } catch (err) {
    logger.error('[GET /api/b2b]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/b2b — 신규 등록 (OWNER + GLOBAL_ADMIN)
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (ctx.role === 'FREE_SALES' || ctx.role === 'AGENT') {
      return NextResponse.json({ ok: false, message: '접근 권한 없음' }, { status: 403 });
    }
    const orgId = requireOrgId(ctx);

    const body = await req.json() as {
      name: string; phone: string; email?: string;
      eduType?: string; productName?: string;
      paymentAmount?: number; paymentDate?: string;
      notes?: string; source?: string; status?: string;
    };

    if (!body.name?.trim() || !body.phone?.trim()) {
      return NextResponse.json({ ok: false, message: '이름과 전화번호는 필수입니다.' }, { status: 400 });
    }

    const eduType       = VALID_EDU_TYPES.includes(body.eduType ?? '') ? body.eduType! : 'INQUIRER';
    const status        = VALID_STATUSES.includes(body.status ?? '') ? body.status! : '잠재고객';
    const id            = crypto.randomUUID(); // cuid alternative — fine for new records
    const productName   = body.productName   ?? null;
    const paymentAmount = body.paymentAmount ?? null;
    const paymentDate   = body.paymentDate   ?? null;
    const email         = body.email         ?? null;
    const notes         = body.notes         ?? null;
    const source        = body.source        ?? 'DIRECT';

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "CrmB2BProspect"
        (id, "organizationId", name, phone, email, "eduType", "productName", "paymentAmount", "paymentDate", notes, status, source, "createdAt", "updatedAt")
      VALUES
        (${id}, ${orgId}, ${body.name.trim()}, ${body.phone.trim()}, ${email}, ${eduType}, ${productName}, ${paymentAmount}, ${paymentDate}, ${notes}, ${status}, ${source}, NOW(), NOW())
    `);

    const [rows] = await prisma.$queryRaw<ProspectRow[]>(Prisma.sql`
      SELECT * FROM "CrmB2BProspect" WHERE id = ${id}
    `);

    logger.log('[POST /api/b2b] 등록', { id, orgId, eduType });
    return NextResponse.json({ ok: true, prospect: rows }, { status: 201 });
  } catch (err) {
    logger.error('[POST /api/b2b]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
