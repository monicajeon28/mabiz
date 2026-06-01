import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

interface PartnerSettlementDetail {
  settlementId: number;
  month: string;
  status: string;
  ledgerCount: number;
  totalCommission: bigint;
  totalWithholding: bigint;
  netPayout: bigint;
  approvedAt: Date | null;
  paidAt: Date | null;
}

/**
 * GET /api/admin/settlements/partner-details
 * 특정 파트너의 정산 내역 상세 조회
 *
 * Query params:
 * - profileId: 파트너 ID (필수)
 * - page: 1-based (기본값: 1)
 * - limit: 1-100 (기본값: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const organizationId = ctx.organizationId;
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: '조직이 설정되지 않았습니다.' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const profileId = searchParams.get('profileId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20') || 20);
    const offset = (page - 1) * limit;

    if (!profileId) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_PARAM', message: 'profileId가 필요합니다.' },
        { status: 400 }
      );
    }

    const profileIdNum = parseInt(profileId);

    const startTime = Date.now();

    const [details, countRows] = await Promise.all([
      prisma.$queryRaw<PartnerSettlementDetail[]>(Prisma.sql`
        SELECT
          ms.id AS settlement_id,
          TO_CHAR(ms."periodStart", 'YYYY-MM') AS month,
          ms.status,
          COUNT(cl.id)::integer AS ledger_count,
          COALESCE(SUM(cl.amount), 0)::bigint AS total_commission,
          COALESCE(SUM(cl."withholdingAmount"), 0)::bigint AS total_withholding,
          COALESCE(SUM(cl.amount) - SUM(cl."withholdingAmount"), 0)::bigint AS net_payout,
          ms."approvedAt",
          ms."paymentDate" AS paid_at
        FROM "CommissionLedger" cl
        LEFT JOIN "MonthlySettlement" ms
          ON cl."settlementId" = ms.id
        WHERE cl."profileId" = ${profileIdNum}
          AND cl."isSettled" = true
          AND cl."organizationId" = ${organizationId}
        GROUP BY ms.id, ms."periodStart", ms.status, ms."approvedAt", ms."paymentDate"
        ORDER BY ms."periodStart" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(DISTINCT ms.id)::bigint AS total
        FROM "CommissionLedger" cl
        LEFT JOIN "MonthlySettlement" ms
          ON cl."settlementId" = ms.id
        WHERE cl."profileId" = ${profileIdNum}
          AND cl."isSettled" = true
          AND cl."organizationId" = ${organizationId}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.ceil(total / limit);
    const elapsed = Date.now() - startTime;

    logger.log('[GET /api/admin/settlements/partner-details]', {
      profileId: profileIdNum,
      total,
      page,
      elapsedMs: elapsed,
    });

    return NextResponse.json({
      ok: true,
      data: {
        profileId: profileIdNum,
        details: details.map((d) => ({
          settlementId: d.settlementId,
          month: d.month,
          status: d.status,
          ledgerCount: d.ledgerCount,
          totalCommission: Number(d.totalCommission),
          totalWithholding: Number(d.totalWithholding),
          netPayout: Number(d.netPayout),
          approvedAt: d.approvedAt?.toISOString() || null,
          paidAt: d.paidAt?.toISOString() || null,
        })),
      },
      pagination: {
        total,
        page,
        pageSize: limit,
        totalPages,
      },
      performance: {
        elapsedMs: elapsed,
      },
    });
  } catch (err) {
    logger.error('[GET /api/admin/settlements/partner-details]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
