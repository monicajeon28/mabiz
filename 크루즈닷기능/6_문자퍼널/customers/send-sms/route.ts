export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  PartnerApiError,
  getPartnerLead,
  requirePartnerContext,
} from '@/app/api/partner/_utils';

export async function POST(req: NextRequest) {
  try {
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    const payload = await req.json().catch(() => ({}));

    const { leadId, phone, message, aligoApiKey, aligoUserId, aligoSenderPhone } = payload;

    if (!phone || !message) {
      throw new PartnerApiError('전화번호와 메시지가 필요합니다.', 400);
    }

    // 알리고 API 설정 결정: 클라이언트에서 전달한 설정 우선, 없으면 DB에서 가져오기
    let finalAligoApiKey: string;
    let finalAligoUserId: string;
    let finalAligoSenderPhone: string;
    let provider: string = 'aligo';

    if (aligoApiKey && aligoUserId && aligoSenderPhone) {
      // 클라이언트에서 직접 입력한 설정 사용
      finalAligoApiKey = aligoApiKey;
      finalAligoUserId = aligoUserId;
      finalAligoSenderPhone = aligoSenderPhone;
    } else {
      // DB에서 SMS API 설정 가져오기
      const isManager = profile.type === 'BRANCH_MANAGER';
      let smsConfig;
      if (isManager) {
        smsConfig = await prisma.partnerSmsConfig.findUnique({
          where: { profileId: profile.id },
        });
      } else {
        smsConfig = await prisma.affiliateSmsConfig.findUnique({
          where: { profileId: profile.id },
        });
      }

      if (!smsConfig || !smsConfig.isActive) {
        throw new PartnerApiError('SMS API 설정이 필요하거나 비활성화되어 있습니다. 설정 페이지에서 SMS API를 설정하거나 문자 보내기 모달에서 직접 입력해주세요.', 400);
      }

      finalAligoApiKey = smsConfig.apiKey;
      finalAligoUserId = smsConfig.userId;
      finalAligoSenderPhone = smsConfig.senderPhone;
      provider = smsConfig.provider || 'aligo';
    }

    // leadId가 있으면 고객 정보 조회 및 권한 확인
    if (leadId) {
      await getPartnerLead(profile.id, leadId, { interactions: 1 }, profile.type);
    }

    // SMS API로 발송 (제공자에 따라 분기)
    let response: Response;
    let result: any;
    let msgType: 'SMS' | 'LMS' = 'SMS'; // 기본값 설정

    if (provider === 'aligo') {
      // 알리고 API
      const ALIGO_BASE_URL = 'https://apis.aligo.in';
      const messageByteLength = new Blob([message]).size;
      msgType = messageByteLength > 90 ? 'LMS' : 'SMS';

      const formData = new URLSearchParams();
      formData.append('key', finalAligoApiKey);
      formData.append('user_id', finalAligoUserId);
      formData.append('sender', finalAligoSenderPhone);
      formData.append('receiver', phone.replace(/[^0-9]/g, ''));
      formData.append('msg', message);
      formData.append('msg_type', msgType);

      response = await fetch(`${ALIGO_BASE_URL}/send/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: formData.toString(),
      });
    } else {
      // 다른 제공자는 추후 구현
      throw new PartnerApiError(`지원하지 않는 SMS 제공자입니다: ${provider}`, 400);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`알리고 API 요청이 실패했습니다. (${response.status}) ${text}`);
    }

    result = await response.json();

    if (result.result_code !== '1') {
      throw new Error(
        result.message || `알리고 오류 (코드: ${result.result_code})`
      );
    }

    // 발송 로그 기록
    await prisma.adminActionLog.create({
      data: {
        adminId: sessionUser.id,
        targetUserId: null,
        action: 'affiliate.sms.sent',
        details: {
          leadId,
          profileId: profile.id,
          phone,
          messageLength: message.length,
          msgType,
          aligoResult: result,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      message: '문자가 성공적으로 발송되었습니다.',
      result,
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('POST /api/partner/customers/send-sms error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        message: error instanceof Error ? error.message : '문자 발송에 실패했습니다.' 
      }, 
      { status: 500 }
    );
  }
}
