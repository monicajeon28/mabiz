export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext, PartnerApiError } from '@/app/api/partner/_utils';
import { schedulePartnerFunnelMessages } from '@/lib/funnel-scheduler';

function parseLeadId(raw: string | undefined) {
  const id = Number(raw);
  if (!raw || Number.isNaN(id) || id <= 0) {
    throw new PartnerApiError('유효한 고객 ID가 필요합니다.', 400);
  }
  return id;
}

// POST: 고객을 그룹으로 이동
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> | { leadId: string } }
) {
  try {
    const { profile, sessionUser } = await requirePartnerContext();
    if (!profile) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const leadId = parseLeadId(resolvedParams.leadId);
    const body = await req.json().catch(() => ({}));
    const { groupId } = body;

    // 고객 소유권 확인
    let lead;
    if (profile.type === 'HQ') {
      // 본사(HQ): 모든 고객 접근 가능
      lead = await prisma.affiliateLead.findFirst({
        where: { id: leadId },
      });
    } else if (profile.type === 'BRANCH_MANAGER') {
      // 대리점장: 본인 고객 + 소속 판매원 고객
      // AffiliateRelation 테이블에서 대리점장-판매원 관계 조회
      const agentRelations = await prisma.affiliateRelation.findMany({
        where: { managerId: profile.id, status: 'ACTIVE' },
        select: { agentId: true },
      });
      const agentIds = agentRelations.map((r) => r.agentId);

      lead = await prisma.affiliateLead.findFirst({
        where: {
          id: leadId,
          OR: [
            { managerId: profile.id },
            { agentId: { in: [profile.id, ...agentIds] } },
          ],
        },
      });
    } else {
      // 판매원: 본인 소유 고객만
      lead = await prisma.affiliateLead.findFirst({
        where: {
          id: leadId,
          OR: [
            { managerId: profile.id },
            { agentId: profile.id },
          ],
        },
      });
    }

    if (!lead) {
      return NextResponse.json(
        { ok: false, message: 'Lead not found or access denied.' },
        { status: 404 }
      );
    }

    const previousGroupId = lead.groupId;

    // 그룹 소유권 확인 (groupId가 null이 아닌 경우)
    // PartnerCustomerGroup 모델 사용 (AffiliateLead.groupId가 참조하는 테이블)
    let targetGroup = null;
    if (groupId !== null && groupId !== undefined) {
      if (profile.type === 'HQ') {
        // 본사(HQ): 모든 그룹 접근 가능
        targetGroup = await prisma.partnerCustomerGroup.findFirst({
          where: { id: parseInt(String(groupId)) },
        });
      } else {
        // 대리점장/판매원: 본인 소유 그룹만
        targetGroup = await prisma.partnerCustomerGroup.findFirst({
          where: {
            id: parseInt(String(groupId)),
            profileId: profile.id,
          },
        });
      }

      if (!targetGroup) {
        return NextResponse.json(
          { ok: false, message: 'Group not found or access denied.' },
          { status: 404 }
        );
      }
    }

    const newGroupId = groupId === null || groupId === undefined ? null : parseInt(String(groupId));

    // 고객 그룹 업데이트
    const updatedLead = await prisma.affiliateLead.update({
      where: { id: leadId },
      data: {
        groupId: newGroupId,
        updatedAt: new Date(),
      },
    });

    // 새 그룹으로 이동한 경우 퍼널 메시지 자동 예약 (실패해도 메인 작업에 영향 없음)
    let funnelScheduled = 0;
    let funnelError: string | undefined = undefined;
    if (newGroupId && newGroupId !== previousGroupId) {
      try {
        const result = await schedulePartnerFunnelMessages({
          leadId,
          groupId: newGroupId,
          profileId: profile.id,
          userId: sessionUser.id,
        });
        funnelScheduled = result.scheduled;
        funnelError = result.error;
      } catch (err: any) {
        console.error('[MoveGroup] Funnel scheduling failed (non-blocking):', err);
        funnelError = err?.message || 'Funnel scheduling failed';
      }
    }

    return NextResponse.json({
      ok: true,
      customer: updatedLead,
      funnelScheduled: funnelScheduled > 0,
      funnelError,
    });
  } catch (error: any) {
    console.error('[MoveGroup] POST error:', error);
    console.error('[MoveGroup] POST error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    // PartnerApiError인 경우 상태 코드 사용
    if (error?.status) {
      return NextResponse.json(
        { ok: false, message: error.message || 'Failed to move customer to group.' },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { 
        ok: false, 
        message: error?.message || 'Failed to move customer to group.',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
