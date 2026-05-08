export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/interactions/route.ts
// Admin 상담기록(Interaction) 생성 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * POST: 상담기록 생성
 * - Admin, 대리점장, 판매원 모두 사용 가능
 * - leadId 필수
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { leadId, interactionType, occurredAt, note } = body;

    // leadId 필수
    if (!leadId || isNaN(Number(leadId))) {
      return NextResponse.json({ ok: false, message: 'Invalid lead ID' }, { status: 400 });
    }

    const leadIdNum = Number(leadId);

    // Lead 존재 확인 및 권한 체크
    const lead = await prisma.affiliateLead.findUnique({
      where: { id: leadIdNum },
      select: {
        id: true,
        managerId: true,
        agentId: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, message: 'Lead not found' }, { status: 404 });
    }

    // 권한 체크
    if (user.role === 'admin') {
      // 관리자: 모든 Lead에 대해 기록 생성 가능
    } else if (user.AffiliateProfile?.type === 'BRANCH_MANAGER') {
      // 대리점장: 본인 및 본인 판매원 Lead만
      const profileId = user.AffiliateProfile.id;
      if (lead.managerId !== profileId && lead.agentId !== profileId) {
        if (lead.agentId) {
          const relation = await prisma.affiliateRelation.findFirst({
            where: {
              managerId: profileId,
              agentId: lead.agentId,
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
      // 판매원: 본인 Lead만
      if (lead.agentId !== user.AffiliateProfile.id) {
        return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ ok: false, message: 'Access denied' }, { status: 403 });
    }

    // 상담기록 생성
    const interaction = await prisma.affiliateInteraction.create({
      data: {
        leadId: leadIdNum,
        profileId: user.AffiliateProfile?.id || null,
        createdById: user.id,
        interactionType: interactionType || 'NOTE',
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
        note: note || null,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // lastContactedAt 업데이트
    await prisma.affiliateLead.update({
      where: { id: leadIdNum },
      data: {
        lastContactedAt: interaction.occurredAt,
      },
    });

    return NextResponse.json({
      ok: true,
      interaction: {
        id: interaction.id,
        interactionType: interaction.interactionType,
        occurredAt: interaction.occurredAt.toISOString(),
        note: interaction.note,
        createdBy: interaction.User ? {
          id: interaction.User.id,
          name: interaction.User.name,
          email: interaction.User.email,
        } : null,
      },
    });
  } catch (error: any) {
    console.error('POST /api/admin/affiliate/interactions error:', error);
    return NextResponse.json({
      ok: false,
      message: '상담 기록 생성에 실패했습니다.',
      error: error?.message || String(error),
    }, { status: 500 });
  }
}
