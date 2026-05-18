/**
 * Menu #38 Phase 3-β: 통합 래퍼 함수 — Contact 템플릿 발송
 *
 * 목적:
 * - sendEmail/sendSMS 호출 중복 제거 (280줄 코드 감소)
 * - SendingHistory + ExecutionLog 병행 기록 (호환성 하이브리드)
 * - 에러 매핑 중앙화
 * - Feature Flag 기반 제어
 *
 * 특징:
 * - Single Responsibility: 발송 + 이력 기록만 담당
 * - Retry Logic: 재시도 판단 + 스케줄링 (내부)
 * - Error Mapping: Aligo/Email → SendingFailureReason 중앙화
 * - Feature Flag: ENABLE_EXECUTION_LOG_WRAPPER (점진적 마이그레이션)
 */

import db from "../prisma";
import { logger } from "../logger";
import type { SendingStatus, SendingFailureReason, ExecutionStatus } from "@prisma/client";
import { sendSms, resolveUserSmsConfig } from "../aligo";
import { sendFunnelEmail } from "../email";
import {
  mapSendingToExecutionStatus,
  mapSendingToExecutionFailureReason,
} from "../enum-mapping";
// Phase 3-β: P1-1 에러 매핑 중앙화 import
import {
  mapAligoErrorToFailureReason,
  mapEmailErrorToFailureReason,
} from "./error-mapper";

// ─────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────

export interface SendToContactByTemplateParams {
  contactId: string;
  channel: "SMS" | "EMAIL";
  messageBody: string;
  messageSubject?: string;
  organizationId: string;
  campaignId?: string;
  sourceType?: "FUNNEL_SEQUENCE" | "AUTOMATION_RULE" | "CAMPAIGN"; // ExecutionLog용
  sourceId?: string;
  sourceName?: string;
  sendingType?: "TEMPLATE" | "AUTOMATION" | "CAMPAIGN"; // SendingHistory용
  useExecutionLog?: boolean; // Feature Flag override
}

export interface SendingResult {
  contactId: string;
  status: SendingStatus;
  failureReason?: SendingFailureReason;
  messageId?: string;
  sendingHistoryId?: string;
  executionLogId?: string;
}

// ─────────────────────────────────────────────────────────────────
// 함수 1: 통합 발송 함수 (래퍼)
// ─────────────────────────────────────────────────────────────────

/**
 * Contact에게 템플릿 기반 메시지 발송 (SMS/Email)
 *
 * 흐름:
 * 1. Contact 조회 (유효성 검증)
 * 2. 채널별 발송 (sendSms / sendFunnelEmail)
 * 3. SendingHistory 기록 (항상)
 * 4. ExecutionLog 기록 (선택적, Feature Flag)
 * 5. 재시도 상태 판단 (일시적 오류 시)
 *
 * @returns SendingResult { status, failureReason, sendingHistoryId, executionLogId }
 */
