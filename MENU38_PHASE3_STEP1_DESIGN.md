# Menu #38 Phase 3 Step 1: CampaignVariant A/B 테스트 인프라 설계

**작업**: CampaignVariant 모델 및 A/B 테스트 인프라 설계
**작성일**: 2026-05-18
**Agent**: α (분석가)
**상태**: 설계 완료 (구현 금지)

---

## 1. 현황 분석

### 1.1 기존 상태 (Phase 2까지)

#### CrmMarketingCampaign 모델 (단일 메시지)
```prisma
model CrmMarketingCampaign {
  id              String
  organizationId  String
  groupId         String
  title           String
  smsBody         String?           // SMS 단일 본문
  sendSms         Boolean
  emailSubject    String?           // 이메일 제목 단일
  emailBody       String?           // 이메일 본문 단일
  sendEmail       Boolean
  sendAt          DateTime
  repeatRule      String?           // ONCE | WEEKLY_* | MONTHLY_*
  status          String            // DRAFT | SCHEDULED | SENT | FAILED
  nextExecutionAt DateTime?
  sentCount       Int               // 총 발송 수
  failedCount     Int
  skippedCount    Int
  openCount       Int               // 이메일 오픈 (향후)
  clickCount      Int               // 클릭 (향후)
  createdAt       DateTime
  updatedAt       DateTime
  sendingHistories SendingHistory[]
}
```

#### SendingHistory 모델 (Phase 2)
```prisma
model SendingHistory {
  id              String
  organizationId  String
  
  // 발송 타입
  sendingType     String            // TEMPLATE | AUTOMATION | CAMPAIGN
  campaignId      String?           // Phase 2에서 추가
  
  // 수신자
  contactId       String
  phone           String?
  email           String?
  
  // 채널
  channel         String            // SMS | EMAIL
  
  // 메시지 내용
  subject         String?
  body            String
  
  // 발송 상태
  status          String            // SENT | FAILED | SKIPPED | RETRY_SCHEDULED | ABANDONED
  sentAt          DateTime?
  failureReason   String?           // INVALID_EMAIL, INVALID_PHONE, OPT_OUT, etc.
  
  // 재시도
  retryCount      Int               // 현재 재시도 횟수
  maxRetries      Int               // 최대 3회
  nextRetryAt     DateTime?
  
  // 메타정보
  metadata        Json?
  
  createdAt       DateTime
  updatedAt       DateTime
  
  campaign        CrmMarketingCampaign?
}
```

**문제점**: 
- 단일 메시지만 지원 (A/B 테스트 불가)
- Variant 선택 로직 없음
- 분석 데이터 없음

---

## 2. 필요 변경사항

### 2.1 추가할 필드 & 관계

#### A. SendingHistory에 추가 필드
```prisma
model SendingHistory {
  // 기존 필드 (생략)
  
  // Phase 3: A/B 테스트 추가
  variantKey      String?           // "A" | "B" | null (기존 발송용)
  variantSplit    Float?            // 트래픽 분할 비율 (0.5 = 50:50)
  
  // 성공률 추적용
  openedAt        DateTime?         // 이메일 오픈 시간
  clickedAt       DateTime?         // 링크 클릭 시간
  clickUrl        String?           // 클릭한 URL
  
  // 인덱스 추가
  @@index([campaignId, variantKey, status]) // Variant별 성공률 분석
}
```

#### B. 새 모델: CampaignVariant
```prisma
model CampaignVariant {
  id              String   @id @default(cuid())
  campaignId      String   // CrmMarketingCampaign 참조
  variantKey      String   // "A" | "B"
  
  // SMS 콘텐츠 (Variant별 특화)
  smsBody         String?  // SMS 본문 (기존: campaign.smsBody로 대체 가능)
  
  // 이메일 콘텐츠 (Variant별 특화)
  emailSubject    String?  // 이메일 제목 A/B
  emailBody       String?  // 이메일 본문 A/B
  
  // 트래픽 분할 설정
  trafficSplit    Float    // 0.5 (50% A, 50% B) 또는 0.3/0.7
  
  // 메타정보
  description     String?  // "Variant A: 이모티콘 포함" 등 설명
  metadata        Json?    // 추가 속성
  
  // 타임스탬프
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // 관계
  campaign        CrmMarketingCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  sendingHistories SendingHistory[]    @relation("VariantSending")
  
  // 유니크 제약: 한 캠페인당 Variant A, B는 최대 1개씩
  @@unique([campaignId, variantKey])
  @@index([campaignId])
  @@map("CampaignVariant")
}
```

