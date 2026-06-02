# Prisma Schema 업데이트 (Webhook 재시도 큐)

## 개요

Webhook 재시도 기능을 사용하려면 `WebhookRetryQueue` 모델을 추가해야 합니다.

**선택사항**: Webhook을 사용하지 않으면 이 단계는 필수 아님

---

## 추가할 모델

`prisma/schema.prisma`에 다음을 추가하세요:

```prisma
// ─────────────────────────────────────────────────────────────────
// Webhook 재시도 큐
// ─────────────────────────────────────────────────────────────────
// Webhook 처리 실패 시 자동 재시도 스케줄링
// 
// 특징:
// - eventId는 고유 (멱등성)
// - nextRetryAt 인덱스로 효율적 조회
// - payload는 JSON으로 저장 (완전 데이터 보존)
// 
// 예시:
// 1. Webhook 수신: payment.created
// 2. 처리 실패 (DB 오류)
// 3. WebhookRetryQueue에 기록
// 4. Cron이 매분 조회
// 5. 5분 후 자동 재시도
// 6. 성공하면 레코드 삭제

model WebhookRetryQueue {
  /// 레코드 고유 ID
  id            String   @id @default(cuid())
  
  /// Webhook 이벤트 ID (멱등성 기반)
  /// 중복 재시도 방지용
  eventId       String   @unique
  
  /// Webhook 이벤트 타입
  /// 예: "payment.created", "inquiry.submitted", "settlement.updated"
  eventType     String
  
  /// 원본 Webhook 페이로드 (JSON)
  /// 전체 데이터 보존으로 재시도 시 동일하게 처리 가능
  payload       Json
  
  /// 현재까지의 시도 횟수
  /// 초기값: 1, 최대값: 5
  attempt       Int      @default(1)
  
  /// 최대 재시도 횟수
  /// 기본: 5회
  maxAttempts   Int      @default(5)
  
  /// 다음 재시도 예정 시각
  /// 이 시각 <= 현재시각 인 항목을 처리
  nextRetryAt   DateTime
  
  /// 마지막 에러 메시지
  /// 디버깅용
  lastError     String?
  
  /// 생성 일시
  createdAt     DateTime @default(now())
  
  /// 마지막 업데이트 일시
  updatedAt     DateTime @updatedAt

  /// ─────────────────────────────────────────────────────
  /// 인덱스
  /// ─────────────────────────────────────────────────────
  
  /// nextRetryAt 인덱스: Cron이 "처리할 항목" 조회할 때 사용
  /// 매분 실행되므로 매우 중요한 인덱스
  @@index([nextRetryAt])
  
  /// eventId 인덱스: 히스토리 조회 시 사용
  @@index([eventId])
}
```

---

## 마이그레이션 실행

### Step 1: 마이그레이션 생성
```bash
cd D:\mabiz-crm
npx prisma migrate dev --name add_webhook_retry_queue
```

### Step 2: 확인
```bash
# Prisma Client 다시 생성
npx prisma generate

# DB 스키마 확인
npx prisma db push
```

### Step 3: TypeScript 재컴파일
```bash
npx tsc --noEmit
```

---

## 선택사항: DLQ (Dead Letter Queue) 모델

모든 재시도 실패를 기록하려면 다음도 추가:

```prisma
/// Webhook 처리 실패 기록 (DLQ)
/// 최대 재시도 횟수를 초과한 웹훅 기록
model WebhookFailureLog {
  id            String   @id @default(cuid())
  eventId       String   @unique
  eventType     String
  payload       Json
  attempts      Int
  lastError     String?
  createdAt     DateTime @default(now())
  
  @@index([createdAt])
}
```

사용:
```typescript
// src/lib/webhook-retry-queue.ts에서
// 최대 재시도 초과 시
await prisma.webhookFailureLog.create({
  data: {
    eventId,
    eventType,
    payload,
    attempts: maxAttempts,
    lastError: error.message,
  },
});
```

