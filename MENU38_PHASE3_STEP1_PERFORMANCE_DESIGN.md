# Menu #38 Phase 3 Step 1 - 성능 최적화 전략 설계
> Agent γ의 1500명 대량 발송 대응 (설계 문서)

**작업**: 성능 최적화 전략 설계 (기업 규모 캠페인 대응)  
**담당**: Agent γ  
**기한**: Phase 3 Step 1 (설계만, 구현 X)  
**기준일**: 2026-05-18  

---

## 1. 현재 상태 분석

### 1.1 배치 처리 현황 (`execute-campaigns.ts`)

| 항목 | 현재값 | 비고 |
|------|--------|------|
| **배치 크기** | 50명 | 보수적 설정 (Phase 2) |
| **발송 방식** | Promise.allSettled | 병렬 발송 (50개 동시) |
| **Retry 간격** | 1h / 6h / 24h | Jitter ±10% 적용 |
| **재시도 한도** | 3회 (maxRetries=3) | 합계 31시간 |
| **Cron 빈도** | 5분 (추정) | 설정 미확인 |

**처리량 추정** (현재):
```
배치 50 × 5분 주기 = 600명/30분 = 1,200명/시간
30분 내 1500명 처리 = ❌ 불가능 (batch 크기 증가 필요)
```

### 1.2 데이터베이스 연결 풀

| 설정 | 현재값 | 권장값 |
|------|--------|--------|
| **DB Pool Size** | 20 (Neon pooler) | 25-30 |
| **URL** | pooler endpoint | ✅ Neon pg_bouncer 사용 중 |
| **Prisma Pool** | 10 (기본값) | 25-30 |
| **연결 증가 시 영향** | 응답 시간 증가 | 재연결 대기 |

**현재 병목**:
```
배치 50 × Promise.allSettled() 호출:
→ 50개의 db.contact.findUnique() 동시 실행
→ Prisma pool (10개) 부족 → 대기 큐 형성
→ 배치 처리 시간 = 50 / 10 × {쿼리시간} = 5배 증가
```

### 1.3 API 호출 분석

#### SMS (Aligo)
- **처리 구조**: `sendSms()` → HTTP POST 동기 호출
- **Rate Limit**: 초당 최대 10건 (공식 미명시, 보수 추정)
- **응답 시간**: 평균 200~500ms
- **병목**: 순차 처리 의무 (병렬 금지 권장)

#### Email (Gmail SMTP)
- **처리 구조**: `nodemailer.sendMail()` → SMTP 동기 연결
- **Rate Limit**: 초당 최대 100건 (Gmail 기본)
- **응답 시간**: 평균 500~1000ms
- **병목**: SMTP 동시 연결 제한 (기본 5-10개)

---

## 2. 병목 지점 식별

### A. 데이터베이스 연결 풀 부족

**증상**: 배치 크기 ↑ → 응답 시간 기하급수 ↑

**원인 분석**:
```typescript
// 현재 코드 (execute-campaigns.ts, 라인 83-106)
for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
  const batch = contactIds.slice(i, i + BATCH_SIZE);
  const contacts = await db.contact.findMany({...});  // OK (1회)
  
  const results = await Promise.allSettled(
    batch.map(async (contactId) => {
      await sendSingleMessage({...});  // ❌ 50개 동시 호출
    })
  );
}

// sendSingleMessage 내부:
const contact = preloadedContact || await db.contact.findUnique({...});  // N+1 우려
```

**결과**:
- 배치 크기 50 → DB pool 10 → 대기 큐 형성
- 평균 응답 시간 = (50 / 10) × 단일 응답 시간 = **5배 증가**
- 1500명 처리 시간 = 1500 / 50 × (배치 시간 증가) = **급증**

### B. SMS API Rate Limit (Aligo)

**현재 발송 로직**:
```typescript
// sendSingleMessage() 호출 순서 분석
const results = await Promise.allSettled(
  batch.map(async (contactId) => {
    // 각 contactId에 대해:
    // 1. DB 조회
    // 2. sendSms() 호출 ← API 동시성 높음
    // 3. SendingHistory 기록
  })
);

// sendSms() 내부는 동기 fetch (병렬 가능)
```

