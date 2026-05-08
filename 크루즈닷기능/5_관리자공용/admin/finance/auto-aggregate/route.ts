// app/api/admin/finance/auto-aggregate/route.ts
// AffiliateSale 데이터 자동 집계 및 FinanceRecord 저장

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/requireAdmin';

interface SalesAggregation {
  totalSales: number;
  salesCount: number;
  totalRefunds: number;
  refundCount: number;
  totalCost: number;
  netRevenue: number;
  totalBranchCommission: number;
  totalSalesCommission: number;
  totalOverrideCommission: number;
  totalWithholding: number;
  byStatus: Record<string, { count: number; amount: number }>;
  byProductCode: Record<string, { count: number; amount: number; commission: number }>;
}

// GET: 지정 기간의 AffiliateSale 집계 조회
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

    // 해당 월의 시작/끝 날짜
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // AffiliateSale 집계
    const sales = await prisma.affiliateSale.findMany({
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        saleAmount: true,
        costAmount: true,
        netRevenue: true,
        branchCommission: true,
        salesCommission: true,
        overrideCommission: true,
        withholdingAmount: true,
        status: true,
        productCode: true,
      },
    });

    // 집계 계산
    const aggregation: SalesAggregation = {
      totalSales: 0,
      salesCount: 0,
      totalRefunds: 0,
      refundCount: 0,
      totalCost: 0,
      netRevenue: 0,
      totalBranchCommission: 0,
      totalSalesCommission: 0,
      totalOverrideCommission: 0,
      totalWithholding: 0,
      byStatus: {},
      byProductCode: {},
    };

    for (const sale of sales) {
      const amount = sale.saleAmount || 0;
      const status = sale.status || 'UNKNOWN';
      const productCode = sale.productCode || 'UNKNOWN';

      // 상태별 집계
      if (!aggregation.byStatus[status]) {
        aggregation.byStatus[status] = { count: 0, amount: 0 };
      }
      aggregation.byStatus[status].count++;
      aggregation.byStatus[status].amount += amount;

      // 상품별 집계
      if (!aggregation.byProductCode[productCode]) {
        aggregation.byProductCode[productCode] = { count: 0, amount: 0, commission: 0 };
      }
      aggregation.byProductCode[productCode].count++;
      aggregation.byProductCode[productCode].amount += amount;
      aggregation.byProductCode[productCode].commission += (sale.salesCommission || 0);

      // APPROVED 상태만 매출로 집계
      if (status === 'APPROVED' || status === 'CONFIRMED') {
        aggregation.totalSales += amount;
        aggregation.salesCount++;
        aggregation.totalCost += sale.costAmount || 0;
        aggregation.netRevenue += sale.netRevenue || 0;
        aggregation.totalBranchCommission += sale.branchCommission || 0;
        aggregation.totalSalesCommission += sale.salesCommission || 0;
        aggregation.totalOverrideCommission += sale.overrideCommission || 0;
        aggregation.totalWithholding += sale.withholdingAmount || 0;
      }

      // REFUNDED 상태는 환불로 집계
      if (status === 'REFUNDED' || status === 'CANCELLED') {
        aggregation.totalRefunds += amount;
        aggregation.refundCount++;
      }
    }

    // 기존 FinanceRecord 조회
    const existingRecord = await prisma.financeRecord.findFirst({
      where: { year, month },
    });

    return NextResponse.json({
      success: true,
      period: { year, month },
      aggregation,
      totalRecords: sales.length,
      existingRecord: existingRecord ? {
        id: existingRecord.id,
        updatedAt: existingRecord.updatedAt,
      } : null,
    });
  } catch (error) {
    console.error('Failed to aggregate sales:', error);
    return NextResponse.json(
      { error: '매출 집계에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 집계 결과를 FinanceRecord에 저장
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { year, month, includeManualData } = body;

    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;

    // 해당 월의 시작/끝 날짜
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // AffiliateSale 집계
    const sales = await prisma.affiliateSale.findMany({
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ['APPROVED', 'CONFIRMED'],
        },
      },
    });

    // 환불 건 조회
    const refunds = await prisma.affiliateSale.findMany({
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ['REFUNDED', 'CANCELLED'],
        },
      },
    });

    // 집계 계산
    let totalSales = 0;
    let totalCost = 0;
    let totalBranchCommission = 0;
    let totalSalesCommission = 0;
    let totalOverrideCommission = 0;
    let totalWithholding = 0;

    for (const sale of sales) {
      totalSales += sale.saleAmount || 0;
      totalCost += sale.costAmount || 0;
      totalBranchCommission += sale.branchCommission || 0;
      totalSalesCommission += sale.salesCommission || 0;
      totalOverrideCommission += sale.overrideCommission || 0;
      totalWithholding += sale.withholdingAmount || 0;
    }

    const totalRefunds = refunds.reduce((sum, r) => sum + (r.saleAmount || 0), 0);
    const netSales = totalSales - totalRefunds;
    const grossProfit = netSales - totalCost;
    const totalCommissions = totalBranchCommission + totalSalesCommission + totalOverrideCommission;

    // 기존 레코드 조회 (수동 입력 데이터 보존)
    const existing = await prisma.financeRecord.findFirst({
      where: { year: targetYear, month: targetMonth },
    });

    // 자동 집계 데이터
    const salesData = {
      totalSales,
      salesCount: sales.length,
      refundAmount: totalRefunds,
      refundCount: refunds.length,
      netSales,
      source: 'auto-aggregate',
      aggregatedAt: new Date().toISOString(),
    };

    const commissionData = {
      branchCommission: totalBranchCommission,
      salesAgentCommission: totalSalesCommission,
      overrideCommission: totalOverrideCommission,
      mentorCommission: 0, // 수동 입력 필요
      withholdingTax: totalWithholding,
      totalCommissions,
    };

    // 수동 입력 데이터 보존
    const fixedCostsData = includeManualData && existing?.fixedCostsData
      ? existing.fixedCostsData
      : {
          officeRent: 0,
          electricity: 0,
          internet: 0,
          insurance: 0,
          other: 0,
          total: 0,
        };

    const variableCostsData = includeManualData && existing?.variableCostsData
      ? existing.variableCostsData
      : {
          marketingCost: 0,
          salesCost: 0,
          travelCost: 0,
          other: 0,
          total: 0,
        };

    // 결과 계산
    const fixedCostsTotal = typeof fixedCostsData === 'object' && fixedCostsData !== null
      ? ((fixedCostsData as Record<string, number>).total || 0)
      : 0;
    const variableCostsTotal = typeof variableCostsData === 'object' && variableCostsData !== null
      ? ((variableCostsData as Record<string, number>).total || 0)
      : 0;

    const resultData = {
      totalRevenue: totalSales,
      netSales,
      grossProfit,
      totalCost,
      totalCommissions,
      operatingCosts: fixedCostsTotal + variableCostsTotal,
      netProfit: grossProfit - totalCommissions - fixedCostsTotal - variableCostsTotal,
      profitMargin: netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(2) : '0',
    };

    // FinanceRecord 저장 (upsert)
    const record = await prisma.financeRecord.upsert({
      where: {
        year_month: {
          year: targetYear,
          month: targetMonth,
        },
      },
      update: {
        salesData,
        commissionData,
        fixedCostsData,
        variableCostsData,
        resultData,
        updatedAt: new Date(),
      },
      create: {
        year: targetYear,
        month: targetMonth,
        salesData,
        commissionData,
        fixedCostsData,
        variableCostsData,
        resultData,
        budgetData: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${targetYear}년 ${targetMonth}월 데이터가 자동 집계되었습니다.`,
      record: {
        id: record.id,
        year: record.year,
        month: record.month,
        salesData: record.salesData,
        commissionData: record.commissionData,
        resultData: record.resultData,
        updatedAt: record.updatedAt,
      },
      summary: {
        salesCount: sales.length,
        refundCount: refunds.length,
        totalSales,
        totalRefunds,
        netSales,
        grossProfit,
        totalCommissions,
      },
    });
  } catch (error) {
    console.error('Failed to save aggregated data:', error);
    return NextResponse.json(
      { error: '집계 데이터 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
