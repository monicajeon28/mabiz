# Phase 2 자동화 규칙 — 공유 실행 라이브러리 스펙

## 개요

**목표**: Phase 1 (퍼널 VipCareSequence) 과 Phase 2 (자동화 규칙 AutomationRule) 이 동일한 `ExecutionLog` 스키마와 공유 라이브러리를 사용하여 코드 중복 제거 및 일관된 발송 로직 제공.

**핵심 원칙**:
- Phase 1 VipCareSequence → ExecutionLog 마이그레이션 (sourceType="FUNNEL_SEQUENCE")
- Phase 2 AutomationRule → ExecutionLog 기록 (sourceType="AUTOMATION_RULE")
- 메시지 발송, 재시도, 실패 추적 로직을 공유 라이브러리로 일원화

---

## 디렉토리 구조

```
src/lib/execution/
  ├── constants.ts         — 상수 & 열거형
  ├── schemas.ts           — Zod 검증 스키마
  ├── executor.ts          — SMS/이메일 발송 (알리고, SMTP 래핑)
  ├── retry-handler.ts     — 재시도 로직 (CAS, 지수 백오프)
  ├── status-mapper.ts     — 기술 오류 → ExecutionFailureReason 매핑
  └── query-builder.ts     — ExecutionLog 쿼리 헬퍼
```

---

## 1. constants.ts — 상수 정의

### 열거형 & 설정값

```typescript
// Prisma enum 재정의 (타입 안정성)
export const EXECUTION_STATUS = {
  PENDING:         "PENDING",           // 발송 대기
  SENT:            "SENT",              // 발송 성공
  FAILED:          "FAILED",            // 발송 실패
  SKIPPED:         "SKIPPED",           // 조건 미충족 (opt-out, 야간 차단 등)
  RETRY_SCHEDULED: "RETRY_SCHEDULED",   // 재시도 예정
  ABANDONED:       "ABANDONED",         // 최대 재시도 초과
} as const;

export const FAILURE_REASON = {
  QUOTA_EXCEEDED:  "QUOTA_EXCEEDED",    // 일일/월간 발송 한도 초과
  INVALID_CONTACT: "INVALID_CONTACT",   // 유효하지 않은 번호/이메일
  OPT_OUT:         "OPT_OUT",           // 수신거부 고객
  SYSTEM_ERROR:    "SYSTEM_ERROR",      // CRM 내부 오류
  PROVIDER_ERROR:  "PROVIDER_ERROR",    // SMS/이메일 서비스 오류
} as const;

export const CHANNELS = {
  SMS:   "SMS",
  EMAIL: "EMAIL",
  KAKAO: "KAKAO",    // 향후 확장용
} as const;

export const MAX_RETRIES = 3;

// 재시도 간격 (지수 백오프)
export const RETRY_INTERVALS_MS = [
  5 * 60 * 1000,      // 1차 재시도: 5분 후
  60 * 60 * 1000,     // 2차 재시도: 1시간 후
  24 * 60 * 60 * 1000, // 3차 재시도: 24시간 후
] as const;

// 월별 반복 발송 설정
export const MONTHLY_REPEAT_CONFIGS = {
  ONCE:    "ONCE",           // 1회만 (퍼널 등)
  MONTHLY: "MONTHLY",        // 매달 반복
  YEARLY:  "YEARLY",         // 매년 반복 (생일 등)
} as const;

// PII 마스킹
export const MASK_PHONE = (phone: string) =>
  phone.substring(0, 4) + "***" + phone.substring(phone.length - 4);

export const MASK_EMAIL = (email: string) => {
  const [local, domain] = email.split("@");
  return local.substring(0, 2) + "***@" + domain;
};

// 야간 차단 시간 (KST 기준)
export const NIGHT_BLOCKED_START = 21; // 21:00
export const NIGHT_BLOCKED_END = 8;    // 08:00
```

---

## 2. schemas.ts — Zod 검증

### 입출력 스키마

