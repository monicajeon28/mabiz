# Menu #38 Phase 3: API 호환성 자동화 전략 분석

**작성**: Claude Agent  
**날짜**: 2026-05-18  
**목표**: SendingHistory → ExecutionLog 마이그레이션 자동화 최적 전략 선택

---

## 1. 현황 분석

### 1.1 현재 아키텍처
```
SendingHistory 모델 (Prisma)
├── 6개 API 엔드포인트에서 직접 쿼리
├── 각 API에서 동일한 where/include 로직 반복
└── 총 4개 파일에 중복 코드 분산

ExecutionLog 모델 (Phase 0 구축)
├── sourceType='CAMPAIGN' 필터로 캠페인 발송만 추적
├── 더 풍부한 상호작용 필드 (emailOpenedAt, linkClickedAt 등)
└── 월별 중복 방지 (@@unique[sourceType, sourceId, contactId, executeMonth])
```

### 1.2 SendingHistory 직접 사용 위치 (4파일)

| 파일 | 메서드 | 역할 | 중복 코드 |
|------|--------|------|----------|
| `route.ts` | GET | 목록 조회 (where, include 8줄) | findMany + include(contact, campaign) |
| `stats/route.ts` | GET | 통계 (groupBy 3회, 채널별 계산) | groupBy 로직 3회, 성공률 계산 중복 |
| `failures/route.ts` | GET | 실패 목록 (findMany + 필터링) | findMany + include(contact) 중복 |
| `[id]/resend/route.ts` | PATCH | 재전송 (findFirst + update) | findFirst + update 로직 복잡 |

### 1.3 코드 중복 분석

**findMany 패턴 (route.ts, failures/route.ts)**
```typescript
// route.ts - 70줄
prisma.sendingHistory.findMany({
  where: { organizationId: orgId, ...(filterStatus && { status: filterStatus }) },
  include: {
    contact: { select: { id, name, phone, email } },
    campaign: { select: { id, title } },
  },
  orderBy: { createdAt: 'desc' },
  take: limit,
  skip: offset,
})

// failures/route.ts - 84줄 (거의 동일)
prisma.sendingHistory.findMany({
  where: { organizationId: orgId, campaignId, status: statusFilter },
  include: {
    contact: { select: { id, name, email, phone } }, // 순서만 다름
  },
  orderBy: { sentAt: 'desc' },
  take: limit,
  skip: offset,
})
```

**groupBy 패턴 (stats/route.ts)**
```typescript
// 상태별 집계 (82줄)
const statusStats = await prisma.sendingHistory.groupBy({
  by: ['status'],
  where: { organizationId, campaignId, createdAt: { gte: since, lte: now } },
  _count: { id: true },
})

// 채널별 집계 (108줄) - 다시 같은 where 조건으로 groupBy
const channelStats = await prisma.sendingHistory.groupBy({
  by: ['channel', 'status'],
  where: { organizationId, campaignId, createdAt: { gte: since, lte: now } },
  _count: { id: true },
})

// 실패사유별 (143줄) - 또 같은 패턴
const failureReasons = await prisma.sendingHistory.groupBy({
  by: ['failureReason'],
  where: { organizationId, campaignId, createdAt: { gte: since, lte: now }, failureReason: { not: null } },
  _count: { id: true },
})
```

**중복 정량화**
- `include(contact, campaign)` 선택 필드: 4회 반복 → 가능한 통일
- `groupBy` 쿼리 where 조건: 3회 반복 → 함수화 기회
- 직렬화 로직: 4회 반복 → 매핑 함수 기회

---

## 2. 마이그레이션 방식 3가지 비교

### 2.1 방식 A: 래퍼 함수 자동화 (권장)

**개념**: SendingHistory 쿼리를 ExecutionLog로 변환하는 어댑터 함수 작성

