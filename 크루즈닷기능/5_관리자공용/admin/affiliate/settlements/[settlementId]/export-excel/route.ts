export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/settlements/[settlementId]/export-excel/route.ts
// 엑셀 다운로드 API (요구사항 형식)

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

/**
 * GET: 엑셀 다운로드 (판매원별 시트)
 * 요구사항:
 * - 판매원별 엑셀 시트
 * - 판매원 이름, 은행 계좌
 * - 각 상품정보 (판매가, 입금가)
 * - 수당단가 (판매원/대리점장별)
 * - 상품별 구매자 이름과 인원수
 * - 총인원
 * - 세부 수당집계
 * - 총 수당집계
 * - 본사 순이익 집계
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ settlementId: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    const { settlementId: settlementIdStr } = await params;
    const settlementId = Number(settlementIdStr);
    if (isNaN(settlementId)) {
      return NextResponse.json({ ok: false, message: 'Invalid settlement ID' }, { status: 400 });
    }

    // Settlement 조회
    const settlement = await prisma.monthlySettlement.findUnique({
      where: { id: settlementId },
      include: {
        ledgerEntries: {
          include: {
            profile: {
              select: {
                id: true,
                affiliateCode: true,
                displayName: true,
                type: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    phone: true,
                  },
                },
              },
            },
            sale: {
              include: {
                AffiliateProfile_managerIdToAffiliateProfile: {
                  select: {
                    id: true,
                    affiliateCode: true,
                    displayName: true,
                  },
                },
                AffiliateProfile_agentIdToAffiliateProfile: {
                  select: {
                    id: true,
                    affiliateCode: true,
                    displayName: true,
                  },
                },
                AffiliateLead: {
                  select: {
                    id: true,
                    customerName: true,
                    customerPhone: true,
                  },
                },
                product: {
                  select: {
                    productCode: true,
                    title: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { profileId: 'asc' },
            { createdAt: 'asc' },
          ],
        },
      },
    });

    if (!settlement) {
      return NextResponse.json({ ok: false, message: 'Settlement not found' }, { status: 404 });
    }

    // 판매원별로 그룹화
    const agentMap = new Map<number, {
      agent: {
        id: number;
        affiliateCode: string | null;
        displayName: string | null;
        user: {
          id: number;
          name: string | null;
          phone: string | null;
        } | null;
      };
      manager: {
        id: number;
        affiliateCode: string | null;
        displayName: string | null;
      } | null;
      bankInfo: {
        bankName: string | null;
        bankAccount: string | null;
        bankAccountHolder: string | null;
      };
      sales: Array<{
        saleId: number;
        saleDate: string | null;
        productCode: string | null;
        productTitle: string | null;
        customerName: string | null;
        headcount: number;
        saleAmount: number;
        costAmount: number;
        agentCommission: number;
        agentWithholding: number;
        agentNet: number;
        managerCommission: number;
        managerWithholding: number;
        managerNet: number;
      }>;
      totals: {
        totalHeadcount: number;
        totalSaleAmount: number;
        totalCostAmount: number;
        totalAgentCommission: number;
        totalAgentWithholding: number;
        totalAgentNet: number;
        totalManagerCommission: number;
        totalManagerWithholding: number;
        totalManagerNet: number;
      };
    }>();

    // 판매원별 데이터 집계
    for (const entry of settlement.ledgerEntries) {
      if (!entry.profile || entry.profile.type !== 'SALES_AGENT' || !entry.sale) continue;

      const agentId = entry.profile.id;
      const sale = entry.sale;

      if (!agentMap.has(agentId)) {
        // 계약서에서 은행 정보 가져오기
        const contract = await prisma.affiliateContract.findFirst({
          where: {
            userId: entry.profile.user?.id,
          },
          select: {
            bankName: true,
            bankAccount: true,
            bankAccountHolder: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        agentMap.set(agentId, {
          agent: {
            id: agentId,
            affiliateCode: entry.profile.affiliateCode,
            displayName: entry.profile.displayName,
            user: entry.profile.user,
          },
          manager: sale.AffiliateProfile_managerIdToAffiliateProfile ? {
            id: sale.AffiliateProfile_managerIdToAffiliateProfile.id,
            affiliateCode: sale.AffiliateProfile_managerIdToAffiliateProfile.affiliateCode,
            displayName: sale.AffiliateProfile_managerIdToAffiliateProfile.displayName,
          } : null,
          bankInfo: {
            bankName: contract?.bankName || null,
            bankAccount: contract?.bankAccount || null,
            bankAccountHolder: contract?.bankAccountHolder || null,
          },
          sales: [],
          totals: {
            totalHeadcount: 0,
            totalSaleAmount: 0,
            totalCostAmount: 0,
            totalAgentCommission: 0,
            totalAgentWithholding: 0,
            totalAgentNet: 0,
            totalManagerCommission: 0,
            totalManagerWithholding: 0,
            totalManagerNet: 0,
          },
        });
      }

      const agentData = agentMap.get(agentId)!;

      // 판매원 수당 계산
      if (entry.entryType === 'SALES_COMMISSION') {
        const agentNet = entry.amount - (entry.withholdingAmount || 0);
        agentData.totals.totalAgentCommission += entry.amount;
        agentData.totals.totalAgentWithholding += entry.withholdingAmount || 0;
        agentData.totals.totalAgentNet += agentNet;
      }

      // 대리점장 수당 계산 (오버라이드)
      if (entry.entryType === 'OVERRIDE_COMMISSION' && sale.AffiliateProfile_managerIdToAffiliateProfile) {
        const managerNet = entry.amount - (entry.withholdingAmount || 0);
        agentData.totals.totalManagerCommission += entry.amount;
        agentData.totals.totalManagerWithholding += entry.withholdingAmount || 0;
        agentData.totals.totalManagerNet += managerNet;
      }

      // 판매 정보 추가 (중복 방지)
      const existingSale = agentData.sales.find(s => s.saleId === sale.id);
      if (!existingSale) {
        // 해당 판매의 모든 수당 정보 가져오기
        const saleLedgers = settlement.ledgerEntries.filter(e => e.sale?.id === sale.id);
        const agentCommission = saleLedgers.find(e => e.entryType === 'SALES_COMMISSION' && e.profileId === agentId)?.amount || 0;
        const agentWithholding = saleLedgers.find(e => e.entryType === 'SALES_COMMISSION' && e.profileId === agentId)?.withholdingAmount || 0;
        const managerCommission = saleLedgers.find(e => e.entryType === 'OVERRIDE_COMMISSION' && sale.AffiliateProfile_managerIdToAffiliateProfile && e.profileId === sale.AffiliateProfile_managerIdToAffiliateProfile.id)?.amount || 0;
        const managerWithholding = saleLedgers.find(e => e.entryType === 'OVERRIDE_COMMISSION' && sale.AffiliateProfile_managerIdToAffiliateProfile && e.profileId === sale.AffiliateProfile_managerIdToAffiliateProfile.id)?.withholdingAmount || 0;

        agentData.sales.push({
          saleId: sale.id,
          saleDate: sale.saleDate?.toISOString().split('T')[0] || sale.confirmedAt?.toISOString().split('T')[0] || null,
          productCode: sale.productCode || sale.product?.productCode || null,
          productTitle: sale.product?.title || null,
          customerName: sale.AffiliateLead?.customerName || null,
          headcount: sale.headcount || 0,
          saleAmount: sale.saleAmount || 0,
          costAmount: sale.costAmount || 0,
          agentCommission,
          agentWithholding,
          agentNet: agentCommission - agentWithholding,
          managerCommission,
          managerWithholding,
          managerNet: managerCommission - managerWithholding,
        });

        agentData.totals.totalHeadcount += sale.headcount || 0;
        agentData.totals.totalSaleAmount += sale.saleAmount || 0;
        agentData.totals.totalCostAmount += sale.costAmount || 0;
      }
    }

    // 엑셀 워크북 생성
    const workbook = XLSX.utils.book_new();

    // 본사 집계 시트
    const hqTotals: any[] = [];
    let totalHqNet = 0;
    let totalSaleAmount = 0;
    let totalCostAmount = 0;
    let totalHqCardFees = 0;
    let totalHqCorporateTax = 0;
    let totalHqNetAfterFees = 0;

    // 모든 판매의 총합 계산
    for (const agentData of agentMap.values()) {
      totalSaleAmount += agentData.totals.totalSaleAmount;
      totalCostAmount += agentData.totals.totalCostAmount;
    }

    // HQ 순익 계산
    for (const entry of settlement.ledgerEntries) {
      if (entry.entryType === 'HQ_NET') {
        totalHqNet += entry.amount;
      }
    }

    // 카드수수료 (3.5%) 및 법인세 (10%) 계산
    totalHqCardFees = Math.round(totalSaleAmount * 0.035);
    const netRevenue = totalSaleAmount - totalCostAmount;
    totalHqCorporateTax = Math.round(netRevenue * 0.1);
    totalHqNetAfterFees = Math.max(totalHqNet - totalHqCardFees - totalHqCorporateTax, 0);

    hqTotals.push(
      ['본사 순이익 집계'],
      ['항목', '금액'],
      ['HQ 순익(원장)', totalHqNet],
      ['HQ 카드수수료', totalHqCardFees],
      ['HQ 법인세', totalHqCorporateTax],
      ['HQ 세후순익', totalHqNetAfterFees],
    );

    const hqSheet = XLSX.utils.aoa_to_sheet(hqTotals);
    XLSX.utils.book_append_sheet(workbook, hqSheet, '본사집계');

    // 판매원별 시트 생성
    for (const [agentId, agentData] of agentMap) {
      const rows: any[] = [];

      // 헤더
      rows.push(['판매원 수당 집계표']);
      rows.push(['판매원명', agentData.agent.displayName || agentData.agent.user?.name || '']);
      rows.push(['판매원코드', agentData.agent.affiliateCode || '']);
      rows.push(['은행명', agentData.bankInfo.bankName || '']);
      rows.push(['계좌번호', agentData.bankInfo.bankAccount || '']);
      rows.push(['예금주', agentData.bankInfo.bankAccountHolder || '']);
      if (agentData.manager) {
        rows.push(['대리점장명', agentData.manager.displayName || '']);
        rows.push(['대리점장코드', agentData.manager.affiliateCode || '']);
      }
      rows.push([]);

      // 상세 데이터 헤더
      rows.push([
        '판매일시',
        '상품코드',
        '상품명',
        '구매자명',
        '인원수',
        '판매가',
        '입금가',
        '판매원수당단가',
        '판매원원천징수',
        '판매원세후금액',
        '대리점장수당단가',
        '대리점장원천징수',
        '대리점장세후금액',
      ]);

      // 상세 데이터
      for (const sale of agentData.sales) {
        rows.push([
          sale.saleDate || '',
          sale.productCode || '',
          sale.productTitle || '',
          sale.customerName || '',
          sale.headcount,
          sale.saleAmount,
          sale.costAmount,
          sale.agentCommission,
          sale.agentWithholding,
          sale.agentNet,
          sale.managerCommission,
          sale.managerWithholding,
          sale.managerNet,
        ]);
      }

      // 합계 행
      rows.push([]);
      rows.push([
        '합계',
        '',
        '',
        '',
        agentData.totals.totalHeadcount,
        agentData.totals.totalSaleAmount,
        agentData.totals.totalCostAmount,
        agentData.totals.totalAgentCommission,
        agentData.totals.totalAgentWithholding,
        agentData.totals.totalAgentNet,
        agentData.totals.totalManagerCommission,
        agentData.totals.totalManagerWithholding,
        agentData.totals.totalManagerNet,
      ]);

      // 시트 생성
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      const sheetName = agentData.agent.displayName || agentData.agent.user?.name || `판매원${agentId}`;
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName.substring(0, 31)); // 엑셀 시트명 최대 31자
    }

    // 엑셀 파일 생성
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const periodLabel = `${settlement.periodStart.toISOString().split('T')[0]}_${settlement.periodEnd.toISOString().split('T')[0]}`;
    const fileName = `수당집계표_${periodLabel}.xlsx`;

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/affiliate/settlements/[settlementId]/export-excel error:', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
