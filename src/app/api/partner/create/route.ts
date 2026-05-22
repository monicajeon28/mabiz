export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

// 파트너 생성 스키마 검증
const partnerCreateSchema = z.object({
  name: z.string().min(1, '파트너 이름은 필수입니다'),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  commissionRate: z.number().min(0).max(100).nullable().optional(),
});

type PartnerCreate = z.infer<typeof partnerCreateSchema>;

// POST /api/partner/create
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const body = await req.json();

    // 입력값 검증
    let validatedData: PartnerCreate;
    try {
      validatedData = partnerCreateSchema.parse(body);
    } catch (validationErr) {
      logger.warn('[POST /api/partner/create] Validation failed', { body });
      return NextResponse.json(
        { ok: false, message: '입력값이 유효하지 않습니다' },
        { status: 400 }
      );
    }

    const partner = await prisma.partner.create({
      data: {
        organizationId: orgId,
        name: validatedData.name.trim(),
        email: validatedData.email?.trim() || null,
        phone: validatedData.phone?.trim() || null,
        commissionRate: validatedData.commissionRate || null,
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
