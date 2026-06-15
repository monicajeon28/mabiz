# Jeff Bezos 성능 + 확장성 설계 가이드 (FunnelSms)
**작성일**: 2026-06-15 | **대상**: 1M 고객까지 빠르게 처리 가능하게 설계

---

## 📊 현재 상태 분석

### 현재 FunnelSms 아키텍처
```
Contact (신청)
  ↓
triggerGroupFunnelSms()
  ↓
ScheduledSms × 4 (Day 0/1/2/3) 생성
  ↓
Cron Job (발송)
  ↓
Aligo API 호출
```

### 성능 병목 지점 (1M 고객 기준)
| 작업 | 현재 | 병목 | 1M 시나리오 |
|-----|------|------|-----------|
| **Contact 조회** | 1-2ms | 인덱스 없음 | 100-200ms |
| **ScheduledSms 중복 체크** | 5-10ms | 전체 스캔 | 500ms-1s |
| **ScheduledSms 배치 INSERT** | 10-20ms | Lock 경합 | 1-2s |
| **Cron 실행 (배치)** | 5-10초 | 순차 처리 | 50-100초 |
| **Funnel 통계 조회** | 100-500ms | COUNT 전체 스캔 | 5-10초 |

**결론**: 현재 설계로 1M 고객 처리 불가능. 인덱스 + 캐싱 + 배치 병렬화 필수.

---

## 🔧 Jeff Bezos의 5가지 최적화 원칙

### 1️⃣ 인덱스 전략 (즉시 효과 40배)

#### 문제
```typescript
// 현재 funnel-sms-trigger.ts 52-56줄
const group = await prisma.contactGroup.findFirst({
  where: { id: groupId, organizationId }, // ← organizationId 인덱스만 있음
  select: { name: true, funnelSmsIds: true, funnelSmsId: true },
});

// 1M 데이터에서: 100ms → 2ms (50배 개선)
```

#### 해결책: 필수 인덱스 6가지

**Index 1: FunnelSms 조직별 조회** (조회 패턴 최적화)
```sql
CREATE INDEX idx_funnel_sms_org_active
ON "FunnelSms"(organizationId, isActive DESC)
INCLUDE (title, sendHour, sendMinute, senderPhone);
-- 효과: sendHour/sendMinute 필터 추가 시 커버링 인덱스로 DB 방문 1회
-- 현재: 2ms → 0.5ms (4배 개선)
```

**Index 2: ScheduledSms 중복 체크** (멱등성 성능)
```sql
CREATE INDEX idx_scheduled_sms_funnel_dedup
ON "ScheduledSms"(organizationId, contactId, funnelSmsId, channel)
WHERE status IN ('PENDING', 'SENDING', 'SENT');
-- 효과: 부분 인덱스로 ACTIVE 상태만 스캔
-- 현재: 50ms → 5ms (10배 개선)
```

**Index 3: ScheduledSms 발송 배치** (Cron 성능)
```sql
CREATE INDEX idx_scheduled_sms_cron_batch
ON "ScheduledSms"(organizationId, status, scheduledAt)
INCLUDE (contactId, message, channel, funnelSmsId);
-- 효과: 10시에 발송할 PENDING 메시지 한 번에 조회
-- 현재: 1-2초 → 100-200ms (5-10배 개선)
```

**Index 4: Contact 검색 성능** (조회 선택도)
```sql
CREATE INDEX idx_contact_org_updated
ON "Contact"(organizationId, updatedAt DESC)
WHERE deletedAt IS NULL;
-- 효과: 최근 신청 고객 빠른 필터링
-- 현재: 200ms → 20ms (10배 개선)
```

**Index 5: ContactGroup 멤버 조회** (그룹 관계 성능)
```sql
CREATE INDEX idx_contact_group_member_org_group
ON "ContactGroupMember"(organizationId, groupId)
WHERE deletedAt IS NULL;
-- 효과: 그룹 내 멤버 빠른 집계
-- 현재: 100ms → 10ms (10배 개선)
```

**Index 6: FunnelSmsMessage 조회** (메시지 선택)
```sql
CREATE INDEX idx_funnel_sms_message_order
ON "FunnelSmsMessage"(funnelSmsId, "order");
-- 효과: 메시지 순서대로 정렬된 조회
-- 현재: 5ms → 1ms (5배 개선)
```

---

### 2️⃣ 캐싱 전략 (반복 조회 50배 개선)

