export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/leads/[leadId]/status/route.ts
// 고객 상태 변경 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * PUT: 고객 상태 변경
 * - 구매상태, 환불, 소통중, 크루즈닷AI체험중 등 상태 관리
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { leadId: leadIdStr } = await params;
    const leadId = Number(leadIdStr);
    if (isNaN(leadId)) {
      return NextResponse.json({ ok: false, message: 'Invalid lead ID' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        role: true,
        AffiliateProfile: {
          select: {
            id: true,
            type: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, message: 'User not found' }, { status: 404 });
    }

    // 기존 Lead 조회
    const existingLead = await prisma.affiliateLead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        managerId: true,
        agentId: true,
        status: true,
        customerName: true,
      },
    });

    if (!existingLead) {
      return NextResponse.json({ ok: false, message: 'Lead not found' }, { status: 404 });
    }

    // 권한 체크
    if (user.role === 'admin') {
      // 관리자: 모든 Lead 상태 변경 가능
    } else if (user.AffiliateProfile?.type === 'BRANCH_MANAGER') {
      // 대리점장: 본인 및 본인 판매원 Lead 상태 변경 가능
      const profileId = user.AffiliateProfile.id;
      if (existingLead.managerId !== profileId && existingLead.agentId !== profileId) {
        if (existingLead.agentId) {
          const relation = await prisma.affiliateRelation.findFirst({
            where: {
              managerId: profileId,
              agentId: existingLead.agentId,
              status: 'ACTIVE',
            },
          });
          if (!relation) {
            return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
          }
        } else {
          return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
        }
      }
    } else if (user.AffiliateProfile?.type === 'SALES_AGENT') {
      // 판매원: 본인 Lead 상태 변경 가능
      if (existingLead.agentId !== user.AffiliateProfile.id) {
        return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { status, notes } = body;

    // 상태 검증 (AffiliateLeadStatus enum 기준)
    const validStatuses = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'PURCHASED', 'REFUNDED', 'CLOSED', 'TEST_GUIDE'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ ok: false, message: `유효하지 않은 상태입니다: ${status}` }, { status: 400 });
    }

    // 상태별 메타데이터 업데이트
    const updateData: any = {};
    if (status) {
      updateData.status = status;
    }
    if (notes !== undefined) {
      updateData.notes = notes || null;
    }

    // 상태별 특수 처리
    const metadata: any = {
      ...((existingLead as any).metadata || {}),
      statusHistory: [
        ...(((existingLead as any).metadata?.statusHistory || []) || []),
        {
          from: existingLead.status,
          to: status || existingLead.status,
          changedAt: new Date().toISOString(),
          changedBy: user.id,
        },
      ],
    };

    // 특수 상태 처리
    if (status === 'PURCHASED') {
      metadata.purchasedAt = new Date().toISOString();
      metadata.purchasedBy = user.id;
    } else if (status === 'REFUNDED') {
      metadata.refundedAt = new Date().toISOString();
      metadata.refundedBy = user.id;
      // 환불 시 본사에 알림 (TODO)
    } else if (status === 'CONTACTED') {
      updateData.lastContactedAt = new Date();
    }

    updateData.metadata = metadata;

    // Lead 상태 변경
    const updatedLead = await prisma.affiliateLead.update({
      where: { id: leadId },
      data: updateData,
      include: {
        manager: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
          },
        },
        agent: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
          },
        },
      },
    });

    // 상호작용 기록 생성
    await prisma.affiliateInteraction.create({
      data: {
        leadId: leadId,
        profileId: user.AffiliateProfile?.id || null,
        createdById: user.id,
        interactionType: 'STATUS_CHANGED',
        note: `상태 변경: ${existingLead.status} → ${status || existingLead.status}${notes ? ` (${notes})` : ''}`,
        metadata: {
          fromStatus: existingLead.status,
          toStatus: status || existingLead.status,
          changedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      ok: true,
      lead: updatedLead,
      message: '고객 상태가 변경되었습니다.',
    });
  } catch (error) {
    console.error('PUT /api/admin/affiliate/leads/[leadId]/status error:', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
