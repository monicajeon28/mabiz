export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export async function GET() {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx?.userId) {
    return NextResponse.json({ ok: false, message: '인증이 필요합니다' }, { status: 401 });
  }

  const orgId = resolveOrgId(ctx);
  const smsConfig = await prisma.orgSmsConfig.findUnique({
    where: { organizationId: orgId },
    select: { senderPhone: true, arsNum: true, senderVerified: true },
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    senderPhone:   smsConfig?.senderPhone    ?? process.env.ALIGO_SENDER_PHONE  ?? '',
    arsNum:        smsConfig?.arsNum          ?? process.env.ALIGO_ARS_NUM       ?? '',
    senderVerified: smsConfig?.senderVerified ?? false,
    kakaoOpenChat: process.env.KAKAO_OPEN_CHAT_URL ?? '',
  });
}
