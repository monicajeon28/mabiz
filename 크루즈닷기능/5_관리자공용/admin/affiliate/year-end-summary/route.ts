// app/api/admin/affiliate/year-end-summary/route.ts
// 연말 합산 데이터 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return NextResponse.json({ error: '인증되지 않음' }, { status: 401 });
    }

    // 관리자 권한 확인
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true }
    });

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    // 1. 전체 판매 집계
    const totalSales = await prisma.affiliateSale.aggregate({
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
        status: 'CONFIRMED',
      },
      _sum: {
        saleAmount: true,
        costAmount: true,
        netRevenue: true,
        branchCommission: true,
        salesCommission: true,
        overrideCommission: true,
      },
      _count: true,
    });

    // 2. 월별 판매 추이
    const monthlySales = await prisma.$queryRaw<Array<{
      month: number;
      totalSales: bigint;
      totalCommission: bigint;
      saleCount: bigint;
    }>>`
      SELECT
        MONTH(saleDate) as month,
        SUM(saleAmount) as totalSales,
        SUM(COALESCE(branchCommission, 0) + COALESCE(salesCommission, 0) + COALESCE(overrideCommission, 0)) as totalCommission,
        COUNT(*) as saleCount
      FROM AffiliateSale
      WHERE YEAR(saleDate) = ${year}
        AND status = 'CONFIRMED'
      GROUP BY MONTH(saleDate)
      ORDER BY MONTH(saleDate)
    `;

    // 3. 대리점장별 집계
    const managerStats = await prisma.affiliateSale.groupBy({
      by: ['managerId'],
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
        status: 'CONFIRMED',
        managerId: {
          not: null,
        },
      },
      _sum: {
        saleAmount: true,
        branchCommission: true,
        overrideCommission: true,
      },
      _count: true,
    });

    // 대리점장 정보 가져오기
    const managerIds = managerStats.map((stat) => stat.managerId).filter(Boolean) as number[];
    const managers = await prisma.affiliateProfile.findMany({
      where: {
        id: {
          in: managerIds,
        },
      },
      select: {
        id: true,
        displayName: true,
        User: {
          select: {
            mallUserId: true,
            name: true,
          },
        },
      },
    });

    const managerStatsWithNames = managerStats.map((stat) => {
      const manager = managers.find((m) => m.id === stat.managerId);
      return {
        managerId: stat.managerId,
        managerName: manager?.displayName || manager?.User?.name || 'N/A',
        mallUserId: manager?.User?.mallUserId || 'N/A',
        totalSales: stat._sum.saleAmount || 0,
        totalBranchCommission: stat._sum.branchCommission || 0,
        totalOverride: stat._sum.overrideCommission || 0,
        totalCommission: (stat._sum.branchCommission || 0) + (stat._sum.overrideCommission || 0),
        saleCount: stat._count,
      };
    });

    // 4. 판매원별 집계
    const agentStats = await prisma.affiliateSale.groupBy({
      by: ['agentId'],
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
        status: 'CONFIRMED',
        agentId: {
          not: null,
        },
      },
      _sum: {
        saleAmount: true,
        salesCommission: true,
      },
      _count: true,
    });

    // 판매원 정보 가져오기
    const agentIds = agentStats.map((stat) => stat.agentId).filter(Boolean) as number[];
    const agents = await prisma.affiliateProfile.findMany({
      where: {
        id: {
          in: agentIds,
        },
      },
      select: {
        id: true,
        displayName: true,
        User: {
          select: {
            mallUserId: true,
            name: true,
          },
        },
      },
    });

    const agentStatsWithNames = agentStats.map((stat) => {
      const agent = agents.find((a) => a.id === stat.agentId);
      return {
        agentId: stat.agentId,
        agentName: agent?.displayName || agent?.User?.name || 'N/A',
        mallUserId: agent?.User?.mallUserId || 'N/A',
        totalSales: stat._sum.saleAmount || 0,
        totalCommission: stat._sum.salesCommission || 0,
        saleCount: stat._count,
      };
    });

    // 5. 상품별 판매 집계
    const productStats = await prisma.affiliateSale.groupBy({
      by: ['productCode'],
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
        status: 'CONFIRMED',
      },
      _sum: {
        saleAmount: true,
      },
      _count: true,
    });

    // 상품 정보 가져오기
    const productCodes = productStats.map((stat) => stat.productCode);
    const products = await prisma.affiliateProduct.findMany({
      where: {
        code: {
          in: productCodes,
        },
      },
      select: {
        code: true,
        title: true,
      },
    });

    const productStatsWithNames = productStats.map((stat) => {
      const product = products.find((p) => p.code === stat.productCode);
      return {
        productCode: stat.productCode,
        productName: product?.title || stat.productCode,
        totalSales: stat._sum.saleAmount || 0,
        saleCount: stat._count,
      };
    });

    // 6. 본사 직판 집계
    const hqDirectSales = await prisma.affiliateSale.aggregate({
      where: {
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
        status: 'CONFIRMED',
        managerId: null,
        agentId: null,
      },
      _sum: {
        saleAmount: true,
        netRevenue: true,
      },
      _count: true,
    });

    return NextResponse.json({
      year,
      summary: {
        totalSales: Number(totalSales._sum.saleAmount || 0),
        totalCost: Number(totalSales._sum.costAmount || 0),
        totalNetRevenue: Number(totalSales._sum.netRevenue || 0),
        totalBranchCommission: Number(totalSales._sum.branchCommission || 0),
        totalSalesCommission: Number(totalSales._sum.salesCommission || 0),
        totalOverrideCommission: Number(totalSales._sum.overrideCommission || 0),
        totalCommission:
          Number(totalSales._sum.branchCommission || 0) +
          Number(totalSales._sum.salesCommission || 0) +
          Number(totalSales._sum.overrideCommission || 0),
        saleCount: totalSales._count,
        hqNetRevenue: Number(hqDirectSales._sum.netRevenue || 0),
        hqSaleCount: hqDirectSales._count,
      },
      monthlySales: monthlySales.map((m) => ({
        month: Number(m.month),
        totalSales: Number(m.totalSales),
        totalCommission: Number(m.totalCommission),
        saleCount: Number(m.saleCount),
      })),
      managerStats: managerStatsWithNames.sort((a, b) => b.totalSales - a.totalSales),
      agentStats: agentStatsWithNames.sort((a, b) => b.totalSales - a.totalSales),
      productStats: productStatsWithNames.sort((a, b) => b.totalSales - a.totalSales),
    });
  } catch (error: any) {
    console.error('[Year-End Summary API] Error:', error);
    return NextResponse.json(
      {
        error: '연말 합산 데이터 조회 실패',
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
