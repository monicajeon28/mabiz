# 에러 처리 강화 가이드 (2026-06-02)

## 📋 목차
1. [현재 상태 분석](#현재-상태-분석)
2. [에러 구분 체계 (413/400/500)](#에러-구분-체계)
3. [사용자 피드백 시스템](#사용자-피드백-시스템)
4. [재시도 로직 구현](#재시도-로직-구현)
5. [구현 순서 및 코드 예제](#구현-순서-및-코드-예제)

---

## 현재 상태 분석

### ✅ 기존 강점
| 항목 | 상태 | 파일 |
|------|------|------|
| 기본 에러 메시지 매핑 | ✅ 완성 | `src/lib/error-messages.ts` |
| 병렬 작업 안전 처리 | ✅ 완성 | `src/lib/error-handling.ts` |
| SMS 재시도 로직 | ✅ 부분 | `src/lib/aligo/delivery-tracker.ts` |
| Webhook 기본 검증 | ✅ 완성 | `src/app/api/webhooks/**/route.ts` |

### ❌ 개선 필요 영역

```
문제점 1: 상태 코드 구분 부족
├─ 400 (Bad Request): 클라이언트 입력 오류 → 사용자 피드백 필요
├─ 413 (Payload Too Large): 파일/데이터 크기 초과 → 특화 메시지 필요
└─ 500 (Server Error): 서버 오류 → 재시도 제안 필요

문제점 2: 사용자 피드백 미흡
├─ 에러 타입별 설명 부족 (기술적 용어만 제시)
├─ 사용자 행동 제안 없음 (재시도/수정/문의 등)
└─ 실시간 에러 모니터링 부재

문제점 3: 재시도 로직 불일관
├─ SMS만 재시도 있음 (다른 API는 없음)
├─ 재시도 간격 하드코딩
├─ 지수 백오프 미구현
└─ 재시도 상태 UI 반영 부족
```

---

## 에러 구분 체계

### HTTP 상태 코드별 처리

#### 400 - Bad Request (클라이언트 입력 오류)

**특징**: 사용자가 잘못된 데이터를 보냄 → 사용자 수정 필요

**예시**:
- 필수 필드 누락: `{ ok: false, message: "이름은 필수입니다" }`
- 잘못된 형식: `{ ok: false, message: "전화번호는 01X-XXXX-XXXX 형식이어야 합니다" }`
- 범위 초과: `{ ok: false, message: "나이는 1~150 사이여야 합니다" }`

**응답 구조**:
```typescript
interface ErrorResponse {
  ok: false;
  error: {
    code: 'VALIDATION_ERROR';
    message: string;           // 사용자 친화적 메시지
    field?: string;            // 어느 필드에서 오류 발생?
    suggestion?: string;       // 사용자가 할 수 있는 행동
    details?: Record<string, string>; // 부분 검증 실패 목록
  };
}
```

**사용자 피드백 예**:
```
❌ 입력값 오류
전화번호 형식이 올바르지 않습니다.
올바른 형식: 010-1234-5678
```

---

#### 413 - Payload Too Large (데이터 크기 초과)

**특징**: 파일/요청 본문이 너무 큼 → 데이터 축소 필요

**예시**:
- 파일 업로드: `413 MB 파일은 최대 100 MB까지만 가능합니다`
- 배치 요청: `500개 항목은 너무 많습니다. 최대 100개까지만 가능합니다`
- JSON 본문: `요청 본문이 1 MB를 초과했습니다`

**응답 구조**:
```typescript
interface PayloadTooLargeError {
  ok: false;
  error: {
    code: 'PAYLOAD_TOO_LARGE';
    message: string;
    currentSize: number;       // 현재 크기 (바이트 또는 항목 수)
    maxSize: number;           // 최대 크기
    suggestion: string;        // "여러 번에 나누어 업로드하세요" 등
  };
}
```

**사용자 피드백 예**:
```
⚠️ 데이터 크기 초과
현재: 250 MB | 최대: 100 MB

👉 해결 방법
1. 파일을 작은 단위로 분할하세요 (예: 50 MB씩)
2. 또는 [일괄 업로드 튜토리얼] 참고
```

---

#### 500 - Server Error (서버 오류)

**특징**: 서버 내부 오류 → 자동 재시도 또는 지원팀 문의 필요

**예시**:
- 데이터베이스 연결 실패
- 외부 API 연동 실패 (Cruisedot, PayApp, 알리고)
- 메모리 부족

**응답 구조**:
```typescript
interface ServerError {
  ok: false;
  error: {
    code: 'SERVER_ERROR' | 'DATABASE_ERROR' | 'EXTERNAL_SERVICE_ERROR';
    message: string;
    operationId: string;       // 로그 추적용 ID
    retryable: true;           // 재시도 가능 여부
    suggestedRetryAfter?: number; // 재시도까지 대기 시간 (ms)
    supportEmail?: string;     // 문제 지속시 연락처
  };
}
```

**사용자 피드백 예**:
```
🔄 일시적 서버 오류
작업 ID: op_6f3a9b2d

자동으로 다시 시도하고 있습니다...
(3/3 시도)

실패하면 지원팀에 문의하세요:
support@mabiz.co.kr
```

---

### 에러 코드 매핑표

```typescript
// src/lib/error-codes.ts

export const ERROR_CODES = {
  // 400 - 클라이언트 오류
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    status: 400,
    retryable: false,
    userMessage: '입력값을 확인해주세요',
  },
  MISSING_REQUIRED_FIELD: {
    code: 'MISSING_REQUIRED_FIELD',
    status: 400,
    retryable: false,
  },
  INVALID_PHONE_FORMAT: {
    code: 'INVALID_PHONE_FORMAT',
    status: 400,
    retryable: false,
  },
  INVALID_EMAIL_FORMAT: {
    code: 'INVALID_EMAIL_FORMAT',
    status: 400,
    retryable: false,
  },
  DUPLICATE_ENTRY: {
    code: 'DUPLICATE_ENTRY',
    status: 409, // Conflict (400의 특수한 경우)
    retryable: false,
  },

  // 413 - Payload Too Large
  PAYLOAD_TOO_LARGE: {
    code: 'PAYLOAD_TOO_LARGE',
    status: 413,
    retryable: false,
    userMessage: '데이터가 너무 큽니다. 작은 단위로 분할해주세요',
  },
  FILE_TOO_LARGE: {
    code: 'FILE_TOO_LARGE',
    status: 413,
    retryable: false,
  },
  TOO_MANY_ITEMS: {
    code: 'TOO_MANY_ITEMS',
    status: 413,
    retryable: false,
  },

  // 429 - Too Many Requests
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    status: 429,
    retryable: true,
    userMessage: '요청이 많습니다. 잠시 후 다시 시도해주세요',
  },
  SMS_DAILY_LIMIT: {
    code: 'SMS_DAILY_LIMIT',
    status: 429,
    retryable: true,
  },

  // 500+ - 서버 오류
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    status: 500,
    retryable: true,
    userMessage: '일시적 오류입니다. 자동으로 재시도 중입니다',
  },
  EXTERNAL_SERVICE_ERROR: {
    code: 'EXTERNAL_SERVICE_ERROR',
    status: 500,
    retryable: true,
  },
  CRUISEDOT_API_ERROR: {
    code: 'CRUISEDOT_API_ERROR',
    status: 502,
    retryable: true,
    externalService: 'Cruisedot',
  },
  PAYAPP_API_ERROR: {
    code: 'PAYAPP_API_ERROR',
    status: 502,
    retryable: true,
    externalService: 'PayApp',
  },
  ALIGO_SMS_ERROR: {
    code: 'ALIGO_SMS_ERROR',
    status: 502,
    retryable: true,
    externalService: '알리고 SMS',
  },
  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    status: 500,
    retryable: true,
  },
} as const;
```

---

## 사용자 피드백 시스템

### 원칙

1. **기술 용어 제거**: "Internal Server Error" → "일시적 오류가 발생했습니다"
2. **구체적 제안**: 에러 메시지 + 사용자가 할 수 있는 행동
3. **시각적 차별화**: 아이콘 + 색상 + 애니메이션
4. **맥락 보존**: 어디서 실패했는지 명확히 제시

### UI 컴포넌트 구조

```typescript
// src/components/ErrorFeedback.tsx

interface ErrorFeedbackProps {
  error: {
    code: string;
    message: string;
    field?: string;
    suggestion?: string;
    retryable?: boolean;
  };
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * 예시 렌더링
 * 
 * ❌ 입력값 오류
 * 전화번호 형식이 올바르지 않습니다.
 * 올바른 형식: 010-1234-5678
 * [수정]  [닫기]
 * 
 * 🔄 일시적 서버 오류
 * 작업 ID: op_6f3a9b2d
 * 자동으로 재시도 중... (2/3)
 * [즉시 재시도]  [문의하기]
 * 
 * ⚠️ 데이터 크기 초과
 * 현재: 250 MB | 최대: 100 MB
 * 👉 여러 번에 나누어 업로드하세요
 * [파일 선택]  [도움말]
 */
```

### Toast vs Modal 결정 기준

| 상황 | UI | 이유 |
|------|-----|------|
| 필드 검증 실패 (400) | **Inline Error** | 사용자가 즉시 수정 가능 |
| 일반 실패 (1-2초 이내) | **Toast** | 주의집중 최소화 |
| 사용자 행동 필요 (413) | **Modal** | 구체적 설명 + 선택지 필요 |
| 중요 오류 (500+) | **Modal** | 작업 중단 + 지원팀 연락처 제시 |
| 자동 재시도 중 | **Progress Toast** | "3/3 시도 중..." 표시 |

---

## 재시도 로직 구현

### 1️⃣ 지수 백오프 재시도 (Exponential Backoff with Jitter)

```typescript
// src/lib/retry-engine.ts

export interface RetryConfig {
  maxRetries?: number;           // 기본값: 3
  initialDelayMs?: number;       // 기본값: 500ms
  maxDelayMs?: number;           // 기본값: 30000ms
  backoffMultiplier?: number;    // 기본값: 2 (500ms → 1s → 2s)
  jitterFactor?: number;         // 기본값: 0.1 (±10% 무작위)
  retryableStatusCodes?: Set<number>; // 기본값: {408, 429, 500, 502, 503, 504}
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  lastErrorCode?: number;
  operationId: string;
}

/**
 * 재시도 로직 예시
 * 
 * 시도 1: 즉시 실행 → 실패 (500 Server Error)
 * 시도 2: 500ms + 무작위(±50ms) = 450-550ms 후 재시도
 * 시도 3: 1000ms + 무작위(±100ms) = 900-1100ms 후 재시도
 * 시도 4: 2000ms + 무작위(±200ms) = 1800-2200ms 후 재시도
 * 
 * 총 대기: ~4-4.5초
 */

export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    initialDelayMs = 500,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    jitterFactor = 0.1,
    retryableStatusCodes = new Set([408, 429, 500, 502, 503, 504]),
  } = config;

  const operationId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  let lastError: Error | undefined;
  let lastErrorCode: number | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await operation();
      
      if (attempt > 0) {
        logger.log(`[RETRY SUCCESS] 재시도 성공`, {
          operationId,
          attempt: attempt + 1,
          totalAttempts: maxRetries + 1,
        });
      }

      return {
        success: true,
        data,
        attempts: attempt + 1,
        operationId,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      // HTTP 상태 코드 추출
      if ('status' in lastError) {
        lastErrorCode = (lastError as any).status;
      }

      const isRetryable = retryableStatusCodes.has(lastErrorCode ?? 500);
      const isLastAttempt = attempt === maxRetries;

      if (!isRetryable || isLastAttempt) {
        logger.error(`[RETRY FAILED] 재시도 포기`, {
          operationId,
          attempt: attempt + 1,
          totalAttempts: maxRetries + 1,
          error: lastError.message,
          retryable: isRetryable,
        });

        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          lastErrorCode,
          operationId,
        };
      }

      // 다음 재시도 전 대기
      const exponentialDelay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );
      const jitter = exponentialDelay * jitterFactor * (Math.random() * 2 - 1);
      const finalDelay = Math.max(0, Math.round(exponentialDelay + jitter));

      logger.warn(`[RETRY] ${attempt + 1}/${maxRetries} 실패, ${finalDelay}ms 후 재시도`, {
        operationId,
        error: lastError.message,
        delayMs: finalDelay,
      });

      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }

  // 모든 재시도 실패
  return {
    success: false,
    error: lastError,
    attempts: maxRetries + 1,
    lastErrorCode,
    operationId,
  };
}
```

### 2️⃣ 조건부 재시도 래퍼

```typescript
// src/lib/api-client-with-retry.ts

export class ApiClientWithRetry {
  constructor(private baseUrl: string) {}

  async post<T>(
    path: string,
    body: any,
    options?: {
      retryConfig?: RetryConfig;
      onRetryAttempt?: (attempt: number, error: Error) => void;
      onRetrySuccess?: (attempts: number) => void;
    }
  ): Promise<T> {
    const { retryConfig, onRetryAttempt, onRetrySuccess } = options ?? {};

    const result = await retryWithExponentialBackoff(
      async () => {
        const response = await fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const err = new Error(`HTTP ${response.status}`);
          (err as any).status = response.status;
          throw err;
        }

        return response.json() as Promise<T>;
      },
      retryConfig
    );

    if (result.success) {
      onRetrySuccess?.(result.attempts);
      return result.data!;
    } else {
      throw result.error;
    }
  }
}
```

### 3️⃣ Webhook 재시도 (DB 기반)

```typescript
// src/lib/webhook-retry-queue.ts

export interface WebhookRetryRecord {
  id: string;
  eventId: string;
  eventType: string;
  payload: Record<string, any>;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: Date;
  lastError?: string;
  createdAt: Date;
}

export async function scheduleWebhookRetry(
  eventId: string,
  eventType: string,
  payload: Record<string, any>,
  error: Error,
  options: {
    attempt?: number;
    maxAttempts?: number;
    initialDelayMs?: number;
  } = {}
) {
  const {
    attempt = 1,
    maxAttempts = 5,
    initialDelayMs = 300000, // 5분
  } = options;

  if (attempt >= maxAttempts) {
    logger.error(`[WEBHOOK RETRY] 최대 재시도 횟수 초과`, {
      eventId,
      attempt,
      maxAttempts,
    });
    return;
  }

  // 지수 백오프: 5분, 10분, 20분, 40분, ...
  const nextRetryMs = initialDelayMs * Math.pow(2, attempt - 1);
  const nextRetryAt = new Date(Date.now() + nextRetryMs);

  await prisma.webhookRetryQueue.create({
    data: {
      eventId,
      eventType,
      payload,
      attempt: attempt + 1,
      maxAttempts,
      nextRetryAt,
      lastError: error.message,
    },
  });

  logger.log(`[WEBHOOK RETRY] 재시도 예약`, {
    eventId,
    nextRetryAt,
    attempt: attempt + 1,
    delayMinutes: Math.round(nextRetryMs / 60000),
  });
}

/**
 * Cron: 매분 실행
 * - nextRetryAt <= NOW인 항목 조회
 * - 재시도 실행
 * - 성공: 레코드 삭제
 * - 실패: scheduleWebhookRetry() 호출 → attempt 증가
 */
export async function processWebhookRetryQueue() {
  const pendingRetries = await prisma.webhookRetryQueue.findMany({
    where: { nextRetryAt: { lte: new Date() } },
    take: 100,
  });

  for (const retry of pendingRetries) {
    try {
      // 재시도 로직
      await processWebhookEvent(retry.eventId, retry.eventType, retry.payload);
      
      // 성공: 삭제
      await prisma.webhookRetryQueue.delete({ where: { id: retry.id } });
      logger.log(`[WEBHOOK RETRY] 성공`, { eventId: retry.eventId });
    } catch (error) {
      // 실패: 다음 재시도 예약
      await scheduleWebhookRetry(
        retry.eventId,
        retry.eventType,
        retry.payload,
        error instanceof Error ? error : new Error(String(error)),
        { attempt: retry.attempt, maxAttempts: retry.maxAttempts }
      );
    }
  }
}
```

---

## 구현 순서 및 코드 예제

### Phase 1: 에러 코드 및 메시지 통합 (1일)

```typescript
// src/lib/error-codes.ts
export const ERROR_CODES = { /* 위 참고 */ };

export function getErrorResponse(
  code: keyof typeof ERROR_CODES,
  details?: any
) {
  const errorDef = ERROR_CODES[code];
  return {
    ok: false,
    error: {
      code,
      message: details?.message || errorDef.code,
      operationId: `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      retryable: errorDef.retryable,
      ...(details && { details }),
    },
  };
}
```

### Phase 2: API 응답 표준화 (2일)

```typescript
// src/app/api/contacts/route.ts (기존 수정)

export async function POST(req: Request) {
  const operationId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  try {
    const body = await req.json();
    const { name, phone } = body;

    // 검증 (400)
    if (!name || !phone) {
      return NextResponse.json({
        ok: false,
        error: {
          code: 'MISSING_REQUIRED_FIELD',
          message: '이름과 전화번호는 필수입니다',
          field: !name ? 'name' : 'phone',
          suggestion: '필수 항목을 모두 입력해주세요',
          operationId,
        },
      }, { status: 400 });
    }

    // 생성
    const contact = await prisma.contact.create({ data: { /* ... */ } });

    return NextResponse.json({
      ok: true,
      data: contact,
    });

  } catch (err) {
    // 400 - 요청 본문 파싱 실패
    if (err instanceof SyntaxError) {
      return NextResponse.json({
        ok: false,
        error: {
          code: 'INVALID_JSON',
          message: 'JSON 형식이 올바르지 않습니다',
          operationId,
        },
      }, { status: 400 });
    }

    // 413 - Payload Too Large
    if (err instanceof Error && err.message.includes('413')) {
      return NextResponse.json({
        ok: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: '요청 데이터가 너무 큽니다 (최대 1MB)',
          suggestion: '요청을 작은 단위로 분할해주세요',
          operationId,
        },
      }, { status: 413 });
    }

    // 500 - Server Error
    logger.error('[POST /api/contacts] 서버 오류', { err, operationId });
    return NextResponse.json({
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '일시적인 오류가 발생했습니다',
        operationId,
        retryable: true,
        supportEmail: 'support@mabiz.co.kr',
      },
    }, { status: 500 });
  }
}
```

### Phase 3: 재시도 로직 (2일)

```typescript
// src/app/api/contacts/import/route.ts (배치 업로드)