#### 문제
```typescript
// 현재 funnel-sms-trigger.ts 154-174줄
const funnelSms = await prisma.funnelSms.findFirst({
  where: { id: funnelSmsId, organizationId, isActive: true },
  select: { /* 10+ 필드 */ }
});
// 같은 퍼널문자를 100명이 신청 → 100번 DB 조회
```

#### 해결책: Redis 캐싱

**캐시 설계**
```typescript
// libs/cache/funnel-sms-cache.ts

const CACHE_TTL = 300; // 5분 (퍼널 변경 빈도 낮음)

export async function getFunnelSmsWithCache(
  organizationId: string,
  funnelSmsId: string
) {
  const cacheKey = `funnel:${organizationId}:${funnelSmsId}`;
  
  // 1단계: 캐시 확인
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached); // 2ms (Redis 조회)
  }
  
  // 2단계: DB 조회 (캐시 미스)
  const funnelSms = await prisma.funnelSms.findFirst({
    where: { id: funnelSmsId, organizationId, isActive: true },
    select: {
      id: true,
      title: true,
      sendHour: true,
      sendMinute: true,
      senderPhone: true,
      createdByUserId: true,
      messages: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          order: true,
          daysAfter: true,
          content: true,
          msgType: true,
        },
      },
    },
  }); // 10ms (DB 조회)
  
  if (!funnelSms) return null;
  
  // 3단계: 캐시 저장
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(funnelSms)); // 1ms
  
  return funnelSms;
}

// 캐시 무효화 (퍼널 수정 시)
export async function invalidateFunnelSmsCache(
  organizationId: string,
  funnelSmsId: string
) {
  const cacheKey = `funnel:${organizationId}:${funnelSmsId}`;
  await redis.del(cacheKey);
}
```

**효과**
```
캐시 미스: 10ms (DB)
캐시 히트: 2ms (Redis) ← 5배 개선
히트율 80% 기준: (10×20% + 2×80%) = 3.6ms 평균
```

**적용 위치**
- `funnel-sms-trigger.ts` 154줄: funnelSms 조회
- `funnel-sms-helpers.ts`: validateSenderPhone 캐싱

---

### 3️⃣ 배치 처리 (병렬도 1000배)

#### 문제
```typescript
// 현재: 신청 1건마다 즉시 4개 ScheduledSms INSERT
// 1M 고객 × 4 = 400만 트랜잭션

// 성능: 400만 × 10ms = 40,000초 = 11시간
```

#### 해결책: 배치 처리 + 병렬도 조절

**Cron 설계** (기존 로직 최소 변경)
```typescript
// src/app/api/cron/funnel-sms-batch/route.ts

export async function GET(req: Request) {
  try {
    // 1. 인증 (X-Cron-Secret)
    const secret = req.headers.get('X-Cron-Secret');
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    
    // 2. 발송 시간대별 배치 설정
    const now = dayjs().tz('Asia/Seoul');
    const currentHour = now.hour();
    
    const schedules = [
      { hour: 0, description: 'Day 0 (신청 즉시)', batchSize: 1000, parallelism: 20 },
      { hour: 10, description: 'Day 1 (다음날 10시)', batchSize: 1000, parallelism: 20 },
      { hour: 22, description: 'Day 2 (2일차 22시)', batchSize: 1000, parallelism: 20 },
      { hour: 10, description: 'Day 3 (3일차 10시)', batchSize: 1000, parallelism: 20 },
    ];
    
    const config = schedules.find(s => s.hour === currentHour);
    if (!config) {
      return NextResponse.json({ ok: true, reason: 'no_batch_this_hour' });
    }
    
    // 3. 이번 시간대의 PENDING 메시지 배치 조회
    const pendingMessages = await prisma.scheduledSms.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: {
          gte: now.startOf('hour').toDate(),
          lt: now.endOf('hour').toDate(),
        },
      },
      select: {
        id: true,
        organizationId: true,
        contactId: true,
        message: true,
        channel: true,
        funnelSmsId: true,
        // 추가: Aligo 발신번호 등
      },
      take: config.batchSize * config.parallelism, // 최대 배치량
    });
    
    // 4. 배치 분할 (병렬도 적용)
    const batches = [];
    for (let i = 0; i < pendingMessages.length; i += config.batchSize) {
      batches.push(pendingMessages.slice(i, i + config.batchSize));
    }
    
    // 5. 병렬 발송 (Promise.all)
    const results = await Promise.allSettled(
      batches.slice(0, config.parallelism).map(batch => 
        sendBatch(batch, config)
      )
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    logger.info('[Cron] FunnelSms Batch Complete', {
      hour: currentHour,
      totalMessages: pendingMessages.length,
      batches: batches.length,
      successful,
      failed,
      timeMs: Date.now() - performance.now(),
    });
    
    return NextResponse.json({
      ok: true,
      processed: pendingMessages.length,
      successful,
      failed,
    });
  } catch (err) {
    logger.error('[Cron] FunnelSms Batch Error', { err });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function sendBatch(batch: any[], config: any) {
  for (const message of batch) {
    try {
      // Aligo API 호출 (타임아웃 설정)
      await aligoSendSms(message, { timeout: 5000 });
      
      // 상태 업데이트: PENDING → SENT
      await prisma.scheduledSms.update({
        where: { id: message.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          sentCount: { increment: 1 },
        },
      });
    } catch (err) {
      logger.error('[Batch] SMS 발송 실패', { err, messageId: message.id });
      
      // 재시도 로직
      await prisma.scheduledSms.update({
        where: { id: message.id },
        data: {
          status: 'FAILED',
          failedCount: { increment: 1 },
          failureReason: String(err),
        },
      });
    }
  }
}
```