#### C. CrmMarketingCampaign 관계 추가
```prisma
model CrmMarketingCampaign {
  // 기존 필드 (생략)
  
  // Phase 3: 관계 추가
  variants        CampaignVariant[] // 이 캠페인의 모든 Variant
  
  // 관계 이름 변경 (Optional)
  // sendingHistories SendingHistory[] @relation("CampaignSending")
}
```

---

## 3. 발송 로직 변경

### 3.1 Variant 선택 알고리즘

#### 3.1.1 Variant 결정 (executeCampaignMessages 내부)
```typescript
// 1. 해당 campaign의 Variant 조회
const variants = await db.campaignVariant.findMany({
  where: { campaignId }
});

// 2. Variant 결정 로직
function selectVariant(variants: CampaignVariant[]): "A" | "B" | null {
  if (variants.length === 0) {
    return null; // A/B 테스트 미사용 (기존 방식)
  }
  
  if (variants.length === 1) {
    // 한 쪽만 있으면 그 쪽 사용 (이상 상태)
    return variants[0].variantKey as "A" | "B";
  }
  
  // 둘 다 있으면 trafficSplit에 따라 선택
  // Variant A의 trafficSplit = 0.5 (50%), B = 0.5 (50%)
  // Variant A의 trafficSplit = 0.3 (30%), B = 0.7 (70%)
  
  const variantA = variants.find(v => v.variantKey === "A");
  const variantB = variants.find(v => v.variantKey === "B");
  
  if (!variantA || !variantB) {
    return null; // 둘 다 없음 (이상 상태)
  }
  
  const rand = Math.random();
  return rand < variantA.trafficSplit ? "A" : "B";
}

const selectedVariant = selectVariant(variants);
```

#### 3.1.2 메시지 내용 결정
```typescript
// 선택된 Variant에 따라 본문 결정
async function resolveMessageContent(
  campaignId: string,
  variantKey: "A" | "B" | null,
  channel: "SMS" | "EMAIL"
) {
  // 기존 캠페인 조회
  const campaign = await db.crmMarketingCampaign.findUnique({
    where: { id: campaignId },
    include: { variants: true }
  });
  
  // A/B 테스트가 없으면 campaign의 기존 필드 사용
  if (variantKey === null) {
    return {
      smsBody: campaign.smsBody,
      emailSubject: campaign.emailSubject,
      emailBody: campaign.emailBody,
    };
  }
  
  // A/B 테스트가 있으면 Variant에서 우선 조회, 없으면 campaign 기본값
  const variant = campaign.variants.find(v => v.variantKey === variantKey);
  
  if (channel === "SMS") {
    return {
      smsBody: variant?.smsBody || campaign.smsBody,
    };
  } else {
    return {
      emailSubject: variant?.emailSubject || campaign.emailSubject,
      emailBody: variant?.emailBody || campaign.emailBody,
    };
  }
}
```

#### 3.1.3 SendingHistory 기록 시 variantKey 포함
```typescript
// execute-campaigns.ts의 createSendingHistory() 함수 수정
async function createSendingHistory(params: {
  campaignId: string;
  contactId: string;
  channel: "SMS" | "EMAIL";
  status: SendingStatus;
  failureReason?: SendingFailureReason;
  organizationId: string;
  messageBody?: string;
  messageSubject?: string;
  sentAt?: Date;
  
  // Phase 3 추가
  variantKey?: string; // "A" | "B" | null
  variantSplit?: number; // 0.5 등
}) {
  await db.sendingHistory.create({
    data: {
      campaignId: params.campaignId,
      contactId: params.contactId,
      channel: params.channel,
      status: params.status,
      failureReason: params.failureReason,
      organizationId: params.organizationId,
      body: params.messageBody || "",
      subject: params.messageSubject || undefined,
      sentAt: params.sentAt,
      retryCount: 0,
      maxRetries: 3,
      nextRetryAt: null,
      scheduledAt: new Date(),
      sendingType: "CAMPAIGN",
      
      // Phase 3
      variantKey: params.variantKey || null,
      variantSplit: params.variantSplit || null,
    },
  });
}
```

