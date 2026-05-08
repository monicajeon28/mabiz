export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

type PeriodRange = {
  label: string;
  start: Date;
  end: Date;
};

type CsvPrimitive = string | number | null;

type CsvRow = {
  rowType: string | null;
  saleId: number | null;
  saleDate: string | null;
  productCode: string | null;
  productTitle: string | null;
  headcount: number | null;
  saleAmount: number | null;
  netRevenue: number | null;
  managerCode: string | null;
  managerName: string | null;
  agentCode: string | null;
  agentName: string | null;
  branchGross: number | null;
  branchWithholding: number | null;
  branchNet: number | null;
  overrideGross: number | null;
  overrideWithholding: number | null;
  overrideNet: number | null;
  managerNet: number | null;
  agentGross: number | null;
  agentWithholding: number | null;
  agentNet: number | null;
  hqNet: number | null;
  hqCardFees: number | null;
  hqCorporateTax: number | null;
  hqNetAfterFees: number | null;
};

const ALLOWED_STATUSES: string[] = ['CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED', 'REFUNDED'];

const CSV_COLUMNS: Array<{ key: keyof CsvRow; header: string }> = [
  { key: 'rowType', header: '구분' },
  { key: 'saleId', header: '판매ID' },
  { key: 'saleDate', header: '판매일시' },
  { key: 'productCode', header: '상품코드' },
  { key: 'productTitle', header: '상품명' },
  { key: 'headcount', header: '인원수' },
  { key: 'saleAmount', header: '총매출' },
  { key: 'netRevenue', header: '순이익' },
  { key: 'managerCode', header: '대리점장코드' },
  { key: 'managerName', header: '대리점장명' },
  { key: 'agentCode', header: '판매원코드' },
  { key: 'agentName', header: '판매원명' },
  { key: 'branchGross', header: '브랜치커미션총액' },
  { key: 'branchWithholding', header: '브랜치원천징수' },
  { key: 'branchNet', header: '브랜치세후금액' },
  { key: 'overrideGross', header: '오버라이드총액' },
  { key: 'overrideWithholding', header: '오버라이드원천징수' },
  { key: 'overrideNet', header: '오버라이드세후금액' },
  { key: 'managerNet', header: '대리점장세후합계' },
  { key: 'agentGross', header: '판매원총액' },
  { key: 'agentWithholding', header: '판매원원천징수' },
  { key: 'agentNet', header: '판매원세후금액' },
  { key: 'hqNet', header: 'HQ순익(원장)' },
  { key: 'hqCardFees', header: 'HQ카드수수료' },
  { key: 'hqCorporateTax', header: 'HQ법인세' },
  { key: 'hqNetAfterFees', header: 'HQ세후순익' },
];

const ROW_TYPE_LABEL: Record<string, string> = {
  DETAIL: '상세',
  TOTAL: '합계',
};