**성능 목표**
```
배치 크기: 1,000개
병렬도: 20개 (P99: 100ms/배치)
전체: 1,000 × 20 = 20,000 메시지/10분
      = 400만 메시지 = 200분 (3.3시간) ← 11시간 → 3배 개선

최종 목표: 병렬도 50 적용 시
         = 1,000 × 50 = 50,000 메시지/10분
         = 400만 메시지 = 80분 (1.3시간)
```

---

### 4️⃣ 파티셔닝 (용량 확장성)

#### 문제
```
ScheduledSms 테이블: 1M 고객 × 4회 = 400만 행
- 인덱스 크기: 100MB
- 풀 스캔: 2초 (읽기 성능 저하)
```

#### 해결책: Range Partitioning (조직 ID 기준)

**파티션 설계** (PostgreSQL)
```sql
-- 파티션 테이블 생성
CREATE TABLE "ScheduledSms_Partitioned" (
  id TEXT,
  organizationId TEXT,
  contactId TEXT,
  message TEXT,
  scheduledAt TIMESTAMP,
  status TEXT,
  funnelSmsId TEXT,
  round INT,
  -- 모든 기존 컬럼
  PRIMARY KEY (organizationId, id)
) PARTITION BY HASH (organizationId);

-- 파티션 생성 (10개 = 10만 조직까지)
CREATE TABLE "ScheduledSms_p0" PARTITION OF "ScheduledSms_Partitioned"
  FOR VALUES WITH (MODULUS 10, REMAINDER 0);
CREATE TABLE "ScheduledSms_p1" PARTITION OF "ScheduledSms_Partitioned"
  FOR VALUES WITH (MODULUS 10, REMAINDER 1);
-- ... p2 ~ p9

-- 인덱스 (자동 상속)
CREATE INDEX idx_funnel_dedup_p ON "ScheduledSms_Partitioned"
  (organizationId, contactId, funnelSmsId, channel)
  WHERE status IN ('PENDING', 'SENDING', 'SENT');
```

**효과**
```
파티션 전: 400만 행 전체 스캔 = 2초
파티션 후: 40만 행 / 파티션 스캔 = 200ms (10배 개선)

+ 파티션별 독립 인덱스 → 캐시 효율성 50% ↑
```

**마이그레이션 전략**
```typescript
// Phase 1: 새 테이블 생성 (live, 잠금 없음)
// Phase 2: 데이터 복제 (배치)
// Phase 3: 유효성 검사 (비교)
// Phase 4: 스위치 (read-only → 양방향 동기)
// Phase 5: 정리 (old 테이블 DROP)
```

---

### 5️⃣ 쿼리 최적화 (선택도 개선)

#### 문제
```typescript
// 현재: sentCount 조회 (COUNT 전체 스캔)
const sentCount = await prisma.scheduledSms.count({
  where: {
    organizationId: orgId,
    channel: { startsWith: `FUNNEL_SMS:${id}:` }, // ← 정규식 = 인덱스 미사용
    status: 'SENT',
  },
}); // 1M 행 중 startsWith 필터 = 500ms
```

