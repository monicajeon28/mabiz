---
name: crm-database-design
description: Supabase PostgreSQL 스키마 설계, 정규화, 인덱싱 전략 및 마비즈 구현사례
metadata:
  type: reference
  category: database
  updated: 2026-05-26
---

# CRM 데이터베이스 설계: Supabase PostgreSQL

## 핵심 개념

### 1. Supabase PostgreSQL 기초
마비즈 CRM은 **Neon PostgreSQL** (Supabase 호환)을 사용하며, Prisma ORM을 통해 관리됩니다.

**데이터소스 설정:**
```prisma
datasource db {
  provider = "postgresql"
  // env("DATABASE_URL")로부터 자동 연결
}

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["partialIndexes"]  // 부분 인덱스 지원
}
```

### 2. 정규화 전략 (3NF 준수)

**제1정규형 (1NF):** 모든 컬럼이 원자값
- Contact.tags: String[] → PostgreSQL Native Array
- Contact.competitorNames: String[] → Array<String>
- Contact.lensMetadata: Json → JSON 타입 (비정규화 허용)

**제2정규형 (2NF):** 부분 종속성 제거
```prisma
// Contact 테이블: 기본 속성만
model Contact {
  id String @id @default(cuid())
  organizationId String
  phone String
  name String
  // ... 기본 필드
  
  // 관계: 별도 테이블로 정규화
  groups ContactGroupMember[]
  lensClassifications ContactLensClassification[]
  callLogs CallLog[]
}

// ContactLensClassification: L0-L10 렌즈별 독립 테이블
model ContactLensClassification {
  id String @id
  contactId String
  lensType String // "L0", "L1", ..., "L10"
  confidenceScore Int
  sequences ContactLensSequence[]
}
```

**제3정규형 (3NF):** 이행 종속성 제거
- Organization → OrganizationMember (1:N)
- Contact → Partner (N:1, 선택사항)
- ContactLensSequence → ContactLensClassification (N:1)

### 3. 인덱싱 전략

**복합 인덱스 (효율적 조회):**
```prisma
model Contact {
  // 역할기반 조회 최적화
  @@index([organizationId, assignedUserId], map: "idx_contact_org_assigned")
  @@index([organizationId, channel], map: "idx_contact_org_channel")
  
  // 렌즈별 세그먼테이션
  @@index([organizationId, reactivationSegment], map: "idx_contact_reactivation_segment")
  @@index([organizationId, differentiationScore], map: "idx_contact_differentiation_score")
  @@index([organizationId, autoSegment], map: "idx_contact_org_segment")
  
  // SMS 발송 추적
  @@index([organizationId, smsDay0Sent, smsDay1Sent, smsDay2Sent, smsDay3Sent])
  
  // 결정 윈도우 추적
  @@index([organizationId, decisionWindowExpiresAt])
  @@index([organizationId, priceDeadlineDate])
  
  // L10 클로징 점수
  @@index([organizationId, l10ClosingScore])
  @@index([organizationId, urgencyExpiresAt])
}

// 부분 인덱스: 활성 레코드만
@@index([organizationId, confidenceScore(sort: Desc)])
  // 활성 분류만 인덱싱하여 메모리 절약
```

**고유 제약 (데이터 무결성):**
```prisma
model Contact {
  // 조직당 전화번호 유일
  @@unique([phone, organizationId])
  
  // 계약서 참조 유일
  @@unique([contractRef], where: raw("(\"contractRef\" IS NOT NULL)"))
}

model ContactLensClassification {
  // 조직+연락처+렌즈별 1개만 존재
  @@unique([organizationId, contactId, lensType])
}
```

---

## 마비즈 CRM 실제 구현

### Contact 테이블 구조 (심리학 렌즈 통합)

