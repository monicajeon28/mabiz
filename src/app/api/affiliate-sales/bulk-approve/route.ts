export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/affiliate-sales/bulk-approve
 * 판매 일괄 승인 (GLOBAL_ADMIN / OWNER만)
 * Body: { ids: number[] }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await req.json() as { ids?: unknown[] };
    const rawIds = body.ids;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'ids 배열 필수' }, { status: 400 });
    }

    // 정수 검증 — 유효하지 않은 값 필터
    const ids: number[] = rawIds
      .map((v) => parseInt(String(v)))
      .filter((n) => !isNaN(n) && n > 0);

    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: '유효한 ID 없음' }, { status: 400 });
    }

    if (ids.length > 200) {
      return NextResponse.json({ ok: false, error: '한 번에 최대 200건만 처리 가능' }, { status: 400 });
    }

    const now = new Date();

    // OWNER: 자신의 managerId 소속 판매만
    let ownerCondition: Prisma.Sql = Prisma.empty;
    if (ctx.role === 'OWNER' && ctx.mallUser?.affiliateProfileId) {
      ownerCondition = Prisma.sql`AND "managerId" = ${ctx.mallUser.affiliateProfileId}`;
    }

    const rows = await prisma.$queryRaw<{ id: number }[]>(
      Prisma.sql`
        UPDATE "AffiliateSale"
        SET    status = 'APPROVED',
               "confirmedAt" = ${now}
        WHERE  id = ANY(${ids}::int[])
          AND  status IN ('PENDING', 'PENDING_APPROVAL')
          ${ownerCondition}
        RETURNING id
      `
    );

    logger.log('[POST /api/affiliate-sales/bulk-approve]', { requested: ids.length, approved: rows.length, role: ctx.role });
    return NextResponse.json({ ok: true, approved: rows.length, ids: rows.map((r) => r.id) });

  } catch (err) {
    logger.error('[POST /api/affiliate-sales/bulk-approve]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
