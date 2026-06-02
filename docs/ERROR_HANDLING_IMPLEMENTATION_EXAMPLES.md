# 에러 처리 구현 예제 (2026-06-02)

## 📖 실제 코드 적용 방법

이 문서는 기존 API에 새로운 에러 처리 시스템을 적용하는 구체적인 예제입니다.

---

## 예제 1: 검증 오류 (400) - 고객 생성 API

### Before (기존)
```typescript
// src/app/api/contacts/route.ts
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { ok: false, message: "이름과 전화번호는 필수입니다" },
        { status: 400 }
      );
    }

    // ... 생성 로직
  } catch (err) {
    logger.error("[POST /api/contacts]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

**문제점**:
- ❌ 어떤 필드가 누락되었는지 명확하지 않음
- ❌ 에러 코드로 프로그래밍 불가
- ❌ 사용자가 취할 행동 제시 없음

### After (개선)
```typescript
// src/app/api/contacts/route.ts
import { NextResponse } from 'next/server';
import { getErrorResponse } from '@/lib/error-codes';

export async function POST(req: Request) {
  const operationId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  try {
    const body = await req.json();
    const { name, phone, email, age } = body;

    // 필수 필드 검증
    if (!name?.trim()) {
      return NextResponse.json(
        getErrorResponse('MISSING_REQUIRED_FIELD', {
          message: '이름은 필수입니다',
          field: 'name',
          suggestion: '고객의 성명을 입력해주세요',
        }),
        { status: 400 }
      );
    }

    if (!phone?.trim()) {
      return NextResponse.json(
        getErrorResponse('MISSING_REQUIRED_FIELD', {
          message: '전화번호는 필수입니다',
          field: 'phone',
          suggestion: '010-XXXX-XXXX 형식으로 입력해주세요',
        }),
        { status: 400 }
      );
    }

    // 형식 검증
    const phoneRegex = /^01[0-9]-\d{3,4}-\d{4}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        getErrorResponse('INVALID_PHONE_FORMAT', {
          message: '전화번호 형식이 올바르지 않습니다',
          field: 'phone',
          suggestion: '올바른 형식: 010-1234-5678',
        }),
        { status: 400 }
      );
    }

    // 나이 검증
    if (age !== undefined && (typeof age !== 'number' || age < 1 || age > 150)) {
      return NextResponse.json(
        getErrorResponse('INVALID_AGE', {
          field: 'age',
        }),
        { status: 400 }
      );
    }

    // 생성 로직
    const contact = await prisma.contact.create({
      data: { name, phone, email: email ?? null, age: age ?? null },
    });

    return NextResponse.json({ ok: true, data: contact });

  } catch (err) {
    // JSON 파싱 오류
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        getErrorResponse('INVALID_JSON'),
        { status: 400 }
      );
    }

    // 서버 오류
    logger.error('[POST /api/contacts]', { err, operationId });
    return NextResponse.json(
      getErrorResponse('INTERNAL_SERVER_ERROR', {
        supportEmail: 'support@mabiz.co.kr',
      }),
      { status: 500 }
    );
  }
}
```

**개선점**:
- ✅ 각 필드별로 명확한 에러 메시지
- ✅ field 속성으로 UI가 어느 입력란을 강조할지 알 수 있음
- ✅ suggestion으로 사용자가 할 수 있는 행동 제시
- ✅ operationId로 추적 가능
- ✅ 클라이언트에서 error.code로 프로그래밍 가능

### UI 연동
```typescript
// src/app/contacts/page.tsx
import { ErrorFeedback } from '@/components/ErrorFeedback';
import { useState } from 'react';

export default function ContactsPage() {
  const [error, setError] = useState<any>(null);

  const handleCreateContact = async (formData: any) => {
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!result.ok) {
        // 에러 표시
        setError(result.error);
        return;
      }

      // 성공
      setError(null);
      // ... 리스트 갱신 등
    } catch (err) {
      setError({
        code: 'NETWORK_ERROR',
        message: '네트워크 오류가 발생했습니다',
      });
    }
  };

  return (
    <div>
      {/* 에러 표시 */}
      {error && (
        <ErrorFeedback
          error={error}
          onDismiss={() => setError(null)}
        />
      )}

      {/* 폼 */}
      <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        handleCreateContact({
          name: formData.get('name'),
          phone: formData.get('phone'),
          email: formData.get('email'),
          age: formData.get('age') ? parseInt(formData.get('age') as string) : undefined,
        });
      }}>
        <input type="text" name="name" placeholder="이름" />
        <input type="tel" name="phone" placeholder="010-1234-5678" />
        <input type="email" name="email" placeholder="email@example.com" />
        <input type="number" name="age" placeholder="나이" />
        <button type="submit">저장</button>
      </form>
    </div>
  );
}
```

---

## 예제 2: 크기 초과 (413) - 파일 업로드 API

### Before (기존)
```typescript
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    // 파일 처리...
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

**문제점**:
- ❌ 파일이 너무 크면 그냥 실패 (사용자가 원인 모름)
- ❌ 어떻게 해결할지 제안 없음

