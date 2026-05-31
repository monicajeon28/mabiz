import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Aligo SMS API 응답 타입
 */
interface AligoResponse {
  success: boolean;
  msg_id?: string;
  error?: string;
  code?: string;
}

/**
 * SMS 발송 결과
 */
export interface SmsSendResult {
  success: boolean;
  smsId?: string;
  error?: string;
  retryable: boolean;
}

/**
 * Aligo REST API를 통한 SMS 발송
 * @see https://aligo.in/api/send/
 *
 * P0-1: 환경변수 검증 강화
 */
async function sendSmsWithAligo(
  aligoUserId: string,
  aligoKey: string,
  senderPhone: string,
  recipientPhone: string,
  message: string
): Promise<SmsSendResult> {
  try {
    // P0-1: 필수 매개변수 검증
    if (!aligoUserId || !aligoKey) {
      logger.error('[Aligo SMS] 필수 인증 정보 누락', {
        hasUserId: !!aligoUserId,
        hasKey: !!aligoKey,
      });
      return {
        success: false,
        error: 'Aligo 인증 정보 누락: user_id 또는 key 없음',
        retryable: false,
      };
    }

    if (!senderPhone || !recipientPhone) {
      logger.error('[Aligo SMS] 전화번호 누락', {
        hasSenderPhone: !!senderPhone,
        hasRecipientPhone: !!recipientPhone,
      });
      return {
        success: false,
        error: 'Aligo SMS 발송 실패: 송신자 또는 수신자 전화번호 없음',
        retryable: false,
      };
    }

    if (!message || message.trim().length === 0) {
      logger.error('[Aligo SMS] 메시지 내용 없음');
      return {
        success: false,
        error: 'Aligo SMS 발송 실패: 메시지 내용 필수',
        retryable: false,
      };
    }

    const formData = new URLSearchParams();
    formData.append('user_id', aligoUserId);
    formData.append('key', aligoKey);
    formData.append('sender', senderPhone);
    formData.append('receiver', recipientPhone);
    formData.append('msg', message);
    formData.append('msg_type', 'SMS'); // SMS만 지원

    const response = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: formData,
    });

    const data: AligoResponse = await response.json();

    if (!data.success) {
      logger.warn('[Aligo SMS] 발송 실패', {
        recipientPhone,
        error: data.error || 'Unknown error',
        code: data.code,
      });

      // 재시도 가능 여부 판단
      const retryable =
        !data.code || // 네트워크 오류
        data.code === '10' || // 일시적 오류
        data.code === '11'; // 서버 오류

      return {
        success: false,
        error: data.error || 'Unknown error',
        retryable,
      };
    }

    logger.log('[Aligo SMS] 발송 성공', {
      recipientPhone,
      smsId: data.msg_id,
    });

    return {
      success: true,
      smsId: data.msg_id,
      retryable: false,
    };
  } catch (error: unknown) {
    logger.error('[Aligo SMS] 네트워크 오류', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      retryable: true, // 네트워크 오류는 재시도 가능
    };
  }
}

/**
 * 파트너 Alert SMS 발송
 */
