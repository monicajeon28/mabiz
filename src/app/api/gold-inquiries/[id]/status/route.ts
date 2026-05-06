export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const VALID_STATUSES = new Set(['PENDING', 'CONTACTED', 'CONVERTED', 'REJECTED']);

/**
 * PATCH /api/gold-inquiries/[id]/status
 * 골드문의 상태 변경 (GLOBAL_ADMIN / OWNER만)
 */
export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const inquiryId = parseInt(context.params.id);
    if (!inquiryId || isNaN(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID' }, { status: 400 });
    }

    const body = await req.json() as { status?: string };
    const status = body.status;
    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { ok: false, error: `허용된 status: ${[...VALID_STATUSES].join('|')}` },
        { status: 400 }
      );
    }

    // OWNER: 소속 문의만 변경 가능
    let scopeCondition: Prisma.Sql = Prisma.empty;
    if (ctx.role === 'OWNER') {
      const profileId = ctx.mallUser?.affiliateProfileId;
      if (!profileId) {
        return NextResponse.json({ ok: false, error: '파트너 프로필이 없습니다.' }, { status: 403 });
      }
      scopeCondition = Prisma.sql`AND "managerId" = ${profileId}`;
    }

    const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      UPDATE "ProductInquiry"
      SET    status = ${status}
      WHERE  id = ${inquiryId}
        AND  "productCode" = 'GOLD_MEMBERSHIP'
        ${scopeCondition}
      RETURNING id
    `);

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    logger.log('[PATCH /api/gold-inquiries/status]', { inquiryId, status, role: ctx.role });
    return NextResponse.json({ ok: true, id: rows[0].id, status });

  } catch (err) {
    logger.error('[PATCH /api/gold-inquiries/status]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
