# Phase 1 — 퍼널 문자 자동화 (8시간 예상)

아키텍처: **ExecutionLog 통합** 방식으로 VipCareSequence → 발송 로직을 리팩토링.
기존 Funnel/VipCareSequence 유지하면서 ExecutionLog에 모든 발송 기록을 남김.

---

## 1. DB 스키마 (변경 없음, 통합만)

**기존 모델 유지:**
- `VipCareSequence` — 고객별 시퀀스 진행 상태 (ACTIVE/PAUSED/COMPLETED)
- `VipCareLog` — 단계별 발송 계획 (PENDING → SENT/FAILED)
- `Funnel` — 발송 템플릿 정의
- `ExecutionLog` — Phase 0에서 추가된 통합 발송 기록 (✅ 스키마 완성)

**통합 방식:**
```
VipCareLog INSERT/UPDATE 시
  ↓
  ExecutionLog도 동시 INSERT (sourceType: "FUNNEL_SEQUENCE")
```

**ExecutionLog 필드 매핑:**
| VipCareLog | ExecutionLog | 설명 |
|-----------|-------------|------|
| sequenceId | sourceId | VipCareSequence ID |
| (고정) | sourceType | "FUNNEL_SEQUENCE" |
| (시퀀스명) | sourceName | "VIP_CARE_SEQ_[고객명]" (발송시점 스냅샷) |
| (Contact FK) | contactId | sequence.contact.id |
| channel | channel | "SMS" or "EMAIL" |
| status | status | PENDING → SENT/FAILED/ABANDONED |
| scheduledAt | scheduledAt | 발송 예정 시각 |
| sentAt | sentAt | 실제 발송 시각 (null: 아직) |
| content | contentUrl | S3 URL (선택: 로그량 많으면 생략) |
| - | failureReason | ExecutionFailureReason (enum) |
| - | failureUserMsg | "일일 발송 한도 초과" (사용자 친화 메시지) |
| - | retryCount | 재시도 횟수 (0부터) |
| - | maxRetries | 3 (기본값) |

**제약사항:**
- `@@unique([sourceType, sourceId, contactId, executeMonth])` → 월별 중복 발송 방지
- Index: `idx_execution_cron_scan` (organizationId, status, scheduledAt)

---

## 2. Cron 라우트 수정

### 2.1 `/api/cron/vip-care/route.ts` — 기존 로직 확장

**기존 동작:**
- VipCareLog: PENDING → SENT/FAILED 상태 전환
- 발송 결과를 SmsLog (Redis 큐)에 기록

**신규 동작:**
```typescript
// 기존 코드 후 (150줄 근처)
for (const log of logs) {
  // ... 기존 발송 로직 ...
  const result = await sendByChannel(...);
  
  // [신규] ExecutionLog 동시 기록
  if (result.success) {
    await createExecutionLog({
      organizationId: contact.organizationId,
      sourceType: "FUNNEL_SEQUENCE",
      sourceId: log.sequenceId,
      sourceName: `VIP_CARE_${contact.id}`, // 스냅샷
      contactId: contact.id,
      channel: log.channel,
      status: "SENT",
      executeMonth: getExecuteMonth(log.scheduledAt), // "2025-01"
      sentAt: new Date(),
      failureReason: null,
    });
  } else {
    // 실패 시
    await createExecutionLog({
      organizationId: contact.organizationId,
      sourceType: "FUNNEL_SEQUENCE",
      sourceId: log.sequenceId,
      sourceName: `VIP_CARE_${contact.id}`,
      contactId: contact.id,
      channel: log.channel,
      status: result.retryable ? "RETRY_SCHEDULED" : "FAILED",
      failureReason: mapErrorToReason(result.error),
      failureUserMsg: mapErrorToUserMsg(result.error),
      retryCount: log.retryCount + 1,
    });
  }
}
```

