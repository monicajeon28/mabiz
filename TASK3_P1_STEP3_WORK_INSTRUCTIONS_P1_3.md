# Task 3 Step 3: P1-3 (failureReason) 작업지시서

## 최종 결정

| 의사결정 | 선택 | 이유 |
|--------|------|------|
| failureReason 길이 | **1,000자** | 스택 트레이스 3-5줄 포함 가능 |
| truncate 처리 | **코드에서 명시** | truncated 표시로 손실 명확화 |
| 다른 필드 | **webhookType, webhookUrl 추가** | 불일관성 제거 |

---

## Step 4 Implementation: P1-3 failureReason 길이 제한 추가

**목표:**
1. 마이그레이션 파일 작성 — 5분
2. mabiz-dlq.ts 상수 및 truncate 로직 추가 — 10분
3. schema.prisma 업데이트 — 5분
4. 다른 String 필드 길이 검토 — 5분
5. npm run build 확인 — 5분
6. 총 30분

---

### 작업 1: 마이그레이션 파일 작성

**파일:** `prisma/migrations/20260522000001_add_dlq_field_lengths/migration.sql`

```sql
-- P1-3: MabizSyncDLQ 필드 길이 제한 추가

-- failureReason: 1000자 (스택 트레이스 3-5줄)
ALTER TABLE "MabizSyncDLQ"
ALTER COLUMN "failureReason" TYPE VARCHAR(1000);

-- webhookType: 100자
ALTER TABLE "MabizSyncDLQ"
ALTER COLUMN "webhookType" TYPE VARCHAR(100);

-- webhookUrl: 2000자 (URL 안전 범위)
ALTER TABLE "MabizSyncDLQ"
ALTER COLUMN "webhookUrl" TYPE VARCHAR(2000);

-- 코멘트
COMMENT ON COLUMN "MabizSyncDLQ"."failureReason" IS 'Webhook 처리 실패 사유, 최대 1000자 (truncated 표시)';
COMMENT ON COLUMN "MabizSyncDLQ"."webhookType" IS 'Webhook 타입 (purchase/refund/inquiry 등), 최대 100자';
COMMENT ON COLUMN "MabizSyncDLQ"."webhookUrl" IS 'Webhook 엔드포인트 URL, 최대 2000자';
```

---

### 작업 2: mabiz-dlq.ts 수정

**파일:** `src/lib/mabiz-dlq.ts`

**현재 코드:**
```typescript
// L4-5
const MAX_RETRIES = 3;
const RETRY_DELAYS_MIN = [5, 15, 60];

// L10-14
export async function enqueueDLQ(
  webhookType: string,
  payload: unknown,
  failureReason: string,
  format: 'json' | 'form-data' = 'json',
)
```

**수정 후:**
```typescript
// L4-6
const MAX_RETRIES = 3;
const RETRY_DELAYS_MIN = [5, 15, 60];
const MAX_FAILURE_REASON_LENGTH = 1000;

// L10-28: enqueueDLQ 함수
export async function enqueueDLQ(
  webhookType: string,
  payload: unknown,
  failureReason: string,
  format: 'json' | 'form-data' = 'json',
): Promise<string> {
  const truncatedReason = truncateString(failureReason, MAX_FAILURE_REASON_LENGTH);
  
  const entry = await prisma.mabizSyncDLQ.create({
    data: {
      webhookType: truncateString(webhookType, 100),  // 추가
      payload: payload as object,
      failureReason: truncatedReason,
      format,
      retryCount: 0,
      maxRetries: 3,
      nextRetryAt: new Date(Date.now() + RETRY_DELAYS_MIN[0] * 60_000),
    },
  });
  logger.warn('[DLQ] 엔큐', { id: entry.id, webhookType, format, reason: truncatedReason });
  return entry.id;
}

// L65-72: failDLQ 함수
export async function failDLQ(id: string, retryCount: number, reason: string): Promise<void> {
  const truncatedReason = truncateString(reason, MAX_FAILURE_REASON_LENGTH);
  
  // 최대 재시도 도달 → 정지
  if (retryCount >= MAX_RETRIES) {
    await prisma.mabizSyncDLQ.update({
      where: { id },
      data: {
        retryCount: retryCount + 1,
        failureReason: truncatedReason,
        resolvedAt: new Date(),
        nextRetryAt: null,
      },
    });
    logger.warn('[DLQ] 최대 재시도 도달', { id, maxRetries: MAX_RETRIES });
    return;
  }

  // 다음 재시도 예약
  const nextDelay = RETRY_DELAYS_MIN[retryCount];
  await prisma.mabizSyncDLQ.update({
    where: { id },
    data: {
      retryCount: retryCount + 1,
      failureReason: truncatedReason,
      nextRetryAt: new Date(Date.now() + nextDelay * 60_000),
    },
  });
  logger.warn('[DLQ] 재시도 예약', { id, retryCount: retryCount + 1, nextDelayMin: nextDelay });
}

// 유틸 함수 추가 (파일 끝)
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '... (truncated)';
}
```

