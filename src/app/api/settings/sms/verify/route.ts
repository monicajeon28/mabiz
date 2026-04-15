export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getOrgId } from '@/lib/org';

// POST: Aligo 콘솔에서 직접 ARS 인증 안내 (API 대신 수동 확인 방식)
export async function POST(_req: NextRequest) {
  try {
    const orgId = await getOrgId();

    const config = await prisma.orgSmsConfig.findUnique({
      where:  { organizationId: orgId },
      select: { senderPhone: true },
    });
    if (!config) return NextResponse.json({ ok: false, message: 'SMS 설정을 먼저 저장하세요.' }, { status: 400 });

    logger.log('[SmsVerify] Aligo 콘솔 인증 안내', { orgId, phone: config.senderPhone.substring(0, 4) + '***' });

    // Aligo ARS API는 비공개 계약 서비스 → 콘솔 직접 인증으로 대체
    return NextResponse.json({
      ok: true,
      message: 'Aligo 콘솔(https://smartsms.aligo.in)에서 발신번호 ARS 인증을 완료한 후 아래 버튼을 눌러주세요.',
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    logger.error('[SmsVerify] POST 오류', { err });
    return NextResponse.json({ ok: false, message: '오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT: 인증 완료 확인 — Aligo 콘솔에서 직접 인증 완료 후 호출
export async function PUT(_req: NextRequest) {
  try {
    const orgId = await getOrgId();

    const config = await prisma.orgSmsConfig.findUnique({
      where:  { organizationId: orgId },
      select: { senderPhone: true },
    });
    if (!config) return NextResponse.json({ ok: false, message: 'SMS 설정을 먼저 저장하세요.' }, { status: 400 });

    await prisma.orgSmsConfig.update({
      where: { organizationId: orgId },
      data:  { senderVerified: true, verifiedAt: new Date(), arsNum: null },
    });

    logger.log('[SmsVerify] 인증 완료', { orgId, phone: config.senderPhone.substring(0, 4) + '***' });
    return NextResponse.json({ ok: true, message: '발신번호 인증이 완료됐습니다!' });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    logger.error('[SmsVerify] PUT 오류', { err });
    return NextResponse.json({ ok: false, message: '인증 확인 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