**주요 변경:**
- 낙관적 잠금: `UPDATE VipCareLog SET status = 'SENDING' WHERE id = ? AND status = 'PENDING'`
- 재시도: nextRetryAt 계산 (지수 백오프: 5분 → 30분 → 2시간)
- 상태 흐름: PENDING → SENT/FAILED/RETRY_SCHEDULED/ABANDONED

---

## 3. API 라우트 (1개 신규)

### 3.1 `/api/funnel-executions/route.ts` — ExecutionLog 조회 (신규)

**목적:** 대시보드에서 발송 기록을 조회하는 공개 API

**구현:**

```typescript
// src/app/api/funnel-executions/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateUserOrg } from "@/lib/auth"; // 조직 권한 검증

export async function GET(req: Request) {
  // IDOR 방지: 조직 권한 검증
  const { organizationId } = await validateUserOrg(req);
  if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // PENDING, SENT, FAILED, null
  const contactId = url.searchParams.get("contactId");
  const sourceId = url.searchParams.get("sourceId");
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = 50;

  // 화이트리스트: status 검증 (Query Injection 방지)
  const validStatuses = ["PENDING", "SENT", "FAILED", "RETRY_SCHEDULED", "ABANDONED"];
  const statusFilter = status && validStatuses.includes(status) ? status : null;

  const where: any = { organizationId };
  if (statusFilter) where.status = statusFilter;
  if (contactId) where.contactId = contactId;
  if (sourceId) where.sourceId = sourceId;

  const [logs, total] = await Promise.all([
    prisma.executionLog.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        // Contact는 PII이므로 이름만 (마스킹)
        // contact: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.executionLog.count({ where }),
  ]);

  // PII 마스킹: contactId만 노출 (이름은 불필요)
  const masked = logs.map(log => ({
    id: log.id,
    sourceType: log.sourceType,
    sourceName: log.sourceName,
    contactId: log.contactId, // UI에서 Contact 이름 조회는 별도 API
    channel: log.channel,
    status: log.status,
    sentAt: log.sentAt,
    failureUserMsg: log.failureUserMsg, // UI 표시용
    retryCount: log.retryCount,
  }));

  return NextResponse.json({
    data: masked,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
```

**Zod 검증:**
```typescript
import { z } from "zod";

const ExecutionLogQuerySchema = z.object({
  status: z.enum(["PENDING", "SENT", "FAILED", "RETRY_SCHEDULED", "ABANDONED"]).optional(),
  contactId: z.string().cuid().optional(),
  sourceId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
});
```

**성능:**
- Index `idx_execution_cron_scan` 활용
- 한 번에 50건 페이지네이션
- COUNT 쿼리 병렬 실행

---

## 4. 라이브러리 모듈 (src/lib/funnel/)

### 4.1 `src/lib/funnel/executor.ts` — 발송 실행

**목적:** SMS/이메일 발송 추상화 + ExecutionLog 기록