```typescript
import { z } from "zod";
import { EXECUTION_STATUS, FAILURE_REASON, CHANNELS } from "./constants";

export const ExecutionStatusSchema = z.enum(
  Object.values(EXECUTION_STATUS) as [string, ...string[]]
);

export const ExecutionFailureReasonSchema = z.enum(
  Object.values(FAILURE_REASON) as [string, ...string[]]
).nullable();

export const ChannelSchema = z.enum(
  Object.values(CHANNELS) as [string, ...string[]]
);

// 전체 ExecutionLog 검증 (DB 읽기)
export const ExecutionLogSchema = z.object({
  id:               z.string().cuid(),
  organizationId:   z.string().cuid(),
  sourceType:       z.enum(["FUNNEL_SEQUENCE", "AUTOMATION_RULE"]),
  sourceId:         z.string(),
  sourceName:       z.string(),
  contactId:        z.string().cuid(),
  channel:          ChannelSchema,
  status:           ExecutionStatusSchema,
  executeMonth:     z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  scheduledAt:      z.date(),
  sentAt:           z.date().nullable(),
  nextRetryAt:      z.date().nullable(),
  contentUrl:       z.string().url().nullable(),
  failureReason:    ExecutionFailureReasonSchema,
  failureUserMsg:   z.string().nullable(),
  retryCount:       z.number().int().min(0),
  maxRetries:       z.number().int().min(0),
  createdAt:        z.date(),
  updatedAt:        z.date(),
});

// 생성 시 (필드 제한)
export const CreateExecutionLogSchema = z.object({
  organizationId:   z.string().cuid(),
  sourceType:       z.enum(["FUNNEL_SEQUENCE", "AUTOMATION_RULE"]),
  sourceId:         z.string(),
  sourceName:       z.string(),
  contactId:        z.string().cuid(),
  channel:          ChannelSchema,
  executeMonth:     z.string().regex(/^\d{4}-\d{2}$/),
  scheduledAt:      z.date(),
  contentUrl:       z.string().url().nullable().optional(),
  maxRetries:       z.number().int().min(1).default(3),
});

// 상태 업데이트 (부분 검증)
export const UpdateExecutionLogSchema = z.object({
  status:           ExecutionStatusSchema.optional(),
  failureReason:    ExecutionFailureReasonSchema.optional(),
  failureUserMsg:   z.string().optional(),
  sentAt:           z.date().optional(),
  nextRetryAt:      z.date().optional(),
  retryCount:       z.number().int().min(0).optional(),
});

export type ExecutionLog = z.infer<typeof ExecutionLogSchema>;
export type CreateExecutionLogInput = z.infer<typeof CreateExecutionLogSchema>;
export type UpdateExecutionLogInput = z.infer<typeof UpdateExecutionLogSchema>;
```

---

## 3. executor.ts — SMS/이메일 발송 실행기

### 함수 시그니처 및 구현

