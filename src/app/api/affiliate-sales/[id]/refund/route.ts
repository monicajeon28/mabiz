export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/affiliate-sales/[id]/refund
 * 판매 환불 처리 (GLOBAL_ADMIN / OWNER만)
 * - OWNER: 본인 managerId 소속 판매만 환불 가능
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const saleId = parseInt(params.id);
    if (!saleId || isNaN(saleId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({})) as { refundedAt?: string };
    const parsedDate = body.refundedAt ? new Date(body.refundedAt) : null;
    if (parsedDate && isNaN(parsedDate.getTime())) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 날짜 형식' }, { status: 400 });
    }
    const refundedAt = parsedDate ?? new Date();

    // OWNER: 자신의 managerId 소속 판매만 처리
    let scopeCondition: Prisma.Sql = Prisma.empty;
    if (ctx.role === 'OWNER') {
      const profileId = ctx.mallUser?.affiliateProfileId;
      if (!profileId) {
        return NextResponse.json({ ok: false, error: '파트너 프로필이 없습니다.' }, { status: 403 });
      }
      scopeCondition = Prisma.sql`AND "managerId" = ${profileId}`;
    }

    const rows = await prisma.$queryRaw<{ id: number; agentId: number | null }[]>(
      Prisma.sql`
        UPDATE "AffiliateSale"
        SET    status = 'REFUNDED',
               "refundedAt" = ${refundedAt}
        WHERE  id = ${saleId}
          AND  status NOT IN ('REFUNDED', 'CANCELLED')
          ${scopeCondition}
        RETURNING id, "agentId"
      `
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: '판매 건을 찾을 수 없거나 이미 환불됨' }, { status: 404 });
    }

    logger.log('[POST /api/affiliate-sales/refund]', { saleId, role: ctx.role });
    return NextResponse.json({ ok: true, id: rows[0].id });

  } catch (err) {
    logger.error('[POST /api/affiliate-sales/refund]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
