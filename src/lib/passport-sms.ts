import { logger } from "@/lib/logger";
import type { AligoConfig } from "@/lib/aligo";

// ─── SMS 템플릿 정의 ────────────────────────────────────────────

export interface SmsTemplate {
  type: "basic" | "reminder" | "urgent";
  message: string;
  variables: string[];
}

/**
 * 여권 독촉용 SMS 템플릿
 * - basic: 초기 안내 (발급 직후)
 * - reminder: 재알림 (7-14일 후)
 * - urgent: 긴급 (출발 3-5일 전)
 */
export const PASSPORT_SMS_TEMPLATES: Record<string, SmsTemplate> = {
  basic: {
    type: "basic",
    message: "[마비즈크루즈] {customerName}님 환영합니다! {tripName} 승선을 위해 여권을 제출해주세요. 🔗 {linkUrl}",
    variables: ["customerName", "tripName", "linkUrl"],
  },
  reminder: {
    type: "reminder",
    message: "[마비즈크루즈] {customerName}님, 여권 제출까지 {daysLeft}일 남았습니다! 지금 제출하세요. {linkUrl}",
    variables: ["customerName", "daysLeft", "linkUrl"],
  },
  urgent: {
    type: "urgent",
    message: "⚠️ 긴급 [{customerName}님] {tripName} 출발 {daysLeft}일 전입니다. 여권을 반드시 제출하세요. {linkUrl}",
    variables: ["customerName", "tripName", "daysLeft", "linkUrl"],
  },
};

// ─── 메시지 생성 함수 ────────────────────────────────────────────

interface MessageVariables {
  customerName: string;
  tripName?: string;
  daysLeft?: number;
  linkUrl: string;
}

/**
 * SMS 템플릿에 변수를 치환하여 최종 메시지 생성
 */
export function renderSmsMessage(
  templateKey: "basic" | "reminder" | "urgent",
  variables: MessageVariables
): string {
  const template = PASSPORT_SMS_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`[Passport SMS] 템플릿 ${templateKey} 없음`);
  }

  let message = template.message;

  // 변수 치환
  message = message.replace("{customerName}", variables.customerName);
  message = message.replace("{tripName}", variables.tripName || "여행");
  message = message.replace("{daysLeft}", String(variables.daysLeft ?? 0));
  message = message.replace("{linkUrl}", variables.linkUrl);

  return message;
}

// ─── 배치 발송 함수 ────────────────────────────────────────────

export interface PassportSmsRecipient {
  id: string; // GmPassportRequestLog.id (String)
  phone: string;
  customerName: string;
  tripName?: string;
  daysLeft?: number;
}

export interface SendSmsBatchResult {
  successCount: number;
  failureCount: number;
  totalCount: number;
  errors: Array<{
    id: string;
    phone: string;
    reason: string;
  }>;
  sentAt: string;
}

/**
 * 배치 SMS 발송
 * - 10명씩 배치 처리
 * - 각 배치 사이 200ms 딜레이
 * - Aligo API 초당 500건 제한 준수
 * - 각 발송마다 logPassportSms() 호출로 SmsLog 기록
 */
