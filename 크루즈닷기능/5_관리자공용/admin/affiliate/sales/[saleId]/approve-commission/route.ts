export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/sales/[saleId]/approve-commission/route.ts
// 구매 완료 승인 및 수당 확정 API (기존 프로세스용)

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { syncSaleCommissionLedgers } from '@/lib/affiliate/commission-ledger';

function requireAdmin(role?: string | null) {
  if (role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

/**
 * POST: 구매 완료 승인 및 수당 확정
 * - PENDING 상태인 판매를 승인
 * - 상태를 CONFIRMED로 변경
 * - 수당 자동 계산 및 CommissionLedger 생성
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ saleId: string }> }
) {
  try {
    const { saleId: saleIdStr } = await params;
    const saleId = Number(saleIdStr);
    if (!saleId || Number.isNaN(saleId)) {
      return NextResponse.json({ ok: false, message: 'Invalid sale ID' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) return guard;

    // 판매 정보 조회
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      include: {
        AffiliateProfile_managerIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            affiliateCode: true,
          },
        },
        AffiliateProfile_agentIdToAffiliateProfile: {
          select: {
            id: true,
            displayName: true,
            affiliateCode: true,
          },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ ok: false, message: 'Sale not found' }, { status: 404 });
    }

    // 이미 확정된 판매인지 확인
    if (sale.status === 'CONFIRMED' || sale.status === 'APPROVED') {
      return NextResponse.json({ 
        ok: false, 
        message: '이미 확정된 판매입니다.' 
      }, { status: 400 });
    }

    // PENDING 상태만 승인 가능
    if (sale.status !== 'PENDING' && sale.status !== 'PENDING_APPROVAL') {
      return NextResponse.json({ 
        ok: false, 
        message: `현재 상태(${sale.status})에서는 승인할 수 없습니다. PENDING 또는 PENDING_APPROVAL 상태만 승인 가능합니다.` 
      }, { status: 400 });
    }

    // 트랜잭션으로 처리
    const result = await prisma.$transaction(async (tx) => {
      // 현재 판매 정보 확인 (commissionProcessed 체크)
      const currentSale = await tx.affiliateSale.findUnique({
        where: { id: saleId },
        select: { metadata: true },
      });

      const currentMetadata = currentSale?.metadata as any;
      const commissionProcessed = currentMetadata?.commissionProcessed || false;

      // 판매 상태를 CONFIRMED로 변경
      const updated = await tx.affiliateSale.update({
        where: { id: saleId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
        include: {
          AffiliateProfile_managerIdToAffiliateProfile: {
            select: {
              id: true,
              displayName: true,
              affiliateCode: true,
            },
          },
          AffiliateProfile_agentIdToAffiliateProfile: {
            select: {
              id: true,
              displayName: true,
              affiliateCode: true,
            },
          },
        },
      });

      // 수당 중복 지급 방지: 이미 처리되었으면 스킵
      if (!commissionProcessed) {
        // 수당 자동 계산 및 CommissionLedger 생성
        await syncSaleCommissionLedgers(
          saleId,
          { 
            regenerate: false, // 기존 레저가 있으면 유지
            includeHq: true, // 본사 수당도 포함
          },
          tx
        );

        // commissionProcessed 플래그 업데이트
        await tx.affiliateSale.update({
          where: { id: saleId },
          data: {
            metadata: {
              ...currentMetadata,
              commissionProcessed: true,
              commissionProcessedAt: new Date().toISOString(),
            },
          },
        });

        logger.log(`[Approve Commission] Commission processed for sale ${saleId}`);
      } else {
        logger.log(`[Approve Commission] Commission already processed for sale ${saleId}, skipping`);
      }

      return updated;
    });

    return NextResponse.json({ 
      ok: true, 
      sale: result,
      message: '구매 완료가 승인되고 수당이 확정되었습니다.',
    });
  } catch (error: any) {
    const { saleId: saleIdStr } = await params;
    console.error(`POST /api/admin/affiliate/sales/${saleIdStr}/approve-commission error:`, error);
    return NextResponse.json({
      ok: false,
      message: error.message || 'Server error'
    }, { status: 500 });
  }
}
