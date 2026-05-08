export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  PartnerApiError,
  getPartnerLead,
  requirePartnerContext,
} from '@/app/api/partner/_utils';

type RouteContext = {
  params: {
    leadId: string;
    saleId: string;
  };
};

function parseId(raw: string | undefined, name: string) {
  const id = Number(raw);
  if (!raw || Number.isNaN(id) || id <= 0) {
    throw new PartnerApiError(`유효한 ${name} ID가 필요합니다.`, 400);
  }
  return id;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    const leadId = parseId(context.params.leadId, '고객');
    const saleId = parseId(context.params.saleId, '매출');

    // 고객 정보 조회 및 권한 확인
    await getPartnerLead(profile.id, leadId, { interactions: 1, sales: 1 }, profile.type);

    // 매출 정보 조회
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      include: {
        product: true,
      },
    });

    if (!sale) {
      throw new PartnerApiError('매출 정보를 찾을 수 없습니다.', 404);
    }

    // 권한 확인: 본인이 관리하는 고객의 매출인지 확인
    if (profile.type === 'BRANCH_MANAGER') {
      if (sale.managerId !== profile.id) {
        throw new PartnerApiError('본인이 관리하는 고객의 매출만 확정할 수 있습니다.', 403);
      }
    } else if (profile.type === 'SALES_AGENT') {
      if (sale.agentId !== profile.id) {
        throw new PartnerApiError('본인이 관리하는 고객의 매출만 확정할 수 있습니다.', 403);
      }
    }

    // 이미 확정된 매출인지 확인
    if (sale.status === 'CONFIRMED' || sale.status === 'PAID' || sale.status === 'PAYOUT_SCHEDULED') {
      throw new PartnerApiError('이미 확정된 매출입니다.', 400);
    }

    // 매출 확정 처리
    const updatedSale = await prisma.affiliateSale.update({
      where: { id: saleId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    // 로그 기록
    await prisma.adminActionLog.create({
      data: {
        adminId: sessionUser.id,
        targetUserId: null,
        action: 'affiliate.sale.confirmed',
        details: {
          saleId,
          leadId,
          profileId: profile.id,
          saleAmount: sale.saleAmount,
          netRevenue: sale.netRevenue,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      sale: updatedSale,
      message: '매출이 확정되었습니다. 수당 책정이 가능합니다.',
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error(`POST /api/partner/customers/${context.params.leadId}/sales/${context.params.saleId}/confirm error:`, error);
    return NextResponse.json({ ok: false, message: '매출 확정에 실패했습니다.' }, { status: 500 });
  }
}
