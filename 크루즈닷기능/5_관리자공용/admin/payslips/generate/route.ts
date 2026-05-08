export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import dayjs from 'dayjs';

const SESSION_COOKIE = 'cg.sid.v2';

/**
 * 월별 지급명세서 생성 API
 * POST /api/admin/payslips/generate
 * 
 * Body: { period: 'YYYY-MM' }
 * 
 * 관리자가 특정 월의 지급명세서를 생성합니다.
 */
export async function POST(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true, name: true },
        },
      },
    });

    if (!session?.User || session.User.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 요청 데이터 파싱
    const body = await req.json();
    const { period } = body; // YYYY-MM 형식

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { ok: false, error: 'period는 YYYY-MM 형식이어야 합니다.' },
        { status: 400 }
      );
    }

    // 기간 계산
    const startDate = dayjs(period, 'YYYY-MM').startOf('month');
    const endDate = dayjs(period, 'YYYY-MM').endOf('month');

    console.log(`[Payslip Generate] Generating payslips for ${period}`);

    // 해당 기간의 판매 데이터 조회 (APPROVED, COMPLETED 상태만)
    const sales = await prisma.affiliateSale.findMany({
      where: {
        saleDate: {
          gte: startDate.toDate(),
          lte: endDate.toDate(),
        },
        status: {
          in: ['APPROVED', 'COMPLETED'],
        },
      },
      include: {
        product: {
          select: {
            productName: true,
            productCode: true,
            cabinType: true,
          },
        },
        manager: {
          select: {
            id: true,
            displayName: true,
            type: true,
          },
        },
        agent: {
          select: {
            id: true,
            displayName: true,
            type: true,
          },
        },
        ledgers: {
          select: {
            profileId: true,
            type: true,
            amount: true,
            withholdingAmount: true,
            netAmount: true,
          },
        },
      },
    });

    // 프로필별로 데이터 집계
    const profileDataMap = new Map<number, {
      profileId: number;
      type: string;
      totalSales: number;
      totalCommission: number;
      totalWithholding: number;
      netPayment: number;
      salesDetails: any[];
    }>();

    sales.forEach((sale) => {
      // 대리점장 데이터 집계
      if (sale.manager) {
        const managerId = sale.manager.id;
        if (!profileDataMap.has(managerId)) {
          profileDataMap.set(managerId, {
            profileId: managerId,
            type: 'BRANCH_MANAGER',
            totalSales: 0,
            totalCommission: 0,
            totalWithholding: 0,
            netPayment: 0,
            salesDetails: [],
          });
        }

        const managerData = profileDataMap.get(managerId)!;
        const managerLedgers = sale.ledgers.filter(l => l.profileId === managerId);
        const managerCommission = managerLedgers.reduce((sum, l) => sum + l.amount, 0);
        const managerWithholding = managerLedgers.reduce((sum, l) => sum + l.withholdingAmount, 0);
        const managerNet = managerLedgers.reduce((sum, l) => sum + l.netAmount, 0);

        managerData.totalSales += sale.saleAmount;
        managerData.totalCommission += managerCommission;
        managerData.totalWithholding += managerWithholding;
        managerData.netPayment += managerNet;
        managerData.salesDetails.push({
          saleId: sale.id,
          productName: sale.product?.productName || '-',
          productCode: sale.product?.productCode || '-',
          cabinType: sale.product?.cabinType || '-',
          saleAmount: sale.saleAmount,
          commission: managerCommission,
          saleDate: sale.saleDate,
        });
      }

      // 판매원 데이터 집계
      if (sale.agent) {
        const agentId = sale.agent.id;
        if (!profileDataMap.has(agentId)) {
          profileDataMap.set(agentId, {
            profileId: agentId,
            type: 'SALES_AGENT',
            totalSales: 0,
            totalCommission: 0,
            totalWithholding: 0,
            netPayment: 0,
            salesDetails: [],
          });
        }

        const agentData = profileDataMap.get(agentId)!;
        const agentLedgers = sale.ledgers.filter(l => l.profileId === agentId);
        const agentCommission = agentLedgers.reduce((sum, l) => sum + l.amount, 0);
        const agentWithholding = agentLedgers.reduce((sum, l) => sum + l.withholdingAmount, 0);
        const agentNet = agentLedgers.reduce((sum, l) => sum + l.netAmount, 0);

        agentData.totalSales += sale.saleAmount;
        agentData.totalCommission += agentCommission;
        agentData.totalWithholding += agentWithholding;
        agentData.netPayment += agentNet;
        agentData.salesDetails.push({
          saleId: sale.id,
          productName: sale.product?.productName || '-',
          productCode: sale.product?.productCode || '-',
          cabinType: sale.product?.cabinType || '-',
          saleAmount: sale.saleAmount,
          commission: agentCommission,
          saleDate: sale.saleDate,
        });
      }
    });

    // 지급명세서 생성 또는 업데이트
    const createdPayslips = [];
    for (const [profileId, data] of profileDataMap.entries()) {
      const payslip = await prisma.affiliatePayslip.upsert({
        where: {
          profileId_period: {
            profileId,
            period,
          },
        },
        create: {
          profileId,
          period,
          type: data.type,
          totalSales: data.totalSales,
          totalCommission: data.totalCommission,
          totalWithholding: data.totalWithholding,
          netPayment: data.netPayment,
          status: 'PENDING',
          details: data.salesDetails,
        },
        update: {
          totalSales: data.totalSales,
          totalCommission: data.totalCommission,
          totalWithholding: data.totalWithholding,
          netPayment: data.netPayment,
          details: data.salesDetails,
          updatedAt: new Date(),
        },
        include: {
          AffiliateProfile: {
            select: {
              displayName: true,
              type: true,
            },
          },
        },
      });

      createdPayslips.push(payslip);
    }

    console.log(`[Payslip Generate] Created/Updated ${createdPayslips.length} payslips`);

    return NextResponse.json({
      ok: true,
      message: `${period} 지급명세서 ${createdPayslips.length}건이 생성/업데이트되었습니다.`,
      data: {
        period,
        count: createdPayslips.length,
        payslips: createdPayslips,
      },
    });
  } catch (error: any) {
    console.error('[Payslip Generate] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || '지급명세서 생성 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