export async function sendPartnerAlertSms(
  organizationId: string,
  partnerId: string,
  day: 'day0' | 'day1' | 'day2' | 'day3',
  riskLevel: 'RED' | 'YELLOW' | 'GREEN',
  messageType: string,
  messageContent: string,
  phoneNumber: string
): Promise<SmsSendResult> {
  try {
    // SMS 설정 조회
    const smsConfig = await prisma.orgSmsConfig.findUnique({
      where: { organizationId },
    });

    if (!smsConfig || !smsConfig.isActive) {
      return {
        success: false,
        error: 'SMS configuration not found or inactive',
        retryable: false,
      };
    }

    // Aligo 발송
    const result = await sendSmsWithAligo(
      smsConfig.aligoUserId,
      smsConfig.aligoKey,
      smsConfig.senderPhone,
      phoneNumber,
      messageContent
    );

    // 발송 로그 기록
    const logStatus = result.success ? 'SENT' : result.retryable ? 'PENDING' : 'FAILED';

    await prisma.partnerSmsLog.create({
      data: {
        organizationId,
        partnerId,
        day,
        riskLevel,
        messageType,
        messageContent,
        phoneNumber,
        status: logStatus,
        smsId: result.smsId,
        failureReason: result.error,
        triggeredBy: 'AUTO_RISK_SCORE',
        sentAt: result.success ? new Date() : null,
      },
    });

    return result;
  } catch (error: unknown) {
    logger.error('[sendPartnerAlertSms] 오류', {
      partnerId,
      error: error instanceof Error ? error.message : String(error),
    });

    // 에러 로그 기록
    try {
      await prisma.partnerSmsLog.create({
        data: {
          organizationId,
          partnerId,
          day,
          riskLevel,
          messageType,
          messageContent,
          phoneNumber,
          status: 'FAILED',
          failureReason: error instanceof Error ? error.message : 'Unknown error',
          triggeredBy: 'AUTO_RISK_SCORE',
        },
      });
    } catch (logError) {
      logger.error('[sendPartnerAlertSms] 로그 기록 실패', {
        error: logError instanceof Error ? logError.message : String(logError),
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }
}

/**
 * 실패한 SMS 재시도
 */
export async function retryFailedPartnerSms(
  smsLogId: string
): Promise<SmsSendResult> {
  try {
    const smsLog = await prisma.partnerSmsLog.findUnique({
      where: { id: smsLogId },
    });

    if (!smsLog) {
      return {
        success: false,
        error: 'SMS log not found',
        retryable: false,
      };
    }

    if (smsLog.retryCount >= smsLog.maxRetries) {
      return {
        success: false,
        error: 'Max retries exceeded',
        retryable: false,
      };
    }

    // 재발송
    if (!smsLog.phoneNumber) {
      return {
        success: false,
        error: 'Phone number not available for retry',
        retryable: false,
      };
    }

    const phoneNumber = smsLog.phoneNumber; // Type guard
    const result = await sendPartnerAlertSms(
      smsLog.organizationId,
      smsLog.partnerId,
      smsLog.day as 'day0' | 'day1' | 'day2' | 'day3',
      smsLog.riskLevel as 'RED' | 'YELLOW' | 'GREEN',
      smsLog.messageType,
      smsLog.messageContent,
      phoneNumber
    );

    // 재시도 횟수 업데이트
    if (!result.success) {
      await prisma.partnerSmsLog.update({
        where: { id: smsLogId },
        data: { retryCount: smsLog.retryCount + 1 },
      });
    }

    return result;
  } catch (error: unknown) {
    logger.error('[retryFailedPartnerSms] 오류', {
      smsLogId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }
}

/**
 * SMS 통계 조회 (일일)
 */
export async function getSmsDailyStats(organizationId: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [sent, failed, bounced, clicked] = await Promise.all([
      prisma.partnerSmsLog.count({
        where: {
          organizationId,
          status: 'SENT',
          createdAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.partnerSmsLog.count({
        where: {
          organizationId,
          status: 'FAILED',
          createdAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.partnerSmsLog.count({
        where: {
          organizationId,
          status: 'BOUNCED',
          createdAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.partnerSmsLog.count({
        where: {
          organizationId,
          status: 'CLICKED',
          createdAt: { gte: today, lt: tomorrow },
        },
      }),
    ]);

    const total = sent + failed + bounced;
    const successRate = total > 0 ? ((sent / total) * 100).toFixed(1) : '0';
    const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0';

    return {
      date: today.toISOString().split('T')[0],
      sent,
      failed,
      bounced,
      clicked,
      total,
      successRate: parseFloat(successRate),
      clickRate: parseFloat(clickRate),
    };
  } catch (error: unknown) {
    logger.error('[getSmsDailyStats] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