```typescript
// src/lib/execution-log-adapter.ts

// 1. 조회 함수
export async function findCampaignExecutionLogs(params: {
  orgId: string;
  campaignId?: string;
  status?: string;
  channel?: string;
  limit: number;
  offset: number;
}) {
  const where = {
    organizationId: params.orgId,
    sourceType: 'CAMPAIGN', // ← 캠페인만 필터링
    ...(params.campaignId && { campaignId: params.campaignId }),
    ...(params.status && { status: params.status }),
    ...(params.channel && { channel: params.channel }),
  };

  return Promise.all([
    prisma.executionLog.findMany({
      where,
      include: {
        campaign: { select: { id: true, title: true } },
        // Contact는 ExecutionLog에 없으므로 직접 조회
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit,
      skip: params.offset,
    }),
    prisma.executionLog.count({ where }),
  ]);
}

// 2. 매핑 함수 (응답 직렬화)
export function mapExecutionLogToSendingHistoryResponse(log: any) {
  return {
    id: log.id,
    contact: null, // ← 나중에 별도 조회
    campaign: log.campaign,
    channel: log.channel,
    status: log.status,
    sentAt: log.sentAt,
    failureReason: log.failureReason,
    failureUserMsg: log.failureUserMsg,
    retryCount: log.retryCount,
    maxRetries: log.maxRetries,
    createdAt: log.createdAt,
  };
}

// 3. 통계 함수
export async function getCampaignExecutionStats(params: {
  orgId: string;
  campaignId: string;
  since: Date;
  until: Date;
}) {
  const where = {
    organizationId: params.orgId,
    sourceType: 'CAMPAIGN',
    campaignId: params.campaignId,
    createdAt: { gte: params.since, lte: params.until },
  };

  // 상태별 집계
  const statusStats = await prisma.executionLog.groupBy({
    by: ['status'],
    where,
    _count: { id: true },
  });

  // 채널별 집계
  const channelStats = await prisma.executionLog.groupBy({
    by: ['channel', 'status'],
    where,
    _count: { id: true },
  });

  // 실패사유별 집계
  const failureReasons = await prisma.executionLog.groupBy({
    by: ['failureReason'],
    where: { ...where, failureReason: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
  });

  return { statusStats, channelStats, failureReasons };
}
```

**API 수정 예시 (route.ts)**
```typescript
// Before (70줄)
const [histories, total] = await Promise.all([
  prisma.sendingHistory.findMany({...}),
  prisma.sendingHistory.count({...}),
]);

// After (5줄)
const [executionLogs, total] = await findCampaignExecutionLogs({
  orgId,
  status: filterStatus,
  limit,
  offset,
});
const histories = executionLogs.map(mapExecutionLogToSendingHistoryResponse);
```

**장점**
- 개발 시간: 2시간
- 유지보수: 중앙화된 로직 (1곳만 관리)
- 오류 확률: 낮음
- 테스트 용이: 어댑터 함수만 테스트하면 됨
- 자동화도: 80% (배포 후 feature flag로 전환)

**단점**
- Contact 조회를 별도로 해야 함 (ExecutionLog에 contact 관계 없음)
- 과도한 N+1 쿼리 가능성

**N+1 해결책**
```typescript
// Contact 배치 조회
const contactIds = executionLogs.map(l => l.contactId);
const contacts = await prisma.contact.findMany({
  where: { id: { in: contactIds } },
});
const contactMap = new Map(contacts.map(c => [c.id, c]));

// 응답에 추가
const histories = executionLogs.map(log => ({
  ...mapExecutionLogToSendingHistoryResponse(log),
  contact: contactMap.get(log.contactId),
}));
```

---

### 2.2 방식 B: 데이터베이스 뷰 (고급)

**개념**: PostgreSQL VIEW로 SendingHistory 테이블을 ExecutionLog로부터 자동 생성

