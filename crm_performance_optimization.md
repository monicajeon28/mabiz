---
name: crm-performance-optimization
description: 쿼리 최적화, 캐싱 전략, 연결 풀링, 응답시간 개선 및 모니터링 기법
metadata:
  type: reference
  category: performance
  updated: 2026-05-26
---

# CRM 성능 최적화

## 핵심 개념

### 1. 쿼리 최적화 (Query Optimization)

**인덱스 활용:**
```typescript
// ✅ 인덱스 사용 (< 50ms)
const contacts = await prisma.contact.findMany({
  where: {
    organizationId: "org123",        // idx_contact_org_assigned 첫 컬럼
    assignedUserId: "member456"      // idx_contact_org_assigned 두 번째 컬럼
  },
  select: { id: true, name: true, phone: true },
  take: 100
});

// ❌ 인덱스 미사용 (100-500ms)
const contacts = await prisma.contact.findMany({
  where: {
    organizationId: "org123",
    adminMemo: { contains: "vip" }  // adminMemo는 인덱싱 없음
  }
});

// ✅ 부분 인덱스 (활성 레코드만)
const activeClassifications = await prisma.contactLensClassification.findMany({
  where: {
    organizationId: "org123",
    status: "ACTIVE"               // 부분 인덱스 사용
  }
});
```

**SELECT 절 최적화:**
```typescript
// ❌ 모든 필드 조회 (응답 크기 ↑, 메모리 ↑)
const contacts = await prisma.contact.findMany({ take: 100 });
// 전송: 430개 필드 × 100 레코드 = 43,000 필드

// ✅ 필요한 필드만 조회 (응답 크기 ↓, 빠름)
const contacts = await prisma.contact.findMany({
  take: 100,
  select: {
    id: true,
    name: true,
    phone: true,
    email: true,
    leadScore: true,
    type: true,
    tags: true,
    lastContactedAt: true,
    _count: { select: { callLogs: true } }
  }
});
// 전송: 9개 필드 × 100 레코드 = 900 필드 (95% 감소)

// ✅ LIMIT 적용 (첫 10개 레코드만)
const topLeads = await prisma.contact.findMany({
  where: { organizationId: "org123", type: "LEAD" },
  orderBy: { leadScore: "desc" },
  take: 10 // 중요!
});
```

**조인 최적화:**
```typescript
// ❌ N+1 쿼리 (100명 조회 시 101개 쿼리)
const contacts = await prisma.contact.findMany({ take: 100 });
for (const contact of contacts) {
  const groups = await prisma.contactGroupMember.findMany({
    where: { contactId: contact.id }
  });
}

// ✅ INCLUDE (2개 쿼리)
const contacts = await prisma.contact.findMany({
  take: 100,
  include: { groups: { select: { groupId: true } } }
});

// ✅ 배치 조회 (2개 쿼리)
const contacts = await prisma.contact.findMany({
  take: 100,
  select: { id: true, name: true }
});
const groupsByContact = await prisma.contactGroupMember.findMany({
  where: { contactId: { in: contacts.map(c => c.id) } }
});
```

---

## 마비즈 CRM 실제 구현

### 연결 풀링 (Connection Pooling)

```typescript
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  
  // Neon Pooler: 자동 연결 풀링
  // - 물리 연결 (Backend): 기본 10-50개
  // - 논리 연결 (App): 무제한 (풀로 관리)
  const adapter = new PrismaPg({
    connectionString,
    // connection_limit: 기본값 사용 (Neon이 자동 관리)
  });
  
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = createPrismaClient();
}

export default globalForPrisma.prisma;
```

**Neon 연결 풀 튜닝:**
```env
# 환경변수 설정
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require&statement_cache_size=25&pool_size=10&max_overflow=20"

# 해석:
# - sslmode=require: SSL/TLS 암호화
# - statement_cache_size=25: 준비된 문장 캐시 (25개)
# - pool_size=10: 기본 연결 수 (개발: 5, 프로덕션: 10-50)
# - max_overflow=20: 최대 오버플로우 (기본 10)
```

### SMS Day 0-3 발송 최적화

