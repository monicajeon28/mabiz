export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

const WITHHOLDING_RATE = 3.3;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ settlementId: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { settlementId } = await params;
    const settlementIdNum = parseInt(settlementId, 10);
    if (isNaN(settlementIdNum)) {
      return NextResponse.json({ ok: false, message: '잘못된 정산 ID입니다.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const profileIdParam = searchParams.get('profileId');
    const profileId = profileIdParam ? parseInt(profileIdParam, 10) : null;

    // 정산 정보 조회
    const settlement = await prisma.monthlySettlement.findUnique({
      where: { id: settlementIdNum },
    });

    if (!settlement) {
      return NextResponse.json({ ok: false, message: '정산 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 관리자인지 확인
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'admin';

    // 파트너인 경우: 본인의 프로필 확인
    let targetProfileId = profileId;
    if (!isAdmin) {
      const partnerProfile = await prisma.affiliateProfile.findFirst({
        where: { userId: sessionUser.id },
        select: { id: true },
      });

      if (!partnerProfile) {
        return NextResponse.json({ ok: false, message: '파트너 프로필을 찾을 수 없습니다.' }, { status: 403 });
      }

      // 파트너는 본인의 명세서만 볼 수 있음
      targetProfileId = partnerProfile.id;
    }

    if (!targetProfileId) {
      return NextResponse.json({ ok: false, message: 'profileId가 필요합니다.' }, { status: 400 });
    }

    // 해당 프로필 정보 조회 (은행 정보 포함)
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: targetProfileId },
      select: {
        id: true,
        affiliateCode: true,
        displayName: true,
        nickname: true,
        type: true,
        bankName: true,
        bankAccount: true,
        bankAccountHolder: true,
        withholdingRate: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, message: '프로필 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 1차: 해당 정산에 연결된 커미션 원장 조회
    let ledgerEntries = await prisma.commissionLedger.findMany({
      where: {
        profileId: targetProfileId,
        settlementId: settlementIdNum,
      },
      include: {
        AffiliateSale: {
          select: {
            id: true,
            productCode: true,
            saleAmount: true,
            saleDate: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2차: 정산 기간 내의 커미션 원장 조회 (settlementId가 없는 경우도 포함)
    if (ledgerEntries.length === 0) {
      ledgerEntries = await prisma.commissionLedger.findMany({
        where: {
          profileId: targetProfileId,
          createdAt: {
            gte: settlement.periodStart,
            lte: settlement.periodEnd,
          },
        },
        include: {
          AffiliateSale: {
            select: {
              id: true,
              productCode: true,
              saleAmount: true,
              saleDate: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    // 3차: CommissionLedger에 데이터가 없으면 AffiliateSale에서 직접 조회
    if (ledgerEntries.length === 0) {
      // 해당 파트너의 판매 데이터 조회 (manager 또는 agent로)
      const sales = await prisma.affiliateSale.findMany({
        where: {
          OR: [
            { managerId: targetProfileId },
            { agentId: targetProfileId },
          ],
          status: { in: ['CONFIRMED', 'APPROVED', 'PAID'] },
          confirmedAt: {
            gte: settlement.periodStart,
            lte: settlement.periodEnd,
          },
        },
        select: {
          id: true,
          productCode: true,
          saleAmount: true,
          saleDate: true,
          confirmedAt: true,
          managerId: true,
          agentId: true,
        },
        orderBy: { confirmedAt: 'asc' },
      });

      if (sales.length === 0) {
        // 데이터가 전혀 없으면 빈 명세서 반환 (0원 명세서)
        return buildEmptyStatementResponse(settlement, profile);
      }

      // AffiliateSale 데이터로 명세서 생성
      return buildStatementFromSales(settlement, profile, sales, targetProfileId);
    }

    return buildStatementResponse(settlement, profile, ledgerEntries);
  } catch (error: any) {
    console.error('[Statement API] GET error:', error);
    return NextResponse.json(
      { ok: false, message: '지급명세서를 불러오지 못했습니다.', error: error?.message },
      { status: 500 }
    );
  }
}

// 빈 명세서 응답 (해당 기간에 데이터가 없는 경우)
function buildEmptyStatementResponse(settlement: any, profile: any) {
  const withholdingRate = profile.withholdingRate ?? WITHHOLDING_RATE;

  const statement = {
    profileId: profile.id,
    affiliateCode: profile.affiliateCode,
    displayName: profile.displayName || profile.nickname,
    type: profile.type,
    periodStart: settlement.periodStart.toISOString(),
    periodEnd: settlement.periodEnd.toISOString(),
    salesCount: 0,
    totalSaleAmount: 0,
    salesCommission: 0,
    branchCommission: 0,
    overrideCommission: 0,
    grossAmount: 0,
    withholdingAmount: 0,
    withholdingRate,
    netAmount: 0,
    entryCount: 0,
    bankName: profile.bankName,
    bankAccount: profile.bankAccount,
    bankAccountHolder: profile.bankAccountHolder,
    confirmed: false,
    confirmedAt: null,
    details: [],
  };

  return NextResponse.json({
    ok: true,
    settlement: {
      id: settlement.id,
      periodStart: settlement.periodStart.toISOString(),
      periodEnd: settlement.periodEnd.toISOString(),
      status: settlement.status,
      paymentDate: settlement.paymentDate?.toISOString() || null,
    },
    statements: [statement],
  });
}

// AffiliateSale 데이터에서 명세서 생성
function buildStatementFromSales(
  settlement: any,
  profile: any,
  sales: any[],
  targetProfileId: number
) {
  const withholdingRate = profile.withholdingRate ?? WITHHOLDING_RATE;
  const isManager = profile.type === 'BRANCH_MANAGER';

  let salesCommission = 0;
  let branchCommission = 0;
  let overrideCommission = 0;
  let totalSaleAmount = 0;

  const details = sales.map((sale) => {
    totalSaleAmount += sale.saleAmount || 0;

    // 기본 커미션 계산 (실제로는 AffiliateProduct의 커미션율 참조 필요)
    let commission = 0;
    let entryType = 'SALES_COMMISSION';

    if (isManager && sale.managerId === targetProfileId) {
      // 대리점장: 직접 판매 또는 오버라이딩
      if (sale.agentId && sale.agentId !== targetProfileId) {
        // 소속 판매원의 판매 -> 오버라이딩
        commission = Math.round((sale.saleAmount || 0) * 0.02); // 2% 오버라이딩 (예시)
        entryType = 'OVERRIDE_COMMISSION';
        overrideCommission += commission;
      } else {
        // 직접 판매 -> 대리점 커미션
        commission = Math.round((sale.saleAmount || 0) * 0.1); // 10% (예시)
        entryType = 'BRANCH_COMMISSION';
        branchCommission += commission;
      }
    } else {
      // 판매원: 판매 수당
      commission = Math.round((sale.saleAmount || 0) * 0.05); // 5% (예시)
      entryType = 'SALES_COMMISSION';
      salesCommission += commission;
    }

    const withholding = Math.round(commission * withholdingRate / 100);

    return {
      entryId: sale.id,
      saleId: sale.id,
      productCode: sale.productCode,
      saleAmount: sale.saleAmount,
      saleDate: sale.confirmedAt?.toISOString() || sale.saleDate?.toISOString() || null,
      entryType,
      amount: commission,
      withholdingAmount: withholding,
      netAmount: commission - withholding,
    };
  });

  const grossAmount = salesCommission + branchCommission + overrideCommission;
  const withholdingAmount = Math.round(grossAmount * withholdingRate / 100);
  const netAmount = grossAmount - withholdingAmount;

  const statement = {
    profileId: profile.id,
    affiliateCode: profile.affiliateCode,
    displayName: profile.displayName || profile.nickname,
    type: profile.type,
    periodStart: settlement.periodStart.toISOString(),
    periodEnd: settlement.periodEnd.toISOString(),
    salesCount: sales.length,
    totalSaleAmount,
    salesCommission,
    branchCommission,
    overrideCommission,
    grossAmount,
    withholdingAmount,
    withholdingRate,
    netAmount,
    entryCount: sales.length,
    bankName: profile.bankName,
    bankAccount: profile.bankAccount,
    bankAccountHolder: profile.bankAccountHolder,
    confirmed: false,
    confirmedAt: null,
    details,
  };

  return NextResponse.json({
    ok: true,
    settlement: {
      id: settlement.id,
      periodStart: settlement.periodStart.toISOString(),
      periodEnd: settlement.periodEnd.toISOString(),
      status: settlement.status,
      paymentDate: settlement.paymentDate?.toISOString() || null,
    },
    statements: [statement],
  });
}

function buildStatementResponse(
  settlement: any,
  profile: any,
  ledgerEntries: any[]
) {
  // 수당 유형별 집계
  let salesCommission = 0; // 판매 수당
  let branchCommission = 0; // 대리점 수당
  let overrideCommission = 0; // 오버라이딩 커미션
  let totalGrossAmount = 0;
  let totalWithholdingAmount = 0;
  let salesCount = 0;
  let totalSaleAmount = 0;

  const withholdingRate = profile.withholdingRate ?? WITHHOLDING_RATE;

  const details = ledgerEntries.map((entry) => {
    const amount = entry.amount;
    const withholding = entry.withholdingAmount ?? Math.round(amount * withholdingRate / 100);
    const netAmount = amount - withholding;

    totalGrossAmount += amount;
    totalWithholdingAmount += withholding;

    // 판매 금액 집계
    if (entry.AffiliateSale?.saleAmount) {
      totalSaleAmount += entry.AffiliateSale.saleAmount;
      salesCount++;
    }

    // 수당 유형별 집계
    switch (entry.entryType) {
      case 'SALES_COMMISSION':
        salesCommission += amount;
        break;
      case 'BRANCH_COMMISSION':
        branchCommission += amount;
        break;
      case 'OVERRIDE_COMMISSION':
        overrideCommission += amount;
        break;
    }

    return {
      entryId: entry.id,
      saleId: entry.AffiliateSale?.id ?? null,
      productCode: entry.AffiliateSale?.productCode ?? null,
      saleAmount: entry.AffiliateSale?.saleAmount ?? null,
      saleDate: entry.AffiliateSale?.saleDate?.toISOString() ?? null,
      entryType: entry.entryType,
      amount,
      withholdingAmount: withholding,
      netAmount,
    };
  });

  const netAmount = totalGrossAmount - totalWithholdingAmount;

  const statement = {
    profileId: profile.id,
    affiliateCode: profile.affiliateCode,
    displayName: profile.displayName || profile.nickname,
    type: profile.type,
    periodStart: settlement.periodStart.toISOString(),
    periodEnd: settlement.periodEnd.toISOString(),
    // 판매 정보
    salesCount,
    totalSaleAmount,
    // 수당 정보
    salesCommission,
    branchCommission,
    overrideCommission,
    grossAmount: totalGrossAmount,
    withholdingAmount: totalWithholdingAmount,
    withholdingRate,
    netAmount,
    entryCount: ledgerEntries.length,
    // 은행 정보
    bankName: profile.bankName,
    bankAccount: profile.bankAccount,
    bankAccountHolder: profile.bankAccountHolder,
    // 확인 상태
    confirmed: false,
    confirmedAt: null,
    details,
  };

  return NextResponse.json({
    ok: true,
    settlement: {
      id: settlement.id,
      periodStart: settlement.periodStart.toISOString(),
      periodEnd: settlement.periodEnd.toISOString(),
      status: settlement.status,
      paymentDate: settlement.paymentDate?.toISOString() || null,
    },
    statements: [statement],
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ settlementId: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { settlementId } = await params;
    const settlementIdNum = parseInt(settlementId, 10);
    if (isNaN(settlementIdNum)) {
      return NextResponse.json({ ok: false, message: '잘못된 정산 ID입니다.' }, { status: 400 });
    }

    const body = await req.json();
    const { confirmed } = body;

    if (typeof confirmed !== 'boolean') {
      return NextResponse.json({ ok: false, message: 'confirmed 값이 필요합니다.' }, { status: 400 });
    }

    // 현재는 확인 기능만 구현 (실제로는 별도 테이블에서 확인 상태 관리 필요)
    // NOTE: StatementConfirmation 테이블 구조 설계 필요 (See GitHub Issue #TBD)
    // 임시: confirmed 파라미터만 받고 별도 저장은 하지 않음

    return NextResponse.json({
      ok: true,
      message: '지급명세서를 확인했습니다.',
    });
  } catch (error: any) {
    console.error('[Statement API] PUT error:', error);
    return NextResponse.json(
      { ok: false, message: '지급명세서 확인에 실패했습니다.', error: error?.message },
      { status: 500 }
    );
  }
}