```typescript
import { logger } from "@/lib/logger";
import { sendSms as aligoSendSms, getOrgSmsConfig } from "@/lib/aligo";
import { sendEmail as smtpSendEmail, getOrgEmailConfig, decryptSmtpPassword } from "@/lib/email";
import { FAILURE_REASON, CHANNELS } from "./constants";
import { mapFailure } from "./status-mapper";

export type ExecutionResult = {
  success: boolean;
  msgId?: string;
  failureReason?: string; // ExecutionFailureReason
  userMsg?: string;       // UI 표시용 한국어 메시지
  error?: unknown;
};

/**
 * SMS 발송 (알리고 라이브러리 래핑)
 *
 * @param opts.phone - 수신 전화번호 (검증 필요)
 * @param opts.message - 메시지 내용
 * @param opts.organizationId - 조직 ID (SMS 설정 조회용)
 * @param opts.idempotencyKey - 중복 방지 키 (로그 조회)
 * @returns { success, msgId?, failureReason?, userMsg? }
 *
 * 오류 처리:
 * - result_code === 1: 발송 성공
 * - result_code === -99: 수신거부 (OPT_OUT)
 * - result_code === -98: 야간 차단 (SKIPPED)
 * - result_code === -20: 한도 초과 (QUOTA_EXCEEDED, RETRY)
 * - 기타: PROVIDER_ERROR (재시도 권장)
 */
export async function sendSms(opts: {
  phone: string;
  message: string;
  organizationId: string;
  idempotencyKey?: string; // "exec-log-xyz" 형식
}): Promise<ExecutionResult> {
  const { phone, message, organizationId, idempotencyKey } = opts;

  try {
    // 1. SMS 설정 조회
    const smsConfig = await getOrgSmsConfig(organizationId);
    if (!smsConfig?.isActive) {
      return {
        success: false,
        failureReason: FAILURE_REASON.SYSTEM_ERROR,
        userMsg: "SMS 서비스가 활성화되지 않았습니다",
      };
    }

    // 2. 알리고 API 호출
    const result = await aligoSendSms({
      config: {
        key: smsConfig.aligoKey,
        userId: smsConfig.aligoUserId,
        sender: smsConfig.senderPhone,
      },
      receiver: phone,
      msg: message,
      organizationId,
      channel: "EXECUTION",
    });

    // 3. 응답 코드 매핑
    const code = Number(result.result_code);
    if (code === 1) {
      logger.log("[Executor] SMS 발송 성공", {
        phone: MASK_PHONE(phone),
        msgId: result.msg_id,
      });
      return { success: true, msgId: result.msg_id };
    }

    // 4. 오류 코드 해석
    const { reason, userMsg } = mapFailure({
      code: String(code),
      message: result.message,
      source: "ALIGO",
    });

    logger.warn("[Executor] SMS 발송 실패", {
      phone: MASK_PHONE(phone),
      code,
      reason,
    });

    return { success: false, failureReason: reason, userMsg };
  } catch (err) {
    logger.error("[Executor] SMS 발송 예외", { err });
    return {
      success: false,
      failureReason: FAILURE_REASON.SYSTEM_ERROR,
      userMsg: "시스템 오류가 발생했습니다",
      error: err,
    };
  }
}

/**
 * 이메일 발송 (SMTP 래핑)
 *
 * @param opts.email - 수신 이메일 주소
 * @param opts.subject - 제목
 * @param opts.htmlBody - HTML 바디
 * @param opts.organizationId - 조직 ID (SMTP 설정 조회용)
 * @param opts.idempotencyKey - 중복 방지 키
 * @returns { success, msgId?, failureReason?, userMsg? }
 *
 * 오류 처리:
 * - 발송 성공: success=true
 * - 메일박스 가득찬 경우: QUOTA_EXCEEDED (재시도)
 * - 잘못된 주소: INVALID_CONTACT (ABANDONED)
 * - SMTP 설정 오류: SYSTEM_ERROR
 * - 네트워크 오류: PROVIDER_ERROR (재시도)
 */
export async function sendEmail(opts: {
  email: string;
  subject: string;
  htmlBody: string;
  organizationId: string;
  idempotencyKey?: string;
}): Promise<ExecutionResult> {
  const { email, subject, htmlBody, organizationId, idempotencyKey } = opts;

  try {
    // 1. 이메일 설정 조회
    const emailConfig = await getOrgEmailConfig(organizationId);
    if (!emailConfig?.isActive) {
      return {
        success: false,
        failureReason: FAILURE_REASON.SYSTEM_ERROR,
        userMsg: "이메일 서비스가 활성화되지 않았습니다",
      };
    }

    // 2. SMTP 발송
    const success = await smtpSendEmail({
      smtpHost: emailConfig.smtpHost,
      smtpPort: emailConfig.smtpPort,
      smtpUser: emailConfig.smtpUser,
      smtpPassEncrypted: emailConfig.smtpPassEncrypted,
      senderName: emailConfig.senderName,
      senderEmail: emailConfig.senderEmail,
      to: email,
      subject,
      html: htmlBody,
    });

    if (success) {
      logger.log("[Executor] 이메일 발송 성공", {
        email: MASK_EMAIL(email),
        subject,
      });
      return { success: true };
    } else {
      // SMTP 발송 실패 (상세 오류는 email.ts 로그에서 추적)
      return {
        success: false,
        failureReason: FAILURE_REASON.PROVIDER_ERROR,
        userMsg: "이메일 발송에 실패했습니다",
      };
    }
  } catch (err) {
    logger.error("[Executor] 이메일 발송 예외", { err });
    return {
      success: false,
      failureReason: FAILURE_REASON.SYSTEM_ERROR,
      userMsg: "시스템 오류가 발생했습니다",
      error: err,
    };
  }
}

/**
 * 채널별 발송 통합 함수
 */
export async function sendByChannel(opts: {
  channel: "SMS" | "EMAIL";
  phone?: string;
  email?: string;
  message?: string; // SMS 메시지
  subject?: string; // 이메일 제목
  htmlBody?: string; // 이메일 본문
  organizationId: string;
  idempotencyKey?: string;
}): Promise<ExecutionResult> {
  const { channel } = opts;

  switch (channel) {
    case CHANNELS.SMS:
      if (!opts.phone || !opts.message) {
        return {
          success: false,
          failureReason: FAILURE_REASON.INVALID_CONTACT,
          userMsg: "전화번호 또는 메시지가 누락되었습니다",
        };
      }
      return sendSms({
        phone: opts.phone,
        message: opts.message,
        organizationId: opts.organizationId,
        idempotencyKey: opts.idempotencyKey,
      });

    case CHANNELS.EMAIL:
      if (!opts.email || !opts.subject || !opts.htmlBody) {
        return {
          success: false,
          failureReason: FAILURE_REASON.INVALID_CONTACT,
          userMsg: "이메일, 제목 또는 본문이 누락되었습니다",
        };
      }
      return sendEmail({
        email: opts.email,
        subject: opts.subject,
        htmlBody: opts.htmlBody,
        organizationId: opts.organizationId,
        idempotencyKey: opts.idempotencyKey,
      });

    default:
      return {
        success: false,
        failureReason: FAILURE_REASON.SYSTEM_ERROR,
        userMsg: "지원하지 않는 채널입니다",
      };
  }
}
```

