export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';

// 정산 수수료 상수 (변경 시 이 파일 상단만 수정)
const HQ_CARD_FEE_RATE = 0.035;      // 카드 수수료 3.5%
const HQ_CORPORATE_TAX_RATE = 0.1;   // 법인세 10%

// addUTCMonths inline (mabiz dateUtils에 없음)
function addUTCMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function parseDateRange(searchParams: URLSearchParams) {
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  let from: Date | undefined;
  let to: Date | undefined;

  if (fromParam) {
    const parsed = new Date(`${fromParam}T00:00:00+09:00`);
    if (!Number.isNaN(parsed.getTime())) {
      from = parsed;
    }
  }

  if (toParam) {
    const parsed = new Date(`${toParam}T23:59:59+09:00`);
    if (!Number.isNaN(parsed.getTime())) {
      to = parsed;
    }
  }

  return { from, to, fromParam: fromParam ?? undefined, toParam: toParam ?? undefined };
}

const TREND_MONTHS = 6;

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number) {
  return addUTCMonths(date, months);
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
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

type TrendAccumulator = {
  saleCount: number;
  saleAmount: number;
  branchCommission: number;
  overrideCommission: number;
  salesCommission: number;
};

// Raw SQL 결과 타입
type AffiliateProfileRow = {
  id: number;
  affiliateCode: string | null;
  displayName: string | null;
  nickname: string | null;
  branchLabel: string | null;
  contactPhone: string | null;
  status: string | null;
};

type AffiliateRelationRow = {
  managerId: number;
  agentId: number;
  status: string;
  connectedAt: Date | null;
  agent_id: number;
  agent_affiliateCode: string | null;
  agent_displayName: string | null;
  agent_nickname: string | null;
  agent_contactPhone: string | null;
  agent_status: string | null;
};

type SaleTrendRow = {
  id: number;
  managerId: number | null;
  saleDate: Date | null;
  saleAmount: number | null;
  branchCommission: number | null;
  overrideCommission: number | null;
  salesCommission: number | null;
};

type LeadStatusGroupRow = {
  managerId: number | null;
  status: string;
  count: bigint;
};

type LeadAgentGroupRow = {
  agentId: number | null;
  status: string;
  count: bigint;
};

type SaleGroupRow = {
  managerId: number | null;
  count: bigint;
  sum_saleAmount: number | null;
  sum_netRevenue: number | null;
  sum_branchCommission: number | null;
  sum_overrideCommission: number | null;
  sum_salesCommission: number | null;
};

type SaleAgentGroupRow = {
  agentId: number | null;
  count: bigint;
  sum_saleAmount: number | null;
  sum_netRevenue: number | null;
  sum_branchCommission: number | null;
  sum_overrideCommission: number | null;
  sum_salesCommission: number | null;
};

type LedgerGroupRow = {
  profileId: number | null;
  entryType: string;
  isSettled: boolean;
  sum_amount: number | null;
  sum_withholdingAmount: number | null;
  count: bigint;
};

export async function GET(req: NextRequest) {
  // ────────────────────────────────────────────────────────
  // RBAC: GLOBAL_ADMIN 전용 — 커미션/원천징수/본사순이익 민감 데이터
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN'], // OWNER/AGENT 제거
    errorMessage: '어필리에이트 팀 지표는 관리자 전용입니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await getAuthContext();
    // enforceRBAC(allowedRoles: ['GLOBAL_ADMIN'])에서 이미 차단됨 — 중복 체크 불필요

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim();
    const { from, to, fromParam, toParam } = parseDateRange(searchParams);

    // managers 조회 (AffiliateProfile WHERE type = 'BRANCH_MANAGER')
    // $queryRawUnsafe → Prisma.sql 태그로 교체 (SQL 인젝션 방지)
    const managers = search
      ? await prisma.$queryRaw<AffiliateProfileRow[]>(Prisma.sql`
          SELECT id, "affiliateCode", "displayName", nickname, "branchLabel", "contactPhone", status
          FROM "AffiliateProfile"
          WHERE type = 'BRANCH_MANAGER'
            AND (
              "displayName" ILIKE ${`%${search}%`}
              OR nickname ILIKE ${`%${search}%`}
              OR "branchLabel" ILIKE ${`%${search}%`}
              OR "contactPhone" ILIKE ${`%${search}%`}
              OR "affiliateCode" ILIKE ${`%${search}%`}
            )
          ORDER BY "displayName" ASC, id ASC
          LIMIT 200
        `)
      : await prisma.$queryRaw<AffiliateProfileRow[]>(Prisma.sql`
          SELECT id, "affiliateCode", "displayName", nickname, "branchLabel", "contactPhone", status
          FROM "AffiliateProfile"
          WHERE type = 'BRANCH_MANAGER'
          ORDER BY "displayName" ASC, id ASC
          LIMIT 200
        `);

    if (managers.length === 0) {
      return NextResponse.json({ ok: true, managers: [], totals: null, filters: { from: fromParam, to: toParam } });
    }

    const managerIds = managers.map((m) => m.id);

    // relations 조회 (AffiliateRelation + agentProfile join)
    const relationRows = await prisma.$queryRaw<AffiliateRelationRow[]>(Prisma.sql`
      SELECT
        r."managerId",
        r."agentId",
        r.status,
        r."connectedAt",
        a.id AS agent_id,
        a."affiliateCode" AS "agent_affiliateCode",
        a."displayName" AS "agent_displayName",
        a.nickname AS agent_nickname,
        a."contactPhone" AS "agent_contactPhone",
        a.status AS agent_status
      FROM "AffiliateRelation" r
      LEFT JOIN "AffiliateProfile" a ON a.id = r."agentId"
      WHERE r."managerId" IN (${Prisma.join(managerIds)})
        AND r.status IN ('ACTIVE', 'PAUSED')
    `);

    const relationsByManager: Record<number, AffiliateRelationRow[]> = {};
    for (const relation of relationRows) {
      if (!relationsByManager[relation.managerId]) relationsByManager[relation.managerId] = [];
      relationsByManager[relation.managerId]!.push(relation);
    }

    const agentIds = relationRows.map((r) => r.agentId).filter((id): id is number => Boolean(id));

    const trendEnd = to ?? new Date();
    const trendStartBase = from ?? addMonths(trendEnd, -(TREND_MONTHS - 1));
    const trendStart = startOfMonth(trendStartBase);
    const monthSeries = buildMonthSeries(trendStart, trendEnd, TREND_MONTHS);

    // 판매 트렌드 (AffiliateSale)
    const salesTrendRecords = await prisma.$queryRaw<SaleTrendRow[]>(Prisma.sql`
      SELECT id, "managerId", "saleDate", "saleAmount", "branchCommission", "overrideCommission", "salesCommission"
      FROM "AffiliateSale"
      WHERE "managerId" IN (${Prisma.join(managerIds)})
        AND status IN ('CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED')
        AND "saleDate" >= ${trendStart}
        AND "saleDate" <= ${trendEnd}
    `);

    const managerTrendMap = new Map<number, Map<string, TrendAccumulator>>();

    salesTrendRecords.forEach((sale) => {
      if (!sale.managerId || !sale.saleDate) return;
      const monthKey = formatMonthKey(new Date(sale.saleDate));
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

    // Lead status groups by manager (AffiliateLead)
    const leadStatusGroups = await prisma.$queryRaw<LeadStatusGroupRow[]>(Prisma.sql`
      SELECT "managerId", status, COUNT(*) AS count
      FROM "AffiliateLead"
      WHERE "managerId" IN (${Prisma.join(managerIds)})
      ${from ? Prisma.sql`AND "createdAt" >= ${from}` : Prisma.empty}
      ${to ? Prisma.sql`AND "createdAt" <= ${to}` : Prisma.empty}
      GROUP BY "managerId", status
    `);

    // Lead status groups by agent
    let leadAgentGroups: LeadAgentGroupRow[] = [];
    if (agentIds.length) {
      leadAgentGroups = await prisma.$queryRaw<LeadAgentGroupRow[]>(Prisma.sql`
        SELECT "agentId", status, COUNT(*) AS count
        FROM "AffiliateLead"
        WHERE "agentId" IN (${Prisma.join(agentIds)})
        ${from ? Prisma.sql`AND "createdAt" >= ${from}` : Prisma.empty}
        ${to ? Prisma.sql`AND "createdAt" <= ${to}` : Prisma.empty}
        GROUP BY "agentId", status
      `);
    }

    // Sale groups by manager (AffiliateSale)
    const saleGroups = await prisma.$queryRaw<SaleGroupRow[]>(Prisma.sql`
      SELECT
        "managerId",
        COUNT(*) AS count,
        SUM("saleAmount") AS sum_saleAmount,
        SUM("netRevenue") AS sum_netRevenue,
        SUM("branchCommission") AS sum_branchCommission,
        SUM("overrideCommission") AS sum_overrideCommission,
        SUM("salesCommission") AS sum_salesCommission
      FROM "AffiliateSale"
      WHERE "managerId" IN (${Prisma.join(managerIds)})
        AND status IN ('CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED')
      ${from ? Prisma.sql`AND "saleDate" >= ${from}` : Prisma.empty}
      ${to ? Prisma.sql`AND "saleDate" <= ${to}` : Prisma.empty}
      GROUP BY "managerId"
    `);

    // Sale groups by agent
    let saleAgentGroups: SaleAgentGroupRow[] = [];
    if (agentIds.length) {
      saleAgentGroups = await prisma.$queryRaw<SaleAgentGroupRow[]>(Prisma.sql`
        SELECT
          "agentId",
          COUNT(*) AS count,
          SUM("saleAmount") AS sum_saleAmount,
          SUM("netRevenue") AS sum_netRevenue,
          SUM("branchCommission") AS sum_branchCommission,
          SUM("overrideCommission") AS sum_overrideCommission,
          SUM("salesCommission") AS sum_salesCommission
        FROM "AffiliateSale"
        WHERE "agentId" IN (${Prisma.join(agentIds)})
          AND status IN ('CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED')
        ${from ? Prisma.sql`AND "saleDate" >= ${from}` : Prisma.empty}
        ${to ? Prisma.sql`AND "saleDate" <= ${to}` : Prisma.empty}
        GROUP BY "agentId"
      `);
    }

    // Ledger groups by manager (CommissionLedger)
    const ledgerGroups = await prisma.$queryRaw<LedgerGroupRow[]>(Prisma.sql`
      SELECT "profileId", "entryType", "isSettled", SUM(amount) AS sum_amount, SUM("withholdingAmount") AS sum_withholdingAmount, COUNT(*) AS count
      FROM "CommissionLedger"
      WHERE "profileId" IN (${Prisma.join(managerIds)})
        AND "entryType" IN ('BRANCH_COMMISSION', 'OVERRIDE_COMMISSION', 'WITHHOLDING')
      ${from ? Prisma.sql`AND "createdAt" >= ${from}` : Prisma.empty}
      ${to ? Prisma.sql`AND "createdAt" <= ${to}` : Prisma.empty}
      GROUP BY "profileId", "entryType", "isSettled"
    `);

    // Ledger groups by agent
    let ledgerAgentGroups: LedgerGroupRow[] = [];
    if (agentIds.length) {
      ledgerAgentGroups = await prisma.$queryRaw<LedgerGroupRow[]>(Prisma.sql`
        SELECT "profileId", "entryType", "isSettled", SUM(amount) AS sum_amount, SUM("withholdingAmount") AS sum_withholdingAmount, COUNT(*) AS count
        FROM "CommissionLedger"
        WHERE "profileId" IN (${Prisma.join(agentIds)})
          AND "entryType" IN ('SALES_COMMISSION', 'OVERRIDE_COMMISSION', 'WITHHOLDING')
        ${from ? Prisma.sql`AND "createdAt" >= ${from}` : Prisma.empty}
        ${to ? Prisma.sql`AND "createdAt" <= ${to}` : Prisma.empty}
        GROUP BY "profileId", "entryType", "isSettled"
      `);
    }

    // 집계 맵 구성
    const leadStatusByManager: Record<number, Record<string, number>> = {};
    for (const row of leadStatusGroups) {
      if (row.managerId !== null) {
        if (!leadStatusByManager[row.managerId]) leadStatusByManager[row.managerId] = {};
        leadStatusByManager[row.managerId]![row.status] = Number(row.count);
      }
    }

    const salesByManager: Record<number, SaleGroupRow> = {};
    for (const row of saleGroups) {
      if (row.managerId !== null) {
        salesByManager[row.managerId] = row;
      }
    }

    const ledgerByManager: Record<number, LedgerGroupRow[]> = {};
    for (const row of ledgerGroups) {
      if (row.profileId === null) continue;
      if (!ledgerByManager[row.profileId]) ledgerByManager[row.profileId] = [];
      ledgerByManager[row.profileId]!.push(row);
    }

    const leadStatusByAgent: Record<number, Record<string, number>> = {};
    for (const row of leadAgentGroups) {
      if (row.agentId === null) continue;
      if (!leadStatusByAgent[row.agentId]) leadStatusByAgent[row.agentId] = {};
      leadStatusByAgent[row.agentId]![row.status] = Number(row.count);
    }

    const salesByAgent: Record<number, SaleAgentGroupRow> = {};
    for (const row of saleAgentGroups) {
      if (row.agentId !== null) {
        salesByAgent[row.agentId] = row;
      }
    }

    const ledgerByAgent: Record<number, LedgerGroupRow[]> = {};
    for (const row of ledgerAgentGroups) {
      if (row.profileId === null) continue;
      if (!ledgerByAgent[row.profileId]) ledgerByAgent[row.profileId] = [];
      ledgerByAgent[row.profileId]!.push(row);
    }

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
        const agentLeadSummary = leadStatusByAgent[relation.agentId] || {};
        const agentSaleSummary = salesByAgent[relation.agentId];
        const agentLedgerSummary = ledgerByAgent[relation.agentId] || [];

        const saleCount = Number(agentSaleSummary?.count ?? 0);
        const saleAmount = Number(agentSaleSummary?.sum_saleAmount ?? 0);
        const netRevenue = Number(agentSaleSummary?.sum_netRevenue ?? 0);
        const salesCommission = Number(agentSaleSummary?.sum_salesCommission ?? 0);
        const overrideCommission = Number(agentSaleSummary?.sum_overrideCommission ?? 0);

        const ledgerTotals = agentLedgerSummary.reduce(
          (acc, row) => {
            const amount = Number(row.sum_amount ?? 0);
            if (row.isSettled) {
              acc.settled += amount;
            } else {
              acc.pending += amount;
            }
            // 원천징수는 WITHHOLDING 전용 행의 amount 만 집계
            // (COMMISSION 행의 withholdingAmount와 중복 집계 방지)
            if (row.entryType === 'WITHHOLDING') {
              if (row.isSettled) acc.withholdingSettled += amount;
              else acc.withholdingPending += amount;
              acc.withholdingAdjustments += amount;
            }
            return acc;
          },
          {
            settled: 0,
            pending: 0,
            withholdingAdjustments: 0,
            withholdingSettled: 0,
            withholdingPending: 0,
            totalWithholding: 0,
            grossCommission: 0,
            netCommission: 0,
          },
        );

        // totalWithholding = WITHHOLDING 행 amount 합계 (단일 소스)
        ledgerTotals.totalWithholding = ledgerTotals.withholdingAdjustments;
        const agentGrossCommission = (salesCommission ?? 0) + (overrideCommission ?? 0);
        ledgerTotals.grossCommission = agentGrossCommission;
        ledgerTotals.netCommission = agentGrossCommission - ledgerTotals.totalWithholding;

        return {
          agent: {
            id: relation.agent_id,
            affiliateCode: relation.agent_affiliateCode,
            displayName: relation.agent_displayName,
            nickname: relation.agent_nickname,
            contactPhone: relation.agent_contactPhone,
            status: relation.agent_status,
          },
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
      const saleCount = Number(saleSummary?.count ?? 0);
      const saleAmount = Number(saleSummary?.sum_saleAmount ?? 0);
      const netRevenue = Number(saleSummary?.sum_netRevenue ?? 0);
      const branchCommission = Number(saleSummary?.sum_branchCommission ?? 0);
      const overrideCommission = Number(saleSummary?.sum_overrideCommission ?? 0);
      const salesCommission = Number(saleSummary?.sum_salesCommission ?? 0);

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
          const amount = Number(row.sum_amount ?? 0);
          if (row.entryType === 'BRANCH_COMMISSION') {
            if (row.isSettled) acc.branchSettled += amount;
            else acc.branchPending += amount;
          }
          if (row.entryType === 'OVERRIDE_COMMISSION') {
            if (row.isSettled) acc.overrideSettled += amount;
            else acc.overridePending += amount;
          }
          // 원천징수는 WITHHOLDING 전용 행 amount 만 집계 (단일 소스)
          if (row.entryType === 'WITHHOLDING') {
            if (row.isSettled) acc.withholdingSettled += amount;
            else acc.withholdingPending += amount;
            acc.withholdingAdjustments += amount;
          }
          return acc;
        },
        {
          branchSettled: 0,
          branchPending: 0,
          overrideSettled: 0,
          overridePending: 0,
          withholdingAdjustments: 0,
          withholdingSettled: 0,
          withholdingPending: 0,
          totalWithholding: 0,
          grossCommission: 0,
          netCommission: 0,
        },
      );

      // totalWithholding = WITHHOLDING 행 amount 합계 (단일 소스)
      ledgerTotals.totalWithholding = ledgerTotals.withholdingAdjustments;
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
    const hqCardFees = Math.round((totals.totalSalesAmount ?? 0) * HQ_CARD_FEE_RATE);
    const hqCorporateTax = Math.round(hqGrossRevenue * HQ_CORPORATE_TAX_RATE);
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
  } catch (error: unknown) {
    logger.error('GET /api/team/metrics error:', error as object);
    return NextResponse.json({
      ok: false,
      message: 'Server error',
      ...(process.env.NODE_ENV === 'development' ? { error: (error as Error)?.message || String(error) } : {})
    }, { status: 500 });
  }
}
