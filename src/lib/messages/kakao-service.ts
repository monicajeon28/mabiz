/**
 * Kakao Talk Message API 서비스
 * - 비즈니스 메시지 템플릿 발송
 * - SMS fallback
 * - 배송 추적
 */

import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

interface KakaoMessagePayload {
  organizationId: string;
  phoneNumber: string; // 수신자 전화번호
  templateId: string;
  templateArgs?: string[]; // 템플릿 변수값
  buttons?: KakaoButton[];
}

interface KakaoButton {
  name: string;
  type: 'WL' | 'AL' | 'BK' | 'MD' | 'BC';
  url?: string;
  metadata?: string;
}

interface KakaoSendResponse {
  resultCode: number;
  resultMessage: string;
  messages: Array<{
    messageId: string;
    state: string;
  }>;
}

/**
 * 카카오톡 비즈니스 메시지 발송
 * Kakao Developers Message API v2 사용
 */
export async function sendKakaoMessage(
  payload: KakaoMessagePayload
): Promise<{ messageId: string; status: string; fallbackToSms: boolean }> {
  try {
    // KakaoConfig 조회
    const kakaoConfig = await prisma.kakaoConfig.findUnique({
      where: { organizationId: payload.organizationId },
    });

    if (!kakaoConfig || !kakaoConfig.isActive) {
      logger.warn('[KakaoService] KakaoConfig not found or inactive', {
        organizationId: payload.organizationId,
      });
      return {
        messageId: '',
        status: 'FAILED',
        fallbackToSms: true,
      };
    }

    // Kakao API 호출
    const response = await callKakaoAPI(kakaoConfig.senderKey, payload);

    if (response.resultCode !== 0) {
      logger.error('[KakaoService] Kakao API error', {
        organizationId: payload.organizationId,
        resultCode: response.resultCode,
        resultMessage: response.resultMessage,
      });

      return {
        messageId: '',
        status: 'FAILED',
        fallbackToSms: true,
      };
    }

    if (!response.messages || response.messages.length === 0) {
      logger.error('[KakaoService] No messages in response', {
        organizationId: payload.organizationId,
        responseMessagesLength: response.messages?.length || 0,
      });

      return {
        messageId: '',
        status: 'FAILED',
        fallbackToSms: true,
      };
    }

    const message = response.messages[0];
    logger.log('[KakaoService] Message sent successfully', {
      organizationId: payload.organizationId,
      messageId: message.messageId,
      phoneNumber: payload.phoneNumber,
      state: message.state,
    });

    return {
      messageId: message.messageId,
      status: 'SENT',
      fallbackToSms: false,
    };
  } catch (error) {
    logger.error('[KakaoService] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      organizationId: payload.organizationId,
    });

    return {
      messageId: '',
      status: 'FAILED',
      fallbackToSms: true,
    };
  }
}

/**
 * Kakao Developers API 호출
 * https://developers.kakao.com/docs/latest/ko/message/rest-api
 */
async function callKakaoAPI(
  senderKey: string,
  payload: KakaoMessagePayload
): Promise<KakaoSendResponse> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${senderKey}`,
  };

  const requestBody = {
    messages: [
      {
        to: sanitizePhoneNumber(payload.phoneNumber),
        templateId: payload.templateId,
        templateArgs: payload.templateArgs || [],
        buttons: payload.buttons || [],
      },
    ],
  };

  const apiUrl = 'https://kapi.kakao.com/v2/user/me/message/template';

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Kakao API returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('[KakaoAPI] Request failed', {
      error: error instanceof Error ? error.message : String(error),
      apiUrl,
    });

    throw error;
  }
}

/**
 * 전화번호 정규화
 * 01012345678 → 010-1234-5678
 */
function sanitizePhoneNumber(phone: string): string {
  // 숫자만 추출
  const digits = phone.replace(/\D/g, '');

  // 국내 번호: 010-1234-5678
  if (digits.startsWith('010') && digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  // 기타: 원본 유지
  return phone;
}

/**
 * Kakao 메시지 로그 기록
 * SmsLog 테이블 재활용
 */
export async function logKakaoMessage(
  organizationId: string,
  contactId: string,
  phoneNumber: string,
  messageId: string,
  content: string,
  status: 'SENT' | 'FAILED'
): Promise<void> {
  try {
    await prisma.smsLog.create({
      data: {
        organizationId,
        contactId: contactId || undefined,
        phone: phoneNumber,
        contentPreview: content.substring(0, 100),
        status,
        channel: 'KAKAO',
        msgId: messageId,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('[KakaoService] Failed to log message', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Kakao 메시지 상태 조회
 * 배송 상태 확인
 */
export async function getKakaoMessageStatus(
  senderKey: string,
  messageId: string
): Promise<{ state: string; sentTime: Date; readTime?: Date }> {
  try {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${senderKey}`,
    };

    const response = await fetch(
      `https://kapi.kakao.com/v2/user/me/message/status?messageId=${messageId}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Kakao API returned ${response.status}`);
    }

    const data = await response.json();
    return {
      state: data.state,
      sentTime: new Date(data.sentTime),
      readTime: data.readTime ? new Date(data.readTime) : undefined,
    };
  } catch (error) {
    logger.error('[KakaoService] Failed to get message status', {
      error: error instanceof Error ? error.message : String(error),
      messageId,
    });

    throw error;
  }
}

/**
 * Kakao 비즈니스 메시지 템플릿 목록 조회
 */
export async function listKakaoTemplates(
  senderKey: string
): Promise<Array<{ templateId: string; templateName: string; status: string }>> {
  try {
    const headers = {
      Authorization: `Bearer ${senderKey}`,
    };

    const response = await fetch(
      'https://kapi.kakao.com/v2/user/me/template/list',
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Kakao API returned ${response.status}`);
    }

    const data = await response.json();
    return data.templates || [];
  } catch (error) {
    logger.error('[KakaoService] Failed to list templates', {
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}
