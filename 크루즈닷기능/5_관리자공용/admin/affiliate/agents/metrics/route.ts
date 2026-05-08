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

function escapeCsv(value: string | number | null | undefined) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

type AgentTrendAccumulator = {
  saleCount: number;
  saleAmount: number;
  salesCommission: number;
  overrideCommission: number;
  branchContribution: number;
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
    const managerIdParam = searchParams.get('managerId');
    const format = searchParams.get('format');
    const managerId = managerIdParam ? Number(managerIdParam) : undefined;
    const { from, to, fromParam, toParam } = parseDateRange(searchParams);

    if (managerIdParam && Number.isNaN(Number(managerIdParam))) {
      return NextResponse.json({ ok: false, message: '잘못된 매니저 ID 입니다.' }, { status: 400 });
    }

    const relationFilter: Prisma.AffiliateRelationWhereInput = {
      status: { in: ['ACTIVE', 'PAUSED'] },
    };

    if (managerId !== undefined) {
      relationFilter.managerId = managerId;
    }

    const relations = await prisma.affiliateRelation.findMany({
      where: relationFilter,
      select: {
        managerId: true,
        agentId: true,
        status: true,
        connectedAt: true,
        AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            nickname: true,
            affiliateCode: true,
          },
        },
      },
    });

    const managerInfoMap = new Map<number, { id: number; name: string | null; affiliateCode: string | null }>();

    relations.forEach((relation) => {
      const manager = relation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile;
      if (manager) {
        managerInfoMap.set(manager.id, {
          id: manager.id,
          name: manager.displayName || manager.nickname || null,
          affiliateCode: manager.affiliateCode ?? null,
        });
      }
    });

    if (managerId !== undefined && !managerInfoMap.has(managerId)) {
      const managerProfile = await prisma.affiliateProfile.findUnique({
        where: { id: managerId },
        select: {
          id: true,
          displayName: true,
          nickname: true,
          affiliateCode: true,
        },
      });
      if (managerProfile) {
        managerInfoMap.set(managerProfile.id, {
          id: managerProfile.id,
          name: managerProfile.displayName || managerProfile.nickname || null,
          affiliateCode: managerProfile.affiliateCode ?? null,
        });
      }
    }

    const relationByAgent = relations.reduce((acc: Record<number, typeof relations>, relation) => {
      if (relation.agentId === null) return acc;
      if (!acc[relation.agentId]) acc[relation.agentId] = [];
      acc[relation.agentId].push(relation);
      return acc;
    }, {} as Record<number, typeof relations>);

    const managerIds = [...new Set(relations.map((relation) => relation.managerId))];

    const agentIdsFromRelations = relations.map((relation) => relation.agentId).filter((id): id is number => Boolean(id));

    const agentWhere: Prisma.AffiliateProfileWhereInput = {
      type: 'SALES_AGENT',
    };

    if (search) {
      agentWhere.OR = [
        { displayName: { contains: search } },
        { nickname: { contains: search } },
        { contactPhone: { contains: search } },
        { affiliateCode: { contains: search } },
      ];
    }

    if (managerId !== undefined) {
      agentWhere.id = { in: agentIdsFromRelations.length ? agentIdsFromRelations : [-1] };
    }

    const agents = await prisma.affiliateProfile.findMany({
      where: agentWhere,
      select: {
        id: true,
        affiliateCode: true,
        displayName: true,
        nickname: true,
        contactPhone: true,
        status: true,
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: 300,
    });

    if (agents.length === 0) {
      return NextResponse.json({
        ok: true,
        agents: [],
        totals: null,
        filters: { from: fromParam, to: toParam, search: search || undefined, managerId },
        managers: Array.from(managerInfoMap.values()),
        months: [],
      });
    }

    const agentIds = agents.map((agent) => agent.id);

    const trendEnd = to ?? new Date();
    const trendStartBase = from ?? addMonths(trendEnd, -(TREND_MONTHS - 1));
    const trendStart = startOfMonth(trendStartBase);
    const monthSeries = buildMonthSeries(trendStart, trendEnd, TREND_MONTHS);

    const agentTrendRecords = agentIds.length
      ? await prisma.affiliateSale.findMany({
          where: {
            agentId: { in: agentIds },
            status: { in: ['CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED'] as string[] },
            saleDate: {
              gte: trendStart,
              lte: trendEnd,
            },
          },
          select: {
            id: true,
            agentId: true,
            saleDate: true,
            saleAmount: true,
            branchCommission: true,
            salesCommission: true,
            overrideCommission: true,
          },
        })
      : [];

    const agentTrendMap = new Map<number, Map<string, AgentTrendAccumulator>>();
    agentTrendRecords.forEach((sale) => {
      if (!sale.agentId || !sale.saleDate) return;
      const monthKey = formatMonthKey(sale.saleDate);
      const agentBucket = agentTrendMap.get(sale.agentId) ?? new Map<string, AgentTrendAccumulator>();
      if (!agentTrendMap.has(sale.agentId)) {
        agentTrendMap.set(sale.agentId, agentBucket);
      }
      const bucket = agentBucket.get(monthKey) ?? {
        saleCount: 0,
        saleAmount: 0,
        salesCommission: 0,
        overrideCommission: 0,
        branchContribution: 0,
      };
      bucket.saleCount += 1;
      bucket.saleAmount += sale.saleAmount ?? 0;
      bucket.salesCommission += sale.salesCommission ?? 0;
      bucket.overrideCommission += sale.overrideCommission ?? 0;
      bucket.branchContribution += sale.branchCommission ?? 0;
      agentBucket.set(monthKey, bucket);
    });

    const recentLeadsRecords = agentIds.length
      ? await prisma.affiliateLead.findMany({
          where: { agentId: { in: agentIds } },
          orderBy: { createdAt: 'desc' },
          take: 500,
          select: {
            id: true,
            agentId: true,
            customerName: true,
            customerPhone: true,
            status: true,
            createdAt: true,
          },
        })
      : [];

    const recentLeadsMap = new Map<number, Array<{ id: number; customerName: string | null; customerPhone: string | null; status: string; createdAt: string }>>();
    recentLeadsRecords.forEach((lead) => {
      if (!lead.agentId) return;
      const list = recentLeadsMap.get(lead.agentId) ?? [];
      if (list.length < 10) {
        list.push({
          id: lead.id,
          customerName: lead.customerName ?? null,
          customerPhone: lead.customerPhone ?? null,
          status: lead.status,
          createdAt: lead.createdAt.toISOString(),
        });
        recentLeadsMap.set(lead.agentId, list);
      }
    });

    const leadWhereBase: Prisma.AffiliateLeadWhereInput = {
      agentId: { in: agentIds },
    };
    if (from || to) {
      leadWhereBase.createdAt = {};
      if (from) leadWhereBase.createdAt.gte = from;
      if (to) leadWhereBase.createdAt.lte = to;
    }

    const leadGroups = await prisma.affiliateLead.groupBy({
      by: ['agentId', 'status'],
      where: { ...leadWhereBase, agentId: { not: null } },
      _count: { _all: true },
    });

    const saleWhereBase: Prisma.AffiliateSaleWhereInput = {
      agentId: { in: agentIds },
      status: { in: ['CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED'] },
    };
    if (from || to) {
      saleWhereBase.confirmedAt = {};
      if (from) saleWhereBase.confirmedAt.gte = from;
      if (to) saleWhereBase.confirmedAt.lte = to;
    }

    const saleGroups = await prisma.affiliateSale.groupBy({
      by: ['agentId'],
      where: { ...saleWhereBase, agentId: { not: null } },
      _count: { _all: true },
      _sum: {
        saleAmount: true,
        netRevenue: true,
        branchCommission: true,
        overrideCommission: true,
        salesCommission: true,
      },
    });

    const ledgerGroups = await prisma.commissionLedger.groupBy({
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
    });

    const leadByAgent = leadGroups.reduce((acc: Record<number, Record<string, number>>, row) => {
      if (row.agentId === null) return acc;
      if (!acc[row.agentId]) acc[row.agentId] = {};
      acc[row.agentId][row.status] = row._count._all;
      return acc;
    }, {} as Record<number, Record<string, number>>);

    const saleByAgent = saleGroups.reduce((acc: Record<number, (typeof saleGroups)[number]>, row) => {
      if (row.agentId === null) return acc;
      acc[row.agentId] = row;
      return acc;
    }, {} as Record<number, (typeof saleGroups)[number]>);

    const ledgerByAgent = ledgerGroups.reduce((acc: Record<number, typeof ledgerGroups>, row) => {
      if (row.profileId === null) return acc;
      if (!acc[row.profileId]) acc[row.profileId] = [];
      acc[row.profileId].push(row);
      return acc;
    }, {} as Record<number, typeof ledgerGroups>);

    const totals = {
      agentCount: agents.length,
      totalLeads: 0,
      totalSalesCount: 0,
      totalSalesAmount: 0,
      totalNetRevenue: 0,
      totalSalesCommission: 0,
      totalOverrideCommission: 0,
      totalBranchContribution: 0,
      totalWithholding: 0,
      totalSettled: 0,
      totalPending: 0,
      totalNetCommission: 0,
    };

    const agentMetrics = agents.map((agent) => {
      const leads = leadByAgent[agent.id] || {};
      const leadTotal = Object.values(leads).reduce((sum: number, value: number) => sum + value, 0);

      const sales = saleByAgent[agent.id];
      const saleCount = sales?._count?._all ?? 0;
      const saleAmount = sales?._sum?.saleAmount ?? 0;
      const netRevenue = sales?._sum?.netRevenue ?? 0;
      const salesCommission = sales?._sum?.salesCommission ?? 0;
      const overrideCommission = sales?._sum?.overrideCommission ?? 0;
      const branchCommission = sales?._sum?.branchCommission ?? 0;

      totals.totalLeads += Number(leadTotal) || 0;
      totals.totalSalesCount += saleCount;
      totals.totalSalesAmount += saleAmount ?? 0;
      totals.totalNetRevenue += netRevenue ?? 0;
      totals.totalSalesCommission += salesCommission ?? 0;
      totals.totalOverrideCommission += overrideCommission ?? 0;
      totals.totalBranchContribution += branchCommission ?? 0;

      const ledgerSummary = ledgerByAgent[agent.id] || [];
      const ledgerTotals = ledgerSummary.reduce(
        (acc, row) => {
          const amount = row._sum.amount ?? 0;
          const withholding = row._sum.withholdingAmount ?? 0;
          if (row.isSettled) {
            acc.settled += amount;
          } else {
            acc.pending += amount;
          }
          if (row.entryType === 'SALES_COMMISSION') {
            if (row.isSettled) acc.salesSettled += amount;
            else acc.salesPending += amount;
            acc.salesWithholding += withholding ?? 0;
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
          settled: 0,
          pending: 0,
          withholding: 0,
          withholdingAdjustments: 0,
          withholdingSettled: 0,
          withholdingPending: 0,
          salesSettled: 0,
          salesPending: 0,
          overrideSettled: 0,
          overridePending: 0,
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

      totals.totalSettled += ledgerTotals.settled ?? 0;
      totals.totalPending += ledgerTotals.pending ?? 0;
      totals.totalWithholding += ledgerTotals.totalWithholding ?? ledgerTotals.withholding ?? 0;
      totals.totalNetCommission += ledgerTotals.netCommission ?? 0;

      const trendBuckets = agentTrendMap.get(agent.id) ?? new Map<string, AgentTrendAccumulator>();
      const monthlyTrend = monthSeries.map((month) => {
        const bucket = trendBuckets.get(month);
        return {
          month,
          saleCount: bucket?.saleCount ?? 0,
          saleAmount: bucket?.saleAmount ?? 0,
          salesCommission: bucket?.salesCommission ?? 0,
          overrideCommission: bucket?.overrideCommission ?? 0,
          branchContribution: bucket?.branchContribution ?? 0,
        };
      });

      const recentLeads = recentLeadsMap.get(agent.id) ?? [];

      return {
        agent,
        managerRelations: relationByAgent[agent.id] || [],
        leads: {
          total: leadTotal,
          byStatus: leads,
        },
        sales: {
          count: saleCount,
          saleAmount,
          netRevenue,
          salesCommission,
          overrideCommission,
          branchContribution: branchCommission,
        },
        ledger: ledgerTotals,
        monthlyTrend,
        recentLeads,
      };
    });

    if (format === 'csv') {
      const header = [
        'agent_id',
        'agent_name',
        'affiliate_code',
        'managers',
        'sales_count',
        'sales_amount',
        'sales_commission',
        'override_commission',
        'branch_contribution',
        'lead_total',
        'ledger_settled',
        'ledger_pending',
      ].join(',');

      const csvRows = agentMetrics.map((agent) => {
        const managerNames = agent.managerRelations
          .map((relation) => relation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile?.displayName || relation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile?.nickname || `#${relation.managerId}`)
          .join('; ');
        const agentName = agent.agent.displayName || agent.agent.nickname || `판매원 #${agent.agent.id}`;
        return [
          escapeCsv(agent.agent.id),
          escapeCsv(agentName),
          escapeCsv(agent.agent.affiliateCode),
          escapeCsv(managerNames),
          escapeCsv(agent.sales.count),
          escapeCsv(agent.sales.saleAmount ?? 0),
          escapeCsv(agent.sales.salesCommission ?? 0),
          escapeCsv(agent.sales.overrideCommission ?? 0),
          escapeCsv(agent.sales.branchContribution ?? 0),
          escapeCsv(agent.leads.total),
          escapeCsv(agent.ledger.settled),
          escapeCsv(agent.ledger.pending),
        ].join(',');
      });

      const csv = [header, ...csvRows].join('\n');
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="agent-metrics-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      agents: agentMetrics,
      totals,
      filters: {
        from: fromParam,
        to: toParam,
        search: search || undefined,
        managerId,
      },
      managers: Array.from(managerInfoMap.values()),
      months: monthSeries,
    });
  } catch (error: any) {
    console.error('GET /api/admin/affiliate/agents/metrics error:', error);
    console.error('Error details:', error?.message, error?.code, error?.meta);
    return NextResponse.json({ 
      ok: false, 
      message: 'Server error',
      error: error?.message || String(error),
      ...(process.env.NODE_ENV === 'development' ? { details: error } : {})
    }, { status: 500 });
  }
}
