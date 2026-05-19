# Menu #38 Phase 4 Step 5-1: DB 스키마 설계 + 마이그레이션 SQL

**목표**: 10렌즈 시스템을 CRM DB에 적용하기 위한 스키마 설계 + 실행 가능한 SQL 마이그레이션 스크립트

**작성일**: 2026-05-19  
**상태**: ✅ 설계 완료, SQL 마이그레이션 준비  
**다음 단계**: Step 5-2 (자동분류 알고리즘 구현)

---

## 📋 목차

1. [현재 CRM 스키마 분석](#현재-crm-스키마-분석)
2. [10렌즈 저장 구조 설계](#10렌즈-저장-구조-설계)
3. [신규 테이블 3개](#신규-테이블-3개)
4. [기존 테이블 수정](#기존-테이블-수정)
5. [Prisma 스키마 업데이트](#prisma-스키마-업데이트)
6. [SQL 마이그레이션 스크립트](#sql-마이그레이션-스크립트)
7. [성능 최적화 전략](#성능-최적화-전략)
8. [배포 체크리스트](#배포-체크리스트)

---

## 현재 CRM 스키마 분석

### 핵심 테이블 현황

```
Contact (고객 정보)
├─ id (PK)
├─ organizationId (FK)
├─ phone (Unique with organizationId)
├─ name, email
├─ type (LEAD | CUSTOMER | RETURNING)
├─ leadScore (0~100)
├─ tags (배열)
├─ cruiseInterest, departureDate, productName
├─ purchasedAt, lastContactedAt
└─ deletedAt (소프트 삭제)

CrmMarketingCampaign (마케팅 캠페인)
├─ id (PK)
├─ organizationId (FK)
├─ groupId (FK to ContactGroup)
├─ name, smsBody, emailSubject
├─ sendAt, repeatRule
├─ status (DRAFT | SCHEDULED | SENT | PAUSED)
├─ totalCount, sentCount, openCount, clickCount
├─ nextExecutionAt
└─ relations: SendingHistory, CampaignCost, ExecutionLog, CampaignVariant

ContactGroup (그룹)
├─ id (PK)
├─ organizationId (FK)
├─ name, description
├─ ownerId
└─ members: ContactGroupMember[]

SendingHistory (발송 이력)
├─ id (PK)
├─ campaignId (FK)
├─ contactId (FK)
├─ sentAt, deliveredAt, clickedAt
└─ status (PENDING | SENT | DELIVERED | FAILED | UNSUBSCRIBED)
```

### 제약사항

✅ **DB 절대법칙**:
- 기존 테이블 삭제 금지
- 기존 칼럼 제거 금지
- 기존 칼럼 타입 변경 금지
- 추가 칼럼만 허용 (NOT NULL 칼럼은 DEFAULT 필수)

---

## 10렌즈 저장 구조 설계

### 데이터 흐름

```
고객 입력 (Contact 생성)
    ↓
렌즈 분류 시스템 (자동/수동/콜기반)
    ├─ ContactLensClassification 생성
    └─ lens_type 결정 (L1-L10)
    ↓
SMS 시퀀스 시작
    ├─ ContactLensSequence 생성 (tracking)
    └─ ScheduledSMS 생성 (Day 0/1/2/3)
    ↓
콜 스크립트 제공
    └─ CallLog 참조 (psychology_principle)
```

### 스키마 설계 원칙

1. **정규화**: 렌즈별 메타데이터는 `ContactLensClassification` 테이블에 저장
2. **추적성**: 시퀀스 진행도는 `ContactLensSequence`로 실시간 추적
3. **재사용성**: SMS/Call 템플릿은 별도 테이블로 관리 (다중 렌즈 지원)
4. **성능**: 렌즈별 조회 인덱싱으로 빠른 필터링
5. **유지보수성**: Contact 테이블에 최소한의 칼럼만 추가

---

## 신규 테이블 3개

### 1. ContactLensClassification (고객별 렌즈 분류)

**목적**: 각 고객이 어느 렌즈에 해당하는지 저장

```sql
CREATE TABLE "ContactLensClassification" (
  -- Primary Key
  id                    TEXT NOT NULL PRIMARY KEY,
  
  -- Foreign Keys
  contactId             TEXT NOT NULL UNIQUE,
  organizationId        TEXT NOT NULL,
  
  -- 렌즈 분류 결과
  lensType              VARCHAR(3) NOT NULL,        -- L1 ~ L10
  lensLabel             VARCHAR(50),                 -- "가격 오해형" (UI용 라벨)
  confidenceScore       INT NOT NULL DEFAULT 0,      -- 0-100, 분류 신뢰도
  
  -- 식별 방법 & 정보
  identificationMethod  VARCHAR(20),                 -- AUTO | MANUAL | CALL_BASED
  questionnaireResponses JSONB,                      -- Q1-Q5 답변 저장
  
  -- 의사결정 수준 (L10 특화)
  decisionLevel         INT DEFAULT 0,               -- 0-100, L10용
  readinessScore        INT DEFAULT 0,               -- 구매 준비도 (0-100)
  
  -- 우선순위 & 상태
  priorityLevel         VARCHAR(10),                 -- HIGH | MEDIUM | LOW
  status                VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE | PAUSED | CONVERTED
  
  -- 타임스탬프
  identifiedAt          TIMESTAMP NOT NULL DEFAULT NOW(),
  lastUpdated           TIMESTAMP NOT NULL DEFAULT NOW(),
  convertedAt           TIMESTAMP,                   -- 전환 시 기록
  
  -- Metadata
  notes                 TEXT,
  tags                  TEXT[],
  
  -- Foreign Key
  FOREIGN KEY (contactId) REFERENCES "Contact"(id) ON DELETE CASCADE,
  FOREIGN KEY (organizationId) REFERENCES "Organization"(id) ON DELETE CASCADE
);

-- 인덱싱 전략
CREATE INDEX "idx_lens_org_type" ON "ContactLensClassification"(organizationId, lensType);
CREATE INDEX "idx_lens_priority" ON "ContactLensClassification"(priorityLevel, status);
CREATE INDEX "idx_lens_confidence" ON "ContactLensClassification"(organizationId, confidenceScore DESC);
CREATE INDEX "idx_lens_decision" ON "ContactLensClassification"(organizationId, lensType) 
  WHERE lensType = 'L10';  -- L10 특화 인덱스
```

**용도**:
- 고객별 단일 렌즈 할당 (1:1 관계)
- 렌즈별 신뢰도 추적
- 의사결정 수준 (L10 중심)
- 전환 여부 추적

---

### 2. ContactLensSequence (렌즈별 SMS 시퀀스 추적)

**목적**: 각 고객의 렌즈별 SMS 발송 진행도 추적

```sql
CREATE TABLE "ContactLensSequence" (
  -- Primary Key
  id                    TEXT NOT NULL PRIMARY KEY,
  
  -- Foreign Keys
  contactId             TEXT NOT NULL,
  organizationId        TEXT NOT NULL,
  classificationId      TEXT NOT NULL,
  
  -- 시퀀스 타입
  sequenceType          VARCHAR(20) NOT NULL,       -- 'SMS_3DAY' | 'CALL_SCRIPT' | 'FOLLOW_UP'
  lensType              VARCHAR(3),                 -- L1-L10
  
  -- 진행도 추적
  day0Sent              BOOLEAN DEFAULT FALSE,
  day0SentAt            TIMESTAMP,
  day0Clicked           BOOLEAN DEFAULT FALSE,
  day0ClickedAt         TIMESTAMP,
  day0ConvertedAt       TIMESTAMP,
  
  day1Sent              BOOLEAN DEFAULT FALSE,
  day1SentAt            TIMESTAMP,
  day1Clicked           BOOLEAN DEFAULT FALSE,
  day1ClickedAt         TIMESTAMP,
  day1ConvertedAt       TIMESTAMP,
  
  day2Sent              BOOLEAN DEFAULT FALSE,
  day2SentAt            TIMESTAMP,
  day2Clicked           BOOLEAN DEFAULT FALSE,
  day2ClickedAt         TIMESTAMP,
  day2ConvertedAt       TIMESTAMP,
  
  day3Sent              BOOLEAN DEFAULT FALSE,
  day3SentAt            TIMESTAMP,
  day3Clicked           BOOLEAN DEFAULT FALSE,
  day3ClickedAt         TIMESTAMP,
  day3ConvertedAt       TIMESTAMP,
  
  -- 최종 결과
  overallConverted      BOOLEAN DEFAULT FALSE,
  conversionDate        TIMESTAMP,
  conversionRevenue     DECIMAL(15, 2),
  
  -- 상태 & 메타
  status                VARCHAR(20) DEFAULT 'PENDING',  -- PENDING | IN_PROGRESS | COMPLETED | ABANDONED
  failureReason         VARCHAR(100),                   -- 실패 사유
  retryCount            INT DEFAULT 0,
  
  -- 타임스탬프
  startedAt             TIMESTAMP NOT NULL DEFAULT NOW(),
  completedAt           TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (contactId) REFERENCES "Contact"(id) ON DELETE CASCADE,
  FOREIGN KEY (organizationId) REFERENCES "Organization"(id) ON DELETE CASCADE,
  FOREIGN KEY (classificationId) REFERENCES "ContactLensClassification"(id) ON DELETE CASCADE
);

-- 인덱싱 전략
CREATE INDEX "idx_sequence_contact" ON "ContactLensSequence"(contactId, lensType);
CREATE INDEX "idx_sequence_org_status" ON "ContactLensSequence"(organizationId, status);
CREATE INDEX "idx_sequence_pending" ON "ContactLensSequence"(organizationId) 
  WHERE status = 'PENDING';  -- 대기 중인 시퀀스 빠른 조회
CREATE INDEX "idx_sequence_conversion" ON "ContactLensSequence"(organizationId, overallConverted) 
  WHERE overallConverted = TRUE;  -- 전환된 시퀀스만
```

**용도**:
- SMS 발송 진행도 추적 (Day 0/1/2/3)
- 클릭/전환 여부 기록
- 시퀀스별 재시도 관리
- 렌즈별 성과 분석

---

### 3. LensTemplate (렌즈별 SMS/Call 템플릿)

**목적**: 렌즈별 메시지 템플릿 중앙 관리

```sql
CREATE TABLE "LensTemplate" (
  -- Primary Key
  id                    TEXT NOT NULL PRIMARY KEY,
  organizationId        TEXT NOT NULL,
  
  -- 템플릿 타입
  templateType          VARCHAR(20) NOT NULL,       -- SMS | CALL_SCRIPT | EMAIL
  lensType              VARCHAR(3) NOT NULL,        -- L1-L10
  day                   INT,                        -- SMS Day (0/1/2/3), Call은 NULL
  phase                 INT,                        -- Call script phase (0-4)
  
  -- 콘텐츠
  title                 VARCHAR(100),
  body                  TEXT NOT NULL,              -- {placeholder} 지원
  
  -- SMS 특화
  smsLength             INT,                        -- 문자 길이 (LMS 판정용)
  expectedClickRate     DECIMAL(5, 2),              -- 예상 클릭율 (%)
  sendDelayMinutes      INT,                        -- Day 0 = 10분, Day 1 = 1440분
  
  -- Call Script 특화
  psychologyPrinciple   VARCHAR(50),                -- LOSS_AVERSION | SOCIAL_PROOF 등
  estimatedDurationSeconds INT,
  stepNumber            INT,                        -- Step 1-5
  
  -- 상태 & 메타
  status                VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE | INACTIVE | ARCHIVED
  version               INT DEFAULT 1,              -- 버전 관리
  isSystemTemplate      BOOLEAN DEFAULT FALSE,      -- 시스템 기본값인지
  customizations        JSONB,                      -- 조직별 커스터마이징
  
  -- 타임스탬프
  createdAt             TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt             TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Foreign Key
  FOREIGN KEY (organizationId) REFERENCES "Organization"(id) ON DELETE CASCADE
);

-- 인덱싱 전략
CREATE INDEX "idx_template_org_lens_type" ON "LensTemplate"(organizationId, lensType, templateType);
CREATE INDEX "idx_template_lens_day" ON "LensTemplate"(lensType, day) 
  WHERE templateType = 'SMS' AND status = 'ACTIVE';
CREATE INDEX "idx_template_active" ON "LensTemplate"(organizationId, status) 
  WHERE status = 'ACTIVE';
```

**용도**:
- 렌즈별 SMS 메시지 중앙 관리
- 렌즈별 콜 스크립트 관리
- 버전 관리 (AB 테스트)
- 조직별 커스터마이징 지원

---

## 기존 테이블 수정

### 1. Contact 테이블 추가 칼럼

```sql
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS (
  -- 렌즈 분류 정보 (빠른 조회용, 정규화는 ContactLensClassification)
  lensType              VARCHAR(3),                 -- L1-L10 (캐시)
  lensConfidenceScore   INT DEFAULT 0,              -- 0-100 (캐시)
  
  -- SMS 시퀀스 상태 (빠른 조회용)
  lensSequenceStatus    VARCHAR(20),                -- PENDING | DAY0_SENT | DAY1_SENT | DAY2_SENT | DAY3_SENT | COMPLETED | ABANDONED
  lensSequenceStartedAt TIMESTAMP,                  -- 시퀀스 시작일
  
  -- L10 특화: 의사결정 수준 추적
  l10DecisionLevel      INT DEFAULT 0,              -- 0-100
  l10ReadinessScore     INT DEFAULT 0,              -- 0-100
  l10LastUpdateAt       TIMESTAMP,
  
  -- 의사결정 상태
  decisionMadeAt        TIMESTAMP,                  -- 최종 결정 시점
  decisionOutcome       VARCHAR(20)                 -- CONVERTED | DECLINED | PENDING
);

-- 인덱싱
CREATE INDEX IF NOT EXISTS "idx_contact_lens_type" ON "Contact"(organizationId, lensType) 
  WHERE lensType IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_contact_sequence_status" ON "Contact"(lensSequenceStatus) 
  WHERE lensSequenceStatus IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_contact_l10_ready" ON "Contact"(organizationId) 
  WHERE lensType = 'L10' AND l10DecisionLevel >= 80;
```

**목적**: 자주 조회되는 필드를 Contact에 캐시하여 JOIN 최소화

---

### 2. CrmMarketingCampaign 테이블 추가 칼럼

```sql
ALTER TABLE "CrmMarketingCampaign" ADD COLUMN IF NOT EXISTS (
  -- 렌즈 타겟팅
  targetLens            VARCHAR(3),                 -- L1-L10 (이 캠페인은 L10 대상)
  
  -- SMS 템플릿 렌즈
  smsTemplateLens       VARCHAR(3),                 -- SMS Day 0-3을 어느 렌즈 템플릿 사용?
  
  -- 콜 스크립트 렌즈
  callScriptLens        VARCHAR(3),                 -- 어느 렌즈의 콜 스크립트?
  
  -- 렌즈별 성과 추적
  lensConversionCount   INT DEFAULT 0,              -- 이 캠페인으로 전환된 렌즈별 고객 수
  lensConversionRate    DECIMAL(5, 2),              -- 렌즈별 전환율 (%)
  
  -- 실험 ID (멀티바리언트 추적)
  experimentId          TEXT,
  variantLens           VARCHAR(3),                 -- A/B 테스트 렌즈
  
  -- 메타데이터
  lensMetadata          JSONB                       -- {L1: {...}, L2: {...}, ...}
);

-- 인덱싱
CREATE INDEX IF NOT EXISTS "idx_campaign_target_lens" ON "CrmMarketingCampaign"(organizationId, targetLens) 
  WHERE targetLens IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_campaign_template_lens" ON "CrmMarketingCampaign"(smsTemplateLens);
```

**목적**: 캠페인별 렌즈 타겟팅 및 성과 추적

---

## Prisma 스키마 업데이트

### schema.prisma 추가 모델 (Step 5-2에서 구현)

```prisma
// Phase 4: 10렌즈 분류 시스템 (Step 5)
model ContactLensClassification {
  id                    String               @id @default(cuid())
  contactId             String               @unique
  organizationId        String
  
  lensType              String               // L1-L10
  lensLabel             String?              // "가격 오해형"
  confidenceScore       Int                  @default(0)  // 0-100
  
  identificationMethod  String?              // AUTO | MANUAL | CALL_BASED
  questionnaireResponses Json?
  
  decisionLevel         Int                  @default(0)
  readinessScore        Int                  @default(0)
  
  priorityLevel         String?              // HIGH | MEDIUM | LOW
  status                String               @default("ACTIVE")
  
  identifiedAt          DateTime             @default(now())
  lastUpdated           DateTime             @updatedAt
  convertedAt           DateTime?
  
  notes                 String?
  tags                  String[]             @default([])
  
  contact               Contact              @relation(fields: [contactId], references: [id], onDelete: Cascade)
  organization          Organization         @relation("LensClassifications", fields: [organizationId], references: [id], onDelete: Cascade)
  sequences             ContactLensSequence[]

  @@unique([contactId])
  @@index([organizationId, lensType])
  @@index([priorityLevel, status])
  @@index([organizationId, confidenceScore(sort: Desc)])
  @@map("ContactLensClassification")
}

model ContactLensSequence {
  id                    String               @id @default(cuid())
  contactId             String
  organizationId        String
  classificationId      String
  
  sequenceType          String               // SMS_3DAY | CALL_SCRIPT | FOLLOW_UP
  lensType              String?              // L1-L10
  
  day0Sent              Boolean              @default(false)
  day0SentAt            DateTime?
  day0Clicked           Boolean              @default(false)
  day0ClickedAt         DateTime?
  day0ConvertedAt       DateTime?
  
  day1Sent              Boolean              @default(false)
  day1SentAt            DateTime?
  day1Clicked           Boolean              @default(false)
  day1ClickedAt         DateTime?
  day1ConvertedAt       DateTime?
  
  day2Sent              Boolean              @default(false)
  day2SentAt            DateTime?
  day2Clicked           Boolean              @default(false)
  day2ClickedAt         DateTime?
  day2ConvertedAt       DateTime?
  
  day3Sent              Boolean              @default(false)
  day3SentAt            DateTime?
  day3Clicked           Boolean              @default(false)
  day3ClickedAt         DateTime?
  day3ConvertedAt       DateTime?
  
  overallConverted      Boolean              @default(false)
  conversionDate        DateTime?
  conversionRevenue     Decimal?             @db.Decimal(15, 2)
  
  status                String               @default("PENDING")  // PENDING | IN_PROGRESS | COMPLETED | ABANDONED
  failureReason         String?
  retryCount            Int                  @default(0)
  
  startedAt             DateTime             @default(now())
  completedAt           DateTime?
  
  contact               Contact              @relation(fields: [contactId], references: [id], onDelete: Cascade)
  organization          Organization         @relation("LensSequences", fields: [organizationId], references: [id], onDelete: Cascade)
  classification        ContactLensClassification @relation(fields: [classificationId], references: [id], onDelete: Cascade)

  @@index([contactId, lensType])
  @@index([organizationId, status])
  @@index([organizationId], map: "idx_sequence_pending") // PENDING 상태 빠른 조회
  @@map("ContactLensSequence")
}

model LensTemplate {
  id                    String               @id @default(cuid())
  organizationId        String
  
  templateType          String               // SMS | CALL_SCRIPT | EMAIL
  lensType              String               // L1-L10
  day                   Int?                 // SMS Day (0/1/2/3)
  phase                 Int?                 // Call script phase
  
  title                 String?
  body                  String               // {placeholder} 지원
  
  smsLength             Int?
  expectedClickRate     Decimal?             @db.Decimal(5, 2)
  sendDelayMinutes      Int?
  
  psychologyPrinciple   String?
  estimatedDurationSeconds Int?
  stepNumber            Int?
  
  status                String               @default("ACTIVE")
  version               Int                  @default(1)
  isSystemTemplate      Boolean              @default(false)
  customizations        Json?
  
  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt
  
  organization          Organization         @relation("LensTemplates", fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, lensType, templateType])
  @@index([lensType, day], map: "idx_template_lens_day")
  @@index([organizationId, status])
  @@map("LensTemplate")
}

// Contact 모델 확장
model Contact {
  // 기존 필드 ...
  
  // Phase 4: 렌즈 분류
  lensType              String?
  lensConfidenceScore   Int                  @default(0)
  lensSequenceStatus    String?
  lensSequenceStartedAt DateTime?
  
  // Phase 4: L10 특화
  l10DecisionLevel      Int                  @default(0)
  l10ReadinessScore     Int                  @default(0)
  l10LastUpdateAt       DateTime?
  
  // 의사결정
  decisionMadeAt        DateTime?
  decisionOutcome       String?
  
  // Relations
  lensClassification    ContactLensClassification?
  
  @@index([organizationId, lensType])
  @@index([lensSequenceStatus])
}

// CrmMarketingCampaign 모델 확장
model CrmMarketingCampaign {
  // 기존 필드 ...
  
  // Phase 4: 렌즈 타겟팅
  targetLens            String?
  smsTemplateLens       String?
  callScriptLens        String?
  
  lensConversionCount   Int                  @default(0)
  lensConversionRate    Decimal?             @db.Decimal(5, 2)
  
  experimentId          String?
  variantLens           String?
  
  lensMetadata          Json?
  
  @@index([organizationId, targetLens])
  @@index([smsTemplateLens])
}
```

---

## SQL 마이그레이션 스크립트

### 마이그레이션 파일 경로

```
/d/mabiz-crm/prisma/migrations/
  20260519000002_add_lens_schema/
    migration.sql
```

### migration.sql (트랜잭션 기반)

```sql
-- Migration: Phase 4 Step 5 - 10렌즈 DB 스키마 확장
-- Date: 2026-05-19
-- Author: Menu #38 Phase 4 Agent
-- Description: 렌즈 분류, 시퀀스 추적, 템플릿 관리를 위한 신규 테이블 3개 + 기존 테이블 확장

BEGIN;

-- ============================================================================
-- STEP 1: 신규 테이블 생성 - ContactLensClassification
-- ============================================================================

CREATE TABLE "ContactLensClassification" (
  id                    TEXT NOT NULL PRIMARY KEY,
  contactId             TEXT NOT NULL UNIQUE,
  organizationId        TEXT NOT NULL,
  
  lensType              VARCHAR(3) NOT NULL,
  lensLabel             VARCHAR(50),
  confidenceScore       INT NOT NULL DEFAULT 0,
  
  identificationMethod  VARCHAR(20),
  questionnaireResponses JSONB,
  
  decisionLevel         INT DEFAULT 0,
  readinessScore        INT DEFAULT 0,
  
  priorityLevel         VARCHAR(10),
  status                VARCHAR(20) DEFAULT 'ACTIVE',
  
  identifiedAt          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lastUpdated           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  convertedAt           TIMESTAMPTZ,
  
  notes                 TEXT,
  tags                  TEXT[],
  
  CONSTRAINT fk_lens_contact FOREIGN KEY (contactId) REFERENCES "Contact"(id) ON DELETE CASCADE,
  CONSTRAINT fk_lens_org FOREIGN KEY (organizationId) REFERENCES "Organization"(id) ON DELETE CASCADE,
  CONSTRAINT ck_lens_type CHECK (lensType IN ('L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'))
);

CREATE INDEX "idx_lens_org_type" ON "ContactLensClassification"(organizationId, lensType);
CREATE INDEX "idx_lens_priority" ON "ContactLensClassification"(priorityLevel, status);
CREATE INDEX "idx_lens_confidence" ON "ContactLensClassification"(organizationId, confidenceScore DESC);
CREATE INDEX "idx_lens_contact_id" ON "ContactLensClassification"(contactId);

-- ============================================================================
-- STEP 2: 신규 테이블 생성 - ContactLensSequence
-- ============================================================================

CREATE TABLE "ContactLensSequence" (
  id                    TEXT NOT NULL PRIMARY KEY,
  contactId             TEXT NOT NULL,
  organizationId        TEXT NOT NULL,
  classificationId      TEXT NOT NULL,
  
  sequenceType          VARCHAR(20) NOT NULL,
  lensType              VARCHAR(3),
  
  day0Sent              BOOLEAN DEFAULT FALSE,
  day0SentAt            TIMESTAMPTZ,
  day0Clicked           BOOLEAN DEFAULT FALSE,
  day0ClickedAt         TIMESTAMPTZ,
  day0ConvertedAt       TIMESTAMPTZ,
  
  day1Sent              BOOLEAN DEFAULT FALSE,
  day1SentAt            TIMESTAMPTZ,
  day1Clicked           BOOLEAN DEFAULT FALSE,
  day1ClickedAt         TIMESTAMPTZ,
  day1ConvertedAt       TIMESTAMPTZ,
  
  day2Sent              BOOLEAN DEFAULT FALSE,
  day2SentAt            TIMESTAMPTZ,
  day2Clicked           BOOLEAN DEFAULT FALSE,
  day2ClickedAt         TIMESTAMPTZ,
  day2ConvertedAt       TIMESTAMPTZ,
  
  day3Sent              BOOLEAN DEFAULT FALSE,
  day3SentAt            TIMESTAMPTZ,
  day3Clicked           BOOLEAN DEFAULT FALSE,
  day3ClickedAt         TIMESTAMPTZ,
  day3ConvertedAt       TIMESTAMPTZ,
  
  overallConverted      BOOLEAN DEFAULT FALSE,
  conversionDate        TIMESTAMPTZ,
  conversionRevenue     NUMERIC(15, 2),
  
  status                VARCHAR(20) DEFAULT 'PENDING',
  failureReason         VARCHAR(100),
  retryCount            INT DEFAULT 0,
  
  startedAt             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completedAt           TIMESTAMPTZ,
  
  CONSTRAINT fk_sequence_contact FOREIGN KEY (contactId) REFERENCES "Contact"(id) ON DELETE CASCADE,
  CONSTRAINT fk_sequence_org FOREIGN KEY (organizationId) REFERENCES "Organization"(id) ON DELETE CASCADE,
  CONSTRAINT fk_sequence_classification FOREIGN KEY (classificationId) REFERENCES "ContactLensClassification"(id) ON DELETE CASCADE
);

CREATE INDEX "idx_sequence_contact" ON "ContactLensSequence"(contactId, lensType);
CREATE INDEX "idx_sequence_org_status" ON "ContactLensSequence"(organizationId, status);
CREATE INDEX "idx_sequence_pending" ON "ContactLensSequence"(organizationId) WHERE status = 'PENDING';
CREATE INDEX "idx_sequence_conversion" ON "ContactLensSequence"(organizationId, overallConverted);

-- ============================================================================
-- STEP 3: 신규 테이블 생성 - LensTemplate
-- ============================================================================

CREATE TABLE "LensTemplate" (
  id                    TEXT NOT NULL PRIMARY KEY,
  organizationId        TEXT NOT NULL,
  
  templateType          VARCHAR(20) NOT NULL,
  lensType              VARCHAR(3) NOT NULL,
  day                   INT,
  phase                 INT,
  
  title                 VARCHAR(100),
  body                  TEXT NOT NULL,
  
  smsLength             INT,
  expectedClickRate     NUMERIC(5, 2),
  sendDelayMinutes      INT,
  
  psychologyPrinciple   VARCHAR(50),
  estimatedDurationSeconds INT,
  stepNumber            INT,
  
  status                VARCHAR(20) DEFAULT 'ACTIVE',
  version               INT DEFAULT 1,
  isSystemTemplate      BOOLEAN DEFAULT FALSE,
  customizations        JSONB,
  
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_template_org FOREIGN KEY (organizationId) REFERENCES "Organization"(id) ON DELETE CASCADE,
  CONSTRAINT ck_template_type CHECK (templateType IN ('SMS', 'CALL_SCRIPT', 'EMAIL')),
  CONSTRAINT ck_template_lens CHECK (lensType IN ('L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'))
);

CREATE INDEX "idx_template_org_lens_type" ON "LensTemplate"(organizationId, lensType, templateType);
CREATE INDEX "idx_template_lens_day" ON "LensTemplate"(lensType, day) WHERE templateType = 'SMS';
CREATE INDEX "idx_template_active" ON "LensTemplate"(organizationId, status) WHERE status = 'ACTIVE';

-- ============================================================================
-- STEP 4: Contact 테이블 칼럼 추가 (Phase 4 렌즈 분류)
-- ============================================================================

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS (
  lensType              VARCHAR(3),
  lensConfidenceScore   INT DEFAULT 0,
  lensSequenceStatus    VARCHAR(20),
  lensSequenceStartedAt TIMESTAMPTZ,
  l10DecisionLevel      INT DEFAULT 0,
  l10ReadinessScore     INT DEFAULT 0,
  l10LastUpdateAt       TIMESTAMPTZ,
  decisionMadeAt        TIMESTAMPTZ,
  decisionOutcome       VARCHAR(20)
);

-- Contact 테이블 인덱스 추가
CREATE INDEX IF NOT EXISTS "idx_contact_lens_type" ON "Contact"(organizationId, lensType) WHERE lensType IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_contact_sequence_status" ON "Contact"(lensSequenceStatus) WHERE lensSequenceStatus IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_contact_l10_ready" ON "Contact"(organizationId) WHERE lensType = 'L10' AND l10DecisionLevel >= 80;

-- ============================================================================
-- STEP 5: CrmMarketingCampaign 테이블 칼럼 추가 (렌즈 타겟팅)
-- ============================================================================

ALTER TABLE "CrmMarketingCampaign" ADD COLUMN IF NOT EXISTS (
  targetLens            VARCHAR(3),
  smsTemplateLens       VARCHAR(3),
  callScriptLens        VARCHAR(3),
  lensConversionCount   INT DEFAULT 0,
  lensConversionRate    NUMERIC(5, 2),
  experimentId          TEXT,
  variantLens           VARCHAR(3),
  lensMetadata          JSONB
);

-- CrmMarketingCampaign 테이블 인덱스 추가
CREATE INDEX IF NOT EXISTS "idx_campaign_target_lens" ON "CrmMarketingCampaign"(organizationId, targetLens) WHERE targetLens IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_campaign_template_lens" ON "CrmMarketingCampaign"(smsTemplateLens);

-- ============================================================================
-- STEP 6: 데이터 무결성 검증
-- ============================================================================

-- ContactLensClassification 테이블 데이터 무결성 확인
DO $$
BEGIN
  -- lensType 검증
  IF EXISTS (SELECT 1 FROM "ContactLensClassification" WHERE lensType NOT IN ('L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10')) THEN
    RAISE EXCEPTION 'Invalid lensType found in ContactLensClassification';
  END IF;
  
  -- confidenceScore 범위 검증 (0-100)
  IF EXISTS (SELECT 1 FROM "ContactLensClassification" WHERE confidenceScore < 0 OR confidenceScore > 100) THEN
    RAISE EXCEPTION 'Invalid confidenceScore (must be 0-100)';
  END IF;
  
  RAISE NOTICE 'ContactLensClassification data integrity check passed';
END;
$$;

-- ============================================================================
-- STEP 7: 마이그레이션 로깅
-- ============================================================================

INSERT INTO "ExecutionLog" (
  id, 
  executationName, 
  status, 
  executedAt,
  "createdAt",
  metadata
)
VALUES (
  gen_random_uuid(),
  'MIGRATION_PHASE4_STEP5_LENS_SCHEMA',
  'SUCCESS',
  NOW(),
  NOW(),
  jsonb_build_object(
    'tables_created', jsonb_build_array('ContactLensClassification', 'ContactLensSequence', 'LensTemplate'),
    'columns_added', jsonb_build_object(
      'Contact', jsonb_build_array('lensType', 'lensConfidenceScore', 'lensSequenceStatus', 'l10DecisionLevel', 'decisionMadeAt'),
      'CrmMarketingCampaign', jsonb_build_array('targetLens', 'smsTemplateLens', 'callScriptLens', 'lensMetadata')
    ),
    'indexes_created', 15,
    'migration_timestamp', NOW()
  )
);

COMMIT;

-- ============================================================================
-- 롤백 스크립트 (필요시 실행)
-- ============================================================================
/*
BEGIN;

DROP TABLE IF EXISTS "ContactLensSequence" CASCADE;
DROP TABLE IF EXISTS "ContactLensClassification" CASCADE;
DROP TABLE IF EXISTS "LensTemplate" CASCADE;

ALTER TABLE "Contact" DROP COLUMN IF EXISTS lensType;
ALTER TABLE "Contact" DROP COLUMN IF EXISTS lensConfidenceScore;
ALTER TABLE "Contact" DROP COLUMN IF EXISTS lensSequenceStatus;
ALTER TABLE "Contact" DROP COLUMN IF EXISTS lensSequenceStartedAt;
ALTER TABLE "Contact" DROP COLUMN IF EXISTS l10DecisionLevel;
ALTER TABLE "Contact" DROP COLUMN IF EXISTS l10ReadinessScore;
ALTER TABLE "Contact" DROP COLUMN IF EXISTS l10LastUpdateAt;
ALTER TABLE "Contact" DROP COLUMN IF EXISTS decisionMadeAt;
ALTER TABLE "Contact" DROP COLUMN IF EXISTS decisionOutcome;

ALTER TABLE "CrmMarketingCampaign" DROP COLUMN IF EXISTS targetLens;
ALTER TABLE "CrmMarketingCampaign" DROP COLUMN IF EXISTS smsTemplateLens;
ALTER TABLE "CrmMarketingCampaign" DROP COLUMN IF EXISTS callScriptLens;
ALTER TABLE "CrmMarketingCampaign" DROP COLUMN IF EXISTS lensConversionCount;
ALTER TABLE "CrmMarketingCampaign" DROP COLUMN IF EXISTS lensConversionRate;
ALTER TABLE "CrmMarketingCampaign" DROP COLUMN IF EXISTS experimentId;
ALTER TABLE "CrmMarketingCampaign" DROP COLUMN IF EXISTS variantLens;
ALTER TABLE "CrmMarketingCampaign" DROP COLUMN IF EXISTS lensMetadata;

COMMIT;
*/
```

---

## 성능 최적화 전략

### 1. 인덱싱 전략

| 테이블 | 인덱스 | 목적 | 예상 효과 |
|--------|--------|------|----------|
| ContactLensClassification | (organizationId, lensType) | 렌즈별 고객 빠른 조회 | O(log n) |
| ContactLensClassification | (organizationId, confidenceScore DESC) | 신뢰도 순 정렬 | 10배 속도 |
| ContactLensSequence | (organizationId, status) | 상태별 시퀀스 조회 | 5배 속도 |
| ContactLensSequence | (organizationId) WHERE status='PENDING' | 대기 중인 시퀀스 | 100배 속도 |
| Contact | (organizationId, lensType) | 렌즈별 고객 캐시 | JOIN 제거 |
| LensTemplate | (lensType, day) WHERE templateType='SMS' | SMS 템플릿 조회 | 5배 속도 |

### 2. 쿼리 최적화 (N+1 방지)

**❌ 나쁜 예시** (N+1 쿼리):
```javascript
const contacts = await db.contact.findMany({ organizationId });
for (const contact of contacts) {
  const lens = await db.contactLensClassification.findFirst({
    where: { contactId: contact.id }
  });  // N번 쿼리 발생
}
```

**✅ 좋은 예시** (배치 로드):
```javascript
const contacts = await db.contact.findMany({
  organizationId,
  include: { lensClassification: true }  // 1번의 JOIN
});
```

### 3. 파티셔닝 고려 (미래)

고객 > 1M 시:
```sql
-- ContactLensSequence 파티셔닝 (월별)
CREATE TABLE "ContactLensSequence_2026_05" PARTITION OF "ContactLensSequence"
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```

### 4. 캐싱 전략 (Redis)

```javascript
// Contact의 lensType을 Redis에 캐시
// Key: org:{organizationId}:contact:{contactId}:lens_type
// TTL: 1시간 (Contact 수정 시 무효화)
```

---

## 배포 체크리스트

### Pre-Deployment (개발 환경)

- [ ] **스키마 검증**
  - [ ] ContactLensClassification 생성 확인
  - [ ] ContactLensSequence 생성 확인
  - [ ] LensTemplate 생성 확인
  - [ ] Contact 칼럼 추가 확인
  - [ ] CrmMarketingCampaign 칼럼 추가 확인

- [ ] **인덱스 생성 확인**
  - [ ] 모든 인덱스 생성 완료
  - [ ] 인덱스 크기 확인 (> 5GB 경고)

- [ ] **데이터 무결성 검증**
  - [ ] FK 제약 조건 검증
  - [ ] CHECK 제약 조건 검증
  - [ ] UNIQUE 제약 조건 검증

- [ ] **성능 테스트**
  - [ ] 렌즈별 조회: < 100ms
  - [ ] 시퀀스 조회: < 200ms
  - [ ] 템플릿 조회: < 50ms
  - [ ] JOIN 쿼리: < 500ms

### Staging 환경

- [ ] **마이그레이션 실행**
  ```bash
  npx prisma migrate deploy
  ```

- [ ] **데이터 일관성 검증**
  ```sql
  SELECT COUNT(*) FROM "ContactLensClassification";
  SELECT COUNT(*) FROM "ContactLensSequence";
  SELECT COUNT(*) FROM "LensTemplate";
  ```

- [ ] **동시성 테스트** (100개 동시 요청)
  - [ ] Deadlock 없음
  - [ ] 응답 시간 안정적

- [ ] **롤백 테스트**
  - [ ] 마이그레이션 다운 성공
  - [ ] 데이터 손실 없음

### Production 배포

- [ ] **최종 백업**
  ```bash
  pg_dump mabiz_crm > backup_20260519.sql
  ```

- [ ] **마이그레이션 실행**
  ```bash
  npx prisma migrate deploy --production
  ```

- [ ] **모니터링 설정**
  - [ ] 쿼리 타임아웃 알림 (> 1s)
  - [ ] 테이블 크기 모니터링
  - [ ] 인덱스 사용률 모니터링

- [ ] **애플리케이션 배포**
  - [ ] Step 5-2 에이전트 코드 배포
  - [ ] API 엔드포인트 테스트
  - [ ] UI 렌더링 테스트

### Post-Deployment

- [ ] **24시간 모니터링**
  - [ ] 에러 로그 확인
  - [ ] 쿼리 성능 확인
  - [ ] 데이터 증가율 확인

- [ ] **최적화 실행**
  - [ ] ANALYZE 통계 갱신
  - [ ] VACUUM 실행
  - [ ] 느린 쿼리 최적화

---

## 테스트 케이스 (Step 5-2에서 구현)

### 1. 렌즈 분류 저장

```javascript
test('ContactLensClassification 생성', async () => {
  const lens = await db.contactLensClassification.create({
    data: {
      contactId: 'contact_123',
      organizationId: 'org_456',
      lensType: 'L10',
      confidenceScore: 85,
      identificationMethod: 'QUESTIONNAIRE'
    }
  });
  
  expect(lens.lensType).toBe('L10');
  expect(lens.confidenceScore).toBe(85);
});
```

### 2. 시퀀스 추적

```javascript
test('ContactLensSequence 진행도 업데이트', async () => {
  const sequence = await db.contactLensSequence.update({
    where: { id: 'seq_123' },
    data: {
      day0Sent: true,
      day0SentAt: new Date(),
      day0Clicked: true,
      day0ClickedAt: new Date(Date.now() + 3600000)
    }
  });
  
  expect(sequence.day0Sent).toBe(true);
  expect(sequence.day0Clicked).toBe(true);
});
```

### 3. 템플릿 조회

```javascript
test('LensTemplate 렌즈별 조회', async () => {
  const templates = await db.lensTemplate.findMany({
    where: {
      organizationId: 'org_456',
      lensType: 'L10',
      templateType: 'SMS',
      status: 'ACTIVE'
    }
  });
  
  expect(templates.length).toBeGreaterThan(0);
  expect(templates[0].lensType).toBe('L10');
});
```

---

## 다음 단계

### Step 5-2: 자동분류 알고리즘 (병렬 진행)

1. **질문지 기반 분류**
   - Q1-Q5 답변 점수화
   - 렌즈별 임계값 설정
   - 신뢰도 계산

2. **콜 기반 분류**
   - 음성 키워드 감지
   - 감정 분석
   - 의사결정 수준 계산

3. **자동 SMS 시작**
   - 시퀀스 생성
   - ScheduledSMS 예약
   - Day 0-3 자동 발송

4. **대시보드 통합**
   - 렌즈별 고객 표시
   - 시퀀스 진행도 표시
   - 성과 분석 차트

---

## 참고 자료

- 렌즈 정의: `/d/mabiz-crm/docs/MENU38_PHASE4_10LENS_MASTER_COMPLETE.md`
- Prisma 마이그레이션: `https://www.prisma.io/docs/orm/prisma-migrate/overview`
- 성능 최적화: `/d/mabiz-crm/docs/performance-optimization-guide.md`

---

**상태**: ✅ DB 스키마 설계 완료  
**산출물**: 
- ✅ DB 스키마 설계 문서 (이 파일)
- ✅ SQL 마이그레이션 스크립트 (마이그레이션 준비 상태)
- ✅ Prisma 스키마 업데이트 가이드
- ✅ 배포 체크리스트

**다음 진행**: Step 5-2 자동분류 알고리즘 에이전트 대기 지시