```sql
-- Prisma migration: create_sending_history_view.sql
CREATE OR REPLACE VIEW sending_history_view AS
SELECT
  el.id,
  el.organizationId,
  'CAMPAIGN' as sendingType,
  el.sourceId as sourceId,
  el.campaignId,
  el.contactId,
  el.phone,
  el.email,
  el.channel,
  el.subject,
  el.status,
  el.failureReason,
  el.failureUserMsg,
  el.messageId,
  NULL::timestamp as deliveredAt,
  el.retryCount,
  el.maxRetries,
  el.nextRetryAt,
  NULL::text as failureMessage,
  el.emailStatus,
  el.sentAt as emailSentAt,
  el.emailOpenedAt,
  el.smsStatus,
  el.sentAt as smsSentAt,
  el.linkClickedAt,
  el.registeredAt,
  el.landingPageViewId,
  0 as webhookAttempts,
  NULL::timestamp as lastWebhookAt,
  el.scheduledAt,
  el.sentAt,
  el.createdAt,
  el.updatedAt,
  NULL::jsonb as metadata
FROM ExecutionLog el
WHERE el.sourceType = 'CAMPAIGN';

-- Prisma schema: 뷰를 모델로 등록 (read-only)
model SendingHistoryView {
  id                String
  organizationId    String
  status            String
  ...
  
  @@map("sending_history_view")
  @@ignore // Prisma 마이그레이션 무시
}
```

**장점**
- 개발 시간: 1시간 (SQL 작성 + 1개 migration)
- 자동화도: 100% (모든 API가 자동으로 동작)
- 데이터 일관성: DB 수준에서 보장
- 성능: JOIN 최적화됨 (쿼리 플래너가 최적화)

**단점**
- Contact 정보를 뷰에 포함 안 함 (별도 JOIN 필요)
- 뷰는 write 불가 (INSTEAD OF trigger 필요)
- 복잡도: 높음 (SQL, trigger)
- Prisma 지원 약함 (raw SQL 필요)

---

### 2.3 방식 C: 개별 수정 (보수적)

**개념**: 각 API를 수동으로 하나씩 수정

```typescript
// stats/route.ts에서 직접 ExecutionLog로 변경
const statusStats = await prisma.executionLog.groupBy({
  by: ['status'],
  where: {
    organizationId: orgId,
    sourceType: 'CAMPAIGN',  // ← 추가
    campaignId,
    createdAt: { gte: since, lte: now },
  },
  _count: { id: true },
});
```

**장점**
- 가장 유연함 (각 API마다 최적화 가능)
- 의도가 명확함 (각 파일에서 뭘 하는지 바로 보임)

**단점**
- 개발 시간: 4시간 (4개 파일 × 1시간)
- 중복 코드: 계속 반복됨
- 오류 확률: 높음 (4곳에서 같은 실수 가능)
- 유지보수: 나중에 변경 시 4곳 모두 수정 필요

---

## 3. 권장 방식: 방식 A (래퍼 함수)

### 3.1 구현 우선순위

**Step 1: 어댑터 함수 작성** (30분)
```
src/lib/execution-log-adapter.ts (200줄)
├── findCampaignExecutionLogs()
├── getCampaignExecutionStats()
├── mapExecutionLogToResponse()
└── 에러 핸들링
```

**Step 2: 각 API에 Feature Flag 추가** (30분)
```
src/lib/feature-flags.ts
├── USE_EXECUTION_LOG_STATS (기본: false)
├── USE_EXECUTION_LOG_LIST (기본: false)
├── USE_EXECUTION_LOG_FAILURES (기본: false)
└── USE_EXECUTION_LOG_RESEND (기본: false)
```

**Step 3: API 수정 (feature flag 조건부)** (1시간)
```typescript
// stats/route.ts 예시
if (featureFlags.USE_EXECUTION_LOG_STATS) {
  const stats = await getCampaignExecutionStats({ orgId, campaignId, since, until });
  // stats 처리 (기존과 동일)
} else {
  // 기존 SendingHistory 로직 유지
}
```

