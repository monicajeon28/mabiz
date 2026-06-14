import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { normalizePhone } from '@/lib/import-utils';
import { logger } from '@/lib/logger';
import { resolveUserSmsConfig, sendSms } from '@/lib/aligo';

interface SmsSendRequest {
  phone: string;
  content: string;
}

interface SmsSendResponse {
  ok: boolean;
  message: string;
  msgId?: string;
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const body: SmsSendRequest = await req.json();
    const { phone, content } = body;

    if (!phone || !content) {
      return NextResponse.json(
        { ok: false, message: '필수 필드 누락' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 전화번호' },
        { status: 400 }
      );
    }

    // 수신 거부 여부 확인 (조직 연락처 기준)
    const contactRecord = await prisma.contact.findFirst({
      where: { phone: normalizedPhone, organizationId: orgId },
      select: { id: true, optOutAt: true },
    });
    if (contactRecord?.optOutAt) {
      logger.warn('[sms/send] 수신 거부 연락처', { phone: normalizedPhone, orgId });
      return NextResponse.json(
        { ok: false, message: '수신 거부 등록된 연락처입니다' },
        { status: 400 }
      );
    }

    // 발신 계정 해석: 개인(UserSmsConfig) > 조직(OrgSmsConfig) > 시스템 env.
    // 판매원·대리점장이 자기 알리고를 연결하면 본인 발신번호로 나간다.
    const config = await resolveUserSmsConfig(orgId, ctx.userId);
    if (!config) {
      logger.error('[sms/send] 알리고 설정 없음', { orgId, userId: ctx.userId });
      return NextResponse.json(
        { ok: false, message: 'SMS 발신 계정이 설정되지 않았습니다. 설정 > 문자에서 알리고를 연결해 주세요.' },
        { status: 500 }
      );
    }

    // sendSms가 수신거부·야간차단·SmsLog 기록·타임아웃까지 처리
    const data = await sendSms({
      config,
      receiver: normalizedPhone,
      msg: content,
      organizationId: orgId,
      contactId: contactRecord?.id,
      channel: 'MANUAL',
    });

    const code = Number(data.result_code);
    if (code === -99) {
      return NextResponse.json({ ok: false, message: '수신 거부 등록된 연락처입니다' }, { status: 400 });
    }
    if (code === -98) {
      return NextResponse.json({ ok: false, message: '야간(21~08시)에는 문자를 발송할 수 없습니다' }, { status: 400 });
    }
    if (code !== 1) {
      logger.error('[sms/send] Aligo 전송 실패', { code: data.result_code, message: data.message });
      return NextResponse.json(
        { ok: false, message: '발송 실패' },
        { status: 500 }
      );
    }

    // 발송 이력 저장 (fire-and-forget) — async IIFE 제거, await 추가
    try {
      await prisma.adminMessage.create({
        data: {
          organizationId: orgId,
          adminId: ctx.userId,
          messageType: 'sms',
          channel: 'MANUAL',
          content,
          totalSent: 1,
          successCount: 1,
        },
      });
    } catch (err) {
      logger.error('[sms/send] 이력 저장 실패', { err });
    }

    logger.log('[sms/send] 완료', { phone: normalizedPhone, orgId });
    const response: SmsSendResponse = {
      ok: true,
      message: '발송 완료',
      msgId: data.msg_id
    };
    return NextResponse.json(response);
  } catch (err) {
    logger.error('[sms/send]', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    return NextResponse.json(
      { ok: false, message: '서버 오류' },
      { status: 500 }
    );
  }
}
