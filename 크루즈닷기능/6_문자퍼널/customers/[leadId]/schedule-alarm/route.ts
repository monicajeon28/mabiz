export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  PartnerApiError,
  getPartnerLead,
  requirePartnerContext,
} from '@/app/api/partner/_utils';

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

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    const params = await context.params;
    const leadId = parseLeadId(params.leadId);
    const payload = await req.json().catch(() => ({}));

    const { nextActionAt, customerName } = payload;

    if (!nextActionAt) {
      throw new PartnerApiError('다음 조치 시간이 필요합니다.', 400);
    }

    // 고객 정보 조회 및 권한 확인
    await getPartnerLead(profile.id, leadId, { interactions: 1 }, profile.type);

    const actionDate = new Date(nextActionAt);
    if (Number.isNaN(actionDate.getTime())) {
      throw new PartnerApiError('유효한 날짜 형식이 아닙니다.', 400);
    }

    // 알람 정보를 메타데이터에 저장 (실제 알람은 스케줄러에서 처리)
    await prisma.affiliateLead.update({
      where: { id: leadId },
      data: {
        metadata: {
          scheduledAlarm: {
            nextActionAt,
            customerName: customerName || '고객',
            scheduledBy: sessionUser.id,
            scheduledAt: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      message: '알람이 스케줄링되었습니다.',
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error(`POST /api/partner/customers/${(await context.params).leadId}/schedule-alarm error:`, error);
    return NextResponse.json({ ok: false, message: '알람 스케줄링에 실패했습니다.' }, { status: 500 });
  }
}
