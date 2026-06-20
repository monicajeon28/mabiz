import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { normalizePhone } from '@/lib/import-utils';
import { logger } from '@/lib/logger';

interface KakaoSendRequest {
  phone?: string;
  groupId?: string;           // 그룹 선택시
  content: string;
  tplCode?: string;           // 템플릿 코드
  subject?: string;
  scheduledTime?: string;
  variables?: Record<string, string>; // 템플릿 변수 (예: {name: "철수", date: "06-20"})
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
    const { phone, groupId, content, tplCode, subject, scheduledTime, variables } = body;

    // 즉시 발송시 phone, 예약/그룹 발송시 groupId 필수
    if (!content || (!phone && !groupId)) {
      return NextResponse.json(
        { ok: false, message: '필수 필드 누락 (content, phone 또는 groupId)' },
        { status: 400 }
      );
    }

    const kakaoTplCode = tplCode || process.env.ALIGO_KAKAO_TPL_CODE || 'EXAM';
    const kakaoSubject = subject || process.env.ALIGO_KAKAO_SUBJECT || '알림';

    let normalizedPhone: string | null = null;
    if (phone) {
      normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone && !scheduledTime) {
        // 즉시 발송시만 전화번호 필수
        return NextResponse.json(
          { ok: false, message: '유효하지 않은 전화번호' },
          { status: 400 }
        );
      }
    }

    // 예약 발송인 경우 DB 저장
    if (scheduledTime) {
      try {
        const scheduledAt = new Date(scheduledTime);
        if (isNaN(scheduledAt.getTime())) {
          return NextResponse.json(
            { ok: false, message: '유효하지 않은 날짜 형식' },
            { status: 400 }
          );
        }

        await prisma.scheduledKakao.create({
          data: {
            organizationId: orgId,
            contactId: undefined,      // 개별 발송이면 phone으로, 그룹 발송이면 groupId로
            groupId: groupId || undefined,
            message: content,
            templateCode: tplCode || undefined,
            variables: variables ? JSON.stringify(variables) : undefined,
            scheduledAt,
            status: 'PENDING',
            createdByUserId: ctx.userId,
          },
        });

        logger.log('[kakao/schedule] 예약 등록 완료', {
          phone: normalizedPhone,
          groupId,
          scheduledAt,
          orgId,
          templateCode: tplCode,
        });
        const response: KakaoSendResponse = {
          ok: true,
          message: '카카오톡 발송이 예약되었습니다',
        };
        return NextResponse.json(response);
      } catch (err) {
        logger.error('[kakao/schedule]', {
          error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json(
          { ok: false, message: '예약 저장 실패' },
          { status: 500 }
        );
      }
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

    const params = new URLSearchParams();
    params.append('key', aligoKey);
    params.append('user_id', aligoUserId);
    params.append('senderkey', aligoKakaoSenderKey);
    params.append('tpl_code', kakaoTplCode);
    params.append('receiver', normalizedPhone || '');
    params.append('subject', kakaoSubject);
    params.append('message', content);
    params.append('failover', 'true');

    const res = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: params,
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
