export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface PeriodMetrics {
  totalSaleAmount: number;
  totalCostAmount: number;
  grossProfit: number;
  grossProfitRate: number;
  salesCount: number;
  refundAmount: number;
  refundCount: number;
  refundRate: number;
  vatAmount: number;
  commissionTotal: number;
  withholdingTotal: number;
}

// APPROVED/LOCKED는 미완료 상태 — 수당 집계 포함 시 이중 계산 위험
// CONFIRMED(입금확인), PAID(지급완료), PAYOUT_SCHEDULED(지급예정)만 집계
const SALE_STATUSES = ['CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED'];
const REFUND_STATUSES = ['REFUNDED', 'CANCELLED'];

async function getPeriodMetrics(startDate: Date, endDate: Date): Promise<PeriodMetrics> {
  const [saleSummary, refundSummary] = await Promise.all([
    prisma.affiliateSale.aggregate({
      where: {
        saleDate: { gte: startDate, lt: endDate },
        status: { in: SALE_STATUSES },
      },
      _sum: {
        saleAmount: true,
        costAmount: true,
        branchCommission: true,
        salesCommission: true,
        overrideCommission: true,
        withholdingAmount: true,
      },
      _count: { id: true },
    }),
    prisma.affiliateSale.aggregate({
      where: {
        saleDate: { gte: startDate, lt: endDate },
        status: { in: REFUND_STATUSES },
      },
      _sum: { saleAmount: true },
      _count: { id: true },
    }),
  ]);

  const totalSaleAmount = Number(saleSummary._sum.saleAmount ?? 0);
  const totalCostAmount = Number(saleSummary._sum.costAmount ?? 0);
  const grossProfit = totalSaleAmount - totalCostAmount;
  const grossProfitRate = totalSaleAmount > 0 ? (grossProfit / totalSaleAmount) * 100 : 0;
  const salesCount = saleSummary._count.id;
  const refundAmount = Number(refundSummary._sum.saleAmount ?? 0);
  const refundCount = refundSummary._count.id;
  const totalCount = salesCount + refundCount;
  const refundRate = totalCount > 0 ? (refundCount / totalCount) * 100 : 0;
  const vatAmount = Math.round((totalSaleAmount / 11) * 10);
  const commissionTotal =
    Number(saleSummary._sum.branchCommission ?? 0) +
    Number(saleSummary._sum.salesCommission ?? 0) +
    Number(saleSummary._sum.overrideCommission ?? 0);
  const withholdingTotal = Number(saleSummary._sum.withholdingAmount ?? 0);

  return {
    totalSaleAmount,
    totalCostAmount,
    grossProfit,
    grossProfitRate: Math.round(grossProfitRate * 100) / 100,
    salesCount,
    refundAmount,
    refundCount,
    refundRate: Math.round(refundRate * 100) / 100,
    vatAmount,
    commissionTotal,
    withholdingTotal,
  };
}

function getGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

function buildDateRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(Date.UTC(year, month, 1));
  end.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

const getDashboardData = unstable_cache(
  async (year: number, month: number) => {
    const current = buildDateRange(year, month);

    const prevMonthDate = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    const prevMonth = buildDateRange(prevMonthDate.year, prevMonthDate.month);

    const prevYear = buildDateRange(year - 1, month);

    const [currentMetrics, prevMonthMetrics, prevYearMetrics] = await Promise.all([
      getPeriodMetrics(current.start, current.end),
      getPeriodMetrics(prevMonth.start, prevMonth.end),
      getPeriodMetrics(prevYear.start, prevYear.end),
    ]);

    const unsettled = await prisma.commissionLedger.aggregate({
      where: { isSettled: false },
      _sum: { amount: true, withholdingAmount: true },
      _count: { id: true },
    });
    const unsettledGross = Number(unsettled._sum.amount ?? 0);
    const unsettledWithholding = Number(unsettled._sum.withholdingAmount ?? 0);

    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setUTCHours(0, 0, 0, 0);
    fortyFiveDaysAgo.setUTCDate(fortyFiveDaysAgo.getUTCDate() - 45);

    const threeDaysAgo = new Date();
    threeDaysAgo.setUTCHours(0, 0, 0, 0);
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);

    const [unlinkedPayments, pendingRefundOver3Days, unsettledOver45Days] = await Promise.all([
      prisma.payment.count({
        where: {
          status: 'completed',
          saleId: null,
          paidAt: { not: null },
        },
      }),
      prisma.affiliateSale.count({
        where: {
          status: { in: REFUND_STATUSES },
          updatedAt: { lt: threeDaysAgo },
        },
      }),
      prisma.commissionLedger.count({
        where: {
          isSettled: false,
          createdAt: { lt: fortyFiveDaysAgo },
        },
      }),
    ]);

    return {
      ok: true,
      period: { year, month },
      current: currentMetrics,
      prevMonth: prevMonthMetrics,
      prevYear: prevYearMetrics,
      growth: {
        mom: getGrowthRate(currentMetrics.totalSaleAmount, prevMonthMetrics.totalSaleAmount),
        yoy: getGrowthRate(currentMetrics.totalSaleAmount, prevYearMetrics.totalSaleAmount),
      },
      unsettledCommission: {
        totalAmount: unsettledGross,
        withholdingAmount: unsettledWithholding,
        netAmount: unsettledGross - unsettledWithholding,
        count: unsettled._count.id,
      },
      auditAlerts: {
        unlinkedPayments,
        pendingRefundOver3Days,
        unsettledOver45Days,
      },
    };
  },
  ['finance-dashboard'],
  { revalidate: 300 }
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
    const now = new Date();
    const year = parseInt(searchParams.get('year') ?? String(now.getUTCFullYear()), 10);
    const month = parseInt(searchParams.get('month') ?? String(now.getUTCMonth() + 1), 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ ok: false, error: '잘못된 year/month 파라미터' }, { status: 400 });
    }

    const data = await getDashboardData(year, month);
    return NextResponse.json(data);
  } catch (error) {
    logger.warn('[finance/dashboard] 조회 실패', { error: String(error) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