```typescript
import { sendSms, getOrgSmsConfig } from "@/lib/aligo";
import { sendEmail, getOrgEmailConfig } from "@/lib/email";
import { ExecutionFailureReason, ExecutionStatus } from "@prisma/client";

export interface ExecutionResult {
  success: boolean;
  status: ExecutionStatus;
  failureReason?: ExecutionFailureReason;
  failureUserMsg?: string;
  retryable: boolean;
  sentAt?: Date;
}

export async function executeMessage(params: {
  organizationId: string;
  contactId: string;
  channel: "SMS" | "EMAIL";
  phoneOrEmail: string;
  messageContent: string;
  messageTitle?: string;
}): Promise<ExecutionResult> {
  const { organizationId, channel, phoneOrEmail, messageContent, messageTitle } = params;

  try {
    if (channel === "SMS") {
      const smsConfig = await getOrgSmsConfig(organizationId);
      if (!smsConfig?.isActive) {
        return {
          success: false,
          status: "FAILED",
          failureReason: "SYSTEM_ERROR",
          failureUserMsg: "SMS 설정이 비활성화됨",
          retryable: false,
        };
      }

      const result = await sendSms({
        config: { key: smsConfig.aligoKey, userId: smsConfig.aligoUserId, sender: smsConfig.senderPhone },
        receiver: phoneOrEmail,
        msg: messageContent,
        msgType: messageTitle ? "LMS" : "SMS",
        organizationId,
      });

      if (result.result_code === 0) {
        return { success: true, status: "SENT", retryable: false, sentAt: new Date() };
      } else {
        const { reason, userMsg, retryable } = mapAligoError(result.result_code);
        return {
          success: false,
          status: retryable ? "RETRY_SCHEDULED" : "FAILED",
          failureReason: reason,
          failureUserMsg: userMsg,
          retryable,
        };
      }
    } else {
      // EMAIL
      const emailConfig = await getOrgEmailConfig(organizationId);
      if (!emailConfig?.isActive) {
        return {
          success: false,
          status: "FAILED",
          failureReason: "SYSTEM_ERROR",
          failureUserMsg: "이메일 설정이 비활성화됨",
          retryable: false,
        };
      }

      const success = await sendEmail({
        smtpHost: emailConfig.smtpHost,
        smtpPort: emailConfig.smtpPort,
        smtpUser: emailConfig.smtpUser,
        smtpPassEncrypted: emailConfig.smtpPassEncrypted,
        senderName: emailConfig.senderName,
        senderEmail: emailConfig.senderEmail,
        to: phoneOrEmail,
        subject: messageTitle || "알림",
        html: messageContent,
      });

      if (success) {
        return { success: true, status: "SENT", retryable: false, sentAt: new Date() };
      } else {
        return {
          success: false,
          status: "RETRY_SCHEDULED",
          failureReason: "PROVIDER_ERROR",
          failureUserMsg: "이메일 서버 오류 (재시도 예정)",
          retryable: true,
        };
      }
    }
  } catch (err) {
    return {
      success: false,
      status: "FAILED",
      failureReason: "SYSTEM_ERROR",
      failureUserMsg: "발송 중 오류 발생",
      retryable: false,
    };
  }
}

function mapAligoError(code: number): { reason: ExecutionFailureReason; userMsg: string; retryable: boolean } {
  // Aligo API 에러 코드 → ExecutionFailureReason 매핑
  const map: Record<number, { reason: ExecutionFailureReason; userMsg: string; retryable: boolean }> = {
    // code: 0 = 성공 (위에서 처리)
    1: { reason: "INVALID_CONTACT", userMsg: "유효하지 않은 번호", retryable: false },
    2: { reason: "INVALID_CONTACT", userMsg: "전송 실패", retryable: true },
    3: { reason: "QUOTA_EXCEEDED", userMsg: "발송 한도 초과", retryable: true },
    4: { reason: "OPT_OUT", userMsg: "수신거부 번호", retryable: false },
    5: { reason: "PROVIDER_ERROR", userMsg: "서버 오류", retryable: true },
  };
  return map[code] || { reason: "SYSTEM_ERROR", userMsg: "알 수 없는 오류", retryable: true };
}
```

### 4.2 `src/lib/funnel/retry-handler.ts` — 재시도 스케줄링

```typescript
import prisma from "@/lib/prisma";

export async function scheduleRetry(params: {
  executionLogId: string;
  retryCount: number;
  maxRetries: number;
}): Promise<boolean> {
  const { executionLogId, retryCount, maxRetries } = params;

  if (retryCount >= maxRetries) {
    // 최대 재시도 초과 → ABANDONED
    await prisma.executionLog.update({
      where: { id: executionLogId },
      data: { status: "ABANDONED" },
    });
    return false;
  }

  // 지수 백오프: 5분 × 2^retryCount (최대 4시간)
  const delayMinutes = Math.min(5 * Math.pow(2, retryCount), 240);
  const nextRetryAt = new Date(Date.now() + delayMinutes * 60_000);

  await prisma.executionLog.update({
    where: { id: executionLogId },
    data: {
      status: "RETRY_SCHEDULED",
      nextRetryAt,
      retryCount: retryCount + 1,
    },
  });

  return true;
}

export function getExecuteMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
```

