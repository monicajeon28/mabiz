export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

interface ProductCodeResult {
  productCode: string;
  cruiseName: string | null;
  shipName: string;
  customerCount: bigint;
}

/**
 * GET /api/passport/admin/product-codes
 * 구매 고객이 있는 상품 코드 목록 조회
 * 권한: GLOBAL_ADMIN + OWNER (대리점장)
 */
export async function GET() {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다.' },
        { status: 403 }
      );
    }

    // ── 구매 고객이 있는 유니크한 productCode 목록 조회 ──────────
    const productCodes = await prisma.$queryRaw<ProductCodeResult[]>(Prisma.sql`
      SELECT DISTINCT t."productCode", t."cruiseName", t."shipName",
             COUNT(DISTINCT r."mainUserId")::bigint as "customerCount"
      FROM "Trip" t
      JOIN "Reservation" r ON r."tripId" = t.id
      WHERE r.status = 'CONFIRMED'
        AND r."paymentAmount" > 0
        AND t."productCode" != ''
      GROUP BY t."productCode", t."cruiseName", t."shipName"
      ORDER BY "customerCount" DESC, t."productCode" ASC
    `);

    const formattedCodes = productCodes.map((row) => ({
      code: row.productCode,
      cruiseName: row.cruiseName,
      shipName: row.shipName,
      customerCount: Number(row.customerCount),
    }));

    logger.log('[GET /api/passport/admin/product-codes]', {
      count: formattedCodes.length,
    });

    return NextResponse.json({
      ok: true,
      productCodes: formattedCodes,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json(
        { ok: false, message: '권한이 없습니다.' },
        { status: 401 }
      );
    }
    logger.error('[GET /api/passport/admin/product-codes]', { err });
    return NextResponse.json(
      { ok: false, error: '서버 오류' },
      { status: 500 }
    );
  }
}
