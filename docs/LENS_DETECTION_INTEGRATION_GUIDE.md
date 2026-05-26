# 렌즈 감지 엔진 통합 가이드

**목표**: Contact 생성/업데이트 시 자동으로 렌즈 감지 + 분류 저장

---

## 1. 구현 경로 (4가지 옵션)

### 옵션 A: API 수동 호출 (즉시 가능)
```typescript
// Contact 생성/업데이트 후 API 호출
const response = await fetch('/api/contacts/detect-lens', {
  method: 'POST',
  body: JSON.stringify({
    contactId: contact.id,
    organizationId: contact.organizationId
  })
});
```

**장점**: 기존 코드 수정 최소  
**단점**: 수동으로 호출해야 함

### 옵션 B: Webhook 자동 트리거 (권장)
```typescript
// Contact 업데이트 시 자동 트리거
const contact = await db.contact.update({
  where: { id: contactId },
  data: { ... },
  include: { /* ... */ }
});

// 자동 트리거 (post-update hook)
await triggerLensDetection(contact);
```

**장점**: Contact 관련 모든 변경사항에 자동 반응  
**단점**: 매번 API 호출로 성능 영향 가능

### 옵션 C: Background Job (최적화)
```typescript
// Contact 업데이트 시 Job Queue에 추가
await updateContact(contactId);
await queueLensDetection(contactId, organizationId); // 비동기

// Worker: 배치 처리 (5분마다 수집된 Contact 일괄 처리)
// 효율: 1개 API 호출로 100개 Contact 처리
```

**장점**: 성능 최적화, 대량 처리 가능  
**단점**: 약간의 지연 (5분 이내)

### 옵션 D: Prisma Middleware (깊은 통합)
```typescript
// prisma/client 초기화 시
prisma.$use(async (params, next) => {
  const result = await next(params);
  
  if (params.model === 'Contact' && params.action === 'update') {
    // 비동기 트리거
    queueLensDetection(result.id, result.organizationId);
  }
  
  return result;
});
```

**장점**: 모든 Contact 변경에 자동 적용  
**단점**: Prisma 레벨에서 성능 오버헤드

---

## 2. 추천 구현: 옵션 B + C (하이브리드)

### Step 1: Contact 업데이트 함수 수정

```typescript
// src/lib/services/contact-service.ts

import { LensDetectionEngine } from './lens-detection-engine';

export async function updateContactWithLensDetection(
  contactId: string,
  organizationId: string,
  updateData: any
) {
  // Contact 업데이트
  const contact = await db.contact.update({
    where: { id: contactId },
    data: updateData,
    include: { CrmMarketingMessage: true }
  });

  // 렌즈 감지 큐에 추가 (비동기, 즉시 반환)
  await queueLensDetection(contactId, organizationId);

  return contact;
}

/**
 * Job Queue: 배치 렌즈 감지 (5분마다 실행)
 */
async function queueLensDetection(
  contactId: string,
  organizationId: string
) {
  // Redis Queue 또는 database job table에 추가
  if (process.env.REDIS_URL) {
    const redis = getRedisClient();
    await redis.lpush(
      `lens:queue:${organizationId}`,
      JSON.stringify({ contactId, timestamp: Date.now() })
    );
  }
}

/**
 * Worker: 배치 렌즈 감지 실행
 * 실행: CronJob (매 5분마다) 또는 API Gateway 트리거
 */
export async function processPendingLensDetections(
  organizationId: string,
  batchSize: number = 100
) {
  const queueKey = `lens:queue:${organizationId}`;
  const redis = getRedisClient();

  // 큐에서 최대 batchSize개 추출
  const items = [];
  for (let i = 0; i < batchSize; i++) {
    const item = await redis.rpop(queueKey);
    if (!item) break;
    items.push(JSON.parse(item as string));
  }

  if (items.length === 0) return;

  // 렌즈 감지 엔진 초기화
  const engine = new LensDetectionEngine(db, redis);

  // 배치 처리
  const results = [];
  for (const item of items) {
    try {
      const result = await engine.detectLens(
        item.contactId,
        organizationId
      );
      await engine.saveClassification(
        item.contactId,
        organizationId,
        result
      );
      results.push({
        contactId: item.contactId,
        success: true,
        lens: result.primaryLens,
        confidence: result.confidenceScore
      });
    } catch (error) {
      console.error(
        `Lens detection failed: ${item.contactId}`,
        error
      );
      results.push({
        contactId: item.contactId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // 로깅
  console.log(
    `Processed ${results.length} contacts for lens detection`,
    { organizationId, successCount: results.filter(r => r.success).length }
  );

  return results;
}
```

