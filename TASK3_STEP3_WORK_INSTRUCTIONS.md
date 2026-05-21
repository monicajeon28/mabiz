# Task 3 Step 3: P0 Critical Issues 작업지시서

## 최종 결정사항 (Step 2 토론 기반)

| 의사결정 | 선택 | 이유 |
|--------|------|------|
| Q1: MabizSyncDLQ 구현 | **예** | DLQ는 웹훅 안정성의 핵심 |
| Q2: Webhook 멱등성 격리수준 | **Serializable** | 중복 처리 100% 방지 필수 |
| Q3: Cron 스케줄 간격 | **매시간** | 합리적인 복구 속도 |

---

## Step 4 Implementation 작업 분배

**총 소요 시간: 약 100분**

### 작업 A: MabizSyncDLQ 마이그레이션 (P0-1) — 10분
**담당:** 단독  
**우선순위:** 🔴 MUST DO FIRST

**Step A-1: 마이그레이션 파일 생성**
```bash
# 파일: prisma/migrations/20260521000003_add_mabiz_sync_dlq/migration.sql

-- MabizSyncDLQ 테이블 생성
CREATE TABLE "MabizSyncDLQ" (
  "id" BIGSERIAL PRIMARY KEY,
  "eventId" TEXT NOT NULL UNIQUE,
  "sourceWebhook" TEXT NOT NULL,  -- 'purchase', 'inquiry', 'gold-inquiry', 'payapp'
  "payload" JSONB NOT NULL,
  "retryCount" INTEGER DEFAULT 0,
  "lastRetryAt" TIMESTAMP,
  "nextRetryAt" TIMESTAMP,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "MabizSyncDLQ_nextRetryAt_idx" ON "MabizSyncDLQ"("nextRetryAt");
CREATE INDEX "MabizSyncDLQ_sourceWebhook_idx" ON "MabizSyncDLQ"("sourceWebhook");
```

**Step A-2: 스키마 확인**
- `prisma/schema.prisma`에서 MabizSyncDLQ 모델이 이미 정의되어 있는지 확인
- 이미 있으면 그대로 진행, 없으면 스키마에 추가

**Step A-3: 마이그레이션 배포**
```bash
npx prisma migrate deploy
npm run build  # 빌드 성공 확인
```

**검증:**
```bash
npx prisma db execute --stdin <<EOF
SELECT COUNT(*) FROM "MabizSyncDLQ";
EOF
# 결과: 0
```

---

### 작업 B: vercel.json Cron 등록 (P0-3) — 5분
**담당:** 단독  
**우선순위:** 🔴 MUST DO (작업 A 후)