---

## 4. 분석 API 스펙

### 4.1 GET /api/campaigns/[id]/variants/stats

#### 요청
```http
GET /api/campaigns/123/variants/stats
Authorization: Bearer <token>
```

#### 응답 (200 OK)
```json
{
  "campaignId": "123",
  "variantA": {
    "key": "A",
    "description": "기존 메시지",
    "trafficSplit": 0.5,
    "stats": {
      "sent": 500,
      "failed": 20,
      "skipped": 5,
      "successRate": "95.5%",
      "opened": 150,
      "openRate": "30%",
      "clicked": 45,
      "clickRate": "9%"
    }
  },
  "variantB": {
    "key": "B",
    "description": "이모티콘 추가",
    "trafficSplit": 0.5,
    "stats": {
      "sent": 500,
      "failed": 15,
      "skipped": 5,
      "successRate": "97%",
      "opened": 180,
      "openRate": "36%",
      "clicked": 60,
      "clickRate": "12%"
    }
  },
  "confidenceLevel": "95%",
  "recommendedWinner": "B",
  "pValue": 0.032,
  "statisticalSignificance": true,
  "sampleSize": {
    "variantA": 525,
    "variantB": 520
  }
}
```

#### 로직
1. 각 Variant별 SendingHistory 조회
   ```sql
   SELECT 
     variantKey,
     COUNT(*) as sent,
     SUM(CASE WHEN status='SENT' THEN 1 ELSE 0 END) as successCount,
     SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) as failedCount,
     SUM(CASE WHEN openedAt IS NOT NULL THEN 1 ELSE 0 END) as openedCount,
     SUM(CASE WHEN clickedAt IS NOT NULL THEN 1 ELSE 0 END) as clickedCount
   FROM SendingHistory
   WHERE campaignId = $1 AND variantKey IS NOT NULL
   GROUP BY variantKey
   ```

2. 성공률 계산
   - successRate = successCount / sent * 100
   - openRate = openedCount / sent * 100
   - clickRate = clickedCount / sent * 100

3. 신뢰도 계산 (Chi-square 또는 Two-proportion Z-test)
   - H0: variantA.successRate == variantB.successRate
   - p-value < 0.05 → 통계적 유의미 (95% 신뢰도)
   - 권장자: p-value < 0.05일 때 더 높은 successRate의 Variant

4. 반환 필드
   - `confidenceLevel`: 95% (고정) 또는 계산된 신뢰도
   - `recommendedWinner`: A | B | null (판정 불가)
   - `pValue`: Chi-square 검정 p-value
   - `statisticalSignificance`: true/false (p < 0.05)

### 4.2 GET /api/campaigns/[id]/variants

#### 요청
```http
GET /api/campaigns/123/variants
Authorization: Bearer <token>
```

#### 응답 (200 OK)
```json
{
  "campaignId": "123",
  "variants": [
    {
      "id": "var_a123",
      "variantKey": "A",
      "smsBody": "...",
      "emailSubject": "새로운 크루즈 여행 안내",
      "emailBody": "...",
      "trafficSplit": 0.5,
      "description": "기존 메시지",
      "createdAt": "2026-05-18T10:00:00Z"
    },
    {
      "id": "var_b123",
      "variantKey": "B",
      "smsBody": "...",
      "emailSubject": "🚢 새로운 크루즈 여행 안내 🌊",
      "emailBody": "...",
      "trafficSplit": 0.5,
      "description": "이모티콘 추가 버전",
      "createdAt": "2026-05-18T10:00:00Z"
    }
  ]
}
```

---

## 5. 마이그레이션 스크립트 스케치

### 5.1 Prisma Migration
```bash
npx prisma migrate dev --name add_campaign_variant_ab_testing
```

