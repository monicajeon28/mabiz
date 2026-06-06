export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

function parseLeadId(raw: string | number | undefined) {
  const id = Number(raw);
  if (!raw || Number.isNaN(id) || id <= 0) {
    throw new Error('유효한 고객 ID가 필요합니다.');
  }
  return id;
}

export async function POST(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const leadId = parseLeadId(payload.leadId);
    const message = payload.message || '여권 정보가 필요합니다.';

    // 고객 정보 조회
    const lead = await prisma.gmAffiliateLead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        passportRequestedAt: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, message: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 여권 요청 시간 업데이트
    await prisma.gmAffiliateLead.update({
      where: { id: leadId },
      data: {
        passportRequestedAt: new Date(),
      },
    });

    // 관리자 액션 로그 기록 (AdminActionLog는 CRM 스키마에 없으므로 raw query)
    const maskedPhone = lead.customerPhone
      ? lead.customerPhone.slice(0, 3) + '****' + lead.customerPhone.slice(-4)
      : null;

    await prisma.$executeRaw`
      INSERT INTO "AdminActionLog" ("adminId", "targetUserId", "action", "details")
      VALUES (
        ${manager.id},
        NULL,
        'affiliate.lead.passport.requested',
        ${JSON.stringify({
          leadId,
          customerName: lead.customerName,
          customerPhone: maskedPhone,
          message,
        })}::jsonb
      )
    `;

    return NextResponse.json({
      ok: true,
      message: '여권 요청이 전송되었습니다.',
    });
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    logger.error(`POST /api/passport/admin/leads-request error:`, {
      message: err.message,
      code: err.code,
    });
    return NextResponse.json(
      {
        ok: false,
        message: '여권 요청에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