---

### 작업 3: schema.prisma 업데이트

**파일:** `prisma/schema.prisma` (L1197-1218)

**현재:**
```typescript
model MabizSyncDLQ {
  id            String    @id @default(cuid())
  webhookType   String
  payload       Json
  failureReason String
  format        String    @default("json") @db.VarChar(20)
  ...
  webhookUrl    String?
}
```

**수정 후:**
```typescript
model MabizSyncDLQ {
  id            String    @id @default(cuid())
  webhookType   String    @db.VarChar(100)
  payload       Json
  failureReason String    @db.VarChar(1000)
  format        String    @default("json") @db.VarChar(20)
  ...
  webhookUrl    String?   @db.VarChar(2000)
}
```

---

### 작업 4: 검증

**확인할 것:**
- [ ] MAX_FAILURE_REASON_LENGTH = 1000 상수 추가
- [ ] truncateString() 유틸 함수 추가
- [ ] enqueueDLQ/failDLQ에서 truncate 적용
- [ ] schema.prisma 필드 길이 업데이트
- [ ] npm run build 성공

---

## Step 5 검증

### 검증 목록

- [ ] mabiz-dlq.ts: MAX_FAILURE_REASON_LENGTH 추가
- [ ] mabiz-dlq.ts: truncateString() 함수 추가
- [ ] enqueueDLQ/failDLQ: truncatedReason 사용
- [ ] schema.prisma: 필드 길이 명시
- [ ] npm run build 성공
- [ ] 마이그레이션 파일 생성

### 마이그레이션 적용

```bash
npx prisma migrate dev --name add_dlq_field_lengths
```

---

## Step 6 Git 커밋

**파일:**
- src/lib/mabiz-dlq.ts
- prisma/schema.prisma
- prisma/migrations/20260522000001_add_dlq_field_lengths/migration.sql

**커밋 메시지:**

```
fix(dlq): P1-3 failureReason 길이 제한 추가

- MAX_FAILURE_REASON_LENGTH = 1000 상수화
- failureReason/webhookType/webhookUrl 길이 제한 추가
- truncateString() 유틸 함수로 명시적 truncate 처리
- 오류 정보 손실 시 "(truncated)" 표시

문제:
- failureReason 필드 길이 제한 없음
- 긴 스택 트레이스 저장 시 DB truncate 가능
- truncate 되면 원본 오류 정보 손실

해결:
- failureReason: VARCHAR(1000) - 스택 트레이스 3-5줄 포함
- webhookType: VARCHAR(100)
- webhookUrl: VARCHAR(2000)
- truncate 시 "(truncated)" 표시로 손실 명확화

테스트:
- npm run build ✓
- 마이그레이션 적용 ✓

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

## 시간 예상

- 마이그레이션 작성: 5분
- mabiz-dlq.ts 수정: 10분
- schema.prisma 업데이트: 3분
- 검증: 5분
- 커밋: 5분

**총: 28분**

