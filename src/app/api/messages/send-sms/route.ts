import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { normalizePhone } from '@/lib/import-utils';
import { logger } from '@/lib/logger';

interface SmsSendRequest {
  phone: string;
  content: string;
}

interface AligoSmsResponse {
  result_code: string;
  message?: string;
  msg_id?: string;
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

    // Aligo API 호출
    const aligoKey = process.env.ALIGO_API_KEY;
    const aligoUserId = process.env.ALIGO_USER_ID;
    const aligoSender = process.env.ALIGO_SENDER_PHONE;

    if (!aligoKey || !aligoUserId || !aligoSender) {
      logger.error('[sms/send] 필수 환경변수 누락', {
        hasKey: !!aligoKey,
        hasUserId: !!aligoUserId,
        hasSender: !!aligoSender,
      });
      return NextResponse.json(
        { ok: false, message: 'SMS 서비스 설정 오류' },
        { status: 500 }
      );
    }

    const res = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: new URLSearchParams({
        key: aligoKey,
        user_id: aligoUserId,
        sender: aligoSender,
        receiver: normalizedPhone,
        msg: content,
      }),
    });

    const data: AligoSmsResponse = await res.json();

    if (data.result_code !== '1') {
      logger.error('[sms/send] Aligo 전송 실패', {
        code: data.result_code,
        message: data.message,
      });
      return NextResponse.json(
        { ok: false, message: '발송 실패' },
        { status: 500 }
      );
    }

    // 발송 이력 저장 (fire-and-forget)
    (async () => {
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
    })();

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
