export const dynamic = 'force-dynamic';

// 여권 완료 처리 API (CRM 관리자/지사장만 가능)

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

/**
 * POST: 여권 완료 처리
 * - CRM 관리자(GLOBAL_ADMIN) 또는 지사장(OWNER)만 가능
 * - 여권 요청이 있었던 경우에만 완료 처리 가능
 *
 * Body: { leadId: number, notes?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다. 다시 로그인해 주세요.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { leadId: leadIdInput, notes } = body;

    const leadId = Number(leadIdInput);
    if (isNaN(leadId)) {
      return NextResponse.json(
        { ok: false, message: 'Invalid lead ID' },
        { status: 400 }
      );
    }

    // Lead 조회
    const lead = await prisma.gmAffiliateLead.findUnique({
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
      return NextResponse.json(
        { ok: false, message: 'Lead not found' },
        { status: 404 }
      );
    }

    // 여권 요청이 없었던 경우
    if (!lead.passportRequestedAt) {
      return NextResponse.json(
        { ok: false, message: '여권 요청이 없습니다.' },
        { status: 400 }
      );
    }

    // 이미 완료된 경우
    if (lead.passportCompletedAt) {
      return NextResponse.json(
        { ok: false, message: '이미 여권 완료 처리되었습니다.' },
        { status: 400 }
      );
    }

    // 여권 완료 처리
    const updatedLead = await prisma.gmAffiliateLead.update({
      where: { id: leadId },
      data: {
        passportCompletedAt: new Date(),
        metadata: {
          ...((lead.metadata as Record<string, unknown>) || {}),
          passportCompletedBy: manager.id,
          passportCompletedAt: new Date().toISOString(),
          passportNotes: notes || null,
        },
      },
    });

    // 매니저/에이전트 정보 조회 (알림용)
    let managerUser: { id: number; name: string | null } | null = null;
    let agentUser: { id: number; name: string | null } | null = null;

    if (lead.managerId) {
      const profile = await prisma.$queryRaw<Array<{ userId: number }>>`
        SELECT "userId" FROM "AffiliateProfile" WHERE id = ${lead.managerId} LIMIT 1
      `;
      if (profile[0]) {
        managerUser = await prisma.gmUser.findUnique({
          where: { id: profile[0].userId },
          select: { id: true, name: true },
        });
      }
    }

    if (lead.agentId) {
      const profile = await prisma.$queryRaw<Array<{ userId: number }>>`
        SELECT "userId" FROM "AffiliateProfile" WHERE id = ${lead.agentId} LIMIT 1
      `;
      if (profile[0]) {
        agentUser = await prisma.gmUser.findUnique({
          where: { id: profile[0].userId },
          select: { id: true, name: true },
        });
      }
    }

    // TODO: 푸시 알림 — sendNotificationToUser가 CRM에 이식되면 활성화
    // if (managerUser) {
    //   await sendNotificationToUser(managerUser.id, {
    //     title: '여권 확인 완료',
    //     body: `${lead.customerName || '고객'}님의 여권 확인이 완료되었습니다.`,
    //   });
    // }

    logger.log('[Passport Complete] 여권 완료 처리:', {
      leadId,
      completedBy: manager.id,
      managerUserId: managerUser?.id,
      agentUserId: agentUser?.id,
    });

    return NextResponse.json({
      ok: true,
      lead: updatedLead,
      message: '여권 확인이 완료되었습니다.',
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('POST /api/passport/admin/leads-complete error:', {
      message: err.message,
      code: err.code,
    });
    return NextResponse.json(
      { ok: false, message: 'Server error' },
      { status: 500 }
    );
  }
}
