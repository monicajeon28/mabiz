# Menu #38 Phase 4 Step 5: Prisma Schema 업데이트 가이드

**작성일**: 2026-05-19  
**목표**: 10렌즈 시스템을 위한 Prisma 스키마 모델 정의  
**상태**: 📋 검토 및 승인 대기

---

## 📋 추가할 Prisma 모델 (3개 + 기존 2개 확장)

### 1. ContactLensClassification 모델

```prisma
// Phase 4: 고객별 렌즈 분류 (Step 5-1)
model ContactLensClassification {
  // Primary Key
  id                    String               @id @default(cuid())
  
  // Foreign Keys
  contactId             String               @unique
  organizationId        String
  
  // 렌즈 분류 결과
  lensType              String               // L1-L10
  lensLabel             String?              // "가격 오해형" (UI용 라벨)
  confidenceScore       Int                  @default(0)  // 0-100
  
  // 식별 방법 & 정보
  identificationMethod  String?              // AUTO | MANUAL | CALL_BASED
  questionnaireResponses Json?
  
  // 의사결정 수준 (L10 특화)
  decisionLevel         Int                  @default(0)  // 0-100
  readinessScore        Int                  @default(0)  // 0-100
  
  // 우선순위 & 상태
  priorityLevel         String?              // HIGH | MEDIUM | LOW
  status                String               @default("ACTIVE")  // ACTIVE | PAUSED | CONVERTED
  
  // 타임스탬프
  identifiedAt          DateTime             @default(now())
  lastUpdated           DateTime             @updatedAt
  convertedAt           DateTime?
  
  // Metadata
  notes                 String?
  tags                  String[]             @default([])
  
  // Relations
  contact               Contact              @relation(fields: [contactId], references: [id], onDelete: Cascade)
  organization          Organization         @relation("LensClassifications", fields: [organizationId], references: [id], onDelete: Cascade)
  sequences             ContactLensSequence[]

  @@unique([contactId])
  @@index([organizationId, lensType])
  @@index([priorityLevel, status])
  @@index([organizationId, confidenceScore(sort: Desc)])
  @@map("ContactLensClassification")
}
```

**용도**: 각 고객(Contact)이 어느 렌즈(L1-L10)에 해당하는지 1:1 저장

**핵심 필드**:
- `lensType`: L1~L10 중 어느 렌즈
- `confidenceScore`: 분류 신뢰도 (0~100%)
- `identificationMethod`: 자동/수동/콜기반 분류
- `decisionLevel`: L10 의사결정 수준 (L1~L9는 0)

---

### 2. ContactLensSequence 모델

```prisma
// Phase 4: 렌즈별 SMS 시퀀스 추적 (Step 5-1)
model ContactLensSequence {
  // Primary Key
  id                    String               @id @default(cuid())
  
  // Foreign Keys
  contactId             String
  organizationId        String
  classificationId      String
  
  // 시퀀스 타입
  sequenceType          String               // 'SMS_3DAY' | 'CALL_SCRIPT' | 'FOLLOW_UP'
  lensType              String?              // L1-L10
  
  // ===== Day 0 추적 =====
  day0Sent              Boolean              @default(false)
  day0SentAt            DateTime?
  day0Clicked           Boolean              @default(false)
  day0ClickedAt         DateTime?
  day0ConvertedAt       DateTime?
  
  // ===== Day 1 추적 =====
  day1Sent              Boolean              @default(false)
  day1SentAt            DateTime?
  day1Clicked           Boolean              @default(false)
  day1ClickedAt         DateTime?
  day1ConvertedAt       DateTime?
  
  // ===== Day 2 추적 =====
  day2Sent              Boolean              @default(false)
  day2SentAt            DateTime?
  day2Clicked           Boolean              @default(false)
  day2ClickedAt         DateTime?
  day2ConvertedAt       DateTime?
  
  // ===== Day 3 추적 =====
  day3Sent              Boolean              @default(false)
  day3SentAt            DateTime?
  day3Clicked           Boolean              @default(false)
  day3ClickedAt         DateTime?
  day3ConvertedAt       DateTime?
  
  // 최종 결과
  overallConverted      Boolean              @default(false)
  conversionDate        DateTime?
  conversionRevenue     Decimal?             @db.Decimal(15, 2)
  
  // 상태 & 메타
  status                String               @default("PENDING")  // PENDING | IN_PROGRESS | COMPLETED | ABANDONED
  failureReason         String?
  retryCount            Int                  @default(0)
  
  // 타임스탬프
  startedAt             DateTime             @default(now())
  completedAt           DateTime?
  
  // Relations
  contact               Contact              @relation(fields: [contactId], references: [id], onDelete: Cascade)
  organization          Organization         @relation("LensSequences", fields: [organizationId], references: [id], onDelete: Cascade)
  classification        ContactLensClassification @relation(fields: [classificationId], references: [id], onDelete: Cascade)

  @@index([contactId, lensType])
  @@index([organizationId, status])
  @@map("ContactLensSequence")
}
```

