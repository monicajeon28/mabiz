export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  PartnerApiError,
  ensureValidLeadStatus,
  getPartnerLead,
  normalizePhoneInput,
  requirePartnerContext,
  resolveCounterpart,
  resolveOwnership,
  serializeLead,
} from '@/app/api/partner/_utils';
import { toNullableString } from '@/app/api/admin/affiliate/profiles/shared';

type RouteContext = {
  params: Promise<{
    leadId: string;
  }>;
};

function parseLeadId(raw: string | undefined) {
  const id = Number(raw);
  if (!raw || Number.isNaN(id) || id <= 0) {
    throw new PartnerApiError('유효한 고객 ID가 필요합니다.', 400);
  }
  return id;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const resolvedParams = await Promise.resolve(context.params);
  const leadIdParam = resolvedParams.leadId;
  try {
    const { profile } = await requirePartnerContext({ includeManagedAgents: true });
    const leadId = parseLeadId(leadIdParam);

    const lead = await getPartnerLead(profile.id, leadId, { interactions: 50, sales: 50 }, profile.type);

    const saleSummary = await prisma.affiliateSale.aggregate({
      where: { leadId },
      _count: { _all: true },
      _sum: { saleAmount: true, netRevenue: true },
    });

    const confirmedSummary = await prisma.affiliateSale.aggregate({
      where: {
        leadId,
        status: { in: ['CONFIRMED', 'PAID', 'PAYOUT_SCHEDULED'] },
      },
      _count: { _all: true },
      _sum: { saleAmount: true },
    });

    const latestSale = await prisma.affiliateSale.findFirst({
      where: { leadId },
      orderBy: [{ saleDate: 'desc' }, { createdAt: 'desc' }],
      select: { saleDate: true, status: true },
    });

    return NextResponse.json({
      ok: true,
      customer: serializeLead(lead, {
        ownership: resolveOwnership(profile.id, lead),
        counterpart: resolveCounterpart(profile.type, lead),
        saleSummary: {
          totalSalesCount: saleSummary._count?._all ?? 0,
          totalSalesAmount: saleSummary._sum?.saleAmount ?? 0,
          totalNetRevenue: saleSummary._sum?.netRevenue ?? 0,
          confirmedSalesCount: confirmedSummary._count?._all ?? 0,
          confirmedSalesAmount: confirmedSummary._sum?.saleAmount ?? 0,
          lastSaleAt: latestSale?.saleDate?.toISOString() ?? null,
          lastSaleStatus: latestSale?.status ?? null,
        },
        userId: await (async () => {
          if (lead.customerPhone) {
            const user = await prisma.user.findFirst({
              where: { phone: lead.customerPhone },
              select: { id: true },
            });
            return user?.id || null;
          }
          return null;
        })(),
      }),
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error(`GET /api/partner/customers/${leadIdParam} error:`, error);
    return NextResponse.json({ ok: false, message: '고객 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const resolvedParams = await Promise.resolve(context.params);
  const leadIdParam = resolvedParams.leadId;
  try {
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    const leadId = parseLeadId(leadIdParam);
    const payload = await req.json().catch(() => ({}));

    await getPartnerLead(profile.id, leadId, { interactions: 1, sales: 1 }, profile.type);

    const data: Prisma.AffiliateLeadUpdateInput = {};

    if (Object.prototype.hasOwnProperty.call(payload, 'customerName')) {
      data.customerName = toNullableString(payload.customerName);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'customerPhone')) {
      data.customerPhone = normalizePhoneInput(toNullableString(payload.customerPhone));
    }

    const status = ensureValidLeadStatus(payload.status);
    if (status) {
      data.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
      data.notes = toNullableString(payload.notes);
    }

    if (payload.nextActionAt) {
      const parsed = new Date(payload.nextActionAt);
      if (!Number.isNaN(parsed.getTime())) {
        data.nextActionAt = parsed;
      }
    } else if (payload.nextActionAt === null) {
      data.nextActionAt = null;
    }

    if (payload.lastContactedAt) {
      const parsed = new Date(payload.lastContactedAt);
      if (!Number.isNaN(parsed.getTime())) {
        data.lastContactedAt = parsed;
      }
    }

    if (payload.metadata && typeof payload.metadata === 'object') {
      data.metadata = payload.metadata;
    }

    if (profile.type === 'BRANCH_MANAGER' && Object.prototype.hasOwnProperty.call(payload, 'agentProfileId')) {
      if (payload.agentProfileId === null || payload.agentProfileId === '') {
        (data as any).agentId = null;
      } else {
        const agentProfileId = Number(payload.agentProfileId);
        if (Number.isNaN(agentProfileId) || agentProfileId <= 0) {
          throw new PartnerApiError('유효한 판매원 ID가 아닙니다.', 400);
        }
        // managedRelations는 requirePartnerContext에서 매핑됨
        const managesAgent =
          (profile as any).managedRelations?.some((relation: any) => relation.agent?.id === agentProfileId) ?? false;
        if (!managesAgent) {
          throw new PartnerApiError('선택한 판매원은 대리점장의 관리 대상이 아닙니다.', 400);
        }
        (data as any).agentId = agentProfileId;
      }
    }

    if (Object.keys(data).length === 0) {
      const lead = await getPartnerLead(profile.id, leadId, { interactions: 50, sales: 50 }, profile.type);
      return NextResponse.json({
        ok: true,
        customer: serializeLead(lead, {
          ownership: resolveOwnership(profile.id, lead),
          counterpart: resolveCounterpart(profile.type, lead),
        }),
        message: '변경된 내용이 없습니다.',
      });
    }

    await prisma.affiliateLead.update({
      where: { id: leadId },
      data,
    });

    await prisma.adminActionLog.create({
      data: {
        adminId: sessionUser.id,
        targetUserId: null,
        action: 'affiliate.lead.updated',
        details: {
          leadId,
          profileId: profile.id,
          changes: data,
        },
      },
    });

    const updatedLead = await getPartnerLead(profile.id, leadId, { interactions: 50, sales: 50 }, profile.type);

    return NextResponse.json({
      ok: true,
      customer: serializeLead(updatedLead, {
        ownership: resolveOwnership(profile.id, updatedLead),
        counterpart: resolveCounterpart(profile.type, updatedLead),
      }),
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error(`PATCH /api/partner/customers/${leadIdParam} error:`, error);
    return NextResponse.json({ ok: false, message: '고객 정보를 수정하지 못했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const resolvedParams = await Promise.resolve(context.params);
  const leadIdParam = resolvedParams.leadId;
  try {
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    const leadId = parseLeadId(leadIdParam);

    // 계약 해지 여부 확인 - 해지된 경우 DB 삭제 불가
    if (profile.userId) {
      const contract = await prisma.affiliateContract.findFirst({
        where: {
          userId: profile.userId,
          status: 'terminated',
        },
        select: {
          id: true,
          metadata: true,
        },
      });

      if (contract) {
        const metadata = contract.metadata as any;
        const terminatedAt = metadata?.terminatedAt ? new Date(metadata.terminatedAt) : null;

        if (terminatedAt) {
          throw new PartnerApiError(
            '계약이 해지되어 고객 DB 삭제가 불가능합니다. 모든 고객 정보는 본사로 회수됩니다.',
            403
          );
        }
      }
    }

    // 고객 정보 조회 및 권한 확인
    const lead = await getPartnerLead(profile.id, leadId, { interactions: 1, sales: 1 }, profile.type);

    // 본인이 관리하는 고객인지 확인
    if (profile.type === 'BRANCH_MANAGER') {
      if (lead.managerId !== profile.id) {
        throw new PartnerApiError('본인이 관리하는 고객만 삭제할 수 있습니다.', 403);
      }
    } else if (profile.type === 'SALES_AGENT') {
      if (lead.agentId !== profile.id) {
        throw new PartnerApiError('본인이 관리하는 고객만 삭제할 수 있습니다.', 403);
      }
    }

    // 고객 삭제 (관련 데이터도 함께 삭제됨 - Cascade)
    await prisma.affiliateLead.delete({
      where: { id: leadId },
    });

    // 삭제 로그 기록
    await prisma.adminActionLog.create({
      data: {
        adminId: sessionUser.id,
        targetUserId: null,
        action: 'affiliate.lead.deleted',
        details: {
          leadId,
          profileId: profile.id,
          customerName: lead.customerName,
          customerPhone: lead.customerPhone,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      message: '고객이 삭제되었습니다.',
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error(`DELETE /api/partner/customers/${leadIdParam} error:`, error);
    return NextResponse.json({ ok: false, message: '고객을 삭제하지 못했습니다.' }, { status: 500 });
  }
}
