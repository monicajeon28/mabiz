import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { normalizePhone } from '@/lib/import-utils';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const { phone, content } = await req.json();

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
    const res = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: new URLSearchParams({
        key: process.env.ALIGO_API_KEY!,
        user_id: process.env.ALIGO_USER_ID!,
        sender: process.env.ALIGO_SENDER_PHONE!,
        receiver: normalizedPhone,
        msg: content,
      }),
    });

    const data = await res.json();

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
    return NextResponse.json({ ok: true, messageId: data.msg_id });
  } catch (err) {
    logger.error('[sms/send]', { err });
    return NextResponse.json(
      { ok: false, message: '서버 오류' },
      { status: 500 }
    );
  }
}