**용도**: SMS 3일 시퀀스의 Day 0/1/2/3 진행도 추적

**추적 항목 (4 days × 3 events = 12개)**:
- `day{N}Sent`: SMS 발송 여부
- `day{N}Clicked`: SMS 클릭 여부
- `day{N}ConvertedAt`: 해당 Day에 전환 발생 시점

---

### 3. LensTemplate 모델

```prisma
// Phase 4: 렌즈별 SMS/Call 템플릿 (Step 5-1)
model LensTemplate {
  // Primary Key
  id                    String               @id @default(cuid())
  organizationId        String
  
  // 템플릿 분류
  templateType          String               // SMS | CALL_SCRIPT | EMAIL
  lensType              String               // L1-L10
  day                   Int?                 // SMS Day (0/1/2/3), Call은 NULL
  phase                 Int?                 // Call script phase (0-4)
  
  // 콘텐츠
  title                 String?
  body                  String               // {placeholder} 지원
  
  // SMS 특화 필드
  smsLength             Int?                 // 문자 길이 (LMS 판정용)
  expectedClickRate     Decimal?             @db.Decimal(5, 2)
  sendDelayMinutes      Int?                 // Day 0 = 10분, Day 1 = 1440분
  
  // Call Script 특화 필드
  psychologyPrinciple   String?              // LOSS_AVERSION | SOCIAL_PROOF | COMMITMENT
  estimatedDurationSeconds Int?
  stepNumber            Int?                 // Step 1-5
  
  // 상태 & 메타
  status                String               @default("ACTIVE")  // ACTIVE | INACTIVE | ARCHIVED
  version               Int                  @default(1)
  isSystemTemplate      Boolean              @default(false)  // 시스템 기본값인지
  customizations        Json?                // 조직별 커스터마이징
  
  // 타임스탬프
  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt
  
  // Relations
  organization          Organization         @relation("LensTemplates", fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, lensType, templateType])
  @@index([lensType, day], map: "idx_template_lens_day")
  @@index([organizationId, status])
  @@map("LensTemplate")
}
```

**용도**: 렌즈별 SMS/콜 스크립트 템플릿 중앙 관리

**예시**:
```javascript
// L10 Day 0 SMS 템플릿
{
  lensType: "L10",
  templateType: "SMS",
  day: 0,
  body: "🎉 선실 3개 남음! 지금이 정말 마지막입니다. {link}",
  sendDelayMinutes: 10,
  expectedClickRate: 42.5,
  psychologyPrinciple: "SCARCITY"
}

// L10 Step 1 콜 스크립트
{
  lensType: "L10",
  templateType: "CALL_SCRIPT",
  phase: 0,
  stepNumber: 1,
  body: "그럼 가시기로 했어요?",
  psychologyPrinciple: "COMMITMENT",
  estimatedDurationSeconds: 10
}
```

---

## 기존 모델 확장

### Contact 모델 추가 필드

```prisma
model Contact {
  // 기존 필드들...
  id              String
  phone           String
  organizationId  String
  name            String
  // ... (다른 필드들)
  
  // ===== Phase 4 추가: 렌즈 분류 =====
  lensType              String?                     // L1-L10 (캐시)
  lensConfidenceScore   Int                         @default(0)  // 0-100 (캐시)
  
  // ===== Phase 4 추가: SMS 시퀀스 상태 =====
  lensSequenceStatus    String?                     // PENDING | DAY0_SENT | DAY1_SENT | DAY2_SENT | DAY3_SENT | COMPLETED | ABANDONED
  lensSequenceStartedAt DateTime?
  
  // ===== Phase 4 추가: L10 특화 =====
  l10DecisionLevel      Int                         @default(0)  // 0-100
  l10ReadinessScore     Int                         @default(0)  // 0-100
  l10LastUpdateAt       DateTime?
  
  // ===== Phase 4 추가: 의사결정 =====
  decisionMadeAt        DateTime?
  decisionOutcome       String?                     // CONVERTED | DECLINED | PENDING
  
  // 기존 Relations...
  organization    Organization
  
  // ===== Phase 4 추가: Relations =====
  lensClassification    ContactLensClassification?
  
  @@index([organizationId, lensType])
  @@index([lensSequenceStatus])
  @@index([organizationId], map: "idx_contact_l10_ready") // L10 준비 완료 고객
}
```

