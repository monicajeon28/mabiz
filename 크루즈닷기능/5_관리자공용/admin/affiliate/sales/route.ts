export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/sales/route.ts
// 어필리에이트 판매 생성 및 관리 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateLedgerEntries } from '@/lib/affiliate/commission';

function requireAdmin(role?: string | null) {
  if (role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

/**
 * GET: 판매 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) return guard;

    const { searchParams } = new URL(req.url);
    const managerId = searchParams.get('managerId') ? Number(searchParams.get('managerId')) : undefined;
    const agentId = searchParams.get('agentId') ? Number(searchParams.get('agentId')) : undefined;
    const status = searchParams.get('status') || undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50;

    const where: any = {};
    if (managerId) where.managerId = managerId;
    if (agentId) where.agentId = agentId;
    if (status) where.status = status;

    // 성능 최적화: include 대신 select 사용
    const sales = await prisma.affiliateSale.findMany({
      where,
      select: {
        id: true,
        productCode: true,
        saleAmount: true,
        netRevenue: true,
        saleDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        managerId: true,
        agentId: true,
        leadId: true,
        AffiliateProfile_managerIdToAffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
            nickname: true,
          },
        },
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
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ ok: true, sales });
  } catch (error: any) {
    console.error('GET /api/admin/affiliate/sales error:', error);
    console.error('Error details:', error?.message, error?.code, error?.meta);
    return NextResponse.json({ 
      ok: false, 
      message: 'Server error',
      error: error?.message || String(error),
      ...(process.env.NODE_ENV === 'development' ? { details: error } : {})
    }, { status: 500 });
  }
}

/**
 * POST: 새로운 판매 생성 (결제 완료 시)
 */
export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { role: true } });
    const guard = requireAdmin(admin?.role);
    if (guard) return guard;

    const body = await req.json();
    const {
      externalOrderCode,
      leadId,
      productCode,
      managerId,
      agentId,
      cabinType,
      fareCategory,
      headcount,
      saleAmount,
      costAmount,
      saleDate,
      metadata,
    } = body;

    // 필수 필드 검증
    if (!saleAmount || !productCode) {
      return NextResponse.json({ ok: false, message: '판매 금액과 상품 코드는 필수입니다.' }, { status: 400 });
    }

    // 어필리에이트 프로필 확인
    let finalManagerId: number | null = null;
    let finalAgentId: number | null = null;

    if (agentId) {
      const agent = await prisma.affiliateProfile.findUnique({
        where: { id: agentId },
        select: {
          id: true,
          type: true,
          agentRelations: {
            where: { status: 'ACTIVE' },
            select: { managerId: true },
            take: 1,
          },
        },
      });

      if (agent) {
        if (agent.type === 'SALES_AGENT') {
          finalAgentId = agent.id;
          if (agent.agentRelations.length > 0) {
            finalManagerId = agent.agentRelations[0].managerId;
          }
        } else if (agent.type === 'BRANCH_MANAGER') {
          finalManagerId = agent.id;
        }
      }
    } else if (managerId) {
      const manager = await prisma.affiliateProfile.findUnique({
        where: { id: managerId },
        select: { id: true, type: true },
      });

      if (manager && manager.type === 'BRANCH_MANAGER') {
        finalManagerId = manager.id;
      }
    }

    // Lead에서 어필리에이트 정보 가져오기 (없는 경우)
    if (!finalManagerId && !finalAgentId && leadId) {
      const lead = await prisma.affiliateLead.findUnique({
        where: { id: leadId },
        select: {
          managerId: true,
          agentId: true,
        },
      });

      if (lead) {
        finalManagerId = lead.managerId ?? null;
        finalAgentId = lead.agentId ?? null;
      }
    }

    // AffiliateProduct 찾기
    let affiliateProductId: number | null = null;
    if (productCode) {
      const affiliateProduct = await prisma.affiliateProduct.findFirst({
        where: {
          productCode,
          isPublished: true,
          effectiveFrom: { lte: new Date() },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: new Date() } },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
        include: {
          commissionTiers: {
            where: {
              OR: [
                { cabinType: cabinType || null },
                { cabinType: null },
              ],
            },
            take: 1,
          },
        },
      });

      if (affiliateProduct) {
        affiliateProductId = affiliateProduct.id;
      }
    }

    // 수당 계산 - CommissionTier에서 수당 정보 가져오기
    const netRevenue = saleAmount - (costAmount || 0);

    // CommissionTier 매핑 (상품에 등록된 수당 설정 사용)
    let tier: {
      cabinType?: string | null;
      saleAmount?: number | null;
      costAmount?: number | null;
      hqShareAmount?: number | null;
      branchShareAmount?: number | null;
      salesShareAmount?: number | null;
      overrideAmount?: number | null;
      currency?: string | null;
    } | undefined = undefined;

    if (affiliateProductId) {
      const affiliateProduct = await prisma.affiliateProduct.findUnique({
        where: { id: affiliateProductId },
        include: {
          AffiliateCommissionTier: {
            where: {
              OR: [
                { cabinType: cabinType || undefined },
                { cabinType: null },
              ],
            },
            orderBy: { cabinType: 'desc' }, // cabinType이 있는 것 우선
            take: 1,
          },
        },
      });

      const commissionTier = affiliateProduct?.AffiliateCommissionTier?.[0];
      if (commissionTier) {
        tier = {
          cabinType: commissionTier.cabinType,
          saleAmount: commissionTier.saleAmount,
          costAmount: commissionTier.costAmount,
          hqShareAmount: commissionTier.hqShareAmount,
          branchShareAmount: commissionTier.branchShareAmount,
          salesShareAmount: commissionTier.salesShareAmount,
          overrideAmount: commissionTier.overrideAmount,
          currency: commissionTier.currency,
        };
      }
    }

    const breakdown = generateLedgerEntries({
      saleId: 0, // 임시값, 나중에 업데이트
      saleAmount,
      costAmount: costAmount || 0,
      tier, // 상품에 등록된 수당 설정 전달
      managerProfileId: finalManagerId ?? undefined,
      agentProfileId: finalAgentId ?? undefined,
      currency: tier?.currency || 'KRW',
      metadata: metadata || {},
    });

    // AffiliateSale 생성
    const sale = await prisma.affiliateSale.create({
      data: {
        externalOrderCode: externalOrderCode || null,
        leadId: leadId || null,
        affiliateProductId,
        managerId: finalManagerId,
        agentId: finalAgentId,
        productCode,
        cabinType: cabinType || null,
        fareCategory: fareCategory || null,
        headcount: headcount || null,
        saleAmount,
        costAmount: costAmount || null,
        netRevenue,
        branchCommission: breakdown.breakdown.branchCommission,
        salesCommission: breakdown.breakdown.salesCommission,
        overrideCommission: breakdown.breakdown.overrideCommission,
        withholdingAmount: breakdown.breakdown.totalWithholding,
        status: 'CONFIRMED',
        saleDate: saleDate ? new Date(saleDate) : new Date(),
        confirmedAt: new Date(),
        metadata: metadata || {},
      },
    });

    // CommissionLedger 엔트리 생성
    const ledgerEntries = breakdown.ledgerEntries.map((entry) => ({
      ...entry,
      saleId: sale.id,
    }));

    if (ledgerEntries.length > 0) {
      await prisma.commissionLedger.createMany({
        data: ledgerEntries,
      });
    }

    // Lead 상태 업데이트
    if (leadId) {
      await prisma.affiliateLead.update({
        where: { id: leadId },
        data: { status: 'PURCHASED' },
      });
    }

    return NextResponse.json({
      ok: true,
      sale: {
        ...sale,
        breakdown: breakdown.breakdown,
      },
    });
  } catch (error) {
    console.error('POST /api/admin/affiliate/sales error:', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
