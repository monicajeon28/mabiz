export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
      logger.error('[product-codes] 인증 실패', { managerId: undefined });
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다.' },
        { status: 403 }
      );
    }

    // OWNER 테넌트 격리: 소속 조직 고객 상품만 표시
    const ownerFilter = (manager.role === 'OWNER' && manager.organizationId)
      ? Prisma.sql`AND EXISTS(
          SELECT 1 FROM "CrmAffiliateSale" af
          JOIN "Reservation" rv ON rv.id::text = af."orderId"
          WHERE rv."mainUserId" = r."mainUserId"
            AND af."organizationId" = ${manager.organizationId}
        )`
      : Prisma.sql``;

    const productCodes = await prisma.$queryRaw<ProductCodeResult[]>(Prisma.sql`
      SELECT t."productCode",
             MAX(t."cruiseName") as "cruiseName",
             MAX(t."shipName") as "shipName",
             COUNT(DISTINCT r."mainUserId")::bigint as "customerCount"
      FROM "Trip" t
      JOIN "Reservation" r ON r."tripId" = t.id
      WHERE r.status = 'CONFIRMED'
        AND r."paymentAmount" > 0
        AND t."productCode" != ''
        ${ownerFilter}
      GROUP BY t."productCode"
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
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error('[GET /api/passport/admin/product-codes]', { message, stack });
    return NextResponse.json(
      { ok: false, error: '서버 오류' },
      { status: 500 }
    );
  }
}
