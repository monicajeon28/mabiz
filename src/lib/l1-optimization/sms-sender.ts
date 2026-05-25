/**
 * L1 렌즈: SMS 발송
 *
 * 템플릿 기반 SMS 텍스트를 만들어 고객에게 발송합니다.
 * Aligo API 또는 테스트 모드를 사용합니다.
 */

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

interface L1SMSSendRequest {
  organizationId: string;
  contactId: string;
  phoneNumber: string;
  messageTemplate: string;
  copyAngle: string;
}

interface L1SMSSendResult {
  success: boolean;
  messageId?: string;
  sentAt?: Date;
  error?: string;
}

/**
 * SMS 발송 메인 함수
 */
export async function sendL1SMS(request: L1SMSSendRequest): Promise<L1SMSSendResult> {
  try {
    const { organizationId, contactId, phoneNumber, messageTemplate, copyAngle } = request;

    // 1. 조직의 SMS 설정 조회
    const smsConfig = await prisma.orgSmsConfig.findUnique({
      where: { organizationId },
      select: {
        aligoKey: true,
        aligoUserId: true,
        senderPhone: true,
        isActive: true,
      },
    });

    if (!smsConfig || !smsConfig.isActive) {
      logger.warn(`[L1] SMS config not active for org ${organizationId}`);
      return {
        success: false,
        error: 'SMS config not active',
      };
    }

    // 2. 메시지 렌더링 (변수 치환)
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { name: true, primaryPhone: true },
    });

    if (!contact) {
      return { success: false, error: 'Contact not found' };
    }

    const renderedMessage = renderMessageTemplate(messageTemplate, {
      customerName: contact.name || '고객님',
      phoneNumber,
    });

    // 3. SMS 길이 확인 (한글 기준 80글자 = 1건, 초과 시 장문 SMS)
    const isLongMessage = renderedMessage.length > 80;

    // 4. Aligo API 호출 (실제 발송)
    const aligoResult = await sendViaAligo({
      userId: smsConfig.aligoUserId,
      key: smsConfig.aligoKey,
      senderPhone: smsConfig.senderPhone,
      receiverPhone: phoneNumber,
      message: renderedMessage,
      isLongMessage,
    });

    if (!aligoResult.success) {
      logger.error(`[L1] Aligo SMS send failed`, {
        contactId,
        error: aligoResult.error,
      });
      return aligoResult;
    }

    // 5. ScheduledSms 레코드 생성 (추적용)
    const scheduledSms = await prisma.scheduledSms.create({
      data: {
        organizationId,
        contactId,
        phoneNumber,
        message: renderedMessage,
        templateType: 'L1_PRICE_OBJECTION',
        status: 'SENT',
        sentAt: new Date(),
        metadata: {
          copyAngle,
          variant: 'A', // 기본값, 실제로는 API에서 전달받음
          isLongMessage,
        },
      },
    });

    logger.info(`[L1] SMS sent successfully`, {
      messageId: scheduledSms.id,
      contactId,
      copyAngle,
    });

    return {
      success: true,
      messageId: scheduledSms.id,
      sentAt: new Date(),
    };
  } catch (error) {
    logger.error('[L1] sendL1SMS error', error);
    return {
      success: false,
      error: 'SMS send failed',
    };
  }
}

/**
 * SMS 템플릿 렌더링 (변수 치환)
 * 예: "안녕하세요 {{customerName}}님" → "안녕하세요 김철수님"
 */
function renderMessageTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let message = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    message = message.replace(new RegExp(placeholder, 'g'), value);
  }

  return message;
}

/**
 * Aligo API 호출
 */
async function sendViaAligo(params: {
  userId: string;
  key: string;
  senderPhone: string;
  receiverPhone: string;
  message: string;
  isLongMessage: boolean;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // 테스트 모드: 실제 발송하지 않음
    if (process.env.SMS_TEST_MODE === 'true') {
      logger.info(`[L1] SMS in test mode (not sent)`, {
        receiver: params.receiverPhone,
        message: params.message.substring(0, 50),
      });
      return {
        success: true,
        messageId: `TEST_${Date.now()}`,
      };
    }

    // 실제 Aligo API 호출
    const response = await fetch('https://api.aligo.in/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        user_id: params.userId,
        key: params.key,
        sender: params.senderPhone,
        receiver: params.receiverPhone,
        msg: params.message,
        msg_type: params.isLongMessage ? 'LMS' : 'SMS',
      }).toString(),
    });

    const data = await response.json() as any;

    if (data.result_code === 1) {
      return {
        success: true,
        messageId: data.msg_id,
      };
    } else {
      return {
        success: false,
        error: data.message || 'Unknown error',
      };
    }
  } catch (error) {
    logger.error('[L1] Aligo API error', error);
    return {
      success: false,
      error: 'API call failed',
    };
  }
}

/**
 * 배치 발송 (여러 고객에게 동시 발송)
 */
export async function sendL1SMSBatch(
  requests: Array<L1SMSSendRequest>
): Promise<Array<L1SMSSendResult>> {
  const results = await Promise.all(
    requests.map(req => sendL1SMS(req))
  );
  return results;
}
