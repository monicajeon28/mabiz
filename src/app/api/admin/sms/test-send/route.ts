/**
 * POST /api/admin/sms/test-send
 * SMS 테스트 발송 API
 *
 * 관리자가 실제로 전화번호에 테스트 SMS를 발송하여 Aligo 설정을 검증합니다.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import prisma from '@/lib/prisma';
import { createAligoClient } from '@/lib/aligo';
import { logger } from '@/lib/logger';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    // 관리자 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    }

    // 관리자 권한 확인 (OrganizationMember 사용)
    const member = await prisma.organizationMember.findFirst({
      where: { email: session.user.email, isActive: true },
      select: { role: true, organizationId: true },
    });

    if (!member?.organizationId || member.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 });
    }

    const { phoneNumber, message } = await req.json();

    // 입력 검증
    if (!phoneNumber || !message) {
      return NextResponse.json(
        { error: '전화번호와 메시지는 필수입니다' },
        { status: 400 }
      );
    }

    // 전화번호 검증 (01012345678 또는 010-1234-5678 형식)
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith('010')) {
      return NextResponse.json(
        { error: '유효한 전화번호를 입력하세요 (예: 01012345678)' },
        { status: 400 }
      );
    }

    // SMS 설정 조회
    const smsConfig = await prisma.orgSmsConfig.findUnique({
      where: { organizationId: member.organizationId },
    });

    if (!smsConfig || !smsConfig.isActive) {
      return NextResponse.json(
        { error: 'SMS 설정이 없거나 비활성화되었습니다' },
        { status: 400 }
      );
    }

    // 발신자 번호 검증 확인
    if (!smsConfig.senderVerified) {
      logger.warn('[SMSTestSend] 발신자 번호 미검증', {
        organizationId: member.organizationId,
        senderPhone: smsConfig.senderPhone,
      });
    }

    // Aligo 클라이언트 생성 (AligoConfig: key, userId, sender)
    const aligoClient = createAligoClient({
      key: smsConfig.aligoKey,
      userId: smsConfig.aligoUserId,
      sender: smsConfig.senderPhone,
    });

    // 발신자 번호 검증
    logger.log('[SMSTestSend] 발신자 번호 검증 시작', {
      senderPhone: smsConfig.senderPhone,
    });

    const isValidSender = await aligoClient.verifySender();

    if (!isValidSender) {
      logger.error('[SMSTestSend] 발신자 번호 검증 실패', {
        senderPhone: smsConfig.senderPhone,
      });
      return NextResponse.json(
        {
          error: '발신자 번호 검증 실패',
          details: `등록된 발신자 번호(${smsConfig.senderPhone})가 Aligo에서 검증되지 않았습니다. Aligo 대시보드를 확인하세요.`,
        },
        { status: 400 }
      );
    }

    // 테스트 SMS 발송
    logger.log('[SMSTestSend] SMS 발송 시작', {
      organizationId: member.organizationId,
      receiver: cleanPhone.substring(0, 4) + '****',
      messageLength: message.length,
    });

    const response = await aligoClient.sendSms(
      cleanPhone,
      `[테스트] ${message}`,
      message.length > 80 ? 'LMS' : 'SMS'
    );

    if (response.result_code === 1) {
      // 성공
      logger.log('[SMSTestSend] SMS 발송 성공', {
        organizationId: member.organizationId,
        msgId: response.msg_id,
        receiver: cleanPhone.substring(0, 4) + '****',
      });

      // SmsLog 기록
      await prisma.smsLog.create({
        data: {
          organizationId: member.organizationId,
          phone: cleanPhone,
          msg: message,
          contentPreview: message.substring(0, 50),
          status: 'SENT',
          msgId: response.msg_id,
          channel: 'ADMIN_TEST',
        },
      });

      return NextResponse.json({
        success: true,
        message: '테스트 SMS가 발송되었습니다',
        msgId: response.msg_id,
        receiver: cleanPhone.substring(0, 4) + '****',
        expectedArrival: '약 1-10초 내',
      });
    } else {
      // 실패
      logger.error('[SMSTestSend] SMS 발송 실패', {
        organizationId: member.organizationId,
        result_code: response.result_code,
        message: response.message,
      });

      // SmsLog 기록 (실패)
      await prisma.smsLog.create({
        data: {
          organizationId: member.organizationId,
          phone: cleanPhone,
          msg: message,
          contentPreview: message.substring(0, 50),
          status: 'FAILED',
          blockReason: response.message,
          channel: 'ADMIN_TEST',
        },
      });

      return NextResponse.json(
        {
          error: 'SMS 발송 실패',
          resultCode: response.result_code,
          message: response.message,
          troubleshooting: getTroubleshooting(response.result_code),
        },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('[SMSTestSend] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: 'SMS 발송 중 오류 발생',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

/**
 * 오류 코드별 문제 해결 가이드
 */
function getTroubleshooting(resultCode: number): string {
  const guides: Record<number, string> = {
    [-99]: '인증 실패: API Key 또는 User ID가 잘못되었습니다. Aligo 대시보드를 확인하세요.',
    [-98]: '야간 발송 차단: 21:00~08:00 시간대입니다. 다음 날 08:00 이후 다시 시도하세요.',
    [-97]: '수신거부 번호: 수신자가 SMS 수신 거부를 신청했습니다.',
    [-96]: '충전금 부족: Aligo 계정에 충전금을 입금하세요.',
    [-1]: '일시적 오류: 네트워크 상태를 확인하고 다시 시도하세요.',
    10: '타임아웃: 요청이 8초 이상 걸렸습니다. 다시 시도하세요.',
    11: '서버 오류: Aligo 서버 상태를 확인하고 다시 시도하세요.',
  };

  return (
    guides[resultCode] ||
    `오류 코드: ${resultCode}. Aligo 고객지원(support@aligo.in)에 문의하세요.`
  );
}