---

## 검증

마이그레이션 후 다음을 확인하세요:

### 1. 테이블 생성 확인
```sql
-- MySQL/PostgreSQL
DESCRIBE webhook_retry_queue;

-- 또는 Prisma Studio
npx prisma studio
```

### 2. TypeScript 타입 확인
```typescript
import { WebhookRetryQueue } from '@prisma/client';

// 컴파일 오류가 없어야 함
const record: WebhookRetryQueue = {
  id: 'test',
  eventId: 'evt_123',
  eventType: 'payment.created',
  payload: { /* ... */ },
  attempt: 1,
  maxAttempts: 5,
  nextRetryAt: new Date(),
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

---

## 데이터 정리 (관리용)

### 오래된 기록 삭제
```typescript
// 7일 이상 된 성공 기록 삭제
await prisma.webhookRetryQueue.deleteMany({
  where: {
    createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  },
});
```

### 수동 재시도
```typescript
// 특정 이벤트 재시도
const retry = await prisma.webhookRetryQueue.findUnique({
  where: { eventId: 'evt_123' },
});

if (retry) {
  await processWebhookEventHandler(
    retry.eventId,
    retry.eventType,
    retry.payload
  );
  
  // 성공하면 삭제
  await prisma.webhookRetryQueue.delete({ where: { id: retry.id } });
}
```

---

## 마이그레이션 파일 예시

자동 생성된 마이그레이션 파일은 다음과 같습니다:

```sql
-- prisma/migrations/[timestamp]_add_webhook_retry_queue/migration.sql

-- CreateTable WebhookRetryQueue
CREATE TABLE `webhook_retry_queue` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `attempt` INTEGER NOT NULL DEFAULT 1,
    `maxAttempts` INTEGER NOT NULL DEFAULT 5,
    `nextRetryAt` DATETIME(3) NOT NULL,
    `lastError` VARCHAR(191),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `webhook_retry_queue_eventId_key`(`eventId`),
    INDEX `webhook_retry_queue_nextRetryAt_idx`(`nextRetryAt`),
    INDEX `webhook_retry_queue_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 롤백 (필요시)

마이그레이션 실패 시:

```bash
# 마지막 마이그레이션 취소
npx prisma migrate resolve --rolled-back "add_webhook_retry_queue"

# 또는 모든 마이그레이션 재설정
npx prisma migrate reset
```

---

## 성능 고려사항

### 인덱스 전략
```
┌─────────────────────────────────────────────────────────┐
│ 인덱스                │ 사용처              │ 중요도    │
├─────────────────────┼──────────────────────┼──────────┤
│ nextRetryAt         │ Cron 조회 (매분)    │ 매우 높음 │
│ eventId (UNIQUE)    │ 멱등성 체크         │ 높음      │
│ eventId (일반)      │ 히스토리 조회      │ 중간      │
└─────────────────────────────────────────────────────────┘
```

### DB 정리 정책
```typescript
// 매주 실행 (Cron)
// - 7일 이상 된 레코드 삭제
// - DLQ에 기록

// 또는 TTL 설정 (필요시)
// MongoDB: { expireAfterSeconds: 604800 } (7일)
```

---

## 체크리스트

- [ ] Schema 파일에 모델 추가
- [ ] `npx prisma migrate dev --name add_webhook_retry_queue` 실행
- [ ] `npx prisma generate` 확인
- [ ] `npx tsc --noEmit` 에러 0개
- [ ] Prisma Studio에서 테이블 확인
- [ ] webhook-retry-queue.ts import 확인
- [ ] Cron 엔드포인트 구현 완료
- [ ] 테스트 실행 (Webhook 처리 실패 → 자동 재시도)

---

## 참고

- Prisma 공식 문서: https://www.prisma.io/docs/
- 마이그레이션 가이드: https://www.prisma.io/docs/concepts/components/prisma-migrate
- JSON 필드: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#json