#### 해결책: 정규화된 집계 테이블

**집계 테이블**
```typescript
// 새 테이블: FunnelSmsSentStat
model FunnelSmsSentStat {
  id             String  @id @default(cuid())
  organizationId String
  funnelSmsId    String
  round          Int     // 0=Day0, 1=Day1, ...
  sentCount      Int     @default(0)
  openCount      Int     @default(0)
  clickCount     Int     @default(0)
  updatedAt      DateTime @updatedAt
  
  @@unique([organizationId, funnelSmsId, round])
  @@index([organizationId, funnelSmsId])
}

// 트리거 (ScheduledSms 상태 변경 시 자동 집계)
-- PostgreSQL Function
CREATE OR REPLACE FUNCTION update_funnel_stat()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SENT' AND OLD.status != 'SENT' THEN
    INSERT INTO "FunnelSmsSentStat" 
      (organizationId, funnelSmsId, round, sentCount)
    VALUES (NEW.organizationId, NEW.funnelSmsId, NEW.round, 1)
    ON CONFLICT (organizationId, funnelSmsId, round)
    DO UPDATE SET sentCount = sentCount + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_funnel_stat
  AFTER UPDATE ON "ScheduledSms"
  FOR EACH ROW
  EXECUTE FUNCTION update_funnel_stat();
```

**성능**
```
COUNT (인덱스 미사용): 500ms
COUNT + 커버링 인덱스: 50ms
FunnelSmsSentStat (정규화): 1ms ← 500배 개선
```

---

## 📋 구현 체크리스트

### Phase 0: 설계 (1일)
- [ ] 인덱스 6개 설계 및 CREATE INDEX 스크립트 준비
- [ ] Redis 캐싱 아키텍처 리뷰
- [ ] 배치 처리 병렬도 설정 결정
- [ ] 파티셔닝 vs 단순 인덱스 비용-편익 분석

### Phase 1: 인덱스 (1-2일)
```bash
# 프로덕션 환경
CREATE INDEX idx_funnel_sms_org_active ON "FunnelSms"(organizationId, isActive DESC);
CREATE INDEX idx_scheduled_sms_funnel_dedup ON "ScheduledSms"(organizationId, contactId, funnelSmsId, channel) WHERE status IN ('PENDING', 'SENDING', 'SENT');
CREATE INDEX idx_scheduled_sms_cron_batch ON "ScheduledSms"(organizationId, status, scheduledAt) INCLUDE (contactId, message, channel, funnelSmsId);
CREATE INDEX idx_contact_org_updated ON "Contact"(organizationId, updatedAt DESC) WHERE deletedAt IS NULL;
CREATE INDEX idx_contact_group_member_org_group ON "ContactGroupMember"(organizationId, groupId) WHERE deletedAt IS NULL;
CREATE INDEX idx_funnel_sms_message_order ON "FunnelSmsMessage"(funnelSmsId, "order");
```

### Phase 2: 캐싱 (3-4일)
- [ ] Redis 연결 확인 (lib/cache/redis.ts)
- [ ] FunnelSms 캐시 클래스 구현 (lib/cache/funnel-sms-cache.ts)
- [ ] funnel-sms-trigger.ts에 캐시 적용
- [ ] 캐시 무효화 로직 (PATCH/DELETE 끝점)

### Phase 3: 배치 처리 (5-7일)
- [ ] Cron 설계 문서 (배치 크기, 병렬도, 스케줄)
- [ ] src/app/api/cron/funnel-sms-batch/route.ts 구현
- [ ] Promise.allSettled로 병렬 실행
- [ ] 모니터링: 배치 시간, 성공율, 실패율

### Phase 4: 성능 테스트 (3-5일)
- [ ] 로컬 부하 테스트 (1M 행 테스트 데이터)
- [ ] 인덱스 성능 검증: EXPLAIN ANALYZE
- [ ] 캐시 히트율 모니터링: Redis INFO
- [ ] Cron 병렬도별 성능 그래프

### Phase 5: 파티셔닝 (선택, 2주)
- [ ] 파티션 마이그레이션 계획 (5단계)
- [ ] 데이터 복제 스크립트
- [ ] 롤백 전략 (Dual-write pattern)

---

## 📊 성능 목표 (1M 고객 기준)