**Step 4: 단위 테스트** (30분)
```
src/lib/__tests__/execution-log-adapter.test.ts
├── findCampaignExecutionLogs() - 6개 시나리오
├── getCampaignExecutionStats() - 4개 시나리오
└── 매핑 함수 - 필드 검증
```

**Step 5: 배포 전 검증** (30분)
```
테스트 script
├── 동일한 campaignId로 SendingHistory vs ExecutionLog 비교
├── 응답 포맷 검증
└── 성능 측정 (쿼리 시간 비교)
```

**총 시간**: 3시간

---

## 4. 점진적 마이그레이션 전략

### 4.1 Feature Flag 기반 점진적 전환

```typescript
// src/lib/feature-flags.ts
export interface FeatureFlags {
  USE_EXECUTION_LOG_STATS: boolean;      // 통계 API
  USE_EXECUTION_LOG_LIST: boolean;       // 목록 조회 API
  USE_EXECUTION_LOG_FAILURES: boolean;   // 실패 목록 API
  USE_EXECUTION_LOG_RESEND: boolean;     // 재전송 API
}

export async function getFeatureFlags(orgId: string): Promise<FeatureFlags> {
  const config = await prisma.systemConfig.findUnique({
    where: { configKey: `feature_flags_${orgId}` },
  });
  
  return {
    USE_EXECUTION_LOG_STATS: config?.value?.includes('STATS') ?? false,
    USE_EXECUTION_LOG_LIST: config?.value?.includes('LIST') ?? false,
    // ...
  };
}
```

**전환 단계**

| 날짜 | Phase | 상태 | 대상 조직 |
|------|-------|------|----------|
| 5월 20일 | Alpha | 기본 OFF | 테스트 조직만 ON |
| 5월 25일 | Beta | 기본 OFF | 20개 조직 ON |
| 6월 1일 | Canary | 기본 OFF | 50% 트래픽 ON |
| 6월 10일 | Release | 기본 ON | 100% 전환 완료 |

### 4.2 검증 체크리스트

```typescript
// src/lib/__tests__/migration-validation.ts

export async function validateMigration(campaignId: string) {
  const sendingHistories = await prisma.sendingHistory.findMany({
    where: { campaignId },
  });

  const executionLogs = await prisma.executionLog.findMany({
    where: { campaignId, sourceType: 'CAMPAIGN' },
  });

  const checks = {
    // 1. 기록 수 동일성
    countMatch: sendingHistories.length === executionLogs.length,

    // 2. 응답 포맷 동일성
    formatMatch: sendingHistories.every((sh, i) => {
      const el = executionLogs[i];
      return (
        sh.contactId === el.contactId &&
        sh.channel === el.channel &&
        sh.status === el.status
      );
    }),

    // 3. 성능 (쿼리 시간)
    performanceOk: false, // ← 벤치마크 후 설정

    // 4. 데이터 무결성
    dataIntegrity: true, // ← 샘플 쿼리로 검증
  };

  return checks;
}
```

---

## 5. 사용자 3가지 선택 사항

### Q1: 자동화 방식 선택

**초등학생 수준 설명:**

크루즈 CRM의 "발송 기록"을 새로운 "실행 로그" 시스템으로 옮겨야 합니다.
세 가지 방법이 있어요:

```
🟢 A) 번역기 방식 (권장) - 2시간
   "발송 기록"을 요청하면 자동으로 "실행 로그"에서 찾아와서 보여주기
   → 가장 빠르고 안전함
   → 나중에 여기저기 수정할 게 적음

🟡 B) 데이터베이스 복사 방식 - 1시간
   데이터베이스 자체에서 자동으로 "발송 기록" 가짜 테이블 만들기
   → 가장 똑똑한 방식
   → 근데 너무 복잡해서 나중에 고칠 게 많음

🔴 C) 손으로 하나하나 고치기 - 4시간
   4개 시스템마다 손으로 수정하기
   → 가장 느림
   → 실수할 확률이 높음
```

