export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/affiliate-sales/[id]/reject
 * 판매 거절 (GLOBAL_ADMIN / OWNER만)
 */
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const saleId = parseInt(context.params.id);
    if (!saleId || isNaN(saleId)) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({})) as { reason?: string };
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;

    const rows = await prisma.$queryRaw<{ id: number }[]>(
      Prisma.sql`
        UPDATE "AffiliateSale"
        SET    status = 'REJECTED'
        WHERE  id = ${saleId}
          AND  status IN ('PENDING', 'PENDING_APPROVAL')
        RETURNING id
      `
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: '판매 건을 찾을 수 없거나 이미 처리됨' }, { status: 404 });
    }

    logger.log('[POST /api/affiliate-sales/reject]', { saleId, reason, role: ctx.role });
    return NextResponse.json({ ok: true, id: rows[0].id });

  } catch (err) {
    logger.error('[POST /api/affiliate-sales/reject]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
