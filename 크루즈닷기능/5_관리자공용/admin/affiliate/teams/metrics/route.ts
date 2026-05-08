export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

function requireAdmin(user: { id: number } | null, role: string | undefined) {
  if (!user || role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

function parseDateRange(searchParams: URLSearchParams) {
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  let from: Date | undefined;
  let to: Date | undefined;

  if (fromParam) {
    const parsed = new Date(`${fromParam}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      from = parsed;
    }
  }

  if (toParam) {
    const parsed = new Date(`${toParam}T23:59:59`);
    if (!Number.isNaN(parsed.getTime())) {
      to = parsed;
    }
  }

  return { from, to, fromParam: fromParam ?? undefined, toParam: toParam ?? undefined };
}

const TREND_MONTHS = 6;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function buildMonthSeries(start: Date, end: Date, limit = TREND_MONTHS) {
  const months: string[] = [];
  let cursor = startOfMonth(start);
  const endMonth = startOfMonth(end);
  while ((cursor <= endMonth || months.length === 0) && months.length < limit + 12) {
    months.push(formatMonthKey(cursor));
    cursor = addMonths(cursor, 1);
    if (cursor > endMonth && months.length >= limit) {
      break;
    }
  }
  return months.slice(-limit);
}

function formatMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

type TrendAccumulator = {
  saleCount: number;
  saleAmount: number;
  branchCommission: number;
  overrideCommission: number;
  salesCommission: number;
};

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(sessionUser, dbUser?.role);
    if (guard) return guard;

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim();
    const { from, to, fromParam, toParam } = parseDateRange(searchParams);

    const managerWhere: Prisma.AffiliateProfileWhereInput = {
      type: 'BRANCH_MANAGER',
    };

    if (search) {
      managerWhere.OR = [
        { displayName: { contains: search } },
        { nickname: { contains: search } },
        { branchLabel: { contains: search } },
        { contactPhone: { contains: search } },
        { affiliateCode: { contains: search } },
      ];
    }

    const managers = await prisma.affiliateProfile.findMany({
      where: managerWhere,
      select: {
        id: true,
        affiliateCode: true,
        displayName: true,
        nickname: true,
        branchLabel: true,
        contactPhone: true,
        status: true,
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: 200,
    });

    if (managers.length === 0) {
      return NextResponse.json({ ok: true, managers: [], totals: null, filters: { from: fromParam, to: toParam } });
    }

    const managerIds = managers.map((manager) => manager.id);

    const relationRows = await prisma.affiliateRelation.findMany({
      where: {
        managerId: { in: managerIds },
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      select: {
        managerId: true,
        agentId: true,
        status: true,
        connectedAt: true,
        AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
            nickname: true,
            contactPhone: true,
            status: true,
          },
        },
      },
    });

    const relationsByManager = relationRows.reduce(
      (acc: Record<number, typeof relationRows>, relation) => {
        if (!acc[relation.managerId]) acc[relation.managerId] = [];
        acc[relation.managerId].push(relation);
        return acc;
      },
      {} as Record<number, typeof relationRows>,
    );

    const agentIds = relationRows.map((relation) => relation.agentId).filter((id): id is number => Boolean(id));

    const trendEnd = to ?? new Date();
    const trendStartBase = from ?? addMonths(trendEnd, -(TREND_MONTHS - 1));
    const trendStart = startOfMonth(trendStartBase);
    const monthSeries = buildMonthSeries(trendStart, trendEnd, TREND_MONTHS);

    const salesTrendRecords = await prisma.affiliateSale.findMany({
      where: {
        managerId: { in: managerIds },
        status: { in: ['CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED'] as string[] },
        saleDate: {
          gte: trendStart,
          lte: trendEnd,
        },
      },
      select: {
        id: true,
        managerId: true,
        saleDate: true,
        saleAmount: true,
        branchCommission: true,
        overrideCommission: true,
        salesCommission: true,
      },
    });

    const managerTrendMap = new Map<number, Map<string, TrendAccumulator>>();

    salesTrendRecords.forEach((sale) => {
      if (!sale.managerId || !sale.saleDate) return;
      const monthKey = formatMonthKey(sale.saleDate);
      const managerBucket = managerTrendMap.get(sale.managerId) ?? new Map<string, TrendAccumulator>();
      if (!managerTrendMap.has(sale.managerId)) {
        managerTrendMap.set(sale.managerId, managerBucket);
      }
      const bucket = managerBucket.get(monthKey) ?? {
        saleCount: 0,
        saleAmount: 0,
        branchCommission: 0,
        overrideCommission: 0,
        salesCommission: 0,
      };
      bucket.saleCount += 1;
      bucket.saleAmount += sale.saleAmount ?? 0;
      bucket.branchCommission += sale.branchCommission ?? 0;
      bucket.overrideCommission += sale.overrideCommission ?? 0;
      bucket.salesCommission += sale.salesCommission ?? 0;
      managerBucket.set(monthKey, bucket);
    });

    const leadWhereBase: Prisma.AffiliateLeadWhereInput = {
      managerId: { in: managerIds },
    };
    if (from || to) {
      leadWhereBase.createdAt = {};
      if (from) leadWhereBase.createdAt.gte = from;
      if (to) leadWhereBase.createdAt.lte = to;
    }

    const leadStatusGroups = await prisma.affiliateLead.groupBy({
      by: ['managerId', 'status'],
      where: { ...leadWhereBase, managerId: { not: null } },
      _count: { _all: true },
    });

    const leadAgentGroups = agentIds.length
      ? await prisma.affiliateLead.groupBy({
          by: ['agentId', 'status'],
          where: {
            agentId: { in: agentIds },
            ...(from || to
              ? {
                  createdAt: {
                    ...(from ? { gte: from } : {}),
                    ...(to ? { lte: to } : {}),
                  },
                }
              : {}),
          },
          _count: { _all: true },
        })
      : [];

    const saleWhereBase: Prisma.AffiliateSaleWhereInput = {
      managerId: { in: managerIds },
      status: { in: ['CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED'] },
    };

    if (from || to) {
      saleWhereBase.confirmedAt = {};
      if (from) saleWhereBase.confirmedAt.gte = from;
      if (to) saleWhereBase.confirmedAt.lte = to;
    }

    const saleGroups = await prisma.affiliateSale.groupBy({
      by: ['managerId'],
      where: { ...saleWhereBase, managerId: { not: null } },
      _count: { _all: true },
      _sum: {
        saleAmount: true,
        netRevenue: true,
        branchCommission: true,
        overrideCommission: true,
        salesCommission: true,
      },
    });

    const saleAgentGroups = agentIds.length
      ? await prisma.affiliateSale.groupBy({
          by: ['agentId'],
          where: {
            agentId: { in: agentIds },
            status: { in: ['CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED'] },
            ...(from || to
              ? {
                  confirmedAt: {
                    ...(from ? { gte: from } : {}),
                    ...(to ? { lte: to } : {}),
                  },
                }
              : {}),
          },
          _count: { _all: true },
          _sum: {
            saleAmount: true,
            netRevenue: true,
            branchCommission: true,
            overrideCommission: true,
            salesCommission: true,
          },
        })
      : [];

    const ledgerGroups = await prisma.commissionLedger.groupBy({
      by: ['profileId', 'entryType', 'isSettled'],
      where: {
        profileId: { in: managerIds },
        entryType: { in: ['BRANCH_COMMISSION', 'OVERRIDE_COMMISSION', 'WITHHOLDING'] },
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      _sum: { amount: true, withholdingAmount: true },
      _count: { _all: true },
    });

    const ledgerAgentGroups = agentIds.length
      ? await prisma.commissionLedger.groupBy({
          by: ['profileId', 'entryType', 'isSettled'],
          where: {
            profileId: { in: agentIds },
            entryType: { in: ['SALES_COMMISSION', 'OVERRIDE_COMMISSION', 'WITHHOLDING'] },
            ...(from || to
              ? {
                  createdAt: {
                    ...(from ? { gte: from } : {}),
                    ...(to ? { lte: to } : {}),
                  },
                }
              : {}),
          },
          _sum: { amount: true, withholdingAmount: true },
          _count: { _all: true },
        })
      : [];

    const leadStatusByManager = leadStatusGroups.reduce(
      (acc: Record<number, Record<string, number>>, row) => {
        if (!acc[row.managerId]) acc[row.managerId] = {};
        acc[row.managerId][row.status] = row._count._all;
        return acc;
      },
      {} as Record<number, Record<string, number>>,
    );

    const salesByManager = saleGroups.reduce(
      (acc: Record<number, (typeof saleGroups)[number]>, row) => {
        if (row.managerId !== null) {
          acc[row.managerId] = row;
        }
        return acc;
      },
      {} as Record<number, (typeof saleGroups)[number]>,
    );

    const ledgerByManager = ledgerGroups.reduce((acc: Record<number, typeof ledgerGroups>, row) => {
      if (row.profileId === null) return acc;
      if (!acc[row.profileId]) acc[row.profileId] = [];
      acc[row.profileId].push(row);
      return acc;
    }, {} as Record<number, typeof ledgerGroups>);

    const leadStatusByAgent = leadAgentGroups.reduce(
      (acc: Record<number, Record<string, number>>, row) => {
        if (row.agentId === null) return acc;
        if (!acc[row.agentId]) acc[row.agentId] = {};
        acc[row.agentId][row.status] = row._count._all;
        return acc;
      },
      {} as Record<number, Record<string, number>>,
    );

    const salesByAgent = saleAgentGroups.reduce(
      (acc: Record<number, (typeof saleAgentGroups)[number]>, row) => {
        if (row.agentId !== null) {
          acc[row.agentId] = row;
        }
        return acc;
      },
      {} as Record<number, (typeof saleAgentGroups)[number]>,
    );

    const ledgerByAgent = ledgerAgentGroups.reduce((acc: Record<number, typeof ledgerAgentGroups>, row) => {
      if (row.profileId === null) return acc;
      if (!acc[row.profileId]) acc[row.profileId] = [];
      acc[row.profileId].push(row);
      return acc;
    }, {} as Record<number, typeof ledgerAgentGroups>);

    const totals = {
      managerCount: managers.length,
      agentCount: agentIds.length,
      totalSalesCount: 0,
      totalSalesAmount: 0,
      totalNetRevenue: 0,
      totalBranchCommission: 0,
      totalOverrideCommission: 0,
      totalSalesCommission: 0,
      totalLeads: 0,
      totalWithholding: 0,
      totalNetCommission: 0,
    };

    const managerMetrics = managers.map((manager) => {
      const relationList = relationsByManager[manager.id] || [];
      const agentSummaries = relationList.map((relation) => {
        const agent = relation.AffiliateProfile_AffiliateRelation_agentIdToAffiliateProfile;
        const agentLeadSummary = leadStatusByAgent[relation.agentId] || {};
        const agentSaleSummary = salesByAgent[relation.agentId];
        const agentLedgerSummary = ledgerByAgent[relation.agentId] || [];

        const saleCount = agentSaleSummary?._count?._all ?? 0;
        const saleAmount = agentSaleSummary?._sum?.saleAmount ?? 0;
        const netRevenue = agentSaleSummary?._sum?.netRevenue ?? 0;
        const salesCommission = agentSaleSummary?._sum?.salesCommission ?? 0;
        const overrideCommission = agentSaleSummary?._sum?.overrideCommission ?? 0;

        const ledgerTotals = agentLedgerSummary.reduce(
          (acc, row) => {
            const amount = row._sum.amount ?? 0;
            const withholding = row._sum.withholdingAmount ?? 0;
            if (row.isSettled) {
              acc.settled += amount;
            } else {
              acc.pending += amount;
            }
            if (row.entryType === 'WITHHOLDING') {
              if (row.isSettled) acc.withholdingSettled += amount;
              else acc.withholdingPending += amount;
              acc.withholdingAdjustments += amount;
            }
            if (row.entryType === 'SALES_COMMISSION') {
              acc.salesWithholding += withholding ?? 0;
            }
            if (row.entryType === 'OVERRIDE_COMMISSION') {
              acc.overrideWithholding += withholding ?? 0;
            }
            acc.withholding += withholding ?? 0;
            return acc;
          },
          {
            settled: 0,
            pending: 0,
            withholding: 0,
            withholdingAdjustments: 0,
            withholdingSettled: 0,
            withholdingPending: 0,
            salesWithholding: 0,
            overrideWithholding: 0,
            totalWithholding: 0,
            grossCommission: 0,
            netCommission: 0,
          },
        );

        ledgerTotals.totalWithholding = ledgerTotals.salesWithholding + ledgerTotals.overrideWithholding;
        const agentGrossCommission = (salesCommission ?? 0) + (overrideCommission ?? 0);
        ledgerTotals.grossCommission = agentGrossCommission;
        ledgerTotals.netCommission = agentGrossCommission - ledgerTotals.totalWithholding;

        return {
          agent,
          relation: {
            status: relation.status,
            connectedAt: relation.connectedAt,
          },
          leads: {
            total: Object.values(agentLeadSummary).reduce((sum: number, value: number) => sum + value, 0),
            byStatus: agentLeadSummary,
          },
          sales: {
            count: saleCount,
            saleAmount,
            netRevenue,
            salesCommission,
            overrideCommission,
          },
          ledger: ledgerTotals,
        };
      });

      const leadSummary = leadStatusByManager[manager.id] || {};
      const leadTotal = Object.values(leadSummary).reduce((sum: number, value: number) => sum + value, 0);

      const saleSummary = salesByManager[manager.id];
      const saleCount = saleSummary?._count?._all ?? 0;
      const saleAmount = saleSummary?._sum?.saleAmount ?? 0;
      const netRevenue = saleSummary?._sum?.netRevenue ?? 0;
      const branchCommission = saleSummary?._sum?.branchCommission ?? 0;
      const overrideCommission = saleSummary?._sum?.overrideCommission ?? 0;
      const salesCommission = saleSummary?._sum?.salesCommission ?? 0;

      totals.totalLeads += Number(leadTotal) || 0;
      totals.totalSalesCount += saleCount;
      totals.totalSalesAmount += saleAmount;
      totals.totalNetRevenue += netRevenue ?? 0;
      totals.totalBranchCommission += branchCommission ?? 0;
      totals.totalOverrideCommission += overrideCommission ?? 0;
      totals.totalSalesCommission += salesCommission ?? 0;

      const ledgerSummary = ledgerByManager[manager.id] || [];
      const ledgerTotals = ledgerSummary.reduce(
        (acc, row) => {
          const amount = row._sum.amount ?? 0;
          const withholding = row._sum.withholdingAmount ?? 0;
          if (row.entryType === 'BRANCH_COMMISSION') {
            if (row.isSettled) acc.branchSettled += amount;
            else acc.branchPending += amount;
            acc.branchWithholding += withholding ?? 0;
          }
          if (row.entryType === 'OVERRIDE_COMMISSION') {
            if (row.isSettled) acc.overrideSettled += amount;
            else acc.overridePending += amount;
            acc.overrideWithholding += withholding ?? 0;
          }
          if (row.entryType === 'WITHHOLDING') {
            if (row.isSettled) acc.withholdingSettled += amount;
            else acc.withholdingPending += amount;
            acc.withholdingAdjustments += amount;
          }
          acc.withholding += withholding ?? 0;
          return acc;
        },
        {
          branchSettled: 0,
          branchPending: 0,
          overrideSettled: 0,
          overridePending: 0,
          withholding: 0,
          withholdingAdjustments: 0,
          withholdingSettled: 0,
          withholdingPending: 0,
          branchWithholding: 0,
          overrideWithholding: 0,
          totalWithholding: 0,
          grossCommission: 0,
          netCommission: 0,
        },
      );

      ledgerTotals.totalWithholding = ledgerTotals.branchWithholding + ledgerTotals.overrideWithholding;
      const managerGrossCommission = (branchCommission ?? 0) + (overrideCommission ?? 0);
      ledgerTotals.grossCommission = managerGrossCommission;
      ledgerTotals.netCommission = managerGrossCommission - ledgerTotals.totalWithholding;
      totals.totalWithholding += ledgerTotals.totalWithholding;
      totals.totalNetCommission += ledgerTotals.netCommission;

      const trendBuckets = managerTrendMap.get(manager.id) ?? new Map<string, TrendAccumulator>();
      const monthlyTrend = monthSeries.map((month) => {
        const bucket = trendBuckets.get(month);
        return {
          month,
          saleCount: bucket?.saleCount ?? 0,
          saleAmount: bucket?.saleAmount ?? 0,
          branchCommission: bucket?.branchCommission ?? 0,
          overrideCommission: bucket?.overrideCommission ?? 0,
          salesCommission: bucket?.salesCommission ?? 0,
        };
      });

      return {
        manager,
        agentCount: relationList.length,
        leads: {
          total: leadTotal,
          byStatus: leadSummary,
        },
        sales: {
          count: saleCount,
          saleAmount,
          netRevenue,
          branchCommission,
          overrideCommission,
          salesCommission,
        },
        ledger: ledgerTotals,
        agents: agentSummaries,
        monthlyTrend,
      };
    });

    const hqGrossRevenue = Math.round(totals.totalNetRevenue ?? 0);
    const hqCardFees = Math.round((totals.totalSalesAmount ?? 0) * 0.035);
    const hqCorporateTax = Math.round(hqGrossRevenue * 0.1);
    const hqNetAfterFees = Math.max(hqGrossRevenue - hqCardFees - hqCorporateTax, 0);

    const enrichedTotals = {
      ...totals,
      totalWithholding: Math.round(totals.totalWithholding),
      totalNetCommission: Math.round(totals.totalNetCommission),
      hq: {
        grossRevenue: hqGrossRevenue,
        cardFees: hqCardFees,
        corporateTax: hqCorporateTax,
        netAfterFees: hqNetAfterFees,
      },
    };

    return NextResponse.json({
      ok: true,
      managers: managerMetrics,
      totals: enrichedTotals,
      filters: { from: fromParam, to: toParam, search: search || undefined },
      months: monthSeries,
    });
  } catch (error: any) {
    console.error('GET /api/admin/affiliate/teams/metrics error:', error);
    console.error('Error details:', error?.message, error?.code, error?.meta);
    return NextResponse.json({ 
      ok: false, 
      message: 'Server error',
      error: error?.message || String(error),
      ...(process.env.NODE_ENV === 'development' ? { details: error } : {})
    }, { status: 500 });
  }
}