### After (개선)
```typescript
import { getErrorResponse } from '@/lib/error-codes';
import { retryWithExponentialBackoff } from '@/lib/retry-engine';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_BATCH_ITEMS = 500;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    // 413: 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        getErrorResponse('FILE_TOO_LARGE', {
          message: `파일이 너무 큽니다 (현재: ${Math.round(file.size / 1024 / 1024)}MB, 최대: 10MB)`,
          field: 'file',
          currentSize: Math.round(file.size / 1024 / 1024),
          maxSize: 10,
          suggestion: '파일을 분할하여 여러 번에 나누어 업로드하세요. [업로드 가이드]를 참고해주세요.',
        }),
        { status: 413 }
      );
    }

    // 파싱 + 재시도
    const result = await retryWithExponentialBackoff(
      async () => {
        const text = await file.text();
        const lines = text.split('\n').filter((l) => l.trim());

        // 항목 수 검증
        if (lines.length > MAX_BATCH_ITEMS) {
          const err = new Error(`Too many items: ${lines.length}`);
          (err as any).status = 413;
          throw err;
        }

        // 실제 처리
        const contacts = await parseAndImportContacts(lines);
        return contacts;
      },
      {
        maxRetries: 2,
        initialDelayMs: 500,
        retryableStatusCodes: new Set([500, 502, 503]),
      }
    );

    if (!result.success) {
      // 413 에러인 경우
      if (result.lastErrorCode === 413) {
        return NextResponse.json(
          getErrorResponse('TOO_MANY_ITEMS', {
            message: `항목이 너무 많습니다 (현재: ${MAX_BATCH_ITEMS}+개)`,
            field: 'file',
            currentSize: MAX_BATCH_ITEMS + 1,
            maxSize: MAX_BATCH_ITEMS,
            suggestion: `${MAX_BATCH_ITEMS}개 이하로 분할해주세요`,
          }),
          { status: 413 }
        );
      }

      // 500 에러인 경우
      return NextResponse.json(
        getErrorResponse('INTERNAL_SERVER_ERROR', {
          message: '파일 가져오기에 실패했습니다',
          suggestion: '파일을 확인하고 다시 시도해주세요',
        }),
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        imported: result.data!.length,
        operationId: result.operationId,
      },
    });

  } catch (err) {
    logger.error('[POST /api/contacts/import]', { err });
    return NextResponse.json(
      getErrorResponse('INTERNAL_SERVER_ERROR'),
      { status: 500 }
    );
  }
}
```

---

## 예제 3: 서버 오류 (500+) - 자동 재시도

### Before (기존)
```typescript
export async function GET(req: Request) {
  try {
    const data = await prisma.contact.findMany();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    logger.error("[GET /api/contacts]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

**문제점**:
- ❌ 일시적 오류인지 확인 불가
- ❌ 재시도 정보 없음
- ❌ 사용자가 다시 시도해야 할지 알 수 없음

### After (개선)
```typescript
import { retryWithExponentialBackoff, getOrThrow } from '@/lib/retry-engine';
import { getErrorResponse } from '@/lib/error-codes';

export async function GET(req: Request) {
  try {
    // 재시도 로직으로 감싸기
    const result = await retryWithExponentialBackoff(
      async () => {
        return prisma.contact.findMany({
          take: 50,
          orderBy: { createdAt: 'desc' },
        });
      },
      {
        maxRetries: 2,
        initialDelayMs: 500,
        retryableStatusCodes: new Set([500, 502, 503]),
        onRetryAttempt: (attempt, error) => {
          logger.warn(`[GET /api/contacts] 재시도 ${attempt}`, {
            error: error.message,
          });
        },
      }
    );

    if (result.success) {
      return NextResponse.json({ ok: true, data: result.data });
    }

    // 모든 재시도 실패
    return NextResponse.json(
      getErrorResponse('DATABASE_ERROR', {
        message: '고객 목록을 불러올 수 없습니다',
        suggestion: '잠시 후 다시 시도해주세요',
      }),
      { status: 500 }
    );

  } catch (err) {
    logger.error('[GET /api/contacts]', { err });
    return NextResponse.json(
      getErrorResponse('INTERNAL_SERVER_ERROR'),
      { status: 500 }
    );
  }
}
```

---

## 예제 4: Webhook 재시도 (DB 기반)

### 구현
```typescript
// src/app/api/webhooks/cruisedot-payment/route.ts
import { scheduleWebhookRetry } from '@/lib/webhook-retry-queue';

export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  // ... 서명 검증 ...

  try {
    const payload = await req.json();
    
    // 실제 처리
    await prisma.$transaction(async (tx) => {
      // ... 복잡한 로직 ...
    });

    logger.log('[CruisedotWebhook] 성공', { eventId: payload.eventId });
    return NextResponse.json({ ok: true });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // 자동 재시도 스케줄링
    // - 다음 5분 후 재시도
    // - 최대 5회 재시도
    await scheduleWebhookRetry(
      payload.eventId,
      payload.eventType,
      payload,
      err,
      { attempt: 1, maxAttempts: 5, initialDelayMs: 300000 }
    );

    logger.warn('[CruisedotWebhook] 실패, 재시도 예약', {
      eventId: payload.eventId,
      error: err.message,
    });

    // 202 Accepted: 즉시 응답 (Webhook 송신자가 재전송하지 않도록)
    return NextResponse.json(
      { ok: false, scheduled: true },
      { status: 202 }
    );
  }
}
```

### Cron 작업
```typescript
// src/app/api/cron/webhook-retry/route.ts
import { processWebhookRetryQueue } from '@/lib/webhook-retry-queue';

