export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const ALLOWED_STATUSES = new Set(['DRAFT', 'SENT', 'SIGNED', 'EXPIRED', 'CANCELLED']);

/**
 * PATCH /api/affiliate-contracts/[id]/status
 * AffiliateContract 상태 변경 (GLOBAL_ADMIN 전용)
 */
export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const contractId = parseInt(context.params.id);
    if (!contractId || isNaN(contractId) || contractId <= 0) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID' }, { status: 400 });
    }

    const body = await req.json() as { status?: string };
    const status = body.status;
    if (!status || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { ok: false, error: `허용된 status: ${[...ALLOWED_STATUSES].join('|')}` },
        { status: 400 }
      );
    }

    const rows = await prisma.$queryRaw<{ id: number; status: string }[]>(Prisma.sql`
      UPDATE "AffiliateContract"
      SET    status = ${status}, "updatedAt" = NOW()
      WHERE  id = ${contractId}
      RETURNING id, status
    `);

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: '계약을 찾을 수 없습니다.' }, { status: 404 });
    }

    logger.log('[PATCH /api/affiliate-contracts/status]', { contractId, status });
    return NextResponse.json({ ok: true, id: rows[0].id, status: rows[0].status });

  } catch (err) {
    logger.error('[PATCH /api/affiliate-contracts/status]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
