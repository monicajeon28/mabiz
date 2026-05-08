export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

/**
 * 정산 보고서 엑셀 다운로드 API
 * GET /api/admin/affiliate/settlements/excel?period=YYYY-MM
 */
export async function GET(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const { cookies } = await import('next/headers');
    const SESSION_COOKIE = 'cg.sid.v2';
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
          select: { id: true, role: true },
        },
      },
    });

    if (!session?.User || session.User.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 기간 파라미터 처리
    const { searchParams } = new URL(req.url);
    const periodParam = searchParams.get('period');
    const profileIdParam = searchParams.get('profileId'); // 특정 프로필 필터
    const profileTypeParam = searchParams.get('profileType'); // 프로필 타입 필터 (BRANCH_MANAGER, SALES_AGENT)

    let startDate: Date;
    let endDate: Date;

    if (periodParam) {
      const [year, month] = periodParam.split('-').map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // 판매 데이터 조회 (확정된 판매만)
    const whereClause: any = {
      status: 'CONFIRMED',
      saleDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    // 특정 프로필 필터링
    if (profileIdParam) {
      const profileId = parseInt(profileIdParam);
      whereClause.OR = [
        { agentId: profileId },
        { managerId: profileId },
      ];
    } else if (profileTypeParam === 'BRANCH_MANAGER') {
      whereClause.managerId = { not: null };
    } else if (profileTypeParam === 'SALES_AGENT') {
      whereClause.agentId = { not: null };
    }

    const sales = await prisma.affiliateSale.findMany({
      where: whereClause,
      include: {
        lead: {
          select: {
            id: true,
            customerName: true,
            customerPhone: true,
          },
        },
        agent: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
            contactPhone: true,
            bankName: true,
            bankAccount: true,
            bankAccountHolder: true,
            type: true,
          },
        },
        manager: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
            contactPhone: true,
            bankName: true,
            bankAccount: true,
            bankAccountHolder: true,
            type: true,
          },
        },
        product: {
          select: {
            productName: true,
            productCode: true,
          },
        },
        ledgers: {
          select: {
            profileId: true,
            type: true,
            amount: true,
            withholdingAmount: true,
            isSettled: true,
            profile: {
              select: {
                displayName: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: {
        saleDate: 'desc',
      },
    });

    // 엑셀 데이터 구조화
    const hqData: any[] = [];
    const managerData: any[] = [];
    const agentData: any[] = [];

    sales.forEach((sale) => {
      const baseInfo = {
        판매일: sale.saleDate ? new Date(sale.saleDate).toLocaleDateString('ko-KR') : '-',
        상품명: sale.product?.productName || sale.productCode || '-',
        상품코드: sale.productCode || '-',
        객실종류: sale.cabinType || '-',
        객실개수: sale.headcount || 1,
        총매출: sale.saleAmount || 0,
        원가: sale.costAmount || 0,
        순이익: sale.netRevenue || 0,
        고객명: sale.lead?.customerName || '-',
        고객연락처: sale.lead?.customerPhone || '-',
      };

      // 본사 데이터
      const hqLedger = sale.ledgers.find((l) => l.type === 'HQ_SHARE');
      if (hqLedger) {
        const hqAmount = hqLedger.amount || 0;
        const hqWithholding = hqLedger.withholdingAmount || 0;
        const hqNetAmount = hqAmount - hqWithholding;

        hqData.push({
          직급: '본사',
          이름: 'HQ',
          ...baseInfo,
          수당총액: hqAmount,
          '원천징수(3.3%)': hqWithholding,
          실수령액: hqNetAmount,
          계좌번호: '-',
          정산상태: hqLedger.isSettled ? '완료' : '대기',
        });
      }

      // 대리점장 데이터
      if (sale.manager) {
        const branchLedger = sale.ledgers.find(
          (l) => l.profileId === sale.manager!.id && l.type === 'BRANCH_COMMISSION'
        );
        const overrideLedger = sale.ledgers.find(
          (l) => l.profileId === sale.manager!.id && l.type === 'OVERRIDE_COMMISSION'
        );

        const branchAmount = branchLedger?.amount || 0;
        const branchWithholding = branchLedger?.withholdingAmount || 0;
        const overrideAmount = overrideLedger?.amount || 0;
        const overrideWithholding = overrideLedger?.withholdingAmount || 0;
        const totalAmount = branchAmount + overrideAmount;
        const totalWithholding = branchWithholding + overrideWithholding;
        const netAmount = totalAmount - totalWithholding;

        managerData.push({
          직급: '대리점장',
          이름: sale.manager.displayName || '-',
          코드: sale.manager.affiliateCode || '-',
          연락처: sale.manager.contactPhone || '-',
          ...baseInfo,
          지점수당: branchAmount,
          '지점수당 원천징수(3.3%)': branchWithholding,
          지점수당실수령액: branchAmount - branchWithholding,
          오버라이드수당: overrideAmount,
          '오버라이드 원천징수(3.3%)': overrideWithholding,
          오버라이드실수령액: overrideAmount - overrideWithholding,
          수당총액: totalAmount,
          '원천징수총액(3.3%)': totalWithholding,
          실수령액: netAmount,
          은행명: sale.manager.bankName || '-',
          계좌번호: sale.manager.bankAccount || '-',
          예금주: sale.manager.bankAccountHolder || '-',
          정산상태: (branchLedger?.isSettled && overrideLedger?.isSettled) ? '완료' : '대기',
        });
      }

      // 판매원 데이터
      if (sale.agent) {
        const agentLedger = sale.ledgers.find(
          (l) => l.profileId === sale.agent!.id && l.type === 'SALES_COMMISSION'
        );

        const amount = agentLedger?.amount || 0;
        const withholding = agentLedger?.withholdingAmount || 0;
        const netAmount = amount - withholding;

        agentData.push({
          직급: '판매원',
          이름: sale.agent.displayName || '-',
          코드: sale.agent.affiliateCode || '-',
          연락처: sale.agent.contactPhone || '-',
          대리점장: sale.manager?.displayName || '-',
          ...baseInfo,
          수당총액: amount,
          '원천징수(3.3%)': withholding,
          실수령액: netAmount,
          은행명: sale.agent.bankName || '-',
          계좌번호: sale.agent.bankAccount || '-',
          예금주: sale.agent.bankAccountHolder || '-',
          정산상태: agentLedger?.isSettled ? '완료' : '대기',
        });
      }
    });

    // 엑셀 워크북 생성
    const workbook = XLSX.utils.book_new();

    // 본사 시트
    const hqSheet = XLSX.utils.json_to_sheet(hqData);
    XLSX.utils.book_append_sheet(workbook, hqSheet, '본사');

    // 대리점장 시트
    const managerSheet = XLSX.utils.json_to_sheet(managerData);
    XLSX.utils.book_append_sheet(workbook, managerSheet, '대리점장');

    // 판매원 시트
    const agentSheet = XLSX.utils.json_to_sheet(agentData);
    XLSX.utils.book_append_sheet(workbook, agentSheet, '판매원');

    // 엑셀 버퍼 생성
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 파일명 생성
    const fileName = `정산보고서_${periodParam || '현재월'}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // 응답 반환
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error: any) {
    console.error('[정산 엑셀 다운로드] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || '엑셀 생성 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