```prisma
model Contact {
  // ─ 기본 정보
  id String @id @default(cuid())
  organizationId String
  phone String
  name String
  email String?
  
  // ─ L0 렌즈: 부재중 고객 (3-6/6-12/1년+)
  reactivationSegment String? // "3-6m", "6-12m", "1y+"
  reactivationLikelihood Int @default(0) // 0-100
  lastCruiseDate DateTime?
  cruiseCount Int @default(0)
  smsDay0Sent Boolean @default(false)
  smsDay0SentAt DateTime?
  
  // ─ L3 렌즈: 차별성 미인지형
  competitorMentioned Boolean @default(false)
  competitorNames String[] // ["Royal", "MSC", "Disney"]
  differentiationScore Int @default(0)
  differentiationResponseSent Boolean @default(false)
  
  // ─ L5 렌즈: 자기투영 (건강상태)
  selfProjectionScore Int @default(0)
  selfProjectionType String? // "personal_health", "family_health"
  personalHealthConcern String?
  compoundHealthRisk Boolean @default(false)
  
  // ─ L6 렌즈: 타이밍/손실회피
  timingUrgencyScore Int @default(0)
  priceDeadlineDate DateTime?
  seatAvailability Int?
  decisionWindowExpiresAt DateTime?
  lossAversionPhrase String?
  
  // ─ L7 렌즈: 동반자 설득
  familyComposition String? // "spouse", "parents", "friends"
  decisionMaker String? // "self", "spouse", "parent"
  spouseEngagement String? // "not_contacted", "aware"
  companionPersuasionStage String?
  companionSmsDay0Sent Boolean @default(false)
  
  // ─ L10 렌즈: 즉시 구매 클로징
  closingStage String? // "initial", "qualified", "ready_close"
  emotionalConnectionScore Int @default(0)
  urgencyLevel Int @default(0)
  l10ClosingScore Int @default(0)
  tripleChoiceOffered Boolean @default(false)
  tripleChoiceSelection String?
  
  // ─ P0-1~5: 상품/예약 FK
  cruiseProductId Int?
  reservationId Int?
  quotedPrice Int?
  priceAcceptedAt DateTime?
  
  // ─ 관계
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  callLogs CallLog[]
  lensClassifications ContactLensClassification[]
  lensSequences ContactLensSequence[]
  
  @@unique([phone, organizationId])
  @@index([organizationId, autoSegment])
}
```

### ContactLensSequence: SMS Day 0-3 추적

```prisma
model ContactLensSequence {
  id String @id @default(cuid())
  contactId String
  lensType String? // "L0", "L1", ..., "L10"
  sequenceType String // "sms_day0_3", "email", "call"
  
  // Day 0-3 발송 추적
  day0Sent Boolean @default(false)
  day0SentAt DateTime?
  day0Clicked Boolean @default(false)
  day0ConvertedAt DateTime?
  
  day1Sent Boolean @default(false)
  day1SentAt DateTime?
  
  day2Sent Boolean @default(false)
  day2SentAt DateTime?
  
  day3Sent Boolean @default(false)
  day3SentAt DateTime?
  
  // 결과 추적
  overallConverted Boolean @default(false)
  conversionDate DateTime?
  conversionRevenue Decimal? @db.Decimal(15, 2)
  status String @default("PENDING") // "PENDING", "SUCCESS", "FAILED"
  failureReason String?
  
  @@index([contactId, lensType])
  @@index([organizationId, overallConverted])
}
```

### 쿼리 최적화 예제

**N+1 문제 해결: 배치 조회**
```typescript
// ❌ N+1 쿼리 (나쁜 예)
const contacts = await prisma.contact.findMany({ take: 100 });
const names = contacts.map(c => c.name); // 추가 쿼리 필요

// ✅ 배치 조회 (좋은 예)
const contactIds = contacts.map(c => c.id);
const transferLogs = await prisma.contactTransferLog.findMany({
  where: { contactId: { in: contactIds } },
  select: { contactId: true, toUserId: true }
});
```

**Connection Pooling (Neon)**
- Prisma Adapter: PrismaPg (native PostgreSQL 연결)
- Connection 풀: Neon Pooler 기본값 (최대 10-50 활성 연결)
- 응답시간 목표: < 200ms (avg)

---

## 마이그레이션 관리 (Prisma Migrations)

```bash
# 스키마 변경 후 마이그레이션 생성
npx prisma migrate dev --name add_contact_lens_fields

# 프로덕션 적용
npx prisma migrate deploy

# 마이그레이션 이력 조회
npx prisma migrate status
```

**마비즈 적용 사례:**
```sql
-- 2026-05-19 마이그레이션: L5/L6 렌즈 필드 추가
ALTER TABLE "Contact" ADD COLUMN "selfProjectionScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contact" ADD COLUMN "timingUrgencyScore" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "idx_contact_self_projection_score" ON "Contact"("organizationId", "selfProjectionScore");
```

---

## 성능 기준 (SLA)

| 작업 | 쿼리 타입 | 목표 응답시간 | 인덱스 |
|------|---------|----------|---------|
| 고객 목록 조회 | SELECT (limit 50) | < 100ms | idx_contact_org_assigned |
| 렌즈별 세그먼트 | GROUP BY lensType | < 200ms | idx_contact_org_segment |
| SMS 발송 추적 | UPDATE + SELECT | < 150ms | idx_contact_*_sms_status |
| 결정 윈도우 추적 | SELECT WHERE deadline | < 80ms | idx_contact_decision_window |

---

**참고:** Contact 모델은 430+ 라인으로 극도로 비정규화되었으나, 심리학 렌즈 기반 세그먼테이션을 위해 의도적 설계됨. ContactLensClassification과의 조합으로 정규화 유지.