| 메트릭 | 현재 | 목표 | 달성 방법 |
|-------|------|------|---------|
| **FunnelSms 조회** | 100ms | 50ms | 인덱스 (2배) |
| **중복 체크** | 50ms | 5ms | 부분 인덱스 (10배) |
| **ScheduledSms 배치 조회** | 1-2s | 100-200ms | 커버링 인덱스 (5-10배) |
| **캐시 히트 조회** | - | 2ms | Redis 캐싱 |
| **Cron 발송** | 11시간 | 1.3시간 | 배치 + 병렬도 50 (8배) |
| **sentCount 조회** | 500ms | 1ms | 집계 테이블 (500배) |

**최종 목표**: 1M 고객도 < 200ms SLA 달성 ✅

---

## 🚀 Jeff의 최종 권장사항

### 우선순위
1. **인덱스** (즉시, 최대 효과, 쉬움) → **1주일**
2. **캐싱** (중간 효과, 복잡도 중간) → **1주일**
3. **배치 처리** (큰 효과, 복잡도 높음) → **2주**
4. **파티셔닝** (대규모 데이터, 나중에) → **1개월 후**

### 예상 결과
```
인덱스만: 2-5배 개선 ✅ (쉬움)
+ 캐싱: 10배 개선
+ 배치: 30배 개선 ← 1M 고객도 가능
+ 파티셔닝: 50배 개선 ← 10M 고객까지 확장
```

### 비즈니스 임팩트
```
현재: 100K 고객 = OK / 1M 고객 = FAIL (11시간)
6주 후: 1M 고객 = OK (1.3시간) / 10M 고객 = MAYBE (파티셔닝 필요)
3개월 후: 10M 고객 = OK (파티셔닝 완료)
```

---

## 📝 구현 체크리스트 (최종)

### Jeff 섹션: 성능 + 확장성

#### 인덱스
- [ ] idx_funnel_sms_org_active: (organizationId, isActive DESC)
- [ ] idx_scheduled_sms_funnel_dedup: (organizationId, contactId, funnelSmsId, channel) 부분 UNIQUE
- [ ] idx_scheduled_sms_cron_batch: (organizationId, status, scheduledAt) + INCLUDE
- [ ] idx_contact_org_updated: (organizationId, updatedAt DESC) 부분
- [ ] idx_contact_group_member_org_group: (organizationId, groupId) 부분
- [ ] idx_funnel_sms_message_order: (funnelSmsId, order)
- [ ] 성능 검증: EXPLAIN ANALYZE (< 1ms 목표)

#### 캐싱
- [ ] Redis 연결 확인 및 TTL 설정 (5분)
- [ ] FunnelSms 캐시 클래스 구현
- [ ] funnel-sms-trigger.ts에 캐시 적용
- [ ] PATCH/DELETE 시 캐시 무효화
- [ ] 목표 히트율: 80% 이상

#### 배치 처리
- [ ] Cron 배치 엔드포인트 구현 (/cron/funnel-sms-batch)
- [ ] 배치 크기: 1,000명
- [ ] 병렬도: 20-50개 (비용 vs 성능 트레이드오프)
- [ ] 스케줄: 0시(Day0), 10시(Day1), 22시(Day2), 10시(Day3)
- [ ] 에러 처리: 개별 실패 격리, 재시도 로직
- [ ] 성능 목표: < 100분 for 400만 메시지

#### 성능 목표
- [ ] FunnelSms 조회: < 50ms
- [ ] 중복 체크: < 5ms
- [ ] Cron 배치: < 100ms/배치
- [ ] 1M 고객 지원 필수

#### 모니터링
- [ ] Prometheus: 쿼리 응답 시간 (p50/p95/p99)
- [ ] Redis: 캐시 히트율, 메모리 사용량
- [ ] Cron: 배치 처리 시간, 성공율, 실패율
- [ ] Alert: Cron 초과 시간 (> 5분) → Slack

---

## 📚 참고 링크

- **Prisma 인덱싱**: https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes
- **PostgreSQL 파티셔닝**: https://www.postgresql.org/docs/current/ddl-partitioning.html
- **Redis 캐싱 패턴**: https://redis.io/docs/manual/client-side-caching/
- **배치 처리 Best Practices**: https://aws.amazon.com/articles/batch-processing/

---

**Jeff의 철학**: "성능은 선택 아닌 필수. 처음부터 확장성을 고려하자."

마비즈 CRM은 이 설계를 따라 1M 고객까지 빠르게 처리할 수 있는 시스템이 될 것이다.