---

## 5. UI 대시보드 (1페이지, 50대 친화)

### 5.1 `/src/app/(dashboard)/dashboard/funnels/[id]/executions/page.tsx` (신규)

**목적:** 발송 기록 조회 + 재시도 CTA

```typescript
// 구현 요청사항:
// 1. 상태별 필터 탭 (PENDING, SENT, FAILED, ALL)
// 2. 발송 일시 표시 (한국어: "2025년 1월 15일 14:30")
// 3. 상태 배지: SENT (초록), FAILED (빨강), PENDING (회색)
// 4. 실패 사유: failureUserMsg 노출 (예: "일일 발송 한도 초과")
// 5. FAILED 건에만 "재시도" 버튼 활성화
// 6. 큰 폰트 (1.1rem 이상) — 50대 가독성
// 7. 충분한 터치 영역 (44px 이상)
// 8. 다크모드 지원
```

**컴포넌트 구조:**
```
ExecutionsPage
├─ StatusFilter (탭: ALL, PENDING, SENT, FAILED)
├─ ExecutionList
│  └─ ExecutionCard (각 건)
│     ├─ 발송 일시 + 상태 배지
│     ├─ 수신자 (ID만)
│     ├─ 실패 사유 (failureUserMsg)
│     └─ 재시도 버튼 (FAILED만)
└─ Pagination
```

---

## 6. 검증 테스트 케이스 (5개)

### 6.1 Unit Test: `src/lib/funnel/executor.test.ts`

```typescript
describe("executeMessage", () => {
  it("SMS 발송 성공 → SENT", async () => {
    // Mock aligo.sendSms: { result_code: 0 }
    // 결과: { success: true, status: "SENT" }
  });

  it("SMS 발송 실패 (수신거부) → FAILED", async () => {
    // Mock aligo.sendSms: { result_code: 4 } (OPT_OUT)
    // 결과: { status: "FAILED", failureReason: "OPT_OUT", retryable: false }
  });

  it("이메일 발송 성공 → SENT", async () => {
    // Mock email.sendEmail: true
    // 결과: { success: true, status: "SENT" }
  });

  it("이메일 서버 오류 → RETRY_SCHEDULED", async () => {
    // Mock email.sendEmail: false (SMTP timeout)
    // 결과: { status: "RETRY_SCHEDULED", retryable: true }
  });
});
```

### 6.2 통합 테스트: Cron + ExecutionLog

```typescript
describe("VipCareSequence → ExecutionLog", () => {
  it("VipCareLog 발송 성공 시 ExecutionLog.SENT 생성", async () => {
    // 1. VipCareSequence + VipCareLog 생성
    // 2. Cron 수동 호출: GET /api/cron/vip-care
    // 3. ExecutionLog 레코드 존재 확인
    //    - status: SENT
    //    - sourceType: FUNNEL_SEQUENCE
    //    - contactId, channel 일치
  });

  it("VipCareLog 발송 실패 시 ExecutionLog.RETRY_SCHEDULED", async () => {
    // SMS 설정 비활성화 후 Cron 호출
    // ExecutionLog.status: RETRY_SCHEDULED
    // ExecutionLog.nextRetryAt: 5분 후
  });

  it("월별 중복 발송 방지 (unique constraint)", async () => {
    // ExecutionLog 2개 생성 (같은 sourceId, contactId, executeMonth)
    // 2번째: UNIQUE 제약 위반 (DB 에러 or 애플리케이션 로직으로 방지)
  });
});
```

### 6.3 E2E 테스트: Playwright

