export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface MonthlyTrend {
  year: number;
  month: number;
  label: string;
  saleAmount: number;
  grossProfit: number;
  refundAmount: number;
  commissionAmount: number;
  salesCount: number;
}

interface SaleRow {
  yr: number;
  mo: number;
  sale_amount: bigint | number | string;
  cost_amount: bigint | number | string;
  refund_amount: bigint | number | string;
  commission_amount: bigint | number | string;
  sales_count: bigint | number | string;
}

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

const getTrendData = unstable_cache(
  async (months: number) => {
    const cutoff = new Date();
    cutoff.setUTCDate(1);
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - (months - 1));

    const rows = await prisma.$queryRaw<SaleRow[]>`
      SELECT
        EXTRACT(YEAR FROM "saleDate")::int  AS yr,
        EXTRACT(MONTH FROM "saleDate")::int AS mo,
        COALESCE(SUM(CASE WHEN status IN ('CONFIRMED','PAID','PAYOUT_SCHEDULED') THEN "saleAmount" ELSE 0 END), 0) AS sale_amount,
        COALESCE(SUM(CASE WHEN status IN ('CONFIRMED','PAID','PAYOUT_SCHEDULED') THEN "costAmount" ELSE 0 END), 0) AS cost_amount,
        COALESCE(SUM(CASE WHEN status IN ('REFUNDED','CANCELLED') THEN "saleAmount" ELSE 0 END), 0) AS refund_amount,
        COALESCE(
          SUM(CASE WHEN status IN ('CONFIRMED','PAID','PAYOUT_SCHEDULED')
            THEN COALESCE("branchCommission",0) + COALESCE("salesCommission",0) + COALESCE("overrideCommission",0)
            ELSE 0 END),
          0
        ) AS commission_amount,
        COUNT(CASE WHEN status IN ('CONFIRMED','PAID','PAYOUT_SCHEDULED') THEN 1 END) AS sales_count
      FROM "AffiliateSale"
      WHERE "saleDate" >= ${cutoff}
      GROUP BY yr, mo
      ORDER BY yr ASC, mo ASC
    `;

    const monthMap = new Map<string, MonthlyTrend>();

    for (const row of rows) {
      const yr = Number(row.yr);
      const mo = Number(row.mo);
      const saleAmount = Number(row.sale_amount);
      const costAmount = Number(row.cost_amount);
      const key = `${yr}-${mo}`;
      monthMap.set(key, {
        year: yr,
        month: mo,
        label: `${yr}년 ${MONTH_LABELS[mo - 1]}`,
        saleAmount,
        grossProfit: saleAmount - costAmount,
        refundAmount: Number(row.refund_amount),
        commissionAmount: Number(row.commission_amount),
        salesCount: Number(row.sales_count),
      });
    }

    // 빈 월 채우기
    const result: MonthlyTrend[] = [];
    const cursor = new Date(cutoff);
    const now = new Date();

    while (
      cursor.getUTCFullYear() < now.getUTCFullYear() ||
      (cursor.getUTCFullYear() === now.getUTCFullYear() && cursor.getUTCMonth() <= now.getUTCMonth())
    ) {
      const yr = cursor.getUTCFullYear();
      const mo = cursor.getUTCMonth() + 1;
      const key = `${yr}-${mo}`;
      result.push(
        monthMap.get(key) ?? {
          year: yr,
          month: mo,
          label: `${yr}년 ${MONTH_LABELS[mo - 1]}`,
          saleAmount: 0,
          grossProfit: 0,
          refundAmount: 0,
          commissionAmount: 0,
          salesCount: 0,
        }
      );
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return { ok: true, months: result };
  },
  ['finance-trend'],
  { revalidate: 3600 }
);

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) return NextResponse.json({ ok: false }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });
    if (!['admin', 'superadmin'].includes(dbUser?.role ?? '')) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const monthsParam = parseInt(searchParams.get('months') ?? '12', 10);
    const months = isNaN(monthsParam) || monthsParam < 1 || monthsParam > 60 ? 12 : monthsParam;

    const data = await getTrendData(months);
    return NextResponse.json(data);
  } catch (error) {
    logger.warn('[finance/trend] 조회 실패', { error: String(error) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
