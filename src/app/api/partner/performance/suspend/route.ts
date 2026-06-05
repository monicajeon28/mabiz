export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

// POST /api/partner/performance/suspend
// 환불율 기준 초과 판매원 정지 처리 (OWNER/ADMIN 전용)
export async function POST(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });

    const isAdmin = ctx.sessionUser.role === 'admin';
    const isOwner = ctx.sessionUser.role === 'owner';
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다' }, { status: 403 });
    }

    const body = await req.json() as {
      memberId:        string;
      organizationId:  string;
      memberName:      string;
      memberRole:      string;
      refundRate:      number;
      score:           number;
    };

    if (!body.memberId || !body.organizationId) {
      return NextResponse.json({ ok: false, error: '필수 정보 누락' }, { status: 400 });
    }

    // OWNER는 자기 조직만 처리 가능
    if (isOwner && (!ctx.organizationId || body.organizationId !== ctx.organizationId)) {
      return NextResponse.json({ ok: false, error: '해당 조직에 대한 권한이 없습니다' }, { status: 403 });
    }

    // 이미 정지 중인지 확인
    const existing = await prisma.partnerSuspension.findFirst({
      where: {
        organizationId:  body.organizationId,
        partnerId:       body.memberId,
        suspensionStatus: { in: ['SUSPENDED', 'APPEALING'] },
      },
      select: { id: true, suspensionStatus: true },
    });

    if (existing) {
      return NextResponse.json({
        ok:      true,
        result:  'already_suspended',
        message: '이미 정지 처리된 판매원입니다.',
      });
    }

    await prisma.partnerSuspension.create({
      data: {
        organizationId:     body.organizationId,
        partnerId:          body.memberId,
        partnerName:        body.memberName,
        partnerRole:        body.memberRole,
        suspensionStatus:   'SUSPENDED',
        suspensionReason:   'HIGH_REFUND',
        reasonDetails:      {
          trigger:         'REFUND_RATE_EXCEEDED',
          refundRate:      body.refundRate,
          score:           body.score,
          threshold:       20,
          displayMessage:  `환불율 기준 초과 정지: ${body.refundRate}% (기준 20%)`,
          triggeredBy:     isAdmin ? 'admin' : 'owner',
          triggeredAt:     new Date().toISOString(),
        },
        suspendedAt:        new Date(),
        suspendedByAdminId: ctx.sessionUser.crmUserId,
      },
    });

    logger.log('[performance/suspend] 판매원 정지 처리', {
      memberId:  body.memberId,
      orgId:     body.organizationId,
      refundRate: body.refundRate,
      by:        isAdmin ? 'admin' : 'owner',
    });

    return NextResponse.json({ ok: true, result: 'suspended', message: '정지 처리가 완료되었습니다.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[performance/suspend] 오류', { message });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
