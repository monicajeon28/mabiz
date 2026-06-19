import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { normalizePhone } from '@/lib/import-utils';
import { logger } from '@/lib/logger';

interface KakaoSendRequest {
  phone: string;
  content: string;
  tplCode?: string;
  subject?: string;
}

interface AligoKakaoResponse {
  result_code: string;
  message?: string;
  msg_id?: string;
}

interface KakaoSendResponse {
  ok: boolean;
  message: string;
  msgId?: string;
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const body: KakaoSendRequest = await req.json();
    const { phone, content, tplCode, subject } = body;

    if (!phone || !content) {
      return NextResponse.json(
        { ok: false, message: '필수 필드 누락' },
        { status: 400 }
      );
    }

    const kakaoTplCode = tplCode || process.env.ALIGO_KAKAO_TPL_CODE || 'EXAM';
    const kakaoSubject = subject || process.env.ALIGO_KAKAO_SUBJECT || '알림';

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 전화번호' },
        { status: 400 }
      );
    }

    // Aligo 카카오 알림톡 API 호출
    const aligoKey = process.env.ALIGO_API_KEY;
    const aligoUserId = process.env.ALIGO_USER_ID;
    const aligoKakaoSenderKey = process.env.ALIGO_KAKAO_SENDER_KEY;

    if (!aligoKey || !aligoUserId || !aligoKakaoSenderKey) {
      logger.error('[kakao/send] 필수 환경변수 누락', {
        hasKey: !!aligoKey,
        hasUserId: !!aligoUserId,
        hasSenderKey: !!aligoKakaoSenderKey,
      });
      return NextResponse.json(
        { ok: false, message: '카카오톡 서비스 설정 오류' },
        { status: 500 }
      );
    }

    const res = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: new URLSearchParams({
        key: aligoKey,
        user_id: aligoUserId,
        senderkey: aligoKakaoSenderKey,
        tpl_code: kakaoTplCode,
        receiver: normalizedPhone,
        subject: kakaoSubject,
        message: content,
        failover: 'true', // SMS 폴백
      }),
    });

    const data: AligoKakaoResponse = await res.json();

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
    void (async () => {
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
        logger.error('[send-kakao] 히스토리 저장 실패', { error: err instanceof Error ? err.message : String(err) });
      }
    })();

    logger.log('[kakao/send] 완료', { phone: normalizedPhone, orgId });
    const response: KakaoSendResponse = {
      ok: true,
      message: '발송 완료',
      msgId: data.msg_id
    };
    return NextResponse.json(response);
  } catch (err) {
    logger.error('[kakao/send]', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    return NextResponse.json(
      { ok: false, message: '서버 오류' },
      { status: 500 }
    );
  }
}