export async function POST(req: Request) {
  const operationId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    // 413 검증
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({
        ok: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `파일이 너무 큽니다 (현재: ${Math.round(file.size / 1024 / 1024)}MB, 최대: 10MB)`,
          currentSize: Math.round(file.size / 1024 / 1024),
          maxSize: 10,
          suggestion: '파일을 분할하거나 [배치 업로드 가이드] 확인',
          operationId,
        },
      }, { status: 413 });
    }

    // 파싱 + 재시도 가능하게
    const result = await retryWithExponentialBackoff(
      async () => {
        const contacts = await parseAndImportContacts(file);
        return contacts;
      },
      {
        maxRetries: 2,
        initialDelayMs: 500,
        retryableStatusCodes: new Set([500, 502, 503]),
      }
    );

    if (!result.success) {
      return NextResponse.json({
        ok: false,
        error: {
          code: 'IMPORT_FAILED',
          message: '파일 가져오기에 실패했습니다',
          operationId,
          retryable: true,
          attempts: result.attempts,
          suggestion: '파일을 확인하고 다시 시도해주세요',
        },
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        imported: result.data.length,
        operationId,
      },
    });

  } catch (err) {
    logger.error('[POST /api/contacts/import]', { err, operationId });
    return NextResponse.json({
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '파일 가져오기 중 오류가 발생했습니다',
        operationId,
      },
    }, { status: 500 });
  }
}
```

### Phase 4: Webhook 재시도 큐 (3일)

```prisma
// prisma/schema.prisma 추가