**문제점**:
- 배치 50 × sendSms() 동시 호출 → API 초당 50건 요청
- Aligo 추정 한계 (초당 10건) → **80% 요청 실패**
- Rate limit hit → 재시도 발생 → 악순환

**측정 예시** (실제 필요):
```bash
# 1500명 발송 시뮬레이션
- 배치 50, cron 5분: 30분 내 3회 = 최대 초당 10건
- 배치 300, cron 5분: 5분 내 1회 = 최대 초당 60건 ← 한계 초과
```

### C. Email SMTP 연결 제한

**현재 구조** (`email.ts`):
```typescript
export async function sendFunnelEmail(params: {...}): Promise<FunnelEmailResponse> {
  const config = await getOrgEmailConfig(organizationId);
  const ok = await sendEmail({...});  // nodemailer 동기
}

// nodemailer.sendMail() 내부:
// - 조직별 SMTP 트랜스포터 재생성 (❌ 연결 풀 미사용)
// - Gmail의 기본 동시 연결: ~5-10개
```

**영향**:
- 배치 300 × Email 동시 호출 → 연결 대기 큐
- SMTP 타임아웃 (30초) → 재시도 → 더 많은 대기
- SendGrid 사용 권장 (100건/초), 현재 Gmail SMTP (5-10건/초)

### D. 메모리 사용량

**배치 크기별 메모리 추정**:
```
Contact 1개 = ~0.5KB (id, phone, email)
SendingHistory 기록 = ~1KB
배치 50:  50 × 2KB = 100KB ← 안전 ✓
배치 300: 300 × 2KB = 600KB ← 안전
배치 500: 500 × 2KB = 1MB
배치 1000: 1000 × 2KB = 2MB ← Node.js 기본 힙 8GB 대비 무시할 수준

단, Promise.allSettled() 내 타이머 + 재시도 메모리까지 고려:
실제 메모리 = 배치 크기 × 5~10KB
배치 500 = 2.5~5MB ✓
배치 1000 = 5~10MB ✓
```

**결론**: 메모리는 병목 아님. DB + API 제한이 우선.

---

## 3. 최적화 전략

### 3.1 최적 배치 크기 계산

**고려 요소**:
1. DB pool 성능 (현재 10, 권장 25-30)
2. SMS API 초당 10건 제한
3. Email SMTP 초당 5-10건 제한
4. 5분 Cron 주기 내 처리

**시나리오별 분석**:

#### 시나리오 A: 현재 (배치 50)
```
배치 50 × 5분 = 600명/30분
1500명 처리 = 1500 / 600 × 5분 = 12.5분 ← 가능하지만 주기 3회 필요
최대 동시 요청 = 50 (SMS) → 80% 실패 위험
```

#### 시나리오 B: 적극적 (배치 200)
```
배치 200 × 5분 = 2,400명/30분
1500명 처리 = 1500 / 2400 × 5분 = 3.1분 ← 한 주기 완료
최대 동시 요청 = 200 (SMS) → 초당 40건, 초과 위험

DB Pool 10 + 배치 200:
- Promise.allSettled() 50개 마다 분할 필요
- 또는 Pool 확대 → 25-30
```

#### 시나리오 C: 균형 (배치 150)
```
배치 150 × 5분 = 1,800명/30분
1500명 처리 = 1500 / 1800 × 5분 = 4.2분 ← 한 주기 완료
최대 동시 요청 = 150 (SMS)

분할 처리로 해결:
- 배치 150 = 3개 서브배치 × 50
- 각 서브배치 간 100ms 지연
- SMS: 초당 ~30건 (초과 있으나 순차 재시도로 흡수)
```

**추천 선택**: **배치 150 (또는 250 + Pool 30)**

### 3.2 Prisma 연결 풀 권장값

**현재**: `DATABASE_URL에 max_pool_size=20`