### 5.2 Migration SQL (PostgreSQL)
```sql
-- 1. CampaignVariant 테이블 생성
CREATE TABLE "CampaignVariant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campaignId" TEXT NOT NULL,
  "variantKey" TEXT NOT NULL,
  "smsBody" TEXT,
  "emailSubject" TEXT,
  "emailBody" TEXT,
  "trafficSplit" FLOAT NOT NULL,
  "description" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignVariant_campaignId_fkey" 
    FOREIGN KEY ("campaignId") REFERENCES "CrmMarketingCampaign"("id") ON DELETE CASCADE,
  UNIQUE ("campaignId", "variantKey")
);

-- 2. SendingHistory 테이블 컬럼 추가
ALTER TABLE "SendingHistory"
ADD COLUMN "variantKey" TEXT,
ADD COLUMN "variantSplit" FLOAT,
ADD COLUMN "openedAt" TIMESTAMP(3),
ADD COLUMN "clickedAt" TIMESTAMP(3),
ADD COLUMN "clickUrl" TEXT;

-- 3. 인덱스 생성
CREATE INDEX "idx_campaign_variant_campaign_id" ON "CampaignVariant"("campaignId");
CREATE INDEX "idx_sending_history_variant_analysis" ON "SendingHistory"("campaignId", "variantKey", "status");
CREATE INDEX "idx_sending_history_opened" ON "SendingHistory"("campaignId", "openedAt") WHERE "openedAt" IS NOT NULL;
CREATE INDEX "idx_sending_history_clicked" ON "SendingHistory"("campaignId", "clickedAt") WHERE "clickedAt" IS NOT NULL;

-- 4. 기존 캠페인 마이그레이션 (선택사항)
-- 기존 캠페인의 smsBody, emailSubject, emailBody를 CampaignVariant로 이관하지 않음
-- 이유: Phase 3에서 A/B 테스트를 명시적으로 활성화할 때만 Variant 생성
```

### 5.3 데이터 마이그레이션 전략
- **기존 캠페인**: variantKey = null로 유지 (단일 메시지 방식)
- **신규 캠페인**: A/B 테스트 활성화 시 Variant A, B 자동 생성
- **기존 데이터**: SendingHistory의 variantKey는 null 유지

---

## 6. UI 레벨 변경사항

### 6.1 캠페인 생성/편집 폼
```typescript
// 기존: 단일 메시지 입력
// 새로운 옵션 추가:
// [ ] A/B 테스트 활성화
// ├─ Variant A (Default)
// │  └─ SMS/Email 입력
// ├─ Variant B
// │  └─ SMS/Email 입력 (Optional)
// └─ 트래픽 분할 비율
//    ├─ 50:50 (추천)
//    ├─ 30:70
//    └─ 커스텀 (슬라이더)
```

### 6.2 캠페인 분석 페이지
```
┌─────────────────────────────────┐
│ 캠페인 분석 탭                      │
├─────────────────────────────────┤
│ [통계] [Variant 비교] [흐름 분석]     │
├─────────────────────────────────┤
│                                 │
│ Variant A vs B 비교             │
│                                 │
│ ┌─────────────┬─────────────┐  │
│ │ Variant A   │ Variant B   │  │
│ ├─────────────┼─────────────┤  │
│ │ 발송: 500건 │ 발송: 500건 │  │
│ │ 성공률: 95% │ 성공률: 97% │  │
│ │ 오픈: 30%   │ 오픈: 36%   │  │
│ │ 클릭: 9%    │ 클릭: 12%   │  │
│ └─────────────┴─────────────┘  │
│                                 │
│ 📊 통계적 유의성: 95% 신뢰도    │
│ 🏆 권장: Variant B              │
└─────────────────────────────────┘
```

---

## 7. 구현 체크리스트 (Phase 3 Wave 1-5)

### Wave 1: 스키마 & 마이그레이션
- [ ] CampaignVariant 모델 Prisma 정의
- [ ] SendingHistory에 variantKey, openedAt, clickedAt 필드 추가
- [ ] 마이그레이션 실행
- [ ] 관계 설정 검증