model WebhookRetryQueue {
  id            String   @id @default(cuid())
  eventId       String   @unique
  eventType     String
  payload       Json
  attempt       Int      @default(1)
  maxAttempts   Int      @default(5)
  nextRetryAt   DateTime
  lastError     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([nextRetryAt])
  @@index([eventId])
}

// 마이그레이션
npx prisma migrate dev --name add_webhook_retry_queue
```

```typescript
// src/app/api/cron/webhook-retry/route.ts

export async function GET() {
  try {
    const processed = await processWebhookRetryQueue();
    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    logger.error('[Cron] Webhook retry queue 처리 실패', { err });
    return NextResponse.json(
      { ok: false, error: 'Processing failed' },
      { status: 500 }
    );
  }
}
```

### Phase 5: UI 피드백 컴포넌트 (2일)

```typescript
// src/components/ErrorFeedback.tsx

import { AlertCircle, Clock, AlertTriangle } from 'lucide-react';

interface ErrorFeedbackProps {
  error: {
    code: string;
    message: string;
    field?: string;
    suggestion?: string;
    retryable?: boolean;
    attempts?: number;
    operationId?: string;
  };
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorFeedback({
  error,
  onRetry,
  onDismiss,
}: ErrorFeedbackProps) {
  const isRetrying = false; // 상태 관리로 변경 필요

  if (error.code === 'VALIDATION_ERROR' || error.field) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-red-900">{error.message}</p>
          {error.suggestion && (
            <p className="text-sm text-red-700 mt-1">{error.suggestion}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-red-600 hover:text-red-700 text-sm font-medium"
        >
          닫기
        </button>
      </div>
    );
  }

  if (error.code === 'PAYLOAD_TOO_LARGE') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-yellow-900">{error.message}</p>
            {error.suggestion && (
              <p className="text-sm text-yellow-700 mt-2">👉 {error.suggestion}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Server Error (Retryable)
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div className="flex gap-3">
        <Clock className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-orange-900">
            🔄 일시적인 오류가 발생했습니다
          </p>
          {error.operationId && (
            <p className="text-xs text-orange-600 mt-1">
              작업 ID: {error.operationId}
            </p>
          )}
          {isRetrying && error.attempts && (
            <div className="mt-2">
              <p className="text-sm text-orange-700 mb-2">
                자동으로 다시 시도 중... ({error.attempts}/3)
              </p>
              <div className="w-full bg-orange-200 rounded-full h-1.5">
                <div
                  className="bg-orange-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${(error.attempts / 3) * 100}%` }}
                />
              </div>
            </div>
          )}
          {error.suggestion && !isRetrying && (
            <p className="text-sm text-orange-700 mt-2">{error.suggestion}</p>
          )}
        </div>
        <div className="flex gap-2">
          {!isRetrying && error.retryable && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-100 rounded hover:bg-orange-200 transition"
            >
              재시도
            </button>
          )}
          <button
            onClick={onDismiss}
            className="text-orange-600 hover:text-orange-700 text-sm font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## ✅ 최종 체크리스트

### 구현 완료 체크
- [ ] Phase 1: `error-codes.ts` 생성 (기존 `error-messages.ts` 병합)
- [ ] Phase 2: 모든 API 엔드포인트 표준 응답 형식으로 수정
- [ ] Phase 3: `retry-engine.ts` 구현 + API 통합
- [ ] Phase 4: Prisma schema 추가 + 웹훅 재시도 큐 Cron
- [ ] Phase 5: `ErrorFeedback` 컴포넌트 구현 + 페이지 통합

### 검증 체크
- [ ] 400 에러: 필드 검증 실패 → 인라인 에러 표시
- [ ] 413 에러: 파일 크기 초과 → 모달 + 파일 분할 가이드
- [ ] 500 에러: 서버 오류 → 토스트 + 자동 재시도 + 작업 ID
- [ ] 각 에러 유형별 사용자 피드백 UI 검증
- [ ] 재시도 지수 백오프 동작 확인 (로그 기반)

### 성능 목표
- 재시도 총 시간: 4-5초 (3회 시도)
- 웹훅 재시도: 5분 → 10분 → 20분 → 40분 (최대 5회)
- 사용자 피드백 표시: 200ms 이내

---

## 참고 링크

- [RFC 7231 - HTTP Status Codes](https://tools.ietf.org/html/rfc7231#section-6)
- [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Error Handling Best Practices](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