---

## 4. retry-handler.ts — 재시도 로직

### 재시도 판단 & 스케줄링

```typescript
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { MAX_RETRIES, RETRY_INTERVALS_MS, EXECUTION_STATUS, FAILURE_REASON } from "./constants";

export type ExecutionLog = {
  id: string;
  status: string;
  failureReason?: string | null;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date | null;
};

/**
 * 재시도 가능 여부 판단
 *
 * @param log - ExecutionLog 레코드
 * @returns 재시도 가능 시 true
 *
 * 규칙:
 * - OPT_OUT, INVALID_CONTACT → 재시도 불가 (ABANDONED)
 * - QUOTA_EXCEEDED, PROVIDER_ERROR → 재시도 가능
 * - 최대 재시도 초과 → 재시도 불가 (ABANDONED)
 */
export function shouldRetry(log: ExecutionLog): boolean {
  // 재시도 불가능한 사유
  const noRetryReasons = [
    FAILURE_REASON.OPT_OUT,
    FAILURE_REASON.INVALID_CONTACT,
  ];

  if (noRetryReasons.includes(log.failureReason)) {
    return false;
  }

  // 최대 재시도 초과
  if (log.retryCount >= log.maxRetries) {
    return false;
  }

  return true;
}

/**
 * 다음 재시도 예정시간 계산 (지수 백오프)
 *
 * @param retryCount - 현재 재시도 횟수 (0-based)
 * @returns 다음 재시도 예정시간
 *
 * 예시:
 * - retryCount=0 → 5분 후
 * - retryCount=1 → 1시간 후
 * - retryCount=2 → 24시간 후
 */
export function calculateNextRetryAt(retryCount: number): Date {
  const intervalMs = RETRY_INTERVALS_MS[Math.min(retryCount, RETRY_INTERVALS_MS.length - 1)];
  const nextRetryAt = new Date();
  nextRetryAt.setTime(nextRetryAt.getTime() + intervalMs);
  return nextRetryAt;
}

/**
 * 재시도 작업 등록 (큐 또는 스케줄러)
 *
 * @param logId - ExecutionLog ID
 *
 * Phase 1: Vercel Cron 또는 Redis Queue 사용
 * Phase 2: AutomationRule 재시도도 동일 메커니즘 사용
 */
export async function enqueueRetry(logId: string): Promise<void> {
  try {
    const log = await prisma.executionLog.findUnique({
      where: { id: logId },
      select: {
        id: true,
        status: true,
        failureReason: true,
        retryCount: true,
        maxRetries: true,
      },
    });

    if (!log) {
      logger.warn("[RetryHandler] ExecutionLog를 찾을 수 없음", { logId });
      return;
    }

    if (!shouldRetry(log)) {
      // ABANDONED 처리
      await prisma.executionLog.update({
        where: { id: logId },
        data: { status: EXECUTION_STATUS.ABANDONED },
      });
      logger.log("[RetryHandler] 재시도 중단 (최대 초과 또는 불가능한 오류)", { logId });
      return;
    }

    // 다음 재시도 예정시간 계산
    const nextRetryAt = calculateNextRetryAt(log.retryCount);

    // CAS (Compare-And-Swap): FAILED → RETRY_SCHEDULED
    const updated = await prisma.executionLog.updateMany({
      where: {
        id: logId,
        status: EXECUTION_STATUS.FAILED,
      },
      data: {
        status: EXECUTION_STATUS.RETRY_SCHEDULED,
        nextRetryAt,
        retryCount: { increment: 1 }, // 재시도 카운트 증가
      },
    });

    if (updated.count === 0) {
      logger.warn("[RetryHandler] CAS 실패 (상태가 이미 변경됨)", { logId });
      return;
    }

    logger.log("[RetryHandler] 재시도 예정됨", {
      logId,
      nextRetryAt: nextRetryAt.toISOString(),
      retryCount: log.retryCount + 1,
    });

    // Redis Queue 또는 Vercel Cron에서 RETRY_SCHEDULED 레코드를 처리
    // (Phase 1: /api/cron/vip-care와 동일 로직)
  } catch (err) {
    logger.error("[RetryHandler] 재시도 등록 실패", { err, logId });
  }
}
```

