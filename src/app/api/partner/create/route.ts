export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// POST /api/partner/create
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const body = await req.json();
    const { name, email, phone, commissionRate } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { ok: false, message: '파트너 이름은 필수입니다.' },
        { status: 400 }
      );
    }

    const partner = await prisma.partner.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        commissionRate: commissionRate ? parseFloat(commissionRate) : null,
      },
    });

    return NextResponse.json({
      ok: true,
      data: partner,
    });
  } catch (err) {
    logger.error('[POST /api/partner/create]', { err });

    // Prisma unique constraint 에러 처리
    if (err instanceof Error && err.message.includes('Unique constraint failed')) {
      return NextResponse.json(
        { ok: false, message: '같은 이름의 파트너가 이미 존재합니다.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
