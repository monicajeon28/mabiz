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
// Phase 3-β: P2-3 에러 분류 import
import {
  mapAligoErrorToFailureReason,
  mapEmailErrorToFailureReason,
  classifyError,
  type ClassifiedError,
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
 * @param params - 발송 매개변수
 * @param params.contactId - 수신자 Contact ID
 * @param params.channel - 발송 채널 ("SMS" | "EMAIL")
 * @param params.messageBody - 메시지 본문 (SMS: 최대 140자, Email: HTML 가능)
 * @param params.messageSubject - 메시지 제목 (Email 전용)
 * @param params.organizationId - 조직 ID
 * @param params.campaignId - Campaign ID (발송 추적용, 선택적)
 * @param params.sourceType - 메시지 소스 타입 ("FUNNEL_SEQUENCE" | "AUTOMATION_RULE" | "CAMPAIGN")
 * @param params.sourceId - 소스 ID (campaignId 또는 manualId)
 * @param params.sourceName - 소스 이름 (Campaign 제목 또는 운영자명)
 * @param params.sendingType - SendingHistory용 타입 ("TEMPLATE" | "AUTOMATION" | "CAMPAIGN")
 * @param params.useExecutionLog - Feature Flag 오버라이드 (선택적, 기본값: 환경변수)
 * @returns {Promise<SendingResult>} 발송 결과 { status, failureReason, messageId, sendingHistoryId, executionLogId }
 * @throws 예외 없음 (error catch로 SYSTEM_ERROR 반환)
 *
 * @example
 * const result = await sendToContactByTemplate({
 *   contactId: "c123",
 *   channel: "EMAIL",
 *   messageBody: "환영합니다!",
 *   messageSubject: "회원가입 완료",
 *   organizationId: "org456",
 *   campaignId: "camp789",
 *   sourceType: "CAMPAIGN",
 *   sourceId: "camp789",
 *   sourceName: "신규 회원 환영",
 * });
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
        messageSubject: DEFAULT_SUBJECT || "안내드립니다",
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
      const executeMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
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
    // Phase 3-β: P2-3 에러 분류 적용
    const classified = classifyError(err);
    logger.error("[Wrapper] 발송 중 예외 발생", {
      contactId,
      channel,
      errorCategory: classified.category,
      errorMessage: classified.message,
      retryable: classified.retryable,
    });

    // 재시도 가능한 에러는 로그 레벨을 높임
    if (classified.retryable) {
      logger.warn("[Wrapper] 재시도 가능한 오류 (자동 재시도 권장)", {
        contactId,
        category: classified.category,
      });
    }

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

/**
 * Contact에게 SMS 발송 (Aligo 기반)
 *
 * 역할:
 * - 휴대폰 번호 유효성 검증
 * - SMS 설정 확인 (조직 레벨)
 * - Aligo API 호출 및 결과 매핑
 * - 에러 코드 → SendingFailureReason 변환
 *
 * @param params - SMS 발송 매개변수
 * @param params.contact - Contact 객체 { id, phone, email }
 * @param params.messageBody - 메시지 본문
 * @param params.organizationId - 조직 ID (SMS 설정 조회용)
 * @param params.contactId - Contact ID (로깅용)
 * @returns {Promise<{status, failureReason?, messageId?}>} 발송 결과
 * @returns {string} status - SendingStatus ("SENT" | "FAILED" | "SKIPPED")
 * @returns {SendingFailureReason} failureReason - 실패 사유 (실패 시에만)
 * @returns {string} messageId - Aligo 메시지 ID (성공 시에만)
 *
 * @internal 외부에서 직접 호출 금지, sendToContactByTemplate에서만 사용
 */
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

/**
 * Contact에게 Email 발송 (Funnel 채널)
 *
 * 역할:
 * - 이메일 주소 유효성 검증
 * - HTML 포매팅 (messageBody 감싸기)
 * - 이메일 제공자 API 호출 및 결과 매핑
 * - 에러 코드 → SendingFailureReason 변환
 *
 * @param params - Email 발송 매개변수
 * @param params.contact - Contact 객체 { id, phone, email }
 * @param params.messageBody - 메시지 본문 (평문, 내부에서 HTML로 변환)
 * @param params.messageSubject - 메시지 제목
 * @param params.organizationId - 조직 ID
 * @param params.contactId - Contact ID (로깅용)
 * @returns {Promise<{status, failureReason?, messageId?}>} 발송 결과
 * @returns {string} status - SendingStatus ("SENT" | "FAILED" | "SKIPPED")
 * @returns {SendingFailureReason} failureReason - 실패 사유 (실패 시에만)
 * @returns {string} messageId - 이메일 제공자 메시지 ID (성공 시에만)
 *
 * @internal 외부에서 직접 호출 금지, sendToContactByTemplate에서만 사용
 */
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
        messageId: undefined,
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

/**
 * 발송 이력을 SendingHistory 테이블에 기록
 *
 * 역할:
 * - 모든 발송 이벤트 (성공/실패/스킵) 기록
 * - 재시도 추적용 메타데이터 저장 (retryCount, nextRetryAt, maxRetries)
 * - 발송 통계/분석 데이터 수집
 *
 * @param params - SendingHistory 레코드 매개변수
 * @param params.contactId - 수신자 Contact ID
 * @param params.channel - 발송 채널 ("SMS" | "EMAIL")
 * @param params.status - 발송 상태 (SENT, FAILED, SKIPPED, RETRY_SCHEDULED, ABANDONED)
 * @param params.failureReason - 실패 사유 (실패 시에만)
 * @param params.organizationId - 조직 ID
 * @param params.campaignId - Campaign ID (선택적)
 * @param params.sendingType - 발송 타입 (TEMPLATE, AUTOMATION, CAMPAIGN)
 * @param params.messageBody - 메시지 본문 (스냅샷)
 * @param params.messageSubject - 메시지 제목 (Email 전용)
 * @param params.messageId - 발송자 메시지 ID (성공 시에만)
 * @param params.sentAt - 발송 시간 (성공 시에만)
 * @returns {Promise<string | undefined>} 생성된 SendingHistory ID (실패 시 undefined)
 *
 * @internal 발송 함수 내부에서만 호출
 */
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
        // 주의: phone/email snapshot은 Contact 조회 시점의 값을 저장
        // Phase 4에서 contact.phone/email 추가 예정
        phone: undefined,
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
// 함수 5: ExecutionLog 기록 (선택적, Feature Flag 기반)
// ─────────────────────────────────────────────────────────────────

/**
 * 자동화 발송 이력을 ExecutionLog 테이블에 기록 (Feature Flag)
 *
 * 역할:
 * - Feature Flag (ENABLE_EXECUTION_LOG_WRAPPER)가 활성화된 경우에만 호출
 * - SendingHistory와 다른 메타데이터 구조 (sourceType, sourceId, sourceName)
 * - SendingStatus → ExecutionStatus 변환 (enum-mapping.ts)
 * - 월별 분할 쿼리 최적화 (executeMonth 파티션)
 *
 * @param params - ExecutionLog 레코드 매개변수
 * @param params.contactId - 수신자 Contact ID
 * @param params.channel - 발송 채널 ("SMS" | "EMAIL")
 * @param params.status - 발송 상태 (SENT, FAILED, SKIPPED 등)
 * @param params.failureReason - 실패 사유 (실패 시에만)
 * @param params.organizationId - 조직 ID
 * @param params.campaignId - Campaign ID (선택적)
 * @param params.sourceType - 자동화 소스 타입 ("FUNNEL_SEQUENCE" | "AUTOMATION_RULE" | "CAMPAIGN")
 * @param params.sourceId - 자동화 소스 ID (campaignId 또는 automationRuleId)
 * @param params.sourceName - 자동화 소스 이름 (Campaign 제목, Rule 이름 등)
 * @param params.messageId - 발송자 메시지 ID (성공 시에만)
 * @param params.executeMonth - 실행 월 (YYYY-MM 포맷, 파티션용)
 * @param params.sentAt - 발송 시간 (성공 시에만)
 * @returns {Promise<string | undefined>} 생성된 ExecutionLog ID (실패 시 undefined)
 *
 * @internal 발송 함수 내부에서만 호출, Feature Flag 조건부
 */
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

/**
 * 환경변수 기반 Feature Flag 조회
 *
 * @param flagName - Feature Flag 이름 (ENABLE_EXECUTION_LOG_WRAPPER 등)
 * @returns {boolean} Feature Flag 활성화 여부
 *
 * @note 프로덕션에서는 lib/config/feature-flags.ts의 중앙화된 함수 사용 권장
 * @see src/lib/config/feature-flags.ts
 */
function getFeatureFlag(flagName: string): boolean {
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