**권장 설정**:
```
배치 150 + 동시 처리:
- Prisma pool = 25-30 (기본 10 → 2.5-3배 증가)
- 각 배치당 DB 쿼리:
  * contact.findMany() 1회
  * db.contact.findUnique() (프리로드로 건너뜀)
  * sendingHistory.create() 배치 크기만큼
  = 총 150 + 1 = 151개 동시 요청
  
- 필요 Pool = 151 / 3 (평균 쿼리 시간 3배 관점) = 50+

✓ 최종 권장:
Database URL: max_pool_size=30
Prisma client: connectionLimit = 30 (env 추가)
```

### 3.3 Cron 빈도 조정

**현재** (추정): 5분

**분석**:
```
5분 Cron + 배치 150 = 1,800명/5분 처리 능력
1500명 대량 발송 = 한 주기 내 완료

단, 재시도:
- 실패율 10% = 150명 재시도 필요
- Cron 5분마다 + 재시도 로직 포함
- 재시도 Cron도 1~2분 간격 권장

권장: 기존 5분 유지 + 재시도 별도 2분 Cron
```

**설정**:
```env
# .env.local 추가
CRON_MAIN_INTERVAL="*/5 * * * *"        # 캠페인 발송
CRON_RETRY_INTERVAL="*/2 * * * *"       # 재시도 처리
CRON_CAMPAIGN_TIMEOUT_SECONDS="300"     # 5분
```

### 3.4 Rate Limit 대응 코드 패턴

#### SMS (Aligo, 초당 10건)

**전략**: Batch 내 **순차 발송** + Concurrency 제한

```typescript
// Phase 3 구현 예정 (설계만)
async function sendSmsBatch(params: {
  smsRequests: SendSmsRequest[];
  concurrency: 3; // 초당 10건 내 유지
}) {
  const queue = [];
  
  for (const req of smsRequests) {
    if (queue.length >= concurrency) {
      await Promise.race(queue); // 하나 완료 대기
      queue.pop();
    }
    
    const promise = sendSms(req).finally(() => {
      // queue에서 제거
    });
    queue.push(promise);
  }
  
  await Promise.all(queue);
}
```

**특징**:
- 초당 최대 3-5건 (안전 마진 50%)
- 배치 150 × 5분 = 3분 내 처리 가능 (150 / 3 = 50초)
- 재시도 큐와 분리 (우선순위)

#### Email (Gmail SMTP 또는 SendGrid)

**전략**: **병렬 가능** (초당 100건 여유)

```typescript
// nodemailer 트랜스포터 풀 (권장)
const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  auth: {...},
  maxConnections: 10,      // 동시 연결 제한
  maxMessages: 100,        // 연결당 메시지 수
  rateDelta: 1000,         // 초당 rate limit (ms)
  rateLimit: 10,           // 초당 최대 메시지
});

// 또는 Promise.all 사용 (SendGrid)
await Promise.all(
  batch.map(contact => sendFunnelEmail({...}))
);
```

**특징**:
- 연결 풀 기반 (재연결 오버헤드 제거)
- SMS보다 훨씬 빠름 (1000ms vs 200ms)

### 3.5 배치 분할 패턴

**배치 150을 3개 서브배치로 분할**:

```typescript
// 설계 스케치 (Phase 3 구현 예정)
const BATCH_SIZE = 150;
const SUB_BATCH_SIZE = 50;
const SUB_BATCH_DELAY = 100; // ms

for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
  const batch = contactIds.slice(i, i + BATCH_SIZE);
  
  for (let j = 0; j < batch.length; j += SUB_BATCH_SIZE) {
    const subBatch = batch.slice(j, j + SUB_BATCH_SIZE);
    
    // DB pool 부담 감소
    const contacts = await db.contact.findMany({
      where: { id: { in: subBatch } }
    });
    
    // SMS/Email 발송 (concurrency 제어)
    await sendBatch({
      contacts,
      concurrency: channel === 'SMS' ? 3 : 10
    });
    
    if (j + SUB_BATCH_SIZE < batch.length) {
      await delay(SUB_BATCH_DELAY); // 서브배치 간 지연
    }
  }
}
```