export async function sendToContactByTemplate(
  params: SendToContactByTemplateParams
): Promise<SendingResult> {
  const {
    contactId,
    channel,
    messageBody,
    messageSubject,
    organizationId,
    campaignId,
    sourceType = "CAMPAIGN",
    sourceId = campaignId,
    sourceName,
    sendingType = "CAMPAIGN",
    useExecutionLog: overrideFeatureFlag,
  } = params;

  const DEFAULT_SUBJECT = channel === "EMAIL" ? messageSubject || "안내드립니다" : undefined;

  try {
    // ─ Step 1: Contact 조회
    const contact = await db.contact.findUnique({
      where: { id: contactId },
      select: { id: true, phone: true, email: true },
    });

    if (!contact) {
      logger.warn("[Wrapper] Contact 없음", { contactId });
      return {
        contactId,
        status: "SKIPPED",
        failureReason: "INVALID_EMAIL" as SendingFailureReason,
      };
    }

    // ─ Step 2: 채널별 발송
    let sendResult: { status: SendingStatus; failureReason?: SendingFailureReason; messageId?: string };

    if (channel === "SMS") {
      sendResult = await sendSmsInternal({
        contact,
        messageBody,
        organizationId,
        contactId,
      });
    } else {
      sendResult = await sendEmailInternal({
        contact,
        messageBody,
        messageSubject: DEFAULT_SUBJECT,
        organizationId,
        contactId,
      });
    }

    // ─ Step 3: SendingHistory 기록 (항상)
    const sendingHistoryId = await recordSendingHistory({
      contactId,
      channel,
      status: sendResult.status,
      failureReason: sendResult.failureReason,
      organizationId,
      campaignId,
      sendingType,
      messageBody,
      messageSubject: DEFAULT_SUBJECT,
      messageId: sendResult.messageId,
      sentAt: sendResult.status === "SENT" ? new Date() : undefined,
    });

    // ─ Step 4: ExecutionLog 기록 (Feature Flag)
    const useExecutionLog = overrideFeatureFlag ?? getFeatureFlag("ENABLE_EXECUTION_LOG_WRAPPER");
    let executionLogId: string | undefined;

    if (useExecutionLog && sourceId && sourceName) {
      const executionMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      executionLogId = await recordExecutionLog({
        contactId,
        channel,
        status: sendResult.status,
        failureReason: sendResult.failureReason,
        organizationId,
        campaignId,
        sourceType,
        sourceId,
        sourceName,
        messageId: sendResult.messageId,
        executeMonth,
        sentAt: sendResult.status === "SENT" ? new Date() : undefined,
      });
    }

    // ─ Step 5: 재시도 상태 판단
    if (sendResult.status === "FAILED" && sendResult.failureReason) {
      const isRetryable = isRetryableFailure(sendResult.failureReason);
      if (isRetryable && sendingHistoryId) {
        await scheduleRetry(sendingHistoryId, 0);
      }
    }

    return {
      contactId,
      status: sendResult.status,
      failureReason: sendResult.failureReason,
      messageId: sendResult.messageId,
      sendingHistoryId,
      executionLogId,
    };
  } catch (err) {
    logger.error("[Wrapper] 발송 중 예외 발생", { contactId, channel, err });
    return {
      contactId,
      status: "FAILED",
      failureReason: "SYSTEM_ERROR" as SendingFailureReason,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// 함수 2: SMS 발송 (내부)
// ─────────────────────────────────────────────────────────────────

async function sendSmsInternal(params: {
  contact: { id: string; phone: string | null; email: string | null };
  messageBody: string;
  organizationId: string;
  contactId: string;
}): Promise<{ status: SendingStatus; failureReason?: SendingFailureReason; messageId?: string }> {
  const { contact, messageBody, organizationId, contactId } = params;

  // 휴대폰 유효성 검증
  if (!contact.phone) {
    logger.warn("[Wrapper] SMS: 휴대폰 없음", { contactId });
    return {
      status: "SKIPPED",
      failureReason: "INVALID_PHONE" as SendingFailureReason,
    };
  }

  // SMS 설정 확인
  const smsConfig = await resolveUserSmsConfig(organizationId);
  if (!smsConfig) {
    logger.warn("[Wrapper] SMS: 설정 없음", { organizationId });
    return {
      status: "FAILED",
      failureReason: "SYSTEM_ERROR" as SendingFailureReason,
    };
  }

  // SMS 발송
  try {
    const smsResult = await sendSms({
      config: smsConfig,
      receiver: contact.phone,
      msg: messageBody,
      msgType: messageBody.length > 90 ? "LMS" : "SMS",
      organizationId,
      contactId,
      channel: "FUNNEL",
    });

    if (smsResult.result_code === 1) {
      return {
        status: "SENT",
        messageId: smsResult.msg_id || undefined,
      };
    } else {
      return {
        status: "FAILED",
        failureReason: mapAligoErrorToFailureReason(smsResult.result_code),
      };
    }
  } catch (err) {
    logger.error("[Wrapper] SMS 발송 실패", { contactId, err });
    return {
      status: "FAILED",
      failureReason: "PROVIDER_ERROR" as SendingFailureReason,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// 함수 3: Email 발송 (내부)
// ─────────────────────────────────────────────────────────────────

async function sendEmailInternal(params: {
  contact: { id: string; phone: string | null; email: string | null };
  messageBody: string;
  messageSubject: string;
  organizationId: string;
  contactId: string;
}): Promise<{ status: SendingStatus; failureReason?: SendingFailureReason; messageId?: string }> {
  const { contact, messageBody, messageSubject, organizationId, contactId } = params;

  // 이메일 유효성 검증
  if (!contact.email) {
    logger.warn("[Wrapper] Email: 이메일 없음", { contactId });
    return {
      status: "SKIPPED",
      failureReason: "INVALID_EMAIL" as SendingFailureReason,
    };
  }

  // Email 발송
  try {
    const emailResult = await sendFunnelEmail({
      organizationId,
      contactId,
      to: contact.email,
      subject: messageSubject,
      html: `<div style="font-family:sans-serif;line-height:1.8;white-space:pre-wrap">${messageBody}</div>`,
      channel: "CAMPAIGN",
    });

    if (emailResult.result_code === 1) {
      return {
        status: "SENT",
        messageId: emailResult.messageId || undefined,
      };
    } else {
      return {
        status: "FAILED",
        failureReason: mapEmailErrorToFailureReason(emailResult.result_code),
      };
    }
  } catch (err) {
    logger.error("[Wrapper] Email 발송 실패", { contactId, err });
    return {
      status: "FAILED",
      failureReason: "PROVIDER_ERROR" as SendingFailureReason,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// 함수 4: SendingHistory 기록
// ─────────────────────────────────────────────────────────────────

async function recordSendingHistory(params: {
  contactId: string;
  channel: "SMS" | "EMAIL";
  status: SendingStatus;
  failureReason?: SendingFailureReason;
  organizationId: string;
  campaignId?: string;
  sendingType: "TEMPLATE" | "AUTOMATION" | "CAMPAIGN";
  messageBody: string;
  messageSubject?: string;
  messageId?: string;
  sentAt?: Date;
}): Promise<string | undefined> {
  try {
    const sending = await db.sendingHistory.create({
      data: {
        contactId: params.contactId,
        channel: params.channel,
        status: params.status,
        failureReason: params.failureReason,
        organizationId: params.organizationId,
        campaignId: params.campaignId,
        sendingType: params.sendingType,
        body: params.messageBody || "",
        subject: params.messageSubject || undefined,
        messageId: params.messageId,
        sentAt: params.sentAt,
        retryCount: 0,
        maxRetries: 3,
        nextRetryAt: null,
        scheduledAt: new Date(),
        phone: undefined, // TODO: snapshot 추가 필요
        email: undefined,
      },
    });

    logger.info("[Wrapper] SendingHistory 기록 완료", {
      sendingHistoryId: sending.id,
      status: params.status,
    });

    return sending.id;
  } catch (err) {
    logger.error("[Wrapper] SendingHistory 기록 실패", { err, params });
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────
// 함수 5: ExecutionLog 기록 (선택적)
// ─────────────────────────────────────────────────────────────────

async function recordExecutionLog(params: {
  contactId: string;
  channel: "SMS" | "EMAIL";
  status: SendingStatus;
  failureReason?: SendingFailureReason;
  organizationId: string;
  campaignId?: string;
  sourceType: "FUNNEL_SEQUENCE" | "AUTOMATION_RULE" | "CAMPAIGN";
  sourceId: string;
  sourceName: string;
  messageId?: string;
  executeMonth: string;
  sentAt?: Date;
}): Promise<string | undefined> {
  try {
    // SendingStatus → ExecutionStatus 변환
    const executionStatus = mapSendingToExecutionStatus(params.status);
    const executionFailureReason = mapSendingToExecutionFailureReason(params.failureReason);

    const log = await db.executionLog.create({
      data: {
        organizationId: params.organizationId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        sourceName: params.sourceName,
        campaignId: params.campaignId,
        contactId: params.contactId,
        channel: params.channel,
        status: executionStatus as ExecutionStatus,
        executeMonth: params.executeMonth,
        scheduledAt: new Date(),
        sentAt: params.sentAt,
        failureReason: executionFailureReason,
        messageId: params.messageId,
      },
    });

    logger.info("[Wrapper] ExecutionLog 기록 완료", {
      executionLogId: log.id,
      status: executionStatus,
    });

    return log.id;
  } catch (err) {
    logger.error("[Wrapper] ExecutionLog 기록 실패", { err, params });
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────
// 헬퍼: 재시도 상태 판단
// ─────────────────────────────────────────────────────────────────

function isRetryableFailure(failureReason: SendingFailureReason): boolean {
  // 영구 실패: 재시도 불가
  const permanentFailures: SendingFailureReason[] = [
    "INVALID_EMAIL",
    "INVALID_PHONE",
    "OPT_OUT",
    "BOUNCE",
  ];

  return !permanentFailures.includes(failureReason);
}

// ─────────────────────────────────────────────────────────────────
// 헬퍼: 재시도 스케줄링
// ─────────────────────────────────────────────────────────────────

const RETRY_DELAYS = [
  60 * 60 * 1000, // 1시간
  6 * 60 * 60 * 1000, // 6시간
  24 * 60 * 60 * 1000, // 24시간
];

async function scheduleRetry(
  sendingHistoryId: string,
  retryCount: number
): Promise<void> {
  try {
    if (retryCount >= RETRY_DELAYS.length) {
      // 최대 재시도 횟수 초과
      await db.sendingHistory.update({
        where: { id: sendingHistoryId },
        data: {
          status: "ABANDONED",
          updatedAt: new Date(),
        },
      });
      logger.info("[Wrapper] 재시도 최대 횟수 초과, ABANDONED 처리", { sendingHistoryId });
      return;
    }

    // 재시도 시간 계산 (Jitter ±10%)
    const base = RETRY_DELAYS[retryCount];
    const jitter = Math.random() * 0.2 * base - 0.1 * base;
    const nextRetryAt = new Date(Date.now() + base + jitter);

    await db.sendingHistory.update({
      where: { id: sendingHistoryId },
      data: {
        status: "RETRY_SCHEDULED",
        nextRetryAt,
        retryCount: retryCount + 1,
        updatedAt: new Date(),
      },
    });

    logger.info("[Wrapper] 재시도 스케줄링", {
      sendingHistoryId,
      nextRetryAt: nextRetryAt.toISOString(),
      retryCount: retryCount + 1,
    });
  } catch (err) {
    logger.error("[Wrapper] 재시도 스케줄링 실패", { sendingHistoryId, err });
  }
}

// Phase 3-β: P1-1 에러 매핑 함수 제거 (src/lib/services/error-mapper.ts에서 import)

// ─────────────────────────────────────────────────────────────────
// 헬퍼: Feature Flag (설정)
// ─────────────────────────────────────────────────────────────────

function getFeatureFlag(flagName: string): boolean {
  // TODO: lib/config/feature-flags.ts에서 로드
  // 임시: 환경변수 또는 DB에서 읽기
  const env = process.env[`FEATURE_${flagName}`] || "false";
  return env === "true";
}

/**
 * 테스트용: 로컬 실행
 * $ npx ts-node src/lib/services/contact-template-sender.ts
 */
if (require.main === module) {
  console.log("[ContactTemplateSender] 래퍼 함수 로드 완료");
}
