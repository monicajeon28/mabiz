import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgIdOrNull, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/b2b-prospects
 * B2B 구매자/문의자 목록 (CrmB2BProspect 테이블)
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx);
    const url = new URL(req.url);

    const q       = url.searchParams.get('q');
    const eduType = url.searchParams.get('eduType');
    const page    = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const limit   = Math.min(50, parseInt(url.searchParams.get('limit') ?? '20'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { ...(orgId ? { organizationId: orgId } : {}) };
    if (eduType) where.eduType = eduType;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { companyName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [prospects, total] = await Promise.all([
      prisma.b2BProspect.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.b2BProspect.count({ where }),
    ]);

    return NextResponse.json({ ok: true, prospects, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error('[GET /api/b2b-prospects]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/** POST /api/b2b-prospects — B2B 잠재고객 생성 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const body = await req.json();

    const { name, phone, email, companyName, position, status, notes,
            eduType, productName, paymentAmount, paymentDate } = body;
    if (!name || !phone) {
      return NextResponse.json({ ok: false, message: '이름과 전화번호는 필수입니다.' }, { status: 400 });
    }

    const prospect = await prisma.b2BProspect.create({
      data: {
        organizationId: orgId,
        name, phone, email: email ?? null,
        companyName: companyName ?? null,
        position: position ?? null,
        status: status ?? '잠재고객',
        notes: notes ?? null,
        eduType: eduType ?? 'INQUIRER',
        productName: productName ?? null,
        paymentAmount: paymentAmount ?? null,
        paymentDate: paymentDate ?? null,
      },
    });
    return NextResponse.json({ ok: true, prospect }, { status: 201 });
  } catch (err) {
    logger.error('[POST /api/b2b-prospects]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