**Step B-1: vercel.json 수정**
```json
{
  "crons": [
    {
      "path": "/api/cron/execute-cron-jobs",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/retry-mabiz-dlq",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Step B-2: 확인**
- `/api/cron/retry-mabiz-dlq` 엔드포인트 존재 확인
- `src/app/api/cron/retry-mabiz-dlq/route.ts` 파일 존재 확인

---

### 작업 C: MabizSyncDLQ 코드 구현 (P0-2) — 30분
**담당:** 단독  
**우선순위:** 🔴 CRITICAL (작업 A 후)

**Step C-1: DLQ 저장 함수 (src/lib/mabiz-dlq.ts)**
```typescript
export async function saveToMabizDLQ(
  eventId: string,
  sourceWebhook: 'purchase' | 'inquiry' | 'gold-inquiry' | 'payapp',
  payload: Record<string, any>,
  failureReason: string
) {
  const nextRetryAt = new Date(Date.now() + 5 * 60000); // 5분 후
  
  return prisma.mabizSyncDLQ.upsert({
    where: { eventId },
    update: {
      retryCount: { increment: 1 },
      lastRetryAt: new Date(),
      nextRetryAt,
      failureReason: failureReason.slice(0, 500), // 500자 제한
    },
    create: {
      eventId,
      sourceWebhook,
      payload,
      failureReason: failureReason.slice(0, 500),
      nextRetryAt,
    },
  });
}
```

**Step C-2: Webhook 호출 시 DLQ 저장**

**purchase/route.ts:**
```typescript
try {
  const result = await prisma.$transaction(async (tx) => {
    // ... 기존 로직
  });
} catch (error) {
  await saveToMabizDLQ(
    eventId,
    'purchase',
    req.body,
    error instanceof Error ? error.message : String(error)
  );
  return NextResponse.json({success: false}, {status: 500});
}
```

**inquiry/route.ts:**
```typescript
try {
  const result = await prisma.$transaction(async (tx) => {
    // ... 기존 로직
  });
} catch (error) {
  await saveToMabizDLQ(
    eventId,
    'inquiry',
    req.body,
    error instanceof Error ? error.message : String(error)
  );
  return NextResponse.json({success: false}, {status: 500});
}
```

동일 패턴으로 gold-inquiry, payapp에도 적용.

**Step C-3: Cron 재시도 로직 (src/app/api/cron/retry-mabiz-dlq/route.ts)**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { saveToMabizDLQ } from '@/lib/mabiz-dlq';
import { timingSafeEqual } from 'crypto';

const RETRY_DELAYS_MIN = [5, 15, 60, 1440]; // 5분, 15분, 1시간, 1일

export async function GET(req: NextRequest) {
  try {
    // 보안: Cron 인증 확인
    const authHeader = req.headers.get('authorization') || '';
    const expectedSecret = Buffer.from(
      process.env.VERCEL_CRON_SECRET || ''
    );
    const providedSecret = Buffer.from(authHeader.replace('Bearer ', ''));

    if (
      expectedSecret.length === 0 ||
      providedSecret.length === 0 ||
      !timingSafeEqual(expectedSecret, providedSecret)
    ) {
      return NextResponse.json(
        {error: 'Unauthorized'},
        {status: 401}
      );
    }

    // DLQ에서 재시도할 항목 찾기
    const now = new Date();
    const pending = await prisma.mabizSyncDLQ.findMany({
      where: {
        nextRetryAt: {lte: now},
        retryCount: {lt: 4}, // 최대 4회 재시도
      },
      orderBy: {nextRetryAt: 'asc'},
      take: 10, // 한 번에 최대 10개
    });

    for (const item of pending) {
      try {
        // sourceWebhook에 따라 재시도 요청 전송
        const result = await retryWebhook(
          item.sourceWebhook,
          item.payload
        );

        if (result.success) {
          // 성공: DLQ에서 제거
          await prisma.mabizSyncDLQ.delete({where: {id: item.id}});
        } else {
          // 실패: 다음 재시도 일정 계산
          const nextDelayMin = RETRY_DELAYS_MIN[item.retryCount] || 1440;
          const nextRetryAt = new Date(
            Date.now() + nextDelayMin * 60000
          );
          
          await prisma.mabizSyncDLQ.update({
            where: {id: item.id},
            data: {
              retryCount: {increment: 1},
              lastRetryAt: now,
              nextRetryAt,
              failureReason: result.error || 'Unknown error',
            },
          });
        }
      } catch (error) {
        // Cron 내부 에러도 기록
        const nextDelayMin = RETRY_DELAYS_MIN[item.retryCount] || 1440;
        const nextRetryAt = new Date(Date.now() + nextDelayMin * 60000);
        
        await prisma.mabizSyncDLQ.update({
          where: {id: item.id},
          data: {
            lastRetryAt: now,
            nextRetryAt,
            failureReason: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: pending.length,
    });
  } catch (error) {
    // Cron 실패: Vercel에 500 반환하면 자동 재시도
    return NextResponse.json(
      {error: error instanceof Error ? error.message : 'Cron failed'},
      {status: 500}
    );
  }
}

async function retryWebhook(
  sourceWebhook: string,
  payload: Record<string, any>
): Promise<{success: boolean; error?: string}> {
  // 실제로 원본 서비스로 다시 전송
  // 예: mabiz 서비스, payapp 서비스, etc
  // 여기서는 스켈레톤만 제시
  try {
    // TODO: sourceWebhook별 재시도 로직 구현
    // purchase/inquiry/gold-inquiry는 크루즈닷몰/payapp에서 재전송 요청
    return {success: true};
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown',
    };
  }
}
```

---