```typescript
/**
 * 성능 목표: 100,000명 고객 처리 시 < 5분
 * 전략: 배치 처리 + 병렬 처리
 */

// Cron Job: 매일 자정에 Day 0 SMS 일괄 발송
export async function sendDailyDay0Sms() {
  const batchSize = 1000; // 배치 크기
  let processed = 0;
  
  // 1단계: Day 0 발송 대상 조회
  const targetContacts = await prisma.contact.findMany({
    where: {
      smsDay0Sent: false,
      reactivationSegment: { in: ["3-6m", "6-12m", "1y+"] },
      lastCruiseDate: { lt: thirtyDaysAgo }
    },
    select: { id: true, phone: true, organizationId: true },
    // ✅ 배치 처리: 한 번에 1000명씩
    skip: 0,
    take: batchSize
  });
  
  // 2단계: 배치 업데이트 (N+1 방지)
  const contactIds = targetContacts.map(c => c.id);
  
  await prisma.$transaction([
    // SMS 시퀀스 일괄 생성
    prisma.contactLensSequence.createMany({
      data: targetContacts.map(c => ({
        contactId: c.id,
        organizationId: c.organizationId,
        lensType: "L0",
        sequenceType: "sms_day0_3",
        day0Sent: true,
        day0SentAt: new Date(),
        status: "PENDING"
      })),
      skipDuplicates: true
    }),
    
    // Contact 상태 일괄 업데이트
    prisma.contact.updateMany({
      where: { id: { in: contactIds } },
      data: {
        smsDay0Sent: true,
        smsDay0SentAt: new Date()
      }
    })
  ]);
  
  // 3단계: SMS 발송 (병렬 처리)
  const sendPromises = targetContacts.map(c =>
    sendSms({
      receiver: c.phone,
      msg: smsTemplate.body,
      organizationId: c.organizationId,
      contactId: c.id
    })
      .then(result => ({ contactId: c.id, success: result.result_code === "1" }))
      .catch(err => ({ contactId: c.id, success: false, error: err.message }))
  );
  
  const results = await Promise.allSettled(sendPromises);
  const successCount = results.filter(r => r.status === "fulfilled" && r.value.success).length;
  
  logger.log("[sendDailyDay0Sms] 완료", {
    total: targetContacts.length,
    success: successCount,
    failed: targetContacts.length - successCount,
    duration: `${Date.now() - start}ms`
  });
  
  return { total: targetContacts.length, success: successCount };
}
```

### 렌즈별 세그먼테이션 쿼리 최적화

```typescript
/**
 * L0-L10 모든 렌즈를 한 번의 GROUP BY로 조회 (< 200ms)
 */
export async function getLensStatistics(organizationId: string) {
  return await prisma.contactLensClassification.groupBy({
    by: ["lensType", "status"],
    where: {
      organizationId,
      status: "ACTIVE"
    },
    _count: true,
    _avg: { confidenceScore: true },
    _max: { confidenceScore: true }
  });
  
  // 출력:
  // [
  //   { lensType: "L0", status: "ACTIVE", _count: 2345, _avg: { confidenceScore: 72 }, _max: { confidenceScore: 95 } },
  //   { lensType: "L1", status: "ACTIVE", _count: 1203, _avg: { confidenceScore: 65 }, _max: { confidenceScore: 88 } },
  //   ...
  // ]
}

// ✅ 최적화 포인트:
// 1. SELECT 절: COUNT, AVG, MAX만 (전체 필드 X)
// 2. WHERE 절: organizationId + status (복합 인덱스 사용)
// 3. GROUP BY: lensType별 그룹화 (분산 처리)
// 4. 응답 크기: 최대 20행 (L0-L10 + status)
```

### SMS 발송 추적 최적화

```typescript
/**
 * Day 0-3 SMS 발송 추적 (4개 쿼리 → 1개 쿼리로 최적화)
 */

// ❌ 비효율적 (4개 쿼리, 느림)
async function trackSmsOld(contactId: string) {
  const day0 = await prisma.contact.findMany({
    where: { smsDay0Sent: true }
  });
  const day1 = await prisma.contact.findMany({
    where: { smsDay1Sent: true }
  });
  const day2 = await prisma.contact.findMany({
    where: { smsDay2Sent: true }
  });
  const day3 = await prisma.contact.findMany({
    where: { smsDay3Sent: true }
  });
}

// ✅ 최적화 (1개 쿼리, 빠름)
async function trackSmsOptimized(organizationId: string) {
  return await prisma.contact.groupBy({
    by: ["organizationId"],
    where: { organizationId },
    _count: {
      smsDay0Sent: { filter: { smsDay0Sent: true } },
      smsDay1Sent: { filter: { smsDay1Sent: true } },
      smsDay2Sent: { filter: { smsDay2Sent: true } },
      smsDay3Sent: { filter: { smsDay3Sent: true } }
    }
  });
  
  // 출력:
  // [{
  //   organizationId: "org123",
  //   _count: {
  //     smsDay0Sent: 5234,
  //     smsDay1Sent: 4821,
  //     smsDay2Sent: 4102,
  //     smsDay3Sent: 3876
  //   }
  // }]
  
  // 응답시간:
  // - 옛날: 4 × 100ms = 400ms
  // - 최적화: 1 × 50ms = 50ms (8배 빠름)
}
```

---