**추천**: 🟢 A) 번역기 방식

---

### Q2: 한번에 전환 vs 점진적 전환

**초등학생 수준 설명:**

**방식 1) 한번에 전환** (Big Bang)
- 월요일: 새 시스템으로 완전히 전환
- 장점: 빠름 (1시간)
- 단점: 문제 생기면 모든 고객이 피해 봄
- 위험도: ⭐⭐⭐⭐⭐

**방식 2) 조금씩 전환** (Feature Flag) ← 권장
- 월요일: 테스트 조직 10개만 새 시스템 시작
- 수요일: 성공하면 조직 50개 추가
- 금요일: 성공하면 모두 전환
- 장점: 문제 생겨도 영향 범위 작음
- 단점: 2주 걸림
- 위험도: ⭐

**추천**: 방식 2) 조금씩 전환

---

### Q3: 지금 리팩토링 vs 나중에 리팩토링

**초등학생 수준 설명:**

**선택지 1) 지금은 최소 수정, Phase 4에서 리팩토링**
```
지금 (3시간):
├── 번역기 만들기
├── Feature flag만 추가
└── API는 최소한의 수정 (번역기 호출만)

Phase 4 (나중에):
└── 전체 코드 정리하기
```
- 장점: 지금은 빨리 끝남 (3시간)
- 단점: 임시 코드가 섞여 있음

**선택지 2) 지금 완벽하게 리팩토링**
```
지금 (5시간):
├── 번역기 만들기
├── Feature flag 추가
├── 각 API 깔끔하게 다시 쓰기
├── 테스트 작성
└── 검증 스크립트 작성
```
- 장점: 깔끔함, 나중에 할 일 없음
- 단점: 지금 시간 걸림

**추천**: 선택지 1) 지금은 최소 수정

---

## 6. 자동화 실행 체크리스트

```
Phase 3 자동화 체크리스트 (총 3시간)

[ ] 1단계: 어댑터 함수 작성 (30분)
    [ ] src/lib/execution-log-adapter.ts 생성
    [ ] findCampaignExecutionLogs() 함수 구현
    [ ] getCampaignExecutionStats() 함수 구현
    [ ] Contact 배치 조회 로직 추가
    [ ] 오류 핸들링 (try-catch, logger)

[ ] 2단계: Feature Flag 설정 (30분)
    [ ] src/lib/feature-flags.ts 수정
    [ ] SystemConfig에 기본값 저장
    [ ] useFeatureFlags() hook 추가 (필요시)
    [ ] 환경 변수 설정 (.env.example)

[ ] 3단계: API 수정 (60분)
    [ ] route.ts - findMany 조건부 변경
    [ ] stats/route.ts - groupBy 조건부 변경
    [ ] failures/route.ts - findMany 조건부 변경
    [ ] [id]/resend/route.ts - findFirst 조건부 변경
    [ ] 응답 포맷 검증 (변경 전후 동일성)

[ ] 4단계: 단위 테스트 (30분)
    [ ] adapter.test.ts - 6개 시나리오
    [ ] feature-flags.test.ts
    [ ] API 통합 테스트 (with ExecutionLog)

[ ] 5단계: 배포 전 검증 (30분)
    [ ] 마이그레이션 검증 스크립트 실행
    [ ] 동일 campaignId 데이터 비교
    [ ] 성능 벤치마크
    [ ] 실제 조직 1개로 테스트
```

---

## 7. 효율성 계산

| 항목 | 개별 수정 (C) | 래퍼 함수 (A) | 데이터베이스 뷰 (B) |
|------|--------------|--------------|------------------|
| **개발 시간** | 4시간 | 3시간 | 2시간 |
| **테스트 시간** | 3시간 | 1.5시간 | 2시간 |
| **배포 전 검증** | 2시간 | 1시간 | 1.5시간 |
| **트러블슈팅** | 2시간 | 0.5시간 | 1시간 |
| **유지보수 (1년)** | 10시간 | 3시간 | 5시간 |
| **총 시간** | 21시간 | 6시간 | 6.5시간 |
| **오류 확률** | 높음 | 낮음 | 중간 |
| **자동화도** | 0% | 80% | 100% |