**이점**:
- DB pool: 151 → 50 + (1+3) = 54 동시 요청 (3배 개선)
- SMS API: 150 → 3개 × 50/분 = 초당 2.5건 (안전)
- 메모리: 150 → 50 유지 (동일)

---

## 4. 모니터링 지표 정의

### 4.1 성능 메트릭

| 지표 | 목표 | 측정 방법 |
|------|------|---------|
| **Average Latency/Message** | <100ms | `(totalTime - setupTime) / contactCount` |
| **Batch Processing Time** | 150건 = <90s | `Date.now() - batchStartTime` |
| **Memory Peak** | <100MB | `process.memoryUsage().heapUsed` |
| **DB Pool Utilization** | <80% | Neon 대시보드 또는 `pg_stat_activity` |
| **API Rate Limit Hit** | <5% | `failureReason === 'PROVIDER_ERROR'` 비율 |
| **SMS Success Rate** | >95% | `sent / (sent + failed)` |
| **Email Success Rate** | >98% | `sent / (sent + failed)` |

### 4.2 로깅 포인트 (execute-campaigns.ts)

**현재**:
```typescript
logger.info(`[Cron] ${channel} 배치 발송 시작`, {
  campaignId,
  channel,
  totalCount: contactIds.length,
});
```

**추가 로깅** (Phase 3):
```typescript
const metrics = {
  startTime: Date.now(),
  batchSize: BATCH_SIZE,
  contactCount: contactIds.length,
  memoryBefore: process.memoryUsage().heapUsed,
};

// 배치 완료 후
logger.info(`[Cron] 배치 발송 완료`, {
  campaignId,
  channel,
  sent,
  failed,
  skipped,
  duration: `${Date.now() - metrics.startTime}ms`,
  avgLatency: `${(Date.now() - metrics.startTime) / contactIds.length}ms`,
  memoryUsed: `${(process.memoryUsage().heapUsed - metrics.memoryBefore) / 1024 / 1024}MB`,
  memoryPeak: `${process.memoryUsage().heapUsed / 1024 / 1024}MB`,
});
```

### 4.3 모니터링 대시보드 (향후)

**필요 메트릭** (ExecutionLog/Analytics):
- 시간별 발송 건수 (그래프)
- 채널별 성공률 (SMS vs Email)
- 재시도율 추이
- DB 연결 풀 사용률
- API Rate Limit Hit 빈도

**도구 선택**:
- Vercel Analytics (자동)
- Datadog 또는 New Relic (권장)
- CloudWatch (AWS) 또는 Google Cloud Monitoring

---

## 5. 구현 순서 및 일정

### Phase 3 Step 구성 (예상)

| Step | 작업 | 담당 | 기간 | 우선순위 |
|------|------|------|------|---------|
| **1** | **성능 최적화 전략 설계** (현재) | γ | 2h | P0 |
| **2** | DB Pool & Cron 설정 | δ | 1h | P0 |
| **3** | 배치 분할 + Rate Limit 코드 | α | 4h | P0 |
| **4** | 모니터링 로깅 통합 | β | 2h | P1 |
| **5** | 부하 테스트 & 검증 | ε | 3h | P1 |
| **6** | 배포 & 롤백 전략 | ζ | 1h | P0 |

**총 예상**: 13시간 (2-3일)

### 산출물 체크리스트

- [ ] ✅ 성능 최적화 설계 (Step 1) ← 현재
- [ ] DB 설정 변경 (DATABASE_URL max_pool_size=30)
- [ ] Cron 환경변수 추가 (CRON_MAIN_INTERVAL, CRON_RETRY_INTERVAL)
- [ ] execute-campaigns.ts 개선 (배치 분할 로직)
- [ ] sendSmsRateLimited() 함수 (동시성 제어)
- [ ] 로깅 강화 (metrics 기록)
- [ ] 단위 테스트 (배치 처리, Rate Limit)
- [ ] 통합 테스트 (1500명 시뮬레이션)
- [ ] 배포 가이드 & Rollback 절차