export async function sendSmsBatch(
  config: AligoConfig,
  recipients: PassportSmsRecipient[],
  templateKey: "basic" | "reminder" | "urgent",
  linkUrl: string,
  organizationId: string
): Promise<SendSmsBatchResult> {
  const { sendSms } = await import("@/lib/aligo");

  const result: SendSmsBatchResult = {
    successCount: 0,
    failureCount: 0,
    totalCount: recipients.length,
    errors: [],
    sentAt: new Date().toISOString(),
  };

  if (recipients.length === 0) {
    logger.log("[Passport SMS] 배치 수신자 0명 — 발송 스킵");
    return result;
  }

  const batchSize = 10;
  const delayBetweenBatches = 200; // ms

  logger.log("[Passport SMS] 배치 발송 시작", {
    total: recipients.length,
    batchSize,
    estimatedTime: `${Math.ceil(recipients.length / batchSize) * 0.2}초`,
  });

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(recipients.length / batchSize);

    logger.log(`[Passport SMS] 배치 ${batchIndex}/${totalBatches} 처리 중...`, {
      count: batch.length,
    });

    // Promise.all로 배치 내 병렬 발송
    const batchPromises = batch.map(async (recipient) => {
      try {
        // 메시지 생성
        const message = renderSmsMessage(templateKey, {
          customerName: recipient.customerName,
          tripName: recipient.tripName,
          daysLeft: recipient.daysLeft,
          linkUrl,
        });

        // SMS 발송 (LMS 자동 선택: 90자 초과)
        const apiResult = await sendSms({
          config,
          receiver: recipient.phone,
          msg: message,
          msgType: message.length > 90 ? "LMS" : "SMS",
          organizationId,
          channel: "MANUAL",
        });

        // SmsLog에 기록
        await logPassportSms({
          passportRequestLogId: recipient.id,
          organizationId,
          phone: recipient.phone,
          message,
          templateKey,
          status: apiResult.result_code === 1 ? "SENT" : "FAILED",
          resultCode: apiResult.result_code,
          msgId: apiResult.msg_id,
        });

        if (apiResult.result_code === 1) {
          result.successCount++;
          logger.log("[Passport SMS] 발송 성공", {
            id: recipient.id,
            phone: recipient.phone.substring(0, 4) + "***",
            msgId: apiResult.msg_id,
          });
        } else {
          result.failureCount++;
          result.errors.push({
            id: recipient.id,
            phone: recipient.phone,
            reason: `Aligo 오류: ${apiResult.message} (code=${apiResult.result_code})`,
          });
          logger.warn("[Passport SMS] 발송 실패", {
            id: recipient.id,
            code: apiResult.result_code,
            message: apiResult.message,
          });
        }
      } catch (err) {
        result.failureCount++;
        result.errors.push({
          id: recipient.id,
          phone: recipient.phone,
          reason: err instanceof Error ? err.message : "알 수 없는 오류",
        });
        logger.error("[Passport SMS] 발송 예외", {
          id: recipient.id,
          err,
        });

        // 예외 발생도 로깅
        await logPassportSms({
          passportRequestLogId: recipient.id,
          organizationId,
          phone: recipient.phone,
          message: `[오류] ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
          templateKey,
          status: "FAILED",
          blockReason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

    await Promise.all(batchPromises);

    // 다음 배치 전에 딜레이 (마지막 배치는 스킵)
    if (i + batchSize < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  logger.log("[Passport SMS] 배치 발송 완료", {
    successCount: result.successCount,
    failureCount: result.failureCount,
    totalCount: result.totalCount,
    errorCount: result.errors.length,
  });

  return result;
}

// ─── 중복 발송 방지 (24시간 내 같은 사람 중복 발송 체크) ────────────

/**
 * 24시간 내 같은 수신자에게 발송된 SMS 기록 확인
 * true = 24시간 내 이미 발송 → 스킵 권장
 * false = 발송 가능
 */
export async function isDuplicateWithin24h(
  passportRequestLogId: string
): Promise<boolean> {
  const { default: prisma } = await import("@/lib/prisma");

  const passportRequestLog = await prisma.gmPassportRequestLog.findUnique({
    where: { id: parseInt(passportRequestLogId, 10) },
    select: { id: true },
  });

  if (!passportRequestLog) {
    return false; // ID가 없으면 진행
  }

  // 24시간 내 같은 요청에 대한 SMS 발송 기록 확인
  const lastSms = await prisma.smsLog.findFirst({
    where: {
      passportRequestId: passportRequestLogId,
      sentAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });

  if (lastSms) {
    logger.warn("[Passport SMS] 24시간 내 중복 발송 감지", {
      passportRequestLogId,
      lastSentAt: lastSms.sentAt,
    });
    return true;
  }

  return false;
}

// ─── SMS 로깅 (SmsLog 테이블 직접 기록) ────────────────────────────

/**
 * 여권 SMS 발송 기록을 SmsLog 테이블에 직접 저장
 * (Redis 큐 대신 동기 DB 저장 - 배치 발송이므로)
 */
export async function logPassportSms(params: {
  passportRequestLogId: string;
  organizationId: string;
  phone: string;
  message: string;
  templateKey: "basic" | "reminder" | "urgent";
  status: "SENT" | "FAILED" | "BLOCKED";
  resultCode?: number;
  msgId?: string;
  blockReason?: string;
}): Promise<void> {
  const { default: prisma } = await import("@/lib/prisma");

  try {
    await prisma.smsLog.create({
      data: {
        passportRequestId: params.passportRequestLogId,
        organizationId: params.organizationId,
        phone: params.phone,
        contentPreview: params.message.substring(0, 100),
        msg: params.message,
        status: params.status,
        blockReason: params.blockReason,
        resultCode: params.resultCode?.toString(),
        msgId: params.msgId,
        channel: "PASSPORT",
      },
    });
  } catch (err) {
    logger.error("[Passport SMS] SmsLog 기록 실패", {
      passportRequestLogId: params.passportRequestLogId,
      err,
    });
  }
}

// ─── 템플릿 유효성 검증 ────────────────────────────────────────────

/**
 * 메시지 길이 검증
 * - SMS: 최대 90자
 * - LMS: 최대 1000자
 */
export function validateMessageLength(message: string): {
  isValid: boolean;
  messageType: "SMS" | "LMS";
  length: number;
  error?: string;
} {
  const length = message.length;

  if (length > 1000) {
    return {
      isValid: false,
      messageType: "LMS",
      length,
      error: `메시지가 너무 깁니다 (${length}자). 최대 1000자입니다.`,
    };
  }

  return {
    isValid: true,
    messageType: length > 90 ? "LMS" : "SMS",
    length,
  };
}