/**
 * 매분 실행 (Vercel Cron)
 * 설정: vercel.json에 다음 추가
 * 
 * {
 *   "crons": [{
 *     "path": "/api/cron/webhook-retry",
 *     "schedule": "* * * * *"
 *   }]
 * }
 */
export async function GET(req: Request) {
  // 권한 검증
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const processed = await processWebhookRetryQueue();
    return NextResponse.json({
      ok: true,
      processed,
    });
  } catch (err) {
    logger.error('[Cron] Webhook retry queue 처리 실패', { err });
    return NextResponse.json(
      { ok: false, error: 'Processing failed' },
      { status: 500 }
    );
  }
}
```

---

## 예제 5: 클라이언트 사이드 재시도

### React Hook
```typescript
// src/hooks/useFetch.ts
import { useState, useCallback } from 'react';
import { retryWithExponentialBackoff } from '@/lib/retry-engine';

export function useFetch<T>(url: string, options?: RequestInit) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await retryWithExponentialBackoff(
      async () => {
        const response = await fetch(url, options);

        if (!response.ok) {
          const errorData = await response.json();
          const err = new Error(errorData.error?.message || 'Request failed');
          (err as any).status = response.status;
          throw err;
        }

        return response.json() as Promise<T>;
      },
      {
        maxRetries: 2,
        initialDelayMs: 500,
        onRetryAttempt: (attempt) => {
          setAttempts(attempt);
        },
      }
    );

    setLoading(false);

    if (result.success) {
      setData(result.data ?? null);
    } else {
      setError({
        code: result.lastErrorCode === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_SERVER_ERROR',
        message: result.error?.message || '요청 실패',
        retryable: result.error?.name !== 'SyntaxError',
        attempts: result.attempts,
        operationId: result.operationId,
      });
    }

    return result;
  }, [url, options]);

  return { data, error, loading, fetch, attempts };
}
```

### 사용
```typescript
import { useFetch } from '@/hooks/useFetch';
import { ErrorFeedback } from '@/components/ErrorFeedback';

export function ContactsList() {
  const { data, error, loading, fetch, attempts } = useFetch('/api/contacts');

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div>
      {/* 에러 표시 */}
      {error && (
        <ErrorFeedback
          error={{ ...error, attempts }}
          onRetry={fetch}
          onDismiss={() => setError(null)}
          autoRetry={{ enabled: true, delayMs: 2000 }}
        />
      )}

      {/* 로딩 */}
      {loading && <p>로드 중...</p>}

      {/* 데이터 */}
      {data && (
        <ul>
          {data.map((contact) => (
            <li key={contact.id}>{contact.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## 체크리스트: 내 API에 적용하기

```
[ ] 1. error-codes.ts 복사 (src/lib/)
[ ] 2. retry-engine.ts 복사 (src/lib/)
[ ] 3. webhook-retry-queue.ts 복사 (src/lib/) — Webhook만 사용할 시
[ ] 4. ErrorFeedback.tsx 복사 (src/components/)
[ ] 5. 기존 API 엔드포인트 수정 (예제 1-4 참고)
[ ] 6. Prisma schema 추가 (WebhookRetryQueue 모델)
[ ] 7. 클라이언트 컴포넌트 수정 (ErrorFeedback 통합)
[ ] 8. 테스트 실행
   [ ] 400 검증 오류 확인
   [ ] 413 파일 크기 오류 확인
   [ ] 500 재시도 로직 확인
[ ] 9. 배포

```

---

## 참고: TypeScript 타입 안전성

```typescript
// 기존 (타입 불안전)
const response = await fetch('/api/contacts');
const data = await response.json(); // any 타입

// 개선 (타입 안전)
import { retryWithExponentialBackoff } from '@/lib/retry-engine';

interface Contact {
  id: string;
  name: string;
  phone: string;
}

const result = await retryWithExponentialBackoff<Contact[]>(
  async () => {
    const response = await fetch('/api/contacts');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
);

if (result.success) {
  const contacts: Contact[] = result.data!; // 타입 안전 ✅
}
```

---

## 참고: 성능 영향

| 항목 | 값 |
|------|-----|
| 재시도 추가 메모리 | < 1KB per operation |
| 재시도 총 시간 (3회) | ~4-5초 |
| 웹훅 재시도 DB 크기 | ~100바이트 per record |
| Cron 오버헤드 | < 100ms (빈 큐일 때) |

---

## 다음 단계

1. **모니터링**: DataDog/Sentry에 retry metrics 추가
2. **대시보드**: 재시도 통계 대시보드 구현
3. **알림**: 재시도 실패 시 Slack 알림
4. **DLQ (Dead Letter Queue)**: 모든 재시도 실패 기록