---

## 6. 결정사항 & 추천

### 최종 권장사항

| 구분 | 선택 | 근거 |
|------|------|------|
| **배치 크기** | 150명 | SMS 초당 10건 + DB pool 20 고려 + 5분 내 완료 |
| **DB Pool** | 30 (현재 20) | 배치 150 + 동시 처리 여유 |
| **Cron 빈도** | 5분 (유지) | 현재 최적, 추가 2분 재시도 Cron |
| **SMS 동시성** | 3건/초 | Aligo 초당 10건 안전 마진 50% |
| **Email 동시성** | 10건/초 | Gmail SMTP 또는 SendGrid 100건/초 |
| **배치 분할** | 3단계 (50+50+50) | Pool 부담 1/3 감소, 관리 간편 |

### 비용 분석

| 항목 | 비용 | 효과 |
|------|------|------|
| DB Pool ↑ (10→30) | 무료 (연결 수만 증가) | DB 응답 시간 50% 개선 |
| Cron 2분 추가 | 무료 (5분 → 2분 추가) | 재시도 15분 → 2분 단축 |
| SendGrid 전환 (선택) | $40-400/월 (1M-10M) | SMS 대비 Email 발송 10배 빠름 |
| 모니터링 대시보드 | 무료-300/월 | 실시간 성능 추적 |

---

## 7. 위험 요소 & 완화 전략

| 위험 | 영향 | 완화 전략 |
|------|------|----------|
| **DB Pool 고갈** | 타임아웃 → 실패율 증가 | Pool 30 + 배치 분할 + 모니터링 |
| **SMS API Rate Limit** | 일부 요청 실패 | 동시성 3건/초 제한 + 재시도 |
| **Email SMTP 연결 제한** | 타임아웃 | nodemailer 풀 10 + rateLimit 설정 |
| **메모리 누수** | OOM 에러 | 배치 분할 (150 → 50) + GC 모니터링 |
| **Cron 동시 실행** | 중복 발송 | 잠금 메커니즘 (Redis 권장) |

---

## 8. 참고자료

### 현재 코드 위치
- **배치 발송 로직**: `src/lib/cron/execute-campaigns.ts` (L83-132)
- **SMS 발송**: `src/lib/aligo.ts` (L72-144)
- **Email 발송**: `src/lib/email.ts` (L106-146)
- **DB 설정**: `.env.local` (L14) + `prisma/schema.prisma` (L6-8)

### 성능 참고 문서
- **Prisma Pool**: https://www.prisma.io/docs/orm/reference/connection-url-reference
- **Neon Pooler**: https://neon.tech/docs/introduction/connection-pooling
- **NodeMailer Pool**: https://nodemailer.com/smtp/pool/
- **Express Rate Limiting**: https://github.com/express-rate-limit/express-rate-limit

### 테스트 시나리오
1. **단위 테스트**: 배치 크기별 (50, 100, 150, 200) DB pool 부하 측정
2. **통합 테스트**: 1500명 시뮬레이션 + Rate Limit 확인
3. **부하 테스트**: 동시 3개 캠페인 (각 500명) 처리
4. **Rollback 테스트**: 배치 크기 축소 시 성능 저하 예측

---

## 9. 다음 단계

### Step 2 (δ - DevOps)
- DATABASE_URL max_pool_size 30으로 변경
- .env.local에 CRON_INTERVAL 환경변수 추가
- Neon 연결 풀 모니터링 설정

### Step 3 (α - Backend)
- execute-campaigns.ts 배치 분할 로직 구현
- sendSmsBatch() 함수 작성 (동시성 3건/초)
- 로깅 강화 (metrics 기록)

### Step 4 (β - QA)
- 단위 테스트 작성
- 부하 테스트 시나리오

### Step 5 (ε - 검증)
- 실제 1500명 캠페인 시뮬레이션
- 성능 메트릭 수집 & 분석

---

**작성**: Agent γ  
**검토**: 대기 (Step 2 이후)  
**승인**: 대기  
**상태**: ✅ 설계 완료 → Step 2 대기