### Wave 2: 발송 로직 수정
- [ ] Variant 선택 알고리즘 구현
- [ ] executeCampaignMessages() 수정 (variantKey 추가)
- [ ] createSendingHistory() 함수 개선
- [ ] retrySendingMessage() 함수 Variant 처리 추가

### Wave 3: API 구현
- [ ] POST /api/campaigns/[id]/variants (Variant 생성/수정)
- [ ] GET /api/campaigns/[id]/variants (목록 조회)
- [ ] DELETE /api/campaigns/[id]/variants/[variantId]
- [ ] GET /api/campaigns/[id]/variants/stats (분석)

### Wave 4: 통계 계산
- [ ] Chi-square 또는 Z-test 구현
- [ ] 신뢰도 계산 로직
- [ ] 권장자 판정 로직
- [ ] 성공률, 오픈율, 클릭율 계산

### Wave 5: UI 구현
- [ ] 캠페인 생성 폼 A/B 테스트 옵션 추가
- [ ] Variant 관리 페이지
- [ ] 분석 탭 (Variant 비교)
- [ ] 통계 차트 (Chart.js 또는 Recharts)

---

## 8. 주요 의사결정

### 8.1 Variant 저장 전략
**선택**: 별도 CampaignVariant 모델
- 장점: 확장성 (향후 Variant C, D 추가 가능), 캠페인 기본값과 분리
- 단점: 조인 쿼리 필요
- 대안: Campaign 모델에 variantA_*, variantB_* 필드 추가 (비추천)

### 8.2 트래픽 분할
**선택**: 동적 분할 (0.3/0.7, 0.5/0.5 등)
- 각 Variant마다 trafficSplit 필드로 관리
- Variant A trafficSplit = 0.3, B trafficSplit = 0.7 시: A 30%, B 70%
- 합계 검증 필요 (항상 1.0)

### 8.3 통계 검정
**선택**: Chi-square 검정 (기본), 향후 Bayesian 고려
- 구현 간단, 표본 크기 20 이상일 때 정확도 높음
- p-value < 0.05 기준 (95% 신뢰도)

### 8.4 기존 캠페인 호환성
**선택**: variantKey = null로 기존 방식 유지
- A/B 테스트 미사용 캠페인은 campaign.smsBody, campaign.emailBody 사용
- A/B 활성화 시 CampaignVariant 테이블 사용
- 점진적 마이그레이션 가능

---

## 9. 성능 고려사항

### 9.1 인덱싱
```prisma
@@index([campaignId, variantKey, status])
@@index([campaignId, openedAt])
@@index([campaignId, clickedAt])
```

### 9.2 쿼리 최적화
```typescript
// N+1 방지: 배치 조회
const campaigns = await db.crmMarketingCampaign.findMany({
  where: { /* ... */ },
  include: { variants: true } // 한 번에 조회
});

// 통계 쿼리: raw SQL 또는 Prisma groupBy
const stats = await db.sendingHistory.groupBy({
  by: ['variantKey', 'status'],
  where: { campaignId },
  _count: { id: true }
});
```

### 9.3 캐싱
- 분석 API 응답 캐싱 (Redis, 1시간 TTL)
- CampaignVariant 메모리 캐싱 (발송 로직 고속화)

---

## 10. 향후 확장 계획 (Phase 4, 5)

### Phase 4: 고급 분석
- 시간대별 분석 (언제 오픈/클릭이 많은가?)
- 디바이스별 분석 (모바일 vs 데스크탑)
- 지역/고객세그먼트별 분석

### Phase 5: 자동 최적화
- 동적 분할 조정 (점진적 50:50 → 30:70)
- 멀티 Variant 지원 (A/B/C/D 동시 테스트)
- Bayesian 통계 검정

---

## 결론

**CampaignVariant** 모델을 통해:
1. A/B 테스트 인프라 완성
2. 메시지 효율성 측정 가능
3. 파트너 판매 최적화 데이터 제공

**구현 순서**: 스키마 → 발송로직 → API → UI → 통계
**예상 기간**: 5 Wave × 1-2일 = 5-10일
