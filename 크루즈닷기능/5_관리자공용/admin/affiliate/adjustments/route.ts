export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/adjustments/route.ts
// 수당 조정 승인 API

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

/**
 * GET: 수당 조정 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    // 인증 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get('cg.sid.v2')?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const sess = await prisma.session.findUnique({
      where: { id: sid },
      select: { User: { select: { id: true, role: true } } },
    });

    if (!sess?.User || sess.User.role !== 'admin') {
      return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const adjustments = await prisma.commissionAdjustment.findMany({
      where,
      include: {
        CommissionLedger: {
          include: {
            AffiliateSale: {
              include: {
                AffiliateProfile_agentIdToAffiliateProfile: {
                  select: {
                    id: true,
                    affiliateCode: true,
                    displayName: true,
                    nickname: true,
                  },
                },
                AffiliateLead: {
                  select: {
                    id: true,
                    customerName: true,
                    customerPhone: true,
                  },
                },
              },
            },
            AffiliateProfile: {
              select: {
                id: true,
                affiliateCode: true,
                displayName: true,
                nickname: true,
              },
            },
          },
        },
        User_CommissionAdjustment_requestedByIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        User_CommissionAdjustment_approvedByIdToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
      take: limit,
    });

    const formattedAdjustments = adjustments.map((adj) => {
      const ledger = adj.CommissionLedger;
      const sale = ledger?.AffiliateSale;
      const agent = sale?.AffiliateProfile_agentIdToAffiliateProfile;
      const lead = sale?.AffiliateLead;

      return {
        id: adj.id,
        ledgerId: adj.ledgerId,
        status: adj.status,
        amount: adj.amount,
        reason: adj.reason,
        requestedAt: adj.requestedAt.toISOString(),
        decidedAt: adj.decidedAt?.toISOString() || null,
        requestedBy: adj.User_CommissionAdjustment_requestedByIdToUser
          ? {
              id: adj.User_CommissionAdjustment_requestedByIdToUser.id,
              name: adj.User_CommissionAdjustment_requestedByIdToUser.name,
              email: adj.User_CommissionAdjustment_requestedByIdToUser.email,
            }
          : null,
        approvedBy: adj.User_CommissionAdjustment_approvedByIdToUser
          ? {
              id: adj.User_CommissionAdjustment_approvedByIdToUser.id,
              name: adj.User_CommissionAdjustment_approvedByIdToUser.name,
              email: adj.User_CommissionAdjustment_approvedByIdToUser.email,
            }
          : null,
        ledger: ledger
          ? {
              id: ledger.id,
              amount: ledger.amount,
              withholdingAmount: ledger.withholdingAmount,
              isSettled: ledger.isSettled,
            }
          : null,
        sale: sale
          ? {
              id: sale.id,
              productCode: sale.productCode,
              saleAmount: sale.saleAmount,
              saleDate: sale.saleDate?.toISOString() || null,
            }
          : null,
        agent: agent
          ? {
              id: agent.id,
              affiliateCode: agent.affiliateCode,
              displayName: agent.displayName || agent.nickname,
            }
          : null,
        customer: lead
          ? {
              id: lead.id,
              name: lead.customerName,
              phone: lead.customerPhone,
            }
          : null,
      };
    });

    return NextResponse.json({
      ok: true,
      adjustments: formattedAdjustments,
    });
  } catch (error: any) {
    console.error('GET /api/admin/affiliate/adjustments error:', error);
    console.error('Error details:', error?.message, error?.code, error?.meta);
    return NextResponse.json({
      ok: false,
      message: error?.message || '수당 조정 목록을 불러오지 못했습니다.',
      ...(process.env.NODE_ENV === 'development' ? { details: error } : {}),
    }, { status: 500 });
  }
}

/**
 * PATCH: 수당 조정 승인/거부
 */
export async function PATCH(req: NextRequest) {
  try {
    // 인증 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get('cg.sid.v2')?.value;
    if (!sid) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const sess = await prisma.session.findUnique({
      where: { id: sid },
      select: { User: { select: { id: true, role: true } } },
    });

    if (!sess?.User || sess.User.role !== 'admin') {
      return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, status } = body;

    if (!id || !status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ ok: false, message: '잘못된 요청입니다.' }, { status: 400 });
    }

    // 조정 내역 조회
    const existingAdjustment = await prisma.commissionAdjustment.findUnique({
      where: { id },
      include: { CommissionLedger: true },
    });

    if (!existingAdjustment) {
      return NextResponse.json({ ok: false, message: '조정 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 이미 처리된 조정 내역은 수정 불가
    if (existingAdjustment.status !== 'PENDING') {
      return NextResponse.json({ ok: false, message: '이미 처리된 조정 내역입니다.' }, { status: 400 });
    }

    // 금액 검증 (승인 시)
    if (status === 'APPROVED' && existingAdjustment.CommissionLedger) {
      const MAX_ADJUSTMENT = 10_000_000; // 최대 1천만원
      const adjustmentAmount = existingAdjustment.amount;

      // 합리적 범위 검증
      if (Math.abs(adjustmentAmount) > MAX_ADJUSTMENT) {
        return NextResponse.json({
          ok: false,
          message: `조정 금액이 허용 범위를 초과합니다 (최대 ${MAX_ADJUSTMENT.toLocaleString()}원)`
        }, { status: 400 });
      }

      // 최종 금액이 음수가 되지 않도록 검증
      const finalAmount = existingAdjustment.CommissionLedger.amount + adjustmentAmount;
      if (finalAmount < 0) {
        return NextResponse.json({
          ok: false,
          message: '조정 후 금액이 음수가 됩니다. 조정 금액을 확인해주세요.'
        }, { status: 400 });
      }
    }

    const adjustment = await prisma.commissionAdjustment.update({
      where: { id },
      data: {
        status,
        approvedById: sess.User.id,
        decidedAt: new Date(),
      },
      include: {
        CommissionLedger: true,
      },
    });

    // 승인된 경우 수수료 원장 업데이트
    if (status === 'APPROVED' && adjustment.CommissionLedger) {
      const newAmount = adjustment.CommissionLedger.amount + adjustment.amount;
      await prisma.commissionLedger.update({
        where: { id: adjustment.ledgerId },
        data: {
          amount: Math.round(newAmount), // 정수로 변환 (소수점 조작 방지)
        },
      });

      logger.log('[Commission Adjustment]', {
        adjustmentId: adjustment.id,
        ledgerId: adjustment.ledgerId,
        originalAmount: adjustment.CommissionLedger.amount,
        adjustmentAmount: adjustment.amount,
        finalAmount: newAmount,
        approvedBy: sess.User.id,
      });
    }

    return NextResponse.json({
      ok: true,
      adjustment: {
        id: adjustment.id,
        status: adjustment.status,
        decidedAt: adjustment.decidedAt?.toISOString() || null,
      },
    });
  } catch (error: any) {
    console.error('PATCH /api/admin/affiliate/adjustments error:', error);
    console.error('Error details:', error?.message, error?.code, error?.meta);
    return NextResponse.json({
      ok: false,
      message: error?.message || '수당 조정 처리에 실패했습니다.',
      ...(process.env.NODE_ENV === 'development' ? { details: error } : {}),
    }, { status: 500 });
  }
}