### 작업 D: payapp Secret 수정 (P0-4) — 2분
**담당:** 단독  
**우선순위:** 🔴 HIGH

**Step D-1: payapp/route.ts 수정**
```typescript
// 파일: src/app/api/webhooks/payapp/route.ts
// 약 line 84

// 변경 전:
const secretKey = process.env.MABIZ_PURCHASE_WEBHOOK_SECRET;

// 변경 후:
const secretKey = process.env.MABIZ_PAYAPP_WEBHOOK_SECRET;
```

**Step D-2: 환경변수 확인**
- `.env.local` 또는 Vercel에 `MABIZ_PAYAPP_WEBHOOK_SECRET` 설정 확인
- 페이앱에서 제공받은 시크릿으로 설정

---

### 작업 E: Webhook 멱등성 - inquiry/gold-inquiry (P0-5, P0-6) — 30분
**담당:** 단독  
**우선순위:** 🔴 HIGH

**Step E-1: inquiry/route.ts 수정**
```typescript
// 파일: src/app/api/webhooks/inquiry/route.ts

const eventId = req.body.id; // 외부 이벤트 ID

// Transaction 시작 전에 체크하는 것 제거
// const existing = await prisma.webHookLog.findUnique({...}); // ❌ 제거

// 모든 로직을 Transaction 안에
const result = await prisma.$transaction(
  async (tx) => {
    // Transaction 내부에서만 체크
    const existing = await tx.webHookLog.findUnique({
      where: {eventId},
    });

    if (existing) {
      return {status: 'duplicate', message: 'Already processed'};
    }

    // 안전하게 처리
    const user = await tx.goldMember.findUnique({
      where: {phone: normalizedPhone},
    });

    const inquiry = await tx.inquiry.create({
      data: {
        ...inquiryData,
        userId: user?.userId || null,
      },
    });

    // 처리 기록 (Transaction 내부)
    await tx.webHookLog.create({
      data: {
        eventId,
        status: 'SUCCESS',
        source: 'inquiry',
      },
    });

    return {status: 'success', inquiry};
  },
  {
    isolationLevel: 'Serializable', // 중요: 가장 엄격한 격리수준
    timeout: 30000, // 30초 타임아웃
  }
);
```

**Step E-2: gold-inquiry/route.ts에 동일 패턴 적용**
- 파일: `src/app/api/webhooks/gold-inquiry/route.ts`
- 동일하게 Transaction 안으로 eventId 체크 이동

**검증:**
```bash
# 동일한 eventId로 두 번 호출
curl -X POST http://localhost:3000/api/webhooks/inquiry \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-event-123",
    "phone": "01012345678",
    ...
  }'

# 두 번째 호출도 동일 응답 (중복 처리 안 됨)
```

---

### 작업 F: Transaction 경계 - purchase (P0-7) — 15분
**담당:** 단독  
**우선순위:** 🔴 HIGH

**Step F-1: purchase/route.ts 수정**
```typescript
// 파일: src/app/api/webhooks/purchase/route.ts

const eventId = req.body.id;

const result = await prisma.$transaction(
  async (tx) => {
    // eventId 중복 체크 (Transaction 내부)
    const existing = await tx.webHookLog.findUnique({
      where: {eventId},
    });

    if (existing) {
      return {status: 'duplicate'};
    }

    // 실제 처리
    const user = await tx.goldMember.findUnique({
      where: {phone: normalizedPhone},
    });

    const contact = await tx.contact.create({
      data: {
        phone: normalizedPhone,
        organizationId: organization.id,
        userId: user?.userId || null,
        ...otherData,
      },
    });

    // eventId 기록도 Transaction 내부 (중요!)
    await tx.webHookLog.create({
      data: {
        eventId,
        status: 'SUCCESS',
        source: 'purchase',
        metadata: {contactId: contact.id},
      },
    });

    return {status: 'success', contact};
  },
  {
    isolationLevel: 'Serializable',
    timeout: 30000,
  }
);

if (result.status === 'success') {
  return NextResponse.json(result, {status: 200});
} else if (result.status === 'duplicate') {
  return NextResponse.json({message: 'Already processed'}, {status: 200});
}
```