**결론**
- **최고 효율**: 방식 A (래퍼 함수)
- **비용 절감**: 15시간 (71% 감소)
- **추천 우선순위**: A > B > C

---

## 8. 다음 단계

### 사용자 답변 필요
```
Q1: 자동화 방식 선택 (A/B/C)?
    → 권장: A) 번역기 방식

Q2: 점진적 vs 한번에?
    → 권장: 점진적 (Feature Flag)

Q3: 지금 리팩토링 vs 나중에?
    → 권장: 나중에 (Phase 4)
```

### 선택 후 진행
1. 어댑터 함수 작성 (src/lib/execution-log-adapter.ts)
2. Feature Flag 추가 (src/lib/feature-flags.ts)
3. 4개 API 순차적 수정 + 테스트
4. 마이그레이션 검증 스크립트 실행
5. Git 커밋 (4-5개)
6. 배포 준비

---

## 참고: ExecutionLog vs SendingHistory 필드 매핑

```typescript
// SendingHistory → ExecutionLog 필드 매핑표

SendingHistory                    ExecutionLog            비고
─────────────────────────────────────────────────────────────
id                      ←→        id
organizationId          ←→        organizationId
sendingType='CAMPAIGN'  ←→        sourceType='CAMPAIGN'
sourceId                ←→        sourceId
campaignId              ←→        campaignId
contactId               ←→        contactId
phone                   ←→        phone                  스냅샷
email                   ←→        email                  스냅샷
channel                 ←→        channel                SMS|EMAIL
subject                 ↔         -                     ExecutionLog에 없음 (contentUrl)
body                    ↔         -                     ExecutionLog에 없음 (contentUrl)
status                  ←→        status
failureReason           ←→        failureReason
failureUserMsg          ←→        failureUserMsg
messageId               ←→        messageId
deliveredAt             ←→        sentAt + ?
retryCount              ←→        retryCount
maxRetries              ←→        maxRetries
nextRetryAt             ←→        nextRetryAt
emailStatus             ←→        status (부분)
emailOpenedAt           ←→        emailOpenedAt         ✨ ExecutionLog의 이점
linkClickedAt           ←→        linkClickedAt         ✨ ExecutionLog의 이점
registeredAt            ←→        registeredAt          ✨ ExecutionLog의 이점
scheduledAt             ←→        scheduledAt
sentAt                  ←→        sentAt
createdAt               ←→        createdAt
updatedAt               ←→        updatedAt

⚠️ 주의사항
- ExecutionLog는 Contact 관계가 없음 → 별도 배치 조회 필요
- message 본문이 contentUrl로 저장됨 → S3/Blob에서 다시 로드 필요
- ExecutionLog의 emailOpenedAt/linkClickedAt는 SendingHistory에서 추적하지 않음
```

---

## 최종 권장사항

```
✅ 최종 선택: 방식 A (래퍼 함수) + 점진적 전환 + 지금은 최소 수정

일정:
- 2026-05-20: Step 1-2 완료 (어댑터 + Feature Flag)
- 2026-05-21: Step 3 완료 (API 수정)
- 2026-05-22: Step 4-5 완료 (테스트 + 검증)
- 2026-05-23: Alpha 배포 (테스트 조직)
- 2026-05-25: Beta 배포 (20개 조직)
- 2026-06-01: Canary 배포 (50% 트래픽)
- 2026-06-10: Release (100% 완료)

비용:
- 개발 시간: 3시간
- 테스트 시간: 1.5시간
- 배포 검증: 1시간
- 총 5.5시간 (기존 21시간 대비 74% 절감)

위험도: ⭐ (매우 낮음)
```