**추가 이유**: 
- `lensType`: 자주 조회되므로 Contact에 캐시 (JOIN 최소화)
- `lensSequenceStatus`: SMS 시퀀스 진행도 빠른 조회
- `l10DecisionLevel`: L10 고객 우선순위 정렬용

---

### CrmMarketingCampaign 모델 추가 필드

```prisma
model CrmMarketingCampaign {
  // 기존 필드들...
  id              String
  organizationId  String
  groupId         String
  name            String
  // ... (다른 필드들)
  
  // ===== Phase 4 추가: 렌즈 타겟팅 =====
  targetLens            String?                     // L1-L10 (이 캠페인은 L10 대상)
  smsTemplateLens       String?                     // SMS 템플릿 렌즈
  callScriptLens        String?                     // 콜 스크립트 렌즈
  
  // ===== Phase 4 추가: 렌즈별 성과 =====
  lensConversionCount   Int                         @default(0)
  lensConversionRate    Decimal?                    @db.Decimal(5, 2)
  
  // ===== Phase 4 추가: AB 테스트 =====
  experimentId          String?
  variantLens           String?                     // A/B 테스트 렌즈
  
  // ===== Phase 4 추가: 메타데이터 =====
  lensMetadata          Json?                       // {L1: {...}, L2: {...}, ...}
  
  // 기존 Relations...
  organization    Organization
  group           ContactGroup
  
  @@index([organizationId, targetLens])
  @@index([smsTemplateLens])
}
```

**추가 이유**:
- `targetLens`: 캠페인별 렌즈 타겟팅
- `lensConversionCount/Rate`: 렌즈별 성과 추적
- `lensMetadata`: 렌즈별 상세 통계 저장

---

## 스키마 구조도

```
Contact (고객)
  ├─ 1:1 → ContactLensClassification (렌즈 분류)
  │           ├─ 1:N → ContactLensSequence (시퀀스 추적)
  │           └─ lensType: L1-L10
  │
  └─ (cache) lensType, lensSequenceStatus, l10DecisionLevel

CrmMarketingCampaign (캠페인)
  ├─ targetLens: L1-L10
  ├─ smsTemplateLens: 사용 템플릿 렌즈
  └─ lensMetadata: {L1: {...}, L2: {...}, ...}

LensTemplate (템플릿 관리)
  ├─ SMS: lensType × day (0/1/2/3) = 40개
  ├─ CALL_SCRIPT: lensType × phase (0-4) = 50개
  └─ VERSION 관리 (A/B 테스트 지원)
```

---

## 마이그레이션 실행 순서

### Step 1: 스키마 파일 업데이트
```bash
# /d/mabiz-crm/prisma/schema.prisma에 위 모델들 추가
# + Contact, CrmMarketingCampaign 필드 추가
```

### Step 2: 마이그레이션 생성 및 실행
```bash
# 마이그레이션 파일 생성
npx prisma migrate dev --name add_lens_schema

# (또는 기존 migration.sql 파일 이용)
npx prisma migrate deploy
```

### Step 3: Prisma Client 재생성
```bash
npx prisma generate
```

### Step 4: 애플리케이션 빌드
```bash
npm run build
```

---

## 사용 예시 (Step 5-2에서 구현)

### 렌즈 분류 생성

```typescript
// 고객이 질문지를 완료했을 때
const classification = await prisma.contactLensClassification.create({
  data: {
    contactId: contact.id,
    organizationId: org.id,
    lensType: 'L10',
    lensLabel: '즉시구매형',
    confidenceScore: 92,
    identificationMethod: 'QUESTIONNAIRE',
    decisionLevel: 85,
    readinessScore: 90,
    priorityLevel: 'HIGH',
    questionnaireResponses: {
      q1: '다음주에 가고 싶어',
      q2: '그냥 크루즈 여행만 하고 싶어',
      q3: '이미 여러 번 고민했어'
    }
  }
});

// Contact에도 캐시 업데이트
await prisma.contact.update({
  where: { id: contact.id },
  data: {
    lensType: 'L10',
    lensConfidenceScore: 92,
    l10DecisionLevel: 85,
    l10ReadinessScore: 90,
    lensSequenceStatus: 'PENDING'
  }
});
```

### 시퀀스 생성 및 추적

