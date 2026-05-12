export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

type RouteContext = {
  params: Promise<{
    leadId: string;
  }>;
};

function parseLeadId(raw: string | undefined) {
  const id = Number(raw);
  if (!raw || Number.isNaN(id) || id <= 0) {
    throw new Error('유효한 고객 ID가 필요합니다.');
  }
  return id;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const params = await context.params;
    const leadId = parseLeadId(params.leadId);
    const payload = await req.json().catch(() => ({}));
    const message = payload.message || '여권 정보가 필요합니다.';

    // 고객 정보 조회
    const lead = await prisma.affiliateLead.findUnique({
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
    await prisma.affiliateLead.update({
      where: { id: leadId },
      data: {
        passportRequestedAt: new Date(),
      },
    });

    // 관리자 액션 로그 기록
    await prisma.adminActionLog.create({
      data: {
        adminId: user.id,
        targetUserId: null,
        action: 'affiliate.lead.passport.requested',
        details: {
          leadId,
          customerName: lead.customerName,
          customerPhone: lead.customerPhone,
          message,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      message: '여권 요청이 전송되었습니다.',
    });
  } catch (error) {
    const params = await context.params;
    console.error(`POST /api/admin/affiliate/leads/${params.leadId}/request-passport error:`, error);
    return NextResponse.json(
      { 
        ok: false, 
        message: error instanceof Error ? error.message : '여권 요청에 실패했습니다.' 
      }, 
      { status: 500 }
    );
  }
}