---

## 5. status-mapper.ts — 오류 코드 매핑

### 기술 코드 → 사용자 메시지

```typescript
import { FAILURE_REASON } from "./constants";

export type TechError = {
  code: string;      // 알리고 API 코드 또는 SMTP 에러 코드
  message: string;
  source: "ALIGO" | "SMTP" | "INTERNAL";
};

export type FailureMapping = {
  reason: string; // ExecutionFailureReason enum 값
  userMsg: string; // UI 표시용 한국어 메시지
};

/**
 * 기술 오류 코드 → ExecutionFailureReason + 사용자 친화 메시지
 *
 * 알리고 API 응답 코드:
 * - 1: 성공
 * - -98: 야간 차단 (21:00~08:00)
 * - -99: 수신거부
 * - -20: 일일/월간 한도 초과
 * - -1: 기타 오류
 *
 * SMTP 오류:
 * - ECONNREFUSED: 연결 거부
 * - EHOSTUNREACH: 호스트 도달 불가
 * - 550: 유효하지 않은 주소
 * - 452: 메일함 가득 참
 */
export function mapFailure(err: TechError): FailureMapping {
  const { code, message, source } = err;

  if (source === "ALIGO") {
    const numCode = Number(code);
    switch (numCode) {
      case 1:
        return {
          reason: FAILURE_REASON.SYSTEM_ERROR, // 발송 성공 (호출 오류)
          userMsg: "예상치 못한 응답",
        };
      case -98:
        return {
          reason: "SKIPPED", // SKIPPED는 enum에 없음 — status로 처리
          userMsg: "야간 차단 시간입니다 (21:00~08:00)",
        };
      case -99:
        return {
          reason: FAILURE_REASON.OPT_OUT,
          userMsg: "수신거부 고객입니다",
        };
      case -20:
        return {
          reason: FAILURE_REASON.QUOTA_EXCEEDED,
          userMsg: "일일/월간 발송 한도를 초과했습니다",
        };
      default:
        return {
          reason: FAILURE_REASON.PROVIDER_ERROR,
          userMsg: `알리고 서버 오류: ${message || "알 수 없음"}`,
        };
    }
  }

  if (source === "SMTP") {
    if (code.includes("ECONNREFUSED") || code.includes("EHOSTUNREACH")) {
      return {
        reason: FAILURE_REASON.PROVIDER_ERROR,
        userMsg: "메일 서버에 연결할 수 없습니다",
      };
    }
    if (code.includes("550")) {
      return {
        reason: FAILURE_REASON.INVALID_CONTACT,
        userMsg: "유효하지 않은 이메일 주소입니다",
      };
    }
    if (code.includes("452")) {
      return {
        reason: FAILURE_REASON.QUOTA_EXCEEDED,
        userMsg: "메일서버 용량 초과, 나중에 다시 시도해주세요",
      };
    }
    return {
      reason: FAILURE_REASON.PROVIDER_ERROR,
      userMsg: `메일 발송 오류: ${message || "알 수 없음"}`,
    };
  }

  // INTERNAL 오류
  return {
    reason: FAILURE_REASON.SYSTEM_ERROR,
    userMsg: "시스템 오류가 발생했습니다",
  };
}
```

