export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/leads/[leadId]/complete-passport/route.ts
// 여권 완료 처리 API (본사 관리자만 가능)

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendNotificationToUser } from '@/lib/push/server';

function requireAdmin(role?: string | null) {
  if (role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }
  return null;
}

/**
 * POST: 여권 완료 처리
 * - 본사 관리자만 가능
 * - 여권 요청이 있었던 경우에만 완료 처리 가능
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
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
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, message: 'User not found' }, { status: 404 });
    }

    // 관리자 권한 체크
    const guard = requireAdmin(user.role);
    if (guard) return guard;

    const { leadId: leadIdStr } = await params;
    const leadId = Number(leadIdStr);
    if (isNaN(leadId)) {
      return NextResponse.json({ ok: false, message: 'Invalid lead ID' }, { status: 400 });
    }

    const body = await req.json();
    const { notes } = body;

    // Lead 조회
    const lead = await prisma.affiliateLead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        managerId: true,
        agentId: true,
        customerName: true,
        customerPhone: true,
        passportRequestedAt: true,
        passportCompletedAt: true,
        status: true,
        metadata: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, message: 'Lead not found' }, { status: 404 });
    }

    // 여권 요청이 없었던 경우
    if (!lead.passportRequestedAt) {
      return NextResponse.json({ ok: false, message: '여권 요청이 없습니다.' }, { status: 400 });
    }

    // 이미 완료된 경우
    if (lead.passportCompletedAt) {
      return NextResponse.json({ ok: false, message: '이미 여권 완료 처리되었습니다.' }, { status: 400 });
    }

    // 여권 완료 처리
    const updatedLead = await prisma.affiliateLead.update({
      where: { id: leadId },
      data: {
        passportCompletedAt: new Date(),
        metadata: {
          ...((lead.metadata as any) || {}),
          passportCompletedBy: user.id,
          passportCompletedAt: new Date().toISOString(),
          passportNotes: notes || null,
        },
      },
      include: {
        manager: {
          select: {
            id: true,
            displayName: true,
            affiliateCode: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        agent: {
          select: {
            id: true,
            displayName: true,
            affiliateCode: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // 상호작용 기록 생성
    await prisma.affiliateInteraction.create({
      data: {
        leadId: leadId,
        profileId: lead.managerId || lead.agentId || null,
        createdById: user.id,
        interactionType: 'PASSPORT_COMPLETED',
        note: notes || '여권 확인이 완료되었습니다.',
        metadata: {
          completedAt: new Date().toISOString(),
          completedBy: user.name,
        },
      },
    });

    // 대리점장/판매원에게 알림 전송
    try {
      if (updatedLead.manager?.user?.id) {
        await sendNotificationToUser(updatedLead.manager.user.id, {
          title: '여권 확인 완료',
          body: `${lead.customerName || '고객'}님의 여권 확인이 완료되었습니다.`,
          requireInteraction: false,
        });
      }
      if (updatedLead.agent?.user?.id) {
        await sendNotificationToUser(updatedLead.agent.user.id, {
          title: '여권 확인 완료',
          body: `${lead.customerName || '고객'}님의 여권 확인이 완료되었습니다.`,
          requireInteraction: false,
        });
      }
    } catch (notificationError) {
      console.error('[Passport Complete] Notification error:', notificationError);
      // 알림 실패해도 여권 완료 처리는 성공으로 처리
    }

    return NextResponse.json({
      ok: true,
      lead: updatedLead,
      message: '여권 확인이 완료되었습니다.',
    });
  } catch (error) {
    console.error('POST /api/admin/affiliate/leads/[leadId]/complete-passport error:', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
