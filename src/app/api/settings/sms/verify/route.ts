export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getOrgId } from '@/lib/org';

const ARS_TTL_MS = 5 * 60 * 1000; // ARS 만료: 5분

// POST: Aligo ARS 인증 요청 (전화로 인증번호 발송)
export async function POST(_req: NextRequest) {
  try {
    const orgId = await getOrgId();
    if (!orgId) return NextResponse.json({ ok: false }, { status: 401 });

    const config = await prisma.orgSmsConfig.findUnique({
      where:  { organizationId: orgId },
      select: { aligoKey: true, aligoUserId: true, senderPhone: true },
    });
    if (!config) return NextResponse.json({ ok: false, message: 'SMS 설정을 먼저 저장하세요.' }, { status: 400 });

    const form = new URLSearchParams({
      key:     config.aligoKey,
      user_id: config.aligoUserId,
      sender:  config.senderPhone,
    });

    const res  = await fetch('https://apis.aligo.in/ars/certify/', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    form.toString(),
    });
    const data = await res.json() as { result_code: number; message: string; ars_num?: string };

    if (Number(data.result_code) !== 1) {
      logger.warn('[SmsVerify] ARS 요청 실패', { code: data.result_code, message: data.message });
      return NextResponse.json({ ok: false, message: data.message ?? 'Aligo 인증 요청 실패' });
    }

    // ars_num DB 임시 저장 (만료 시각 인코딩: "timestamp:arsNum")
    const arsNumWithTs = `${Date.now()}:${data.ars_num ?? ''}`;
    await prisma.orgSmsConfig.update({
      where: { organizationId: orgId },
      data:  { arsNum: arsNumWithTs },
    });

    logger.log('[SmsVerify] ARS 인증 요청 성공', { orgId, phone: config.senderPhone.substring(0, 4) + '***' });
    return NextResponse.json({ ok: true, message: '인증 전화가 발송됩니다. ARS 안내에 따라 인증번호를 입력하세요.' });
  } catch (err) {
    logger.error('[SmsVerify] ARS 요청 오류', { err });
    return NextResponse.json({ ok: false, message: '인증 요청 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PUT: ARS 인증 완료 확인
export async function PUT(_req: NextRequest) {
  try {
    const orgId = await getOrgId();
    if (!orgId) return NextResponse.json({ ok: false }, { status: 401 });

    const config = await prisma.orgSmsConfig.findUnique({
      where:  { organizationId: orgId },
      select: { aligoKey: true, aligoUserId: true, arsNum: true, senderPhone: true },
    });
    if (!config?.arsNum) {
      return NextResponse.json({ ok: false, message: '인증 요청을 먼저 진행하세요.' }, { status: 400 });
    }

    // 만료 체크 (5분)
    const [tsStr, actualArsNum] = config.arsNum.split(':');
    const elapsed = Date.now() - Number(tsStr);
    if (elapsed > ARS_TTL_MS) {
      await prisma.orgSmsConfig.update({ where: { organizationId: orgId }, data: { arsNum: null } });
      return NextResponse.json({ ok: false, message: '인증 시간이 만료됐습니다. 다시 요청해 주세요.' }, { status: 400 });
    }

    const form = new URLSearchParams({
      key:     config.aligoKey,
      user_id: config.aligoUserId,
      ars_num: actualArsNum ?? '',
    });

    const res  = await fetch('https://apis.aligo.in/ars/certify_check/', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    form.toString(),
    });
    const data = await res.json() as { result_code: number; message: string };

    if (Number(data.result_code) !== 1) {
      logger.warn('[SmsVerify] ARS 확인 실패', { code: data.result_code });
      return NextResponse.json({ ok: false, message: '인증 실패. 다시 시도해 주세요.' });
    }

    // 인증 완료 저장 (arsNum 제거로 race condition 방지)
    await prisma.orgSmsConfig.updateMany({
      where: { organizationId: orgId, arsNum: { not: null } },
      data:  { senderVerified: true, verifiedAt: new Date(), arsNum: null },
    });

    logger.log('[SmsVerify] 인증 완료', { orgId, phone: config.senderPhone.substring(0, 4) + '***' });
    return NextResponse.json({ ok: true, message: '발신번호 인증이 완료됐습니다! ✅' });
  } catch (err) {
    logger.error('[SmsVerify] ARS 확인 오류', { err });
    return NextResponse.json({ ok: false, message: '인증 확인 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