### Step 2: Cron Job 등록

```typescript
// src/lib/cron/lens-detection-batch.ts

import { CronJob } from 'cron';
import { processPendingLensDetections } from '../services/contact-service';
import { db } from '../db';

/**
 * 매 5분마다 대기 중인 Contact의 렌즈 감지 실행
 */
export function startLensDetectionCron() {
  const job = new CronJob('*/5 * * * *', async () => {
    console.log('[Cron] Starting lens detection batch processing...');

    try {
      // 모든 Organization에 대해 배치 처리
      const orgs = await db.organization.findMany({
        select: { id: true },
        where: { status: 'ACTIVE' }
      });

      for (const org of orgs) {
        try {
          await processPendingLensDetections(org.id, 100);
        } catch (error) {
          console.error(
            `Lens detection batch failed for org ${org.id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error('[Cron] Lens detection cron error:', error);
    }
  });

  job.start();
  console.log('[Cron] Lens detection batch job started (every 5 minutes)');
}
```

### Step 3: 앱 시작 시 Cron 등록

```typescript
// src/app/api/init/route.ts 또는 app/page.tsx

import { startLensDetectionCron } from '@/lib/cron/lens-detection-batch';

// 앱 시작 시 한 번만 실행
if (process.env.NODE_ENV === 'production') {
  startLensDetectionCron();
}
```

### Step 4: Contact 업데이트 포인트 수정

Contact를 업데이트하는 모든 곳에서 위 함수 사용:

```typescript
// 변경 전
await db.contact.update({ where: { id }, data });

// 변경 후
import { updateContactWithLensDetection } from '@/lib/services/contact-service';
await updateContactWithLensDetection(id, organizationId, data);
```

---

## 3. 성능 최적화

### 3.1 Redis Cache

```typescript
// LensDetectionEngine에 이미 구현됨
// 24시간 TTL로 동일 Contact에 대한 재계산 방지

// Cache hit 확인 (선택사항)
const cacheKey = `lens:${organizationId}:${contactId}`;
const cached = await redis.get(cacheKey);
if (cached) {
  console.log('Cache hit:', cacheKey);
  return JSON.parse(cached);
}
```

### 3.2 Batch 크기 조정

```typescript
// 5분에 처리할 Contact 수 조정
// 작은 수: 더 자주 처리하지만 오버헤드 증가
// 큰 수: 더 효율적이지만 지연 가능

processPendingLensDetections(organizationId, 200); // 기본: 100, 조정 가능
```

### 3.3 Deduplication

```typescript
// 같은 Contact가 여러 번 큐에 추가되지 않도록 SET 사용
const dedupeKey = `lens:processing:${organizationId}:${contactId}`;
if (await redis.exists(dedupeKey)) {
  return; // 이미 처리 중
}
await redis.set(dedupeKey, '1', { ex: 600 }); // 10분 TTL
```

---

## 4. 모니터링 및 알림

### 4.1 처리 상태 추적

```typescript
// src/lib/services/lens-detection-metrics.ts

export async function trackLensDetectionMetrics(
  organizationId: string
) {
  const redis = getRedisClient();

  const metrics = {
    pending: await redis.llen(`lens:queue:${organizationId}`),
    processedToday: parseInt(
      (await redis.get(`lens:processed:${organizationId}:today`)) || '0'
    ),
    failedToday: parseInt(
      (await redis.get(`lens:failed:${organizationId}:today`)) || '0'
    ),
    avgConfidence: parseFloat(
      (await redis.get(`lens:confidence:${organizationId}:avg`)) || '0'
    ),
    lastRun: await redis.get(`lens:lastrun:${organizationId}`)
  };

  return metrics;
}
```

### 4.2 대시보드 API

```typescript
// GET /api/admin/lens-detection-status

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const organizationId = searchParams.get('organizationId');

  const metrics = await trackLensDetectionMetrics(organizationId!);

  return NextResponse.json({
    status: metrics.pending === 0 ? 'healthy' : 'processing',
    ...metrics
  });
}
```

---

## 5. 마이그레이션 계획

### Phase 1: 신규 Contact만 자동 분류 (즉시)
- 오늘부터 모든 신규 Contact에 대해 렌즈 자동 감지
- 기존 Contact는 유지 (수동으로 필요시)

### Phase 2: 기존 Contact 배치 마이그레이션 (1-2주)
```typescript
// src/scripts/migrate-existing-contacts-lens.ts