---

## 6. query-builder.ts — ExecutionLog 쿼리 헬퍼

### DB 조회 및 상태 업데이트

```typescript
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { EXECUTION_STATUS } from "./constants";

export type ExecutionLogRecord = {
  id: string;
  organizationId: string;
  sourceType: string;
  sourceId: string;
  contactId: string;
  channel: string;
  status: string;
  executeMonth: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  nextRetryAt?: Date | null;
  failureReason?: string | null;
  retryCount: number;
  maxRetries: number;
};

/**
 * 발송 대기 중인 ExecutionLog 조회 (페이징)
 *
 * @param orgId - 조직 ID
 * @param limit - 페이지 크기 (기본 100)
 * @param sourceType - FUNNEL_SEQUENCE | AUTOMATION_RULE (선택)
 * @returns 발송 대기 레코드 배열
 *
 * 조회 조건:
 * - status = PENDING
 * - scheduledAt ≤ now()
 * - organizationId = orgId (조직 데이터 격리)
 */
export async function getPendingExecutions(
  orgId: string,
  limit: number = 100,
  sourceType?: string
): Promise<ExecutionLogRecord[]> {
  try {
    const logs = await prisma.executionLog.findMany({
      where: {
        organizationId: orgId,
        status: EXECUTION_STATUS.PENDING,
        scheduledAt: { lte: new Date() },
        ...(sourceType && { sourceType }),
      },
      take: limit,
      orderBy: { scheduledAt: "asc" },
    });
    return logs;
  } catch (err) {
    logger.error("[QueryBuilder] getPendingExecutions 실패", { err, orgId });
    throw err;
  }
}

/**
 * 상태별 ExecutionLog 조회
 *
 * @param orgId - 조직 ID
 * @param status - PENDING | SENT | FAILED | RETRY_SCHEDULED | ABANDONED
 * @returns 해당 상태의 레코드 배열
 */
export async function getExecutionsByStatus(
  orgId: string,
  status: string,
  limit: number = 100
): Promise<ExecutionLogRecord[]> {
  try {
    const logs = await prisma.executionLog.findMany({
      where: {
        organizationId: orgId,
        status,
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    return logs;
  } catch (err) {
    logger.error("[QueryBuilder] getExecutionsByStatus 실패", { err, orgId, status });
    throw err;
  }
}

/**
 * 발송 중 상태로 원자적 전환 (CAS)
 *
 * @param id - ExecutionLog ID
 * @returns 업데이트 성공 시 true
 *
 * 용도:
 * - 다중 워커가 동일 레코드를 중복 처리하지 않도록 방지
 * - PENDING → SENDING 원자적 전환
 */
export async function markAsRunning(id: string): Promise<boolean> {
  try {
    const updated = await prisma.executionLog.updateMany({
      where: {
        id,
        status: EXECUTION_STATUS.PENDING,
      },
      data: { status: "SENDING" }, // 임시 상태 (실제 enum은 PENDING → SENT/FAILED)
    });
    return updated.count > 0;
  } catch (err) {
    logger.error("[QueryBuilder] markAsRunning 실패", { err, id });
    return false;
  }
}

/**
 * 발송 결과 기록
 *
 * @param id - ExecutionLog ID
 * @param result - { status, failureReason?, failureUserMsg?, sentAt? }
 *
 * 호출 시점:
 * - sendSms / sendEmail 완료 후
 * - 재시도 로직 전 또는 후
 */
export async function recordResult(
  id: string,
  result: {
    status: string; // SENT | FAILED | SKIPPED | RETRY_SCHEDULED | ABANDONED
    failureReason?: string | null;
    failureUserMsg?: string | null;
    sentAt?: Date;
    nextRetryAt?: Date | null;
    retryCount?: number;
  }
): Promise<void> {
  try {
    await prisma.executionLog.update({
      where: { id },
      data: {
        status: result.status,
        failureReason: result.failureReason ?? undefined,
        failureUserMsg: result.failureUserMsg ?? undefined,
        sentAt: result.sentAt ?? undefined,
        nextRetryAt: result.nextRetryAt ?? undefined,
        retryCount: result.retryCount ?? undefined,
        updatedAt: new Date(),
      },
    });

    logger.log("[QueryBuilder] 발송 결과 기록", {
      id,
      status: result.status,
    });
  } catch (err) {
    logger.error("[QueryBuilder] recordResult 실패", { err, id });
    throw err;
  }
}

/**
 * 월별 중복 확인 (Upsert 방지)
 *
 * @param orgId - 조직 ID
 * @param sourceType - FUNNEL_SEQUENCE | AUTOMATION_RULE
 * @param sourceId - 규칙/시퀀스 ID
 * @param contactId - 고객 ID
 * @param executeMonth - YYYY-MM
 * @returns 해당 월에 이미 기록이 있으면 true
 *
 * 데이터베이스에 UNIQUE 제약 조건이 있으므로 사전 확인 권장
 */
export async function existsForMonth(
  orgId: string,
  sourceType: string,
  sourceId: string,
  contactId: string,
  executeMonth: string
): Promise<boolean> {
  try {
    const log = await prisma.executionLog.findFirst({
      where: {
        organizationId: orgId,
        sourceType,
        sourceId,
        contactId,
        executeMonth,
      },
      select: { id: true },
    });
    return !!log;
  } catch (err) {
    logger.error("[QueryBuilder] existsForMonth 실패", { err });
    throw err;
  }
}
```