```typescript
// SMS 시퀀스 시작
const sequence = await prisma.contactLensSequence.create({
  data: {
    contactId: contact.id,
    organizationId: org.id,
    classificationId: classification.id,
    sequenceType: 'SMS_3DAY',
    lensType: 'L10',
    status: 'IN_PROGRESS',
    startedAt: new Date()
  }
});

// Day 0 SMS 발송 후 업데이트
await prisma.contactLensSequence.update({
  where: { id: sequence.id },
  data: {
    day0Sent: true,
    day0SentAt: new Date()
  }
});

// Day 0 클릭 감지
await prisma.contactLensSequence.update({
  where: { id: sequence.id },
  data: {
    day0Clicked: true,
    day0ClickedAt: new Date()
  }
});

// 전환 기록
await prisma.contactLensSequence.update({
  where: { id: sequence.id },
  data: {
    day0ConvertedAt: new Date(),
    overallConverted: true,
    conversionDate: new Date(),
    conversionRevenue: new Decimal('1800000'),
    status: 'COMPLETED'
  }
});
```

### 템플릿 조회

```typescript
// L10 Day 0 SMS 템플릿 조회
const template = await prisma.lensTemplate.findFirst({
  where: {
    organizationId: org.id,
    lensType: 'L10',
    templateType: 'SMS',
    day: 0,
    status: 'ACTIVE'
  }
});

// L10 모든 SMS 템플릿 조회
const templates = await prisma.lensTemplate.findMany({
  where: {
    organizationId: org.id,
    lensType: 'L10',
    templateType: 'SMS',
    status: 'ACTIVE'
  },
  orderBy: { day: 'asc' }
});

// L10 Step 1 콜 스크립트
const callScript = await prisma.lensTemplate.findFirst({
  where: {
    lensType: 'L10',
    templateType: 'CALL_SCRIPT',
    stepNumber: 1,
    status: 'ACTIVE'
  }
});
```

### 관계 쿼리 (N+1 방지)

```typescript
// ❌ 나쁜 예: N+1 쿼리
const contacts = await prisma.contact.findMany({ organizationId });
for (const contact of contacts) {
  const lens = await prisma.contactLensClassification.findFirst({
    where: { contactId: contact.id }
  });
}

// ✅ 좋은 예: 1번 쿼리
const contacts = await prisma.contact.findMany({
  where: { organizationId },
  include: {
    lensClassification: {
      include: { sequences: true }
    }
  }
});
```

---

## 성능 최적화 팁

### 1. 쿼리 최적화

```typescript
// L10 고객 우선순위 정렬
const readyCustomers = await prisma.contact.findMany({
  where: {
    organizationId,
    lensType: 'L10',
    l10DecisionLevel: { gte: 80 }
  },
  orderBy: {
    l10DecisionLevel: 'desc'
  },
  take: 100
});
```

### 2. 배치 작업

```typescript
// 대량 시퀀스 업데이트
const sequences = await prisma.contactLensSequence.updateMany({
  where: {
    organizationId,
    status: 'IN_PROGRESS',
    day0Sent: false
  },
  data: {
    day0Sent: true,
    day0SentAt: new Date()
  }
});
```

### 3. 캐싱 활용

```typescript
// Contact의 lensType 캐시 활용 (조인 제거)
const contact = await prisma.contact.findUnique({
  where: { id },
  select: {
    id: true,
    lensType: true,        // 캐시된 필드
    lensSequenceStatus: true,
    l10DecisionLevel: true
  }
});
```

---

## 검증 체크리스트

- [ ] 3개 신규 모델 추가 (ContactLensClassification, ContactLensSequence, LensTemplate)
- [ ] Contact 모델에 9개 칼럼 추가
- [ ] CrmMarketingCampaign 모델에 8개 칼럼 추가
- [ ] 모든 Foreign Key 정의 완료
- [ ] 모든 Index 정의 완료
- [ ] `npx prisma format` 실행 (스키마 포맷팅)
- [ ] `npx prisma validate` 실행 (문법 검증)
- [ ] 마이그레이션 파일 검토

---

## 다음 단계 (Step 5-2)

1. **자동분류 알고리즘**
   - 질문지 점수화
   - 렌즈별 임계값 매핑
   - 신뢰도 계산

2. **SMS 자동화**
   - Day 0-3 시퀀스 생성
   - 스케줄링 로직
   - 콜백 처리

3. **대시보드 통합**
   - 렌즈별 고객 표시
   - 시퀀스 진행도
   - 성과 분석

---

**상태**: 📋 승인 대기  
**최종 검토**: Prisma 스키마 검증 + 마이그레이션 테스트 필요