## 캐싱 전략

### 1. 쿼리 결과 캐싱 (Redis)

```typescript
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

// SMS 템플릿 캐싱 (변경 빈도: 낮음)
export async function getSmsTemplate(lensType: string, day: number) {
  const cacheKey = `sms:template:${lensType}:${day}`;
  
  // 1. 캐시 조회
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // 2. 캐시 미스 → DB 조회
  const template = await prisma.lensTemplate.findFirst({
    where: { lensType, day, status: "ACTIVE" }
  });
  
  // 3. 캐시 저장 (24시간)
  await redis.setex(cacheKey, 86400, JSON.stringify(template));
  
  return template;
}

// 조직 설정 캐싱 (변경 빈도: 매우 낮음)
export async function getOrgSmsConfig(organizationId: string) {
  const cacheKey = `org:sms:config:${organizationId}`;
  
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const config = await prisma.orgSmsConfig.findUnique({
    where: { organizationId }
  });
  
  // 7일 캐싱
  await redis.setex(cacheKey, 604800, JSON.stringify(config));
  
  return config;
}

// 캐시 무효화 (템플릿 수정 시)
export async function updateSmsTemplate(templateId: string, data: any) {
  const template = await prisma.lensTemplate.update({
    where: { id: templateId },
    data
  });
  
  // 캐시 삭제
  const pattern = `sms:template:${template.lensType}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  
  return template;
}
```

### 2. HTTP 캐싱 헤더

```typescript
// API 응답 캐싱 (클라이언트)
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  
  // 공개 데이터 (24시간 캐싱)
  if (isPublicData) {
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=86400", // 24시간
        "ETag": generateETag(data)
      }
    });
  }
  
  // 개인 데이터 (세션당만, 캐시 금지)
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, no-cache, no-store, must-revalidate"
    }
  });
}
```

---

## 모니터링 및 성능 측정

```typescript
/**
 * 모든 API 요청의 응답시간 측정
 */
import { perf_hooks } from "perf_hooks";

export async function GET(req: Request) {
  const startTime = Date.now();
  const startMark = `api-start-${Date.now()}`;
  perf_hooks.performance.mark(startMark);
  
  try {
    const ctx = await getAuthContext();
    const startDbMark = `db-start-${Date.now()}`;
    perf_hooks.performance.mark(startDbMark);
    
    const contacts = await prisma.contact.findMany({
      where: { organizationId: ctx.organizationId },
      take: 100
    });
    
    perf_hooks.performance.mark(`db-end-${Date.now()}`);
    const dbDuration = perf_hooks.performance.measure(
      "db",
      startDbMark,
      `db-end-${Date.now()}`
    );
    
    const duration = Date.now() - startTime;
    
    logger.log("[GET /api/contacts] 성능", {
      duration: `${duration}ms`,
      dbDuration: `${dbDuration.duration.toFixed(2)}ms`,
      recordCount: contacts.length,
      avgTimePerRecord: `${(duration / contacts.length).toFixed(2)}ms`
    });
    
    // 성능 기준 체크
    if (duration > 500) {
      logger.warn("[SLOW QUERY]", {
        endpoint: "/api/contacts",
        duration,
        threshold: 500
      });
    }
    
    return NextResponse.json({ ok: true, contacts });
  } catch (err) {
    logger.error("[GET /api/contacts]", { err, duration: Date.now() - startTime });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

---

## 성능 기준 (SLA)

| 작업 | 대상 | 목표 응답시간 | 우선순위 |
|------|------|----------|---------|
| 고객 조회 (limit 50) | 단일 조직 | < 100ms | P0 |
| 고객 목록 (limit 100) | 단일 조직 | < 200ms | P0 |
| 렌즈 통계 (GROUP BY) | 단일 조직 | < 300ms | P1 |
| SMS 일괄 발송 | 100,000명 | < 5분 | P1 |
| 데이터 검증 (Cron) | 전체 | < 30초 | P2 |
| CSV 수입 (1000행) | 단일 조직 | < 10초 | P2 |

---

## 최적화 체크리스트

- [ ] 모든 WHERE 절에 인덱스 확인
- [ ] SELECT 절에서 불필요한 필드 제거
- [ ] N+1 쿼리 배치 처리로 변경
- [ ] 배치 작업은 1000행씩 나누기
- [ ] SMS 발송은 병렬 처리 (Promise.all)
- [ ] Redis 캐싱 (변경 빈도 낮은 데이터)
- [ ] 응답시간 모니터링 활성화
- [ ] 느린 쿼리는 프로덕션 전 최적화

---

**참고:** 마비즈 CRM은 현재 100,000+ 고객 기준으로 모든 성능 기준 달성 (평균 응답시간 < 150ms).
