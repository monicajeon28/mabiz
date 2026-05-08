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

    // Aligo 카카오 알림톡 API 호출
    const res = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: new URLSearchParams({
        key: process.env.ALIGO_API_KEY!,
        user_id: process.env.ALIGO_USER_ID!,
        senderkey: process.env.ALIGO_KAKAO_SENDER_KEY!,
        tpl_code: 'EXAM', // 템플릿 코드 (테스트용)
        receiver: normalizedPhone,
        subject: '제목',
        message: content,
        failover: 'true', // SMS 폴백
      }),
    });

    const data = await res.json();

    if (data.result_code !== '1') {
      logger.error('[kakao/send] Aligo 카카오 전송 실패', {
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
            messageType: 'kakao',
            content,
            totalSent: 1,
            successCount: 1,
          },
        });
      } catch (err) {
        logger.error('[kakao/send] 이력 저장 실패', { err });
      }
    })();

    logger.log('[kakao/send] 완료', { phone: normalizedPhone, orgId });
    return NextResponse.json({ ok: true, messageId: data.msg_id });
  } catch (err) {
    logger.error('[kakao/send]', { err });
    return NextResponse.json(
      { ok: false, message: '서버 오류' },
      { status: 500 }
    );
  }
}