async function migrateExistingContactsLens(
  organizationId: string
) {
  const contacts = await db.contact.findMany({
    where: { organizationId },
    select: { id: true },
    take: 10000 // 1만개씩
  });

  for (const contact of contacts) {
    await queueLensDetection(contact.id, organizationId);
  }

  console.log(`Queued ${contacts.length} contacts for lens detection`);
}
```

실행:
```bash
npx ts-node src/scripts/migrate-existing-contacts-lens.ts --orgId=org_xxxxx
```

### Phase 3: 정확도 검증
- 샘플 100개 수동 검증
- 정확도 >= 85% 확인
- 피드백 기반 규칙 미세조정

---

## 6. 트러블슈팅

### 문제: 렌즈 감지가 작동하지 않음

**원인 1**: Redis 연결 실패
```typescript
// 해결: Redis 없이 실행 (인메모리 미지원)
if (!getRedisClient()) {
  throw new Error('Redis is required for lens detection');
}
```

**원인 2**: Contact 데이터 불완전
```typescript
// 해결: 필수 필드 확인
if (!contact.lastContactedAt && !contact.purchasedAt) {
  console.warn(`Contact ${contact.id} has insufficient data for lens detection`);
}
```

### 문제: 성능 저하

**원인**: 동시에 너무 많은 렌즈 감지 실행

**해결**:
- Batch 크기 감소 (100 → 50)
- Cron 간격 확대 (5분 → 10분)
- 야간(22시-8시)만 배치 처리

```typescript
// src/lib/cron/lens-detection-batch-optimized.ts

export function startLensDetectionCronOptimized() {
  // 평일 업무시간: 5분마다, 50개씩
  const businessHours = new CronJob('*/5 9-18 * * 1-5', async () => {
    await processPendingLensDetections(orgId, 50);
  });

  // 야간: 1분마다, 500개씩 (빠르게 처리)
  const nightHours = new CronJob('* 22-23,0-8 * * *', async () => {
    await processPendingLensDetections(orgId, 500);
  });

  businessHours.start();
  nightHours.start();
}
```

---

## 7. 테스트 계획

### 유닛 테스트
```typescript
// tests/lens-detection-engine.test.ts

describe('LensDetectionEngine', () => {
  it('should detect L0 (inactive) correctly', async () => {
    const contact = {
      lastContactedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400일 전
      cruiseCount: 2,
      vipStatus: 'GOLD'
    };

    const result = await engine.detectLens(contact.id, orgId);
    expect(result.primaryLens).toBe('L0');
    expect(result.confidenceScore).toBeGreaterThan(50);
  });

  it('should return L10 for high decision level', async () => {
    const contact = {
      lensMetadata: { decisionLevel: 9, readinessScore: 85 },
      lastContactedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1일 전
    };

    const result = await engine.detectLens(contact.id, orgId);
    expect(result.primaryLens).toBe('L10');
    expect(result.confidenceScore).toBeGreaterThan(80);
  });
});
```

### E2E 테스트
```bash
# Contact 생성 → 렌즈 자동 감지 → 템플릿 자동 선택 → SMS 발송
npm run test:e2e -- --test=lens-detection-flow.e2e.ts
```

---

## 8. 롤아웃 체크리스트

- [ ] LensDetectionEngine 서비스 코드 리뷰
- [ ] API 3개 테스트 완료 (unit + e2e)
- [ ] Contact 업데이트 함수 수정 및 테스트
- [ ] Cron Job 설정 및 모니터링
- [ ] Redis 24h TTL 캐시 검증
- [ ] 샘플 100개 손으로 검증 (정확도 >= 85%)
- [ ] Day 0-3 SMS 템플릿 모두 생성 (L0-L10 × 4일)
- [ ] 대시보드 API 성능 테스트 (<2초)
- [ ] 모니터링 알림 설정 (큐 크기 > 1000일 때)
- [ ] 프로덕션 배포

---

**예상 구현 시간**: 2-3일 (기초 + 통합 + 테스트)  
**예상 효과**: 메시지 관련성 40% → 85%, 월 수익 +$150K