function requireAdmin(user: { id: number } | null, role: string | undefined) {
  if (!user || role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

function parsePeriod(searchParams: URLSearchParams): PeriodRange {
  const periodParam = (searchParams.get('period') || '').trim();
  let baseDate = new Date();

  if (/^\d{4}-\d{2}$/.test(periodParam)) {
    const [yearStr, monthStr] = periodParam.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (!Number.isNaN(year) && !Number.isNaN(monthIndex)) {
      baseDate = new Date(year, monthIndex, 1);
    }
  }

  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;

  return { label, start, end };
}

function formatMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

type LedgerAccumulator = {
  saleId: number;
  hqNet: number;
  branchGross: number;
  branchWithholding: number;
  overrideGross: number;
  overrideWithholding: number;
  agentGross: number;
  agentWithholding: number;
  withholdingAdjustments: number;
};

function createEmptyLedgerAccumulator(saleId: number): LedgerAccumulator {
  return {
    saleId,
    hqNet: 0,
    branchGross: 0,
    branchWithholding: 0,
    overrideGross: 0,
    overrideWithholding: 0,
    agentGross: 0,
    agentWithholding: 0,
    withholdingAdjustments: 0,
  };
}

function accumulateLedgerEntry(
  acc: LedgerAccumulator,
  entry: { entryType: string; amount: number; withholdingAmount: number | null },
) {
  const withholding = entry.withholdingAmount ?? 0;
  switch (entry.entryType) {
    case 'HQ_NET':
      acc.hqNet += entry.amount;
      break;
    case 'BRANCH_COMMISSION':
      acc.branchGross += entry.amount;
      acc.branchWithholding += withholding;
      break;
    case 'OVERRIDE_COMMISSION':
      acc.overrideGross += entry.amount;
      acc.overrideWithholding += withholding;
      break;
    case 'SALES_COMMISSION':
      acc.agentGross += entry.amount;
      acc.agentWithholding += withholding;
      break;
    case 'WITHHOLDING':
      acc.withholdingAdjustments += entry.amount;
      break;
    default:
      break;
  }
}

function buildCsv(rows: CsvRow[], columns = CSV_COLUMNS): string {
  if (rows.length === 0) {
    return '\uFEFF데이터가 없습니다.';
  }

  const headerLine = columns.map((column) => column.header).join(',');
  const csvLines = rows.map((row) =>
    columns
      .map((column) => {
        let value: CsvPrimitive = row[column.key];
        if (column.key === 'rowType' && typeof value === 'string') {
          value = ROW_TYPE_LABEL[value] ?? value;
        }
        if (value == null) return '';
        const stringValue = String(value);
        if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}`;
        }
        return stringValue;
      })
      .join(','),
  );

  const csvBody = [headerLine, ...csvLines].join('\n');
  return `\uFEFF${csvBody}`;
}

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });
    const guard = requireAdmin(sessionUser, dbUser?.role);
    if (guard) return guard;

    const now = new Date();
    const { searchParams } = new URL(req.url);
    const period = parsePeriod(searchParams);
    const format = (searchParams.get('format') || 'json').trim().toLowerCase();

    const saleWhere: Prisma.AffiliateSaleWhereInput = {
      status: { in: ALLOWED_STATUSES },
      confirmedAt: {
        gte: period.start,
        lte: period.end,
      },
      // 정산 완료 조건: 첫 콜 또는 여권 안내 콜 녹음이 필수
      audioFileType: { in: ['FIRST_CALL', 'PASSPORT_GUIDE'] },
      // 녹음 파일도 있어야 함 (Google Drive URL 필수)
      audioFileGoogleDriveUrl: { not: null },
      audioFileGoogleDriveId: { not: null },
    };

    // 성능 최적화: include 대신 select 사용
    const sales = await prisma.affiliateSale.findMany({
      where: saleWhere,
      orderBy: [{ confirmedAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        productCode: true,
        saleAmount: true,
        netRevenue: true,
        saleDate: true,
        confirmedAt: true,
        headcount: true,
        costAmount: true,
        audioFileType: true,
        audioFileGoogleDriveUrl: true,
        audioFileGoogleDriveId: true,
        status: true,           // 환불 상태 확인용
        refundedAt: true,       // 환불 날짜
        AffiliateProfile_managerIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
            branchLabel: true,
            nickname: true,
            type: true,
          },
        },
        AffiliateProfile_agentIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
            nickname: true,
            type: true,
          },
        },
        AffiliateProduct: {
          select: {
            productCode: true,
            title: true,
          },
        },
      },
    });

    const saleIds = sales.map((sale) => sale.id);

    const ledgerEntries = saleIds.length
      ? await prisma.commissionLedger.findMany({
          where: {
            saleId: { in: saleIds },
            entryType: {
              in: ['HQ_NET', 'BRANCH_COMMISSION', 'OVERRIDE_COMMISSION', 'SALES_COMMISSION', 'WITHHOLDING'],
            },
          },
          select: {
            saleId: true,
            entryType: true,
            amount: true,
            withholdingAmount: true,
            profileId: true,
          },
        })
      : [];

    const ledgerBySale = ledgerEntries.reduce((acc: Record<number, LedgerAccumulator>, entry) => {
      const bucket = acc[entry.saleId] ?? createEmptyLedgerAccumulator(entry.saleId);
      accumulateLedgerEntry(bucket, entry);
      acc[entry.saleId] = bucket;
      return acc;
    }, {} as Record<number, LedgerAccumulator>);

    const totals = {
      saleCount: 0,
      headcount: 0,
      saleAmount: 0,
      costAmount: 0,
      netRevenue: 0,
      hqNet: 0,
      hqCardFees: 0,
      hqCorporateTax: 0,
      hqNetAfterFees: 0,
      branchGross: 0,
      branchWithholding: 0,
      overrideGross: 0,
      overrideWithholding: 0,
      managerNet: 0,
      agentGross: 0,
      agentWithholding: 0,
      agentNet: 0,
      // 환불 관련 집계
      refundCount: 0,           // 환불 건수
      refundAmount: 0,          // 환불 금액
      refundNetRevenue: 0,      // 환불된 순이익
    };

    const comparisonData = {
      branchCommission: 0,
      overrideCommission: 0,
      salesCommission: 0,
      netCommissionManagers: 0,
      netCommissionAgents: 0,
      withholdingManagers: 0,
      withholdingAgents: 0,
    };

    type ManagerBucket = {
      profile: {
        id: number;
        affiliateCode: string | null;
        displayName: string | null;
        branchLabel: string | null;
        nickname: string | null;
      };
      saleCount: number;
      headcount: number;
      saleAmount: number;
      netRevenue: number;
      branchGross: number;
      branchWithholding: number;
      overrideGross: number;
      overrideWithholding: number;
    };

    type AgentBucket = {
      profile: {
        id: number;
        affiliateCode: string | null;
        displayName: string | null;
        nickname: string | null;
      };
      manager?: {
        id: number;
        displayName: string | null;
        affiliateCode: string | null;
      } | null;
      saleCount: number;
      headcount: number;
      saleAmount: number;
      netRevenue: number;
      gross: number;
      withholding: number;
    };

    const managerMap = new Map<number, ManagerBucket>();
    const agentMap = new Map<number, AgentBucket>();

    const saleRows: CsvRow[] = [];
    const saleDetails: Array<{
      saleId: number;
      saleDate: string | null;
      product: { code: string | null; title: string | null };
      headcount: number;
      amounts: {
        sale: number;
        netRevenue: number;
        hqNet: number;
      };
      manager: {
        id: number;
        affiliateCode: string | null;
        displayName: string | null;
        branchLabel: string | null;
      } | null;
      agent: {
        id: number;
        affiliateCode: string | null;
        displayName: string | null;
      } | null;
      commissions: {
        branch: { gross: number; withholding: number; net: number };
        override: { gross: number; withholding: number; net: number };
        agent: { gross: number; withholding: number; net: number };
      };
    }> = [];

    sales.forEach((sale) => {
      const ledger = ledgerBySale[sale.id] ?? createEmptyLedgerAccumulator(sale.id);
      const saleNetRevenue =
        typeof sale.netRevenue === 'number'
          ? sale.netRevenue
          : (sale.saleAmount ?? 0) - (sale.costAmount ?? 0);

      // 환불된 건인지 확인
      const isRefunded = sale.status === 'REFUNDED' || sale.refundedAt !== null;

      if (isRefunded) {
        // 환불된 건은 마이너스로 집계
        totals.refundCount += 1;
        totals.refundAmount += sale.saleAmount ?? 0;
        totals.refundNetRevenue += saleNetRevenue ?? 0;
        // 실제 금액에서 차감
        totals.saleAmount -= sale.saleAmount ?? 0;
        totals.netRevenue -= saleNetRevenue ?? 0;
      } else {
        // 정상 판매 건
        totals.saleCount += 1;
        totals.saleAmount += sale.saleAmount ?? 0;
        totals.costAmount += sale.costAmount ?? 0;
        totals.netRevenue += saleNetRevenue ?? 0;
        totals.headcount += sale.headcount ?? 0;
      }

      totals.hqNet += ledger.hqNet;

      totals.branchGross += ledger.branchGross;
      totals.branchWithholding += ledger.branchWithholding;
      totals.overrideGross += ledger.overrideGross;
      totals.overrideWithholding += ledger.overrideWithholding;

      totals.agentGross += ledger.agentGross;
      totals.agentWithholding += ledger.agentWithholding;

      const managerNet = ledger.branchGross + ledger.overrideGross - ledger.branchWithholding - ledger.overrideWithholding;
      totals.managerNet += managerNet;

      const agentNet = ledger.agentGross - ledger.agentWithholding;
      totals.agentNet += agentNet;
      comparisonData.salesCommission += ledger.agentGross;
      comparisonData.withholdingAgents += ledger.agentWithholding;
      comparisonData.netCommissionAgents += agentNet;

      if (sale.AffiliateProfile_managerIdToAffiliateProfile) {
        const manager = sale.AffiliateProfile_managerIdToAffiliateProfile;
        const bucket =
          managerMap.get(manager.id) ??
          {
            profile: {
              id: manager.id,
              affiliateCode: manager.affiliateCode ?? null,
              displayName: manager.displayName ?? manager.nickname ?? null,
              branchLabel: manager.branchLabel ?? null,
              nickname: manager.nickname ?? null,
            },
            saleCount: 0,
            headcount: 0,
            saleAmount: 0,
            netRevenue: 0,
            branchGross: 0,
            branchWithholding: 0,
            overrideGross: 0,
            overrideWithholding: 0,
          };

        bucket.saleCount += 1;
        bucket.headcount += sale.headcount ?? 0;
        bucket.saleAmount += sale.saleAmount ?? 0;
        bucket.netRevenue += saleNetRevenue ?? 0;
        bucket.branchGross += ledger.branchGross;
        bucket.branchWithholding += ledger.branchWithholding;
        bucket.overrideGross += ledger.overrideGross;
        bucket.overrideWithholding += ledger.overrideWithholding;

        managerMap.set(manager.id, bucket);
      }

      if (sale.AffiliateProfile_agentIdToAffiliateProfile) {
        const agent = sale.AffiliateProfile_agentIdToAffiliateProfile;
        const manager = sale.AffiliateProfile_managerIdToAffiliateProfile;
        const bucket =
          agentMap.get(agent.id) ??
          {
            profile: {
              id: agent.id,
              affiliateCode: agent.affiliateCode ?? null,
              displayName: agent.displayName ?? agent.nickname ?? null,
              nickname: agent.nickname ?? null,
            },
            manager: manager
              ? {
                  id: manager.id,
                  displayName: manager.displayName ?? manager.nickname ?? null,
                  affiliateCode: manager.affiliateCode ?? null,
                }
              : null,
            saleCount: 0,
            headcount: 0,
            saleAmount: 0,
            netRevenue: 0,
            gross: 0,
            withholding: 0,
          };

        bucket.saleCount += 1;
        bucket.headcount += sale.headcount ?? 0;
        bucket.saleAmount += sale.saleAmount ?? 0;
        bucket.netRevenue += saleNetRevenue ?? 0;
        bucket.gross += ledger.agentGross;
        bucket.withholding += ledger.agentWithholding;

        agentMap.set(agent.id, bucket);
      }

      const branchNet = ledger.branchGross - ledger.branchWithholding;
      const overrideNet = ledger.overrideGross - ledger.overrideWithholding;
      const agentNetValue = agentNet;

      saleDetails.push({
        saleId: sale.id,
        saleDate: sale.confirmedAt?.toISOString() ?? sale.saleDate?.toISOString() ?? null,
        product: {
          code: sale.productCode ?? sale.AffiliateProduct?.productCode ?? null,
          title: sale.AffiliateProduct?.title ?? null,
        },
        headcount: sale.headcount ?? 0,
        amounts: {
          sale: sale.saleAmount ?? 0,
          netRevenue: saleNetRevenue ?? 0,
          hqNet: ledger.hqNet,
        },
        manager: sale.AffiliateProfile_managerIdToAffiliateProfile
          ? {
              id: sale.AffiliateProfile_managerIdToAffiliateProfile.id,
              affiliateCode: sale.AffiliateProfile_managerIdToAffiliateProfile.affiliateCode ?? null,
              displayName: sale.AffiliateProfile_managerIdToAffiliateProfile.displayName ?? sale.AffiliateProfile_managerIdToAffiliateProfile.nickname ?? null,
              branchLabel: sale.AffiliateProfile_managerIdToAffiliateProfile.branchLabel ?? null,
            }
          : null,
        agent: sale.AffiliateProfile_agentIdToAffiliateProfile
          ? {
              id: sale.AffiliateProfile_agentIdToAffiliateProfile.id,
              affiliateCode: sale.AffiliateProfile_agentIdToAffiliateProfile.affiliateCode ?? null,
              displayName: sale.AffiliateProfile_agentIdToAffiliateProfile.displayName ?? sale.AffiliateProfile_agentIdToAffiliateProfile.nickname ?? null,
            }
          : null,
        commissions: {
          branch: { gross: ledger.branchGross, withholding: ledger.branchWithholding, net: branchNet },
          override: { gross: ledger.overrideGross, withholding: ledger.overrideWithholding, net: overrideNet },
          agent: { gross: ledger.agentGross, withholding: ledger.agentWithholding, net: agentNetValue },
        },
      });

      saleRows.push({
        rowType: 'DETAIL',
        saleId: sale.id,
        saleDate: sale.confirmedAt?.toISOString() ?? sale.saleDate?.toISOString() ?? null,
        productCode: sale.productCode ?? sale.product?.productCode ?? null,
        productTitle: sale.product?.title ?? null,
        headcount: sale.headcount ?? 0,
        saleAmount: sale.saleAmount ?? 0,
        netRevenue: saleNetRevenue ?? 0,
        managerCode: sale.AffiliateProfile_managerIdToAffiliateProfile?.affiliateCode ?? null,
        managerName: sale.AffiliateProfile_managerIdToAffiliateProfile?.displayName ?? sale.AffiliateProfile_managerIdToAffiliateProfile?.nickname ?? null,
        agentCode: sale.AffiliateProfile_agentIdToAffiliateProfile?.affiliateCode ?? null,
        agentName: sale.AffiliateProfile_agentIdToAffiliateProfile?.displayName ?? sale.AffiliateProfile_agentIdToAffiliateProfile?.nickname ?? null,
        branchGross: ledger.branchGross,
        branchWithholding: ledger.branchWithholding,
        branchNet,
        overrideGross: ledger.overrideGross,
        overrideWithholding: ledger.overrideWithholding,
        overrideNet,
        managerNet: branchNet + overrideNet,
        agentGross: ledger.agentGross,
        agentWithholding: ledger.agentWithholding,
        agentNet: agentNetValue,
        hqNet: ledger.hqNet,
        hqCardFees: null,
        hqCorporateTax: null,
        hqNetAfterFees: null,
      });
    });

    totals.hqCardFees = Math.round(totals.saleAmount * 0.035);
    totals.hqCorporateTax = Math.round(totals.netRevenue * 0.1);
    totals.hqNetAfterFees = Math.max(totals.hqNet - totals.hqCardFees - totals.hqCorporateTax, 0);

    saleRows.push({
      rowType: 'TOTAL',
      saleId: null,
      saleDate: null,
      productCode: null,
      productTitle: null,
      headcount: totals.headcount,
      saleAmount: totals.saleAmount,
      netRevenue: totals.netRevenue,
      managerCode: null,
      managerName: null,
      agentCode: null,
      agentName: null,
      branchGross: totals.branchGross,
      branchWithholding: totals.branchWithholding,
      branchNet: totals.branchGross - totals.branchWithholding,
      overrideGross: totals.overrideGross,
      overrideWithholding: totals.overrideWithholding,
      overrideNet: totals.overrideGross - totals.overrideWithholding,
      managerNet: totals.managerNet,
      agentGross: totals.agentGross,
      agentWithholding: totals.agentWithholding,
      agentNet: totals.agentNet,
      hqNet: totals.hqNet,
      hqCardFees: totals.hqCardFees,
      hqCorporateTax: totals.hqCorporateTax,
      hqNetAfterFees: totals.hqNetAfterFees,
    });

    const managerSummaries = Array.from(managerMap.values()).map((bucket) => {
      const branchNet = bucket.branchGross - bucket.branchWithholding;
      const overrideNet = bucket.overrideGross - bucket.overrideWithholding;
      comparisonData.branchCommission += bucket.branchGross;
      comparisonData.overrideCommission += bucket.overrideGross;
      comparisonData.withholdingManagers += bucket.branchWithholding + bucket.overrideWithholding;
      comparisonData.netCommissionManagers += branchNet + overrideNet;
      return {
        manager: bucket.profile,
        sales: {
          count: bucket.saleCount,
          headcount: bucket.headcount,
          saleAmount: bucket.saleAmount,
          netRevenue: bucket.netRevenue,
        },
        branchCommission: {
          gross: bucket.branchGross,
          withholding: bucket.branchWithholding,
          net: branchNet,
        },
        overrideCommission: {
          gross: bucket.overrideGross,
          withholding: bucket.overrideWithholding,
          net: overrideNet,
        },
        totalCommission: {
          gross: bucket.branchGross + bucket.overrideGross,
          withholding: bucket.branchWithholding + bucket.overrideWithholding,
          net: branchNet + overrideNet,
        },
      };
    });

    const agentSummaries = Array.from(agentMap.values()).map((bucket) => ({
      agent: bucket.profile,
      manager: bucket.manager ?? null,
      sales: {
        count: bucket.saleCount,
        headcount: bucket.headcount,
        saleAmount: bucket.saleAmount,
        netRevenue: bucket.netRevenue,
      },
      commission: {
        gross: bucket.gross,
        withholding: bucket.withholding,
        net: bucket.gross - bucket.withholding,
      },
    }));

    const availablePeriodsSource = await prisma.affiliateSale.findMany({
      where: {
        status: { in: ALLOWED_STATUSES },
        confirmedAt: {
          not: null,
          lte: now,
        },
      },
      select: {
        confirmedAt: true,
      },
      orderBy: { confirmedAt: 'desc' },
      take: 120,
    });

    const availablePeriods = Array.from(
      new Set(
        availablePeriodsSource
          .map((row) => (row.confirmedAt ? formatMonthKey(row.confirmedAt) : null))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (format === 'csv') {
      const csv = buildCsv(saleRows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="affiliate-settlement-${period.label}.csv"`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      period: {
        label: period.label,
        start: period.start.toISOString(),
        end: period.end.toISOString(),
      },
      totals: {
        saleCount: totals.saleCount,
        headcount: totals.headcount,
        saleAmount: totals.saleAmount,
        costAmount: totals.costAmount,
        netRevenue: totals.netRevenue,
        // 환불 집계 추가
        refund: {
          count: totals.refundCount,
          amount: totals.refundAmount,
          netRevenue: totals.refundNetRevenue,
        },
        hq: {
          ledgerNet: totals.hqNet,
          cardFees: totals.hqCardFees,
          corporateTax: totals.hqCorporateTax,
          netAfterFees: totals.hqNetAfterFees,
        },
        branch: {
          branchGross: totals.branchGross,
          branchWithholding: totals.branchWithholding,
          overrideGross: totals.overrideGross,
          overrideWithholding: totals.overrideWithholding,
          net: totals.managerNet,
        },
        agent: {
          gross: totals.agentGross,
          withholding: totals.agentWithholding,
          net: totals.agentNet,
        },
      },
      comparisons: {
        totals: {
          saleAmount: totals.saleAmount,
          netRevenue: totals.netRevenue,
          branchCommission: comparisonData.branchCommission,
          overrideCommission: comparisonData.overrideCommission,
          managerWithholding: comparisonData.withholdingManagers,
          managerNet: comparisonData.netCommissionManagers,
          salesCommission: comparisonData.salesCommission,
          agentWithholding: comparisonData.withholdingAgents,
          agentNet: comparisonData.netCommissionAgents,
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          source: 'settlement-dashboard',
        },
      },
      managers: managerSummaries,
      agents: agentSummaries,
      sales: saleDetails,
      availablePeriods,
    });
  } catch (error: any) {
    console.error('[Affiliate Settlement API] GET error:', error);
    console.error('Error details:', error?.message, error?.code, error?.meta);
    return NextResponse.json({ 
      ok: false, 
      message: 'Server error',
      error: error?.message || String(error),
      ...(process.env.NODE_ENV === 'development' ? { details: error } : {})
    }, { status: 500 });
  }
}