```typescript
describe("발송 기록 대시보드 (Executions Page)", () => {
  it("상태별 필터링: FAILED만 표시", async () => {
    await page.goto("/dashboard/funnels/seq-123/executions?status=FAILED");
    const cards = await page.locator("[data-testid='execution-card']").all();
    // 모든 카드의 배지가 FAILED 상태
  });

  it("재시도 버튼 (FAILED 건만)", async () => {
    const retryBtn = await page.locator("[data-testid='retry-btn']").first();
    await retryBtn.click();
    // POST /api/funnel-executions/{id}/retry
    // ExecutionLog.status: RETRY_SCHEDULED
  });

  it("PII 마스킹: 수신자 전화번호 노출 안 함", async () => {
    const card = await page.locator("[data-testid='execution-card']").first();
    const text = await card.textContent();
    // 전화번호 패턴 없음 (contactId만 표시)
  });
});
```

---

## 7. 주의사항

### 7.1 IDOR (Insecure Direct Object Reference) 방지
```typescript
// ❌ 위험: organizationId 검증 없음
GET /api/funnel-executions?contactId=any-id

// ✅ 안전: 요청자의 organizationId만 허용
const { organizationId } = await validateUserOrg(req);
where.organizationId = organizationId; // 강제
```

### 7.2 PII 마스킹
- ExecutionLog 응답에서 **Contact 이름/전화번호 노출 금지**
- contactId만 반환 (필요 시 별도 API로 Contact 정보 조회)
- failureUserMsg는 사용자 친화 메시지만 (기술 상세 정보 제외)

### 7.3 성능 최적화
- ExecutionLog 조회: `idx_execution_cron_scan` 인덱스 활용
- Cron 배치: 한 번에 100건 처리 (250s 타임아웃 안전)
- 재시도 스케줄: 지수 백오프 (5분 → 30분 → 2시간 → ... → 최대 4시간)
- Redis 큐: SmsLog/EmailLog 기록 (fire-and-forget, DB 오버로드 방지)

### 7.4 에러 처리
- Aligo API 에러 → ExecutionFailureReason (enum) 매핑
- SMTP/네트워크 타임아웃 → RETRY_SCHEDULED
- 설정 비활성화 → FAILED (재시도 불가)

### 7.5 모니터링
- Cron 로그: `[Cron/vip-care] 처리건수, 성공/실패율`
- ExecutionLog 대시보드: 발송 현황 실시간 추적
- 알림: FAILED 건수 > 100 또는 재시도 횟수 > 3

---

## 재사용 목록 (기존 라이브러리)

| 모듈 | 함수 | 용도 |
|-----|------|------|
| `src/lib/aligo.ts` | `sendSms()` | SMS 발송 |
| `src/lib/aligo.ts` | `getOrgSmsConfig()` | 조직 SMS 설정 조회 |
| `src/lib/email.ts` | `sendEmail()` | 이메일 발송 |
| `src/lib/email.ts` | `getOrgEmailConfig()` | 조직 이메일 설정 조회 |
| `src/lib/sms-queue.ts` | `addSmsLog()` | SMS 로그 Redis 큐 |
| `src/lib/email-queue.ts` | `addEmailLog()` | 이메일 로그 Redis 큐 |
| `src/lib/auth.ts` | `validateUserOrg()` | 조직 권한 검증 |
| `src/lib/logger.ts` | `logger.log()` | 구조화된 로깅 |

---

## 예상 일정 (8시간)

| 단계 | 예상 시간 | 담당 |
|------|---------|------|
| 1. Cron 수정 (vip-care) | 1.5h | Backend |
| 2. 라이브러리 구현 (executor, retry-handler) | 2h | Backend |
| 3. API 구현 (funnel-executions) | 1.5h | Backend |
| 4. UI 페이지 (executions/page.tsx) | 1.5h | Frontend |
| 5. 테스트 (unit, 통합, E2E) | 1.5h | QA |

**마일스톤:**
- ✅ Phase 0: ExecutionLog 스키마 (완료)
- 🔄 Phase 1: Cron 통합 + API + UI (8시간)
- ⏳ Phase 2: 자동화 규칙 (AUTOMATION_RULE sourceType) 추가
- ⏳ Phase 3: 월별 반복 로직 (executeMonth 그룹화)

---

**작성일:** 2026-05-18  
**담당:** Architecture Lead