---

## 보안 고려사항

### 1. 조직 데이터 격리 (organizationId 필터링)

모든 쿼리에서 `organizationId` 조건을 필수로 포함합니다. 미포함 시 데이터 유출 위험:

```typescript
// ❌ 위험
const logs = await prisma.executionLog.findMany({
  where: { status: EXECUTION_STATUS.PENDING }
});

// ✅ 안전
const logs = await prisma.executionLog.findMany({
  where: { organizationId: orgId, status: EXECUTION_STATUS.PENDING }
});
```

### 2. PII 마스킹 (로그 기록)

민감한 정보를 로그에 기록할 때 마스킹합니다:

```typescript
logger.log("[Executor] SMS 발송", {
  phone: MASK_PHONE(contact.phone),    // "01012***345"
  email: MASK_EMAIL(contact.email),    // "john***@example.com"
});
```

### 3. 입력 검증 (Zod 스키마)

모든 입력값을 Zod로 검증하여 타입 안전성 보장:

```typescript
const validated = CreateExecutionLogSchema.parse(input);
```

---

## 테스트 전략

### Phase 1 (퍼널) 테스트 케이스

```typescript
// Case 1: 정상 SMS 발송
// Case 2: 야간 차단 (scheduledAt이 21:00~08:00)
// Case 3: 수신거부 고객 (OPT_OUT)
// Case 4: 일일 한도 초과 (QUOTA_EXCEEDED → RETRY_SCHEDULED)
// Case 5: 최대 재시도 초과 (ABANDONED)
// Case 6: 이메일 발송 (SMTP)
// Case 7: 중복 등록 방지 (UNIQUE 제약 조건)
```

### Phase 2 (자동화 규칙) 테스트 케이스

```typescript
// Case 8: AutomationRule 발송 (sourceType="AUTOMATION_RULE")
// Case 9: 조건부 발송 (조건 미충족 → SKIPPED)
// Case 10: 월별 반복 (executeMonth 기반 중복 방지)
// Case 11: 재시도 지수 백오프 (5분 → 1시간 → 24시간)
// Case 12: 동시성 테스트 (여러 워커가 동일 레코드 처리)
```

---

## 마이그레이션 & 적용 일정

- **Phase 1 (현재)**: VipCareLog → ExecutionLog 마이그레이션, 공유 라이브러리 구현
- **Phase 2 (다음)**: AutomationRule 모델 추가, Phase 2 자동화 규칙 발송 구현
- **Phase 3**: 재시도 CronJob 또는 Redis Queue 통합

---

## 참고 파일

- `/prisma/schema.prisma` — ExecutionLog, ExecutionStatus, ExecutionFailureReason 모델
- `/src/app/api/cron/vip-care/route.ts` — Phase 1 구현 (배치 처리, 중복 방지, CAS)
- `/src/lib/aligo.ts` — 알리고 API 래핑
- `/src/lib/email.ts` — SMTP 래핑