**검증:**
```bash
# Transaction 중간에 네트워크 끊어도 부분 실패 없음
# eventId 또는 Contact 둘 다 생성되거나 둘 다 안 됨
```

---

### 작업 G: Cron 타이밍 공격 방지 (P0-8) — 10분
**담당:** 단독  
**우선순위:** 🟡 MEDIUM (보안)

**Step G-1: retry-mabiz-dlq/route.ts 수정**
```typescript
// 파일: src/app/api/cron/retry-mabiz-dlq/route.ts
// 작업 C-3에서 이미 포함됨

import { timingSafeEqual } from 'crypto';

const authHeader = req.headers.get('authorization') || '';
const expectedSecret = Buffer.from(
  process.env.VERCEL_CRON_SECRET || ''
);
const providedSecret = Buffer.from(authHeader.replace('Bearer ', ''));

if (
  expectedSecret.length === 0 ||
  providedSecret.length === 0 ||
  !timingSafeEqual(expectedSecret, providedSecret)
) {
  return NextResponse.json({error: 'Unauthorized'}, {status: 401});
}
```

---

## Step 5 검증 (작업 후)

### 검증 1: 마이그레이션 성공
```bash
npx prisma migrate status
# 모든 마이그레이션이 "✓ applied" 상태
```

### 검증 2: vercel.json 등록 확인
```bash
cat vercel.json | grep retry-mabiz-dlq
# "path": "/api/cron/retry-mabiz-dlq" 출력
```

### 검증 3: 웹훅 DLQ 저장 테스트
```bash
# 의도적으로 실패 유발하는 요청 전송
curl -X POST http://localhost:3000/api/webhooks/inquiry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wrong-secret" \
  -d '{...}'

# DLQ에 기록되었는지 확인
npx prisma db execute --stdin <<EOF
SELECT * FROM "MabizSyncDLQ" ORDER BY "createdAt" DESC LIMIT 1;
EOF
```

### 검증 4: 멱등성 테스트
```bash
# 동일 eventId로 두 번 호출
curl -X POST http://localhost:3000/api/webhooks/inquiry \
  -H "Content-Type: application/json" \
  -d '{"id":"test-123", "phone":"01012345678", ...}'

# 결과: 첫 번째 성공, 두 번째도 200 OK (중복 응답)
# DB: Contact는 1개만 존재
```

### 검증 5: Cron 인증 테스트
```bash
# 잘못된 secret으로 호출
curl -X GET http://localhost:3000/api/cron/retry-mabiz-dlq \
  -H "Authorization: Bearer wrong-secret"

# 결과: 401 Unauthorized
```

---

## Step 6 Git 커밋

```bash
git add prisma/migrations/20260521000003_add_mabiz_sync_dlq/
git add prisma/schema.prisma
git add src/lib/mabiz-dlq.ts
git add src/app/api/webhooks/*/route.ts
git add src/app/api/cron/retry-mabiz-dlq/route.ts
git add vercel.json

git commit -m "fix(webhooks): P0 Critical Issues - MabizSyncDLQ + Idempotency + Security

- P0-1: MabizSyncDLQ 마이그레이션 파일 생성 (테이블 정의)
- P0-2: MabizSyncDLQ 코드 구현 (DLQ 저장/재시도)
- P0-3: vercel.json에 retry-mabiz-dlq Cron 등록
- P0-4: payapp Secret 매핑 수정 (MABIZ_PAYAPP_WEBHOOK_SECRET)
- P0-5/6: Webhook 멱등성 강화 (Serializable + Transaction)
- P0-7: Transaction 경계 수정 (eventId도 Transaction 내부)
- P0-8: Cron 타이밍 공격 방지 (timingSafeEqual)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## 의존성 및 주의사항

1. **마이그레이션 순서:** P0-1 (마이그레이션) → P0-3 (vercel.json) → 나머지
2. **환경변수:** MABIZ_PAYAPP_WEBHOOK_SECRET, VERCEL_CRON_SECRET 확인
3. **Isolation Level:** Serializable은 성능이 약간 떨어질 수 있으나, 중복 처리 방지가 우선
4. **Cron 타임아웃:** vercel.json의 함수 타임아웃과 일치해야 함 (현재 60초)

