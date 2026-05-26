# 마비즈 CRM 기술 아키텍처 가이드 (2026-05-26)

**버전**: 2.0 | **작성일**: 2026-05-26 | **마지막 업데이트**: 2026-05-26  
**담당**: 에이전트 + DevOps + Backend Lead  
**상태**: Production Ready

---

## 📋 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [기술 스택](#2-기술-스택)
3. [데이터베이스 설계](#3-데이터베이스-설계)
4. [API 설계 & 엔드포인트](#4-api-설계--엔드포인트)
5. [Workflow 엔진](#5-workflow-엔진-상세)
6. [자동화 사용 예제](#6-자동화-사용-예제)
7. [배포 & 운영](#7-배포--운영)
8. [보안](#8-보안)
9. [성능 최적화](#9-성능-최적화)
10. [통합 가이드](#10-통합-가이드)
11. [문제 해결](#11-문제-해결)

---

## 1. 아키텍처 개요

### 1.1 시스템 레이어

```
┌─────────────────────────────────────────────────────────────┐
│                     프론트엔드 (Next.js 15)                    │
│  React 19 + TypeScript + Tailwind CSS + ShadCN Components   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   API Layer (Next.js Routes)                 │
│  REST API (route.ts) + Middleware + Request Validation       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              비즈니스 로직 & Orchestration                     │
│  ├─ Contact Management                                       │
│  ├─ Workflow Engine (Trigger → Condition → Action)          │
│  ├─ Psychology Lens Classification (L0-L10)                 │
│  ├─ Marketing Automation (PASONA + SPIN)                    │
│  ├─ Affiliate Management                                    │
│  └─ Analytics & Reporting                                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  데이터 접근 계층 (Prisma ORM)                  │
│  Database Client + Schema Validation + Migrations           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    데이터베이스 (PostgreSQL)                    │
│  Supabase 호스팅 / 60+ 테이블 / 인덱싱 및 파티셔닝            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 주요 컴포넌트

| 컴포넌트 | 역할 | 기술 |
|---------|------|------|
| **Contact Service** | 고객 정보 관리, 렌즈 점수 계산 | Prisma, PostgreSQL |
| **Workflow Engine** | 자동화 트리거/조건/액션 실행 | Node.js + Redis (Queue) |
| **Message Handler** | SMS/Email 발송, 템플릿 관리 | Aligo + SendGrid + CRM API |
| **Psychology Lens** | Grant Cardone 10렌즈 분류 | AI Classification + Heuristics |
| **Analytics** | KPI 추적, A/B 테스트, 성과 리포팅 | PostgreSQL Aggregation |
| **Affiliate Manager** | 파트너 관리, 수수료 계산 | Commission API + Payouts |
| **Webhook Handler** | 외부 시스템 통합 | Signature Verification |

### 1.3 데이터 흐름

```
고객 입수
   │
   ▼
Contact 생성 (Import / Manual / API)
   │
   ▼
자동 분류 (Lens L0-L10 점수 계산)
   │
   ▼
세그먼트 할당 (Tag + Group)
   │
   ▼
Workflow 트리거 (Event-based / Schedule-based)
   │
   ▼
조건 평가 (Lens Score / Risk Flag / Custom Rule)
   │
   ▼
액션 실행 (SMS / Email / CRM Tag / Webhook)
   │
   ▼
응답 추적 (Message Log + Engagement)
   │
   ▼
KPI 수집 (Conversion / LTV / ROI)
   │
   ▼
Re-segmentation & Next Action 스케줄링
```

---

## 2. 기술 스택

### 2.1 프론트엔드

```json
{
  "framework": "Next.js 15.5.18",
  "language": "TypeScript 5",
  "styling": "Tailwind CSS 4 + PostCSS",
  "components": "shadcn/ui + Radix UI",
  "state": "TanStack React Query 5",
  "forms": "React Hook Form + Zod Validation",
  "auth": "Clerk 7.4.1 (선택적)",
  "animation": "Framer Motion 11",
  "charting": "Recharts 3.8.1"
}
```

### 2.2 백엔드

```json
{
  "runtime": "Node.js (Next.js Server Runtime)",
  "database": {
    "primary": "PostgreSQL (Supabase)",
    "cache": "Upstash Redis (세션 + 큐)",
    "orm": "Prisma 7.7.0"
  },
  "auth": "NextAuth 4.24.14",
  "email": {
    "transactional": "SendGrid (선택적)",
    "smtp": "Nodemailer 8.0.5 (커스텀 SMTP)"
  },
  "sms": "Aligo (한국 SMS 제공자)",
  "ai": "@anthropic-ai/sdk 0.98.0",
  "search": "Full-text search (PostgreSQL tsvector)",
  "observability": "Sentry 10.53.1"
}
```

### 2.3 개발 도구

```json
{
  "testing": "Jest 29 + Testing Library",
  "e2e": "Cypress 13.6.6",
  "linting": "Next.js ESLint",
  "package_manager": "npm 10+",
  "ci_cd": "GitHub Actions (선택적)"
}
```

---

## 3. 데이터베이스 설계

### 3.1 Core Tables

#### Contact

고객 정보 및 심리학 렌즈 점수 저장.

```sql
CREATE TABLE "Contact" (
  id                    STRING PRIMARY KEY,
  organizationId        STRING NOT NULL (FK),
  name                  STRING NOT NULL,
  phone                 STRING,
  email                 STRING,
  birthDate             DATE,
  source                STRING, -- "manual" | "import" | "api" | "sms"
  status                STRING DEFAULT 'ACTIVE', -- "ACTIVE" | "INACTIVE" | "ARCHIVED" | "OPTED_OUT"
  
  -- 심리학 렌즈 점수 (0-100)
  lensL0Score          INT DEFAULT 0, -- 부재 고객 (인액션 타입)
  lensL1Score          INT DEFAULT 0, -- 가격 이의
  lensL2Score          INT DEFAULT 0, -- 준비 복잡
  lensL3Score          INT DEFAULT 0, -- 차별성 미인지
  lensL4Score          INT DEFAULT 0, -- 피처 구조
  lensL5Score          INT DEFAULT 0, -- 자기투영 + 의료
  lensL6Score          INT DEFAULT 0, -- 타이밍/손실회피
  lensL7Score          INT DEFAULT 0, -- 동반자 설득
  lensL8Score          INT DEFAULT 0, -- 재구매/습관화
  lensL9Score          INT DEFAULT 0, -- 의료 신뢰
  lensL10Score         INT DEFAULT 0, -- 즉시 구매
  dominantLens         STRING, -- 가장 높은 렌즈 (L0-L10)
  
  -- 세그먼트
  segment              STRING, -- "GOLD" | "SILVER" | "BRONZE" | "COLD"
  riskScore            INT DEFAULT 0, -- 0-100 (높을수록 위험)
  
  -- 성과 메트릭
  totalSpent           DECIMAL DEFAULT 0,
  purchaseCount        INT DEFAULT 0,
  lastPurchaseDate     DATETIME,
  lastContactDate      DATETIME,
  
  -- 자동화 상태
  tags                 STRING[], -- Array of tag names
  workflowStatus       STRING DEFAULT 'IDLE', -- "IDLE" | "ACTIVE" | "COMPLETED" | "PAUSED"
  nextActionDate       DATETIME,
  nextActionType       STRING, -- "SMS" | "EMAIL" | "CALL" | null
  
  createdAt            DATETIME DEFAULT now(),
  updatedAt            DATETIME DEFAULT now(),
  
  UNIQUE(organizationId, phone),
  INDEX(organizationId, status),
  INDEX(organizationId, dominantLens),
  INDEX(riskScore)
);
```

#### Workflow

자동화 워크플로우 정의 (Trigger → Condition → Action).

```sql
CREATE TABLE "Workflow" (
  id                   STRING PRIMARY KEY,
  organizationId       STRING NOT NULL (FK),
  name                 STRING NOT NULL,
  description          STRING,
  
  -- 트리거
  triggerType          STRING NOT NULL, -- "event" | "schedule" | "manual" | "api"
  triggerConfig        JSONB, -- { eventType, schedulePattern, ... }
  
  -- 조건
  conditions           JSONB NOT NULL, -- [ { field, operator, value }, ... ]
  conditionLogic       STRING DEFAULT 'AND', -- "AND" | "OR"
  
  -- 액션
  actions              JSONB NOT NULL, -- [ { type, config }, ... ]
  
  -- 성과 추적
  executedCount        INT DEFAULT 0,
  successCount         INT DEFAULT 0,
  failureCount         INT DEFAULT 0,
  lastExecutedAt       DATETIME,
  
  -- 상태
  isActive             BOOLEAN DEFAULT true,
  createdAt            DATETIME DEFAULT now(),
  updatedAt            DATETIME DEFAULT now(),
  
  INDEX(organizationId, isActive)
);
```

#### CrmMarketingMessage

SMS/Email 메시지 발송 및 추적.

```sql
CREATE TABLE "CrmMarketingMessage" (
  id                   STRING PRIMARY KEY,
  organizationId       STRING NOT NULL (FK),
  contactId            STRING NOT NULL (FK),
  
  -- 메시지 정보
  channel              STRING NOT NULL, -- "SMS" | "EMAIL"
  messageType          STRING NOT NULL, -- "BROADCAST" | "WORKFLOW" | "MANUAL"
  templateId           STRING,
  body                 STRING NOT NULL,
  
  -- 심리학 기법
  lensApplied          STRING, -- "L0" | "L1" | ... | "L10"
  psychologyTechnique  STRING, -- "PASONA" | "SPIN" | "LOSS_AVERSION" | ...
  
  -- 발송 상태
  status               STRING DEFAULT 'PENDING', -- "PENDING" | "SENT" | "FAILED" | "BOUNCED"
  sentAt               DATETIME,
  sentVia              STRING, -- "ALIGO" | "SENDGRID" | "SMTP"
  externalMessageId    STRING,
  
  -- 응답 추적
  openedAt             DATETIME,
  clickedAt            DATETIME,
  respondedAt          DATETIME,
  responseText         STRING,
  
  -- A/B 테스트
  variantKey           STRING, -- "A" | "B" | "C"
  campaignId           STRING,
  
  createdAt            DATETIME DEFAULT now(),
  updatedAt            DATETIME DEFAULT now(),
  
  INDEX(organizationId, status),
  INDEX(contactId, sentAt),
  INDEX(lensApplied),
  INDEX(campaignId)
);
```

#### Partner

파트너/계약자 정보.

```sql
CREATE TABLE "Partner" (
  id                   STRING PRIMARY KEY,
  organizationId       STRING NOT NULL (FK),
  
  -- 기본 정보
  name                 STRING NOT NULL,
  email                STRING,
  phone                STRING,
  status               STRING DEFAULT 'ACTIVE', -- "ACTIVE" | "INACTIVE" | "SUSPENDED"
  
  -- 수수료 설정
  commissionRate       DECIMAL DEFAULT 0.0, -- 0.0-1.0
  payout               STRING DEFAULT 'WEEKLY', -- "WEEKLY" | "MONTHLY"
  bankAccount          STRING,
  bankName             STRING,
  
  -- 성과 메트릭
  totalSales           DECIMAL DEFAULT 0,
  totalCommission      DECIMAL DEFAULT 0,
  totalPayout          DECIMAL DEFAULT 0,
  salesCount           INT DEFAULT 0,
  refundCount          INT DEFAULT 0,
  
  -- 자동 감시
  riskFlag             STRING, -- "NONE" | "FRAUD" | "PERFORMANCE_LOW" | "PAYMENT_ISSUE"
  suspensionReason     STRING,
  
  createdAt            DATETIME DEFAULT now(),
  updatedAt            DATETIME DEFAULT now(),
  
  UNIQUE(organizationId, email),
  INDEX(organizationId, status)
);
```

#### AffiliateSale

파트너 판매 기록 및 수수료 추적.

```sql
CREATE TABLE "AffiliateSale" (
  id                   STRING PRIMARY KEY,
  organizationId       STRING NOT NULL (FK),
  partnerId            STRING NOT NULL (FK),
  contactId            STRING,
  
  -- 판매 정보
  amount               DECIMAL NOT NULL,
  currency             STRING DEFAULT 'KRW',
  saleDate             DATETIME DEFAULT now(),
  
  -- 수수료
  commissionAmount     DECIMAL,
  commissionRate       DECIMAL,
  
  -- 상태
  status               STRING DEFAULT 'PENDING', -- "PENDING" | "APPROVED" | "REJECTED" | "REFUNDED"
  approvedAt           DATETIME,
  paidAt               DATETIME,
  
  -- 성과
  contactName          STRING,
  contactPhone         STRING,
  
  createdAt            DATETIME DEFAULT now(),
  updatedAt            DATETIME DEFAULT now(),
  
  INDEX(organizationId, partnerId),
  INDEX(saleDate),
  INDEX(status)
);
```

#### RiskFlag

자동 감시 플래그 (Contact 또는 Partner).

```sql
CREATE TABLE "RiskFlag" (
  id                   STRING PRIMARY KEY,
  targetId             STRING NOT NULL, -- contactId 또는 partnerId
  targetType           STRING NOT NULL, -- "CONTACT" | "PARTNER"
  
  -- 플래그 정보
  flagType             STRING NOT NULL,
  -- Contact: "INACTIVE_6M" | "INACTIVE_12M" | "PRICE_COMPLAINT" | "CHURN_RISK" | "FRAUD_SUSPICIOUS"
  -- Partner: "SALE_VOLUME_LOW" | "REFUND_HIGH" | "PAYMENT_LATE" | "REPUTATION_ISSUE"
  
  severity             INT DEFAULT 1, -- 1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL
  score                INT DEFAULT 0, -- 0-100
  reason               STRING,
  
  -- 자동 액션
  autoAction           STRING, -- "SMS_REACTIVATION" | "MANUAL_REVIEW" | null
  actionTriggeredAt    DATETIME,
  
  isResolved           BOOLEAN DEFAULT false,
  resolvedAt           DATETIME,
  resolvedBy           STRING,
  
  createdAt            DATETIME DEFAULT now(),
  updatedAt            DATETIME DEFAULT now(),
  
  INDEX(targetId, targetType),
  INDEX(flagType),
  INDEX(isResolved)
);
```

### 3.2 인덱싱 전략

```sql
-- Contact 검색 성능 최적화
CREATE INDEX idx_contact_org_status ON "Contact"(organizationId, status);
CREATE INDEX idx_contact_org_lens ON "Contact"(organizationId, dominantLens);
CREATE INDEX idx_contact_risk_score ON "Contact"(riskScore DESC);
CREATE INDEX idx_contact_next_action ON "Contact"(nextActionDate) WHERE workflowStatus = 'ACTIVE';

-- Message 발송 추적
CREATE INDEX idx_crm_msg_org_status ON "CrmMarketingMessage"(organizationId, status);
CREATE INDEX idx_crm_msg_contact_date ON "CrmMarketingMessage"(contactId, sentAt DESC);
CREATE INDEX idx_crm_msg_lens ON "CrmMarketingMessage"(lensApplied);
CREATE INDEX idx_crm_msg_campaign ON "CrmMarketingMessage"(campaignId);

-- Workflow 실행 로그
CREATE INDEX idx_execution_log_org ON "ExecutionLog"(organizationId, createdAt DESC);
CREATE INDEX idx_execution_log_workflow ON "ExecutionLog"(workflowId, status);

-- 파트너 성과
CREATE INDEX idx_affiliate_sale_partner_date ON "AffiliateSale"(partnerId, saleDate DESC);
CREATE INDEX idx_affiliate_sale_status ON "AffiliateSale"(status);
```

---

## 4. API 설계 & 엔드포인트

### 4.1 Contact API

#### POST /api/contacts
새로운 고객 생성 또는 기존 고객 업데이트.

```typescript
// Request
{
  organizationId: string,
  name: string,
  phone?: string,
  email?: string,
  birthDate?: string (YYYY-MM-DD),
  source: "manual" | "import" | "api" | "sms",
  tags?: string[],
  metadata?: Record<string, any>
}

// Response (200)
{
  id: string,
  name: string,
  phone: string,
  email: string,
  dominantLens: "L0" | "L1" | ... | "L10",
  segment: "GOLD" | "SILVER" | "BRONZE" | "COLD",
  riskScore: number,
  tags: string[],
  createdAt: string,
  updatedAt: string
}

// Error (400, 409)
{
  error: string,
  details: Record<string, any>
}
```

#### GET /api/contacts/{id}
고객 상세 조회 (렌즈 점수 포함).

```typescript
// Response (200)
{
  id: string,
  organizationId: string,
  name: string,
  phone: string,
  email: string,
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED",
  
  // 렌즈 점수
  lensScores: {
    L0: number, // 부재
    L1: number, // 가격
    L2: number, // 준비
    // ... L3-L10
  },
  dominantLens: string,
  
  // 세그먼트
  segment: string,
  riskScore: number,
  riskFlags: { flagType: string, severity: number }[],
  
  // 성과
  totalSpent: number,
  purchaseCount: number,
  lastPurchaseDate: string,
  
  // 자동화
  tags: string[],
  nextActionDate: string,
  nextActionType: string,
  
  messages: CrmMarketingMessage[],
  callLogs: CallLog[],
  
  createdAt: string,
  updatedAt: string
}
```

#### PATCH /api/contacts/{id}
고객 정보 업데이트 및 렌즈 점수 재계산.

```typescript
// Request
{
  name?: string,
  phone?: string,
  email?: string,
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED",
  tags?: string[],
  metadata?: Record<string, any>,
  recalculateLens?: boolean // true면 L0-L10 점수 재계산
}

// Response (200)
{
  id: string,
  updatedAt: string,
  dominantLens: string,
  lensScores: Record<string, number>
}
```

#### POST /api/contacts/{id}/message
고객에게 메시지 발송.

```typescript
// Request
{
  channel: "SMS" | "EMAIL",
  templateId?: string,
  body: string,
  lensApplied?: "L0" | "L1" | ... | "L10",
  psychologyTechnique?: "PASONA" | "SPIN" | "LOSS_AVERSION",
  variantKey?: "A" | "B" | "C",
  campaignId?: string,
  sendAt?: string (ISO 8601, 예약 발송)
}

// Response (200)
{
  messageId: string,
  status: "PENDING" | "SENT" | "FAILED",
  channel: string,
  sentAt?: string,
  externalMessageId?: string
}
```

#### GET /api/contacts
고객 목록 조회 (필터링 + 페이징).

```typescript
// Query Parameters
{
  organizationId: string (필수),
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED",
  segment?: "GOLD" | "SILVER" | "BRONZE" | "COLD",
  lens?: "L0" | "L1" | ... | "L10",
  riskScoreMin?: number,
  riskScoreMax?: number,
  tags?: string[] (CSV 또는 배열),
  search?: string, // 이름, 전화, 이메일 검색
  sortBy?: "createdAt" | "lastContactDate" | "riskScore",
  sortOrder?: "asc" | "desc",
  skip?: number,
  take?: number (기본 50, 최대 500)
}

// Response (200)
{
  total: number,
  contacts: Contact[],
  nextToken?: string // 페이징용
}
```

### 4.2 Workflow API

#### POST /api/workflows
새로운 자동화 워크플로우 생성.

```typescript
// Request
{
  organizationId: string,
  name: string,
  description?: string,
  
  // 트리거
  triggerType: "event" | "schedule" | "manual" | "api",
  triggerConfig: {
    // event: { eventType: "contact_created" | "lens_changed" | "message_responded" }
    // schedule: { pattern: "CRON", expression: "0 9 * * *" }
    // manual: {}
    // api: { path: "/api/custom-event" }
  },
  
  // 조건
  conditions: [
    {
      field: "dominantLens" | "riskScore" | "status" | "tags" | "custom",
      operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "contains",
      value: any
    }
  ],
  conditionLogic: "AND" | "OR",
  
  // 액션
  actions: [
    {
      type: "message" | "tag" | "segment" | "webhook" | "api",
      config: {
        // message: { channel: "SMS" | "EMAIL", templateId: string, body: string }
        // tag: { tags: string[] }
        // segment: { segment: "GOLD" | "SILVER" | ... }
        // webhook: { url: string, method: "POST" | "PUT", headers: Record<string, string> }
        // api: { endpoint: string, method: string, payload: any }
      }
    }
  ]
}

// Response (201)
{
  id: string,
  organizationId: string,
  name: string,
  isActive: boolean,
  createdAt: string
}
```

#### GET /api/workflows
활성 워크플로우 목록.

```typescript
// Query
{
  organizationId: string (필수),
  isActive?: boolean,
  triggerType?: string,
  skip?: number,
  take?: number
}

// Response (200)
{
  total: number,
  workflows: Workflow[]
}
```

#### POST /api/workflows/{id}/execute
즉시 워크플로우 실행 (테스트/수동 트리거).

```typescript
// Request
{
  contactIds?: string[], // 특정 고객에게만 실행
  dryRun?: boolean // true면 시뮬레이션
}

// Response (200)
{
  executionId: string,
  status: "PENDING" | "EXECUTING" | "COMPLETED",
  contactsProcessed: number,
  actionsExecuted: number,
  errors: { contactId: string, error: string }[]
}
```

#### GET /api/workflows/{id}/logs
워크플로우 실행 로그.

```typescript
// Query
{
  status?: "SUCCESS" | "FAILED" | "PENDING",
  skip?: number,
  take?: number
}

// Response (200)
{
  total: number,
  logs: ExecutionLog[]
}
```

### 4.3 Affiliate API

#### GET /api/affiliates
파트너 목록.

```typescript
// Query
{
  organizationId: string (필수),
  status?: "ACTIVE" | "INACTIVE" | "SUSPENDED",
  skip?: number,
  take?: number
}

// Response (200)
{
  total: number,
  partners: Partner[]
}
```

#### GET /api/affiliates/{id}/performance
파트너 성과 지표.

```typescript
// Query
{
  period?: "WEEK" | "MONTH" | "YEAR",
  startDate?: string,
  endDate?: string
}

// Response (200)
{
  partnerId: string,
  period: string,
  totalSales: number,
  salesCount: number,
  avgSaleAmount: number,
  commissionEarned: number,
  refunds: number,
  conversionRate: number,
  trend: { date: string, sales: number, commission: number }[]
}
```

#### GET /api/affiliates/{id}/payouts
지급 기록.

```typescript
// Query
{
  status?: "PENDING" | "COMPLETED" | "FAILED",
  skip?: number,
  take?: number
}

// Response (200)
{
  total: number,
  payouts: {
    id: string,
    amount: number,
    status: string,
    createdAt: string,
    paidAt?: string,
    bankAccount: string
  }[]
}
```

#### POST /api/affiliates/{id}/bonus
보너스 지급 (관리자 전용).

```typescript
// Request
{
  amount: number,
  reason: string,
  month?: string (YYYY-MM)
}

// Response (200)
{
  payoutId: string,
  amount: number,
  status: "PENDING"
}
```

---

## 5. Workflow 엔진 상세

### 5.1 Trigger 타입

#### Event-based Trigger

고객 이벤트 발생 시 즉시 트리거.

```typescript
enum EventType {
  // Contact
  CONTACT_CREATED = "contact_created",
  CONTACT_UPDATED = "contact_updated",
  CONTACT_ARCHIVED = "contact_archived",
  
  // Lens
  LENS_CHANGED = "lens_changed", // dominantLens 변경
  LENS_SCORE_UPDATED = "lens_score_updated",
  
  // Message
  MESSAGE_SENT = "message_sent",
  MESSAGE_RESPONDED = "message_responded",
  MESSAGE_BOUNCED = "message_bounced",
  
  // Risk
  RISK_FLAG_CREATED = "risk_flag_created",
  RISK_SCORE_INCREASED = "risk_score_increased"
}

// 구현: Prisma middleware 또는 Event Emitter
// src/lib/events/contact-events.ts
class ContactEventEmitter {
  on(event: EventType, callback: (data: any) => void) { ... }
  emit(event: EventType, data: any) { ... }
}
```

#### Schedule-based Trigger

CRON 패턴으로 정기적으로 실행.

```typescript
// Trigger Config
{
  triggerType: "schedule",
  triggerConfig: {
    pattern: "CRON",
    expression: "0 9 * * MON,WED,FRI" // 매주 월/수/금 9:00
  }
}

// 구현: Node.js cron (node-cron) + Next.js API Routes
// src/jobs/workflow-scheduler.ts
const job = cron.schedule('0 9 * * *', async () => {
  const workflows = await getScheduledWorkflows();
  for (const wf of workflows) {
    await executeWorkflow(wf.id);
  }
});
```

### 5.2 Condition 평가 (DSL)

```typescript
// Condition DSL
type Condition = {
  field: string, // Contact의 컬럼 또는 nested 경로
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "contains" | "startsWith",
  value: any
}

// 예제 1: L0 렌즈 > 70
{
  field: "lensL0Score",
  operator: "gt",
  value: 70
}

// 예제 2: Risk Score 60 이상
{
  field: "riskScore",
  operator: "gte",
  value: 60
}

// 예제 3: Tags에 "가격이의" 포함
{
  field: "tags",
  operator: "contains",
  value: "가격이의"
}

// 예제 4: 지난 6개월 미접촉 (부재)
{
  field: "lastContactDate",
  operator: "lt",
  value: "NOW - 6 months"
}

// 평가 로직
function evaluateConditions(contact: Contact, conditions: Condition[]): boolean {
  const results = conditions.map(cond => {
    const fieldValue = getNestedField(contact, cond.field);
    return evaluateCondition(fieldValue, cond.operator, cond.value);
  });
  
  // conditionLogic: "AND" => all(results), "OR" => any(results)
  return conditionLogic === "AND" ? results.every(r => r) : results.some(r => r);
}
```

### 5.3 Action 타입

#### Message Action

SMS 또는 Email 발송.

```typescript
{
  type: "message",
  config: {
    channel: "SMS" | "EMAIL",
    templateId?: string,
    body: string,
    lensApplied?: "L0" | "L1" | ... | "L10",
    psychologyTechnique?: "PASONA" | "SPIN" | "LOSS_AVERSION",
    delayMinutes?: number, // 지연 발송 (기본 0)
    sendAt?: string // ISO 8601 스케줄링
  }
}
```

#### Tag Action

자동으로 태그 추가/제거.

```typescript
{
  type: "tag",
  config: {
    add: ["tag1", "tag2"],
    remove: ["tag3"]
  }
}
```

#### Segment Action

세그먼트 자동 할당.

```typescript
{
  type: "segment",
  config: {
    segment: "GOLD" | "SILVER" | "BRONZE" | "COLD"
  }
}
```

#### Webhook Action

외부 시스템에 HTTP 요청.

```typescript
{
  type: "webhook",
  config: {
    url: "https://external-crm.com/api/contacts",
    method: "POST" | "PUT" | "PATCH",
    headers: { "Authorization": "Bearer token" },
    payload: {
      // 템플릿: {{contact.id}}, {{contact.name}}, {{contact.lensL0Score}}, etc.
      contactId: "{{contact.id}}",
      name: "{{contact.name}}",
      lensApplied: "L0"
    }
  }
}
```

#### API Action

내부 API 호출 (확장성).

```typescript
{
  type: "api",
  config: {
    endpoint: "/api/custom-action",
    method: "POST",
    payload: {
      contactId: "{{contact.id}}",
      action: "custom_logic"
    }
  }
}
```

### 5.4 Execution Context & Retry

```typescript
interface ExecutionContext {
  workflowId: string,
  executionId: string, // 각 실행마다 고유 ID
  contactId: string,
  status: "PENDING" | "EXECUTING" | "COMPLETED" | "FAILED",
  
  // 액션 결과
  actionResults: {
    actionId: string,
    type: string,
    status: "SUCCESS" | "FAILED",
    result: any,
    error?: string,
    executedAt: string,
    retryCount: number
  }[],
  
  // 메타데이터
  triggeredBy: "event" | "schedule" | "manual" | "api",
  triggeredAt: string,
  completedAt?: string,
  
  // 로깅
  logs: string[]
}

// Retry 정책
interface RetryPolicy {
  maxRetries: number, // 기본 3
  backoffMs: number[], // [1000, 5000, 30000]
  retryableErrors: string[] // ["NETWORK_ERROR", "TIMEOUT"]
}

// 구현
async function executeAction(action: Action, contact: Contact, ctx: ExecutionContext) {
  let lastError = null;
  
  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    try {
      const result = await performAction(action, contact);
      ctx.actionResults.push({
        actionId: action.id,
        status: "SUCCESS",
        result,
        retryCount: attempt
      });
      return;
    } catch (error) {
      lastError = error;
      
      if (attempt < policy.maxRetries && isRetryable(error)) {
        const delay = policy.backoffMs[attempt] || policy.backoffMs[policy.backoffMs.length - 1];
        await sleep(delay);
      }
    }
  }
  
  ctx.actionResults.push({
    status: "FAILED",
    error: lastError.message,
    retryCount: policy.maxRetries
  });
}
```

---

## 6. 자동화 사용 예제

### 예제 1: 부재 고객 복구 (L0 렌즈)

**시나리오**: 6개월 이상 미접촉 고객을 자동으로 복구하는 워크플로우.

```typescript
// Workflow 정의
const reactivationWorkflow = {
  organizationId: "org-123",
  name: "L0 부재 고객 자동 복구",
  description: "6개월 이상 미접촉 고객에게 Day 0-3 SMS 자동 발송",
  
  triggerType: "schedule",
  triggerConfig: {
    pattern: "CRON",
    expression: "0 9 * * MON" // 매주 월요일 9:00
  },
  
  conditions: [
    {
      field: "lastContactDate",
      operator: "lt",
      value: "NOW - 6 months"
    },
    {
      field: "status",
      operator: "eq",
      value: "ACTIVE"
    },
    {
      field: "lensL0Score",
      operator: "gte",
      value: 60
    }
  ],
  
  actions: [
    // Day 0: 초기 접촉 (PASONA P+A 단계)
    {
      type: "message",
      config: {
        channel: "SMS",
        body: "{{contact.name}} 고객님! 오랜만입니다. 최신 특가가 20% 할인입니다. 확인하시겠어요? [링크]",
        lensApplied: "L0",
        psychologyTechnique: "PASONA",
        delayMinutes: 0
      }
    },
    
    // Day 2: Follow-up (이의 대응)
    {
      type: "message",
      config: {
        channel: "SMS",
        body: "{{contact.name}} 고객님, 남은 자리가 2석뿐입니다. 즉시 예약하시면 추가 할인도 가능합니다!",
        lensApplied: "L0",
        psychologyTechnique: "LOSS_AVERSION",
        sendAt: "NOW + 2 days"
      }
    },
    
    // Day 3: 최종 결정 촉구
    {
      type: "message",
      config: {
        channel: "SMS",
        body: "마지막 기회입니다! 이 가격으로는 내일까지만 가능합니다. 지금 바로 결정하세요!",
        lensApplied: "L0",
        psychologyTechnique: "SCARCITY",
        sendAt: "NOW + 3 days"
      }
    },
    
    // 자동 태그
    {
      type: "tag",
      config: {
        add: ["L0_재활성화_진행중"],
        remove: ["L0_미접촉"]
      }
    }
  ]
};

// 실행 결과 예상
// - 부재 고객 500명 발견
// - SMS 3회 자동 발송 (1,500 건)
// - 예상 응답율: 12-18% (60-90명)
// - 예상 전환율: 8-12% (40-50명)
// - 예상 매출: 500만원 이상
```

### 예제 2: 가격 이의 대응 (L1 렌즈)

**시나리오**: 메시지에서 "비싸", "가격 문의" 등을 감지하면 자동으로 대응 옵션 제시.

```typescript
const priceObjectionWorkflow = {
  organizationId: "org-123",
  name: "L1 가격 이의 자동 대응",
  
  triggerType: "event",
  triggerConfig: {
    eventType: "message_responded"
  },
  
  conditions: [
    {
      field: "responseText",
      operator: "contains",
      value: ["비싸", "가격", "너무 비", "할인", "가격 문의"]
    },
    {
      field: "lensL1Score",
      operator: "lt",
      value: 50 // 가격 민감도 높음
    }
  ],
  
  actions: [
    // SMS: 3가지 대안 제시 (Grant Cardone Rebuttal)
    {
      type: "message",
      config: {
        channel: "SMS",
        templateId: "price_rebuttal_3choices",
        lensApplied: "L1",
        psychologyTechnique: "SPIN",
        body: `{{contact.name}} 고객님의 고민 이해합니다.
        
3가지 선택지가 있습니다:
1️⃣ 12개월 할부 → 월 {{monthly_price}}원
2️⃣ 그룹 예약 → 인당 15% 할인
3️⃣ VIP멤버십 → 평생 20% 할인 + 우선예약

어느 옵션이 가장 관심 가나요?`
      }
    },
    
    // CRM 태그
    {
      type: "tag",
      config: {
        add: ["L1_가격이의", "대응필요"]
      }
    },
    
    // Webhook: CRM에 기록
    {
      type: "webhook",
      config: {
        url: "https://salesforce-api.com/contacts/{{contact.id}}/activities",
        method: "POST",
        payload: {
          type: "PRICE_OBJECTION",
          responseText: "{{contact.lastMessage}}",
          suggestedNextAction: "3_CHOICE_CTA"
        }
      }
    }
  ]
};
```

### 예제 3: 즉시 구매 트리거 (L10 렌즈)

**시나리오**: L10 점수 > 75인 고객에게 즉시 구매 CTA (삼중선택).

```typescript
const immediatePurchaseWorkflow = {
  organizationId: "org-123",
  name: "L10 즉시 구매 결정 유도",
  
  triggerType: "event",
  triggerConfig: {
    eventType: "lens_score_updated"
  },
  
  conditions: [
    {
      field: "lensL10Score",
      operator: "gte",
      value: 75
    },
    {
      field: "status",
      operator: "eq",
      value: "ACTIVE"
    }
  ],
  
  actions: [
    {
      type: "message",
      config: {
        channel: "SMS",
        body: `{{contact.name}} 고객님! 지금 바로 결정하세요!

🎁 옵션 A: 지금 예약 → 추가 선물 증정
💰 옵션 B: 2명 이상 단체 → 1명 무료
⏰ 옵션 C: 24시간 내 결정 → 30만원 추가 할인

지금 바로 결정하셔야 이 가격으로 가능합니다!
[예약 링크]`,
        lensApplied: "L10",
        psychologyTechnique: "LOSS_AVERSION + SCARCITY"
      }
    }
  ]
};
```

---

## 7. 배포 & 운영

### 7.1 환경 변수 설정 (.env.local)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname
DATABASE_URL_NON_POOLING=postgresql://user:password@host:5432/dbname (Prisma 마이그레이션용)

# Redis (캐시 + 큐)
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# SMS (Aligo)
ALIGO_KEY=xxx
ALIGO_USER_ID=xxx
ALIGO_SENDER_PHONE=01012345678

# Email (SendGrid 또는 SMTP)
SENDGRID_API_KEY=xxx
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=xxx
SMTP_PASS=xxx

# AI (Anthropic)
ANTHROPIC_API_KEY=xxx

# Auth
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://yourdomain.com

# Clerk (선택적)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=xxx
CLERK_SECRET_KEY=xxx

# Observability
SENTRY_DSN=xxx
ENVIRONMENT=production
```

### 7.2 마이그레이션 전략

```bash
# 1. Schema 변경 생성
npx prisma migrate dev --name add_new_column

# 2. 마이그레이션 파일 검토
# prisma/migrations/{timestamp}_add_new_column/migration.sql

# 3. Staging 환경에서 테스트
DATABASE_URL=staging-db-url npx prisma migrate deploy

# 4. 프로덕션 배포 전 백업
pg_dump postgresql://prod-db > backup-$(date +%s).sql

# 5. 프로덕션 마이그레이션
DATABASE_URL=production-db-url npx prisma migrate deploy

# 6. 검증
npx prisma studio # 프로덕션 DB 데이터 확인
```

### 7.3 모니터링 & 경고

```typescript
// Sentry 설정 (src/middleware.ts)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.ENVIRONMENT,
  tracesSampleRate: process.env.ENVIRONMENT === 'production' ? 0.1 : 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Prisma()
  ]
});

// 커스텀 모니터링
async function monitorWorkflowExecution(workflowId: string) {
  const startTime = Date.now();
  
  try {
    const result = await executeWorkflow(workflowId);
    
    Sentry.captureMessage(`Workflow ${workflowId} executed successfully`, 'info', {
      duration: Date.now() - startTime,
      contactsProcessed: result.contactsProcessed,
      actionsExecuted: result.actionsExecuted
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        workflowId,
        component: 'workflow-engine'
      }
    });
  }
}
```

### 7.4 성능 메트릭 수집

```typescript
// src/lib/metrics.ts
export class MetricsCollector {
  static async recordWorkflowMetrics(workflowId: string, ctx: ExecutionContext) {
    const metrics = {
      workflowId,
      duration: ctx.completedAt - ctx.triggeredAt,
      contactsProcessed: ctx.contactCount,
      actionsExecuted: ctx.actionResults.length,
      successCount: ctx.actionResults.filter(r => r.status === 'SUCCESS').length,
      failureCount: ctx.actionResults.filter(r => r.status === 'FAILED').length,
      averageActionTime: ctx.actionResults.reduce((sum, r) => sum + r.duration, 0) / ctx.actionResults.length
    };
    
    // DataDog / CloudWatch 등으로 전송
    await sendMetrics(metrics);
  }
}
```

---

## 8. 보안

### 8.1 RBAC (Role-Based Access Control)

```typescript
enum OrganizationRole {
  ADMIN = 'ADMIN',      // 모든 권한
  MANAGER = 'MANAGER',  // 팀 관리 + 자동화 설정
  AGENT = 'AGENT',      // 고객 접근만
  VIEWER = 'VIEWER'     // 읽기만
}

// API 미들웨어
async function checkPermission(req: NextRequest, requiredRole: OrganizationRole) {
  const session = await getSession(req);
  const member = await db.organizationMember.findUnique({
    where: { id: session.memberId }
  });
  
  const roleHierarchy = ['ADMIN', 'MANAGER', 'AGENT', 'VIEWER'];
  const hasPermission = roleHierarchy.indexOf(member.role) <= roleHierarchy.indexOf(requiredRole);
  
  if (!hasPermission) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
```

### 8.2 API Key 관리

```typescript
// API Key 생성 및 저장
async function generateApiKey(organizationId: string) {
  const key = crypto.randomBytes(32).toString('hex');
  const hashedKey = await hash(key);
  
  await db.apiKey.create({
    data: {
      organizationId,
      hashedKey,
      lastUsedAt: null,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1년
    }
  });
  
  return key; // 이 값만 한 번 반환
}

// API 인증 미들웨어
async function authenticateApiKey(req: NextRequest) {
  const key = req.headers.get('X-API-Key');
  if (!key) return null;
  
  const hashedKey = await hash(key);
  const apiKey = await db.apiKey.findUnique({
    where: { hashedKey }
  });
  
  if (!apiKey || (apiKey.expiresAt && apiKey.expiresAt < new Date())) {
    return null;
  }
  
  // 마지막 사용 시간 업데이트
  await db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() }
  });
  
  return apiKey.organizationId;
}
```

### 8.3 Webhook 서명 검증

```typescript
// Webhook 발송 시 HMAC 서명 생성
async function sendWebhook(config: WebhookConfig, payload: any) {
  const secret = config.secret || process.env.WEBHOOK_SECRET;
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  await fetch(config.url, {
    method: config.method,
    headers: {
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': Date.now().toString(),
      'Content-Type': 'application/json'
    },
    body
  });
}

// 수신자가 서명 검증
export async function POST(req: NextRequest) {
  const signature = req.headers.get('X-Webhook-Signature');
  const timestamp = req.headers.get('X-Webhook-Timestamp');
  const body = await req.text();
  
  // 타임스탐프 검증 (5분 이내)
  if (Math.abs(Date.now() - parseInt(timestamp)) > 5 * 60 * 1000) {
    return NextResponse.json({ error: 'Request expired' }, { status: 401 });
  }
  
  // 서명 검증
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  // 처리
  const payload = JSON.parse(body);
  // ...
}
```

### 8.4 민감 정보 암호화

```typescript
import crypto from 'crypto';

// SMS 설정 암호화
async function encryptSmsConfig(smsConfig: SmsConfigInput) {
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'),
    crypto.randomBytes(16)
  );
  
  const encrypted = cipher.update(JSON.stringify(smsConfig), 'utf8', 'hex');
  cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedData: encrypted,
    authTag: authTag.toString('hex'),
    iv: (cipher as any).iv.toString('hex')
  };
}

// 복호화
function decryptSmsConfig(encrypted: { encryptedData: string, authTag: string, iv: string }) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'),
    Buffer.from(encrypted.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));
  
  const decrypted = decipher.update(encrypted.encryptedData, 'hex', 'utf8');
  decipher.final('utf8');
  
  return JSON.parse(decrypted);
}
```

---

## 9. 성능 최적화

### 9.1 데이터베이스 최적화

```typescript
// N+1 쿼리 방지
async function getContactsWithEngagement(organizationId: string) {
  // ❌ 나쁜 예: N+1 쿼리
  const contacts = await db.contact.findMany({ where: { organizationId } });
  for (const contact of contacts) {
    contact.messages = await db.crmMarketingMessage.findMany({
      where: { contactId: contact.id }
    });
  }
  
  // ✅ 좋은 예: 한 번의 쿼리 (JOIN)
  const contacts = await db.contact.findMany({
    where: { organizationId },
    include: {
      messages: {
        take: 10,
        orderBy: { createdAt: 'desc' }
      }
    }
  });
}

// Connection Pooling
// .env.local
DATABASE_URL=postgresql://user:pass@host/db?schema=public&connection_limit=20
```

### 9.2 캐싱 전략

```typescript
// Redis 캐시
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

async function getCachedContact(contactId: string) {
  // 1. Redis 캐시 확인
  const cached = await redis.get(`contact:${contactId}`);
  if (cached) return JSON.parse(cached);
  
  // 2. DB에서 조회
  const contact = await db.contact.findUnique({
    where: { id: contactId }
  });
  
  // 3. Redis에 5분 캐시
  if (contact) {
    await redis.setex(`contact:${contactId}`, 300, JSON.stringify(contact));
  }
  
  return contact;
}

// 캐시 무효화 (Contact 업데이트 시)
async function updateContact(id: string, data: any) {
  const updated = await db.contact.update({
    where: { id },
    data
  });
  
  // 캐시 삭제
  await redis.del(`contact:${id}`);
  
  return updated;
}
```

### 9.3 Rate Limiting

```typescript
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 h') // 시간당 100요청
});

export async function POST(req: NextRequest) {
  const identifier = req.headers.get('X-API-Key') || req.ip || 'anonymous';
  
  const { success } = await ratelimit.limit(identifier);
  
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  // 계속 진행
}
```

### 9.4 페이징 & 스트리밍

```typescript
// 대량 데이터 조회 시 페이징
async function getContactsPaginated(organizationId: string, skip: number, take: number) {
  const [total, contacts] = await Promise.all([
    db.contact.count({ where: { organizationId } }),
    db.contact.findMany({
      where: { organizationId },
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    })
  ]);
  
  return {
    total,
    contacts,
    hasMore: skip + take < total
  };
}

// 스트리밍 응답 (대량 export)
export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const organizationId = req.nextUrl.searchParams.get('organizationId')!;
      const pageSize = 1000;
      let skip = 0;
      
      while (true) {
        const contacts = await db.contact.findMany({
          where: { organizationId },
          skip,
          take: pageSize
        });
        
        if (contacts.length === 0) break;
        
        controller.enqueue(JSON.stringify(contacts) + '\n');
        skip += pageSize;
      }
      
      controller.close();
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="contacts.jsonl"'
    }
  });
}
```

---

## 10. 통합 가이드

### 10.1 Aligo SMS 통합

```typescript
// src/lib/sms/aligo-client.ts
import axios from 'axios';

class AligoClient {
  private baseUrl = 'https://apis.aligo.in/send/';
  
  async sendSMS(
    recipientPhone: string,
    message: string,
    senderPhone: string
  ): Promise<{ messageId: string, status: 'success' | 'failed' }> {
    const response = await axios.post(this.baseUrl, {
      apikey: process.env.ALIGO_KEY,
      userid: process.env.ALIGO_USER_ID,
      sPhone: senderPhone.replace(/[^0-9]/g, ''),
      rPhone: recipientPhone.replace(/[^0-9]/g, ''),
      msg: message,
      testmode: '0'
    });
    
    return {
      messageId: response.data.msg_id,
      status: response.data.result === '1' ? 'success' : 'failed'
    };
  }
  
  async getBalance(): Promise<number> {
    const response = await axios.get(`${this.baseUrl}balance/`, {
      params: {
        apikey: process.env.ALIGO_KEY
      }
    });
    
    return response.data.balance;
  }
}

export const aligoClient = new AligoClient();
```

### 10.2 SendGrid Email 통합

```typescript
// src/lib/email/sendgrid-client.ts
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

async function sendEmail(to: string, subject: string, html: string) {
  const msg = {
    to,
    from: process.env.SENDGRID_FROM_EMAIL!,
    subject,
    html,
    trackingSettings: {
      openTracking: { enabled: true },
      clickTracking: { enabled: true }
    }
  };
  
  try {
    const response = await sgMail.send(msg);
    return {
      messageId: response[0].headers['x-message-id'],
      status: 'sent'
    };
  } catch (error) {
    return { status: 'failed', error };
  }
}
```

### 10.3 Webhook 통합 (외부 CRM)

```typescript
// src/app/api/webhooks/contact-updated/route.ts
import { verifyWebhookSignature } from '@/lib/webhook-utils';

export async function POST(req: NextRequest) {
  // 1. 서명 검증
  if (!verifyWebhookSignature(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // 2. 페이로드 파싱
  const { contact, event } = await req.json();
  
  // 3. 외부 CRM 업데이트 (Salesforce, HubSpot, etc.)
  switch (event.type) {
    case 'contact_created':
      await syncToSalesforce(contact);
      break;
    case 'lens_changed':
      await updateHubSpotLens(contact.id, contact.dominantLens);
      break;
    case 'message_responded':
      await logActivityInSalesforce(contact.id, event.message);
      break;
  }
  
  return NextResponse.json({ success: true });
}
```

### 10.4 Affiliate Partner Webhook

```typescript
// src/app/api/webhooks/affiliate-sale/route.ts
export async function POST(req: NextRequest) {
  const { partnerId, amount, contactPhone } = await req.json();
  
  // 1. Partner 검증
  const partner = await db.partner.findUnique({
    where: { id: partnerId }
  });
  
  if (!partner) {
    return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
  }
  
  // 2. Contact 조회 (전화번호로)
  let contact = await db.contact.findFirst({
    where: { phone: contactPhone }
  });
  
  // Contact가 없으면 자동 생성
  if (!contact) {
    contact = await db.contact.create({
      data: {
        organizationId: partner.organizationId,
        name: 'Partner Sale',
        phone: contactPhone,
        source: 'affiliate',
        status: 'ACTIVE'
      }
    });
  }
  
  // 3. Sale 기록
  const sale = await db.affiliateSale.create({
    data: {
      organizationId: partner.organizationId,
      partnerId: partner.id,
      contactId: contact.id,
      amount,
      commissionAmount: amount * partner.commissionRate,
      commissionRate: partner.commissionRate,
      status: 'PENDING'
    }
  });
  
  // 4. Partner 성과 업데이트
  await db.partner.update({
    where: { id: partner.id },
    data: {
      totalSales: { increment: amount },
      totalCommission: { increment: sale.commissionAmount },
      salesCount: { increment: 1 }
    }
  });
  
  return NextResponse.json({ saleId: sale.id, status: 'recorded' });
}
```

---

## 11. 문제 해결

### 11.1 일반적인 오류

| 에러 | 원인 | 해결책 |
|------|------|--------|
| `ECONNREFUSED` (DB) | 데이터베이스 연결 불가 | `DATABASE_URL` 확인, Supabase 상태 체크 |
| `Prisma Client not initialized` | Prisma 미생성 | `npx prisma generate` 실행 |
| `API Key invalid` | Aligo/SendGrid 키 만료 | `.env.local` 갱신 |
| `Rate limit exceeded` | API 호출 제한 | Redis 상태 확인, Upstash 할당량 체크 |
| `Webhook timeout` | 외부 API 응답 지연 | 타임아웃 값 증가, 재시도 로직 추가 |

### 11.2 디버깅 기술

```typescript
// 1. Prisma Studio (DB 직접 확인)
npx prisma studio

// 2. 상세 로깅
export async function executeWorkflow(workflowId: string) {
  const startTime = Date.now();
  console.log(`[Workflow] Starting ${workflowId} at ${new Date().toISOString()}`);
  
  try {
    // ...
    console.log(`[Workflow] Completed in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error(`[Workflow] Failed with error:`, error);
    Sentry.captureException(error);
  }
}

// 3. 네트워크 요청 추적
// Next.js DevTools (browser console)
// Network tab에서 API 요청 확인

// 4. Database 쿼리 로깅
// prisma/schema.prisma
// datasource db {
//   provider = "postgresql"
//   url      = env("DATABASE_URL")
// }
// 
// 환경 변수에 추가
// DATABASE_URL="postgresql://...?schema=public&debug=true"
```

### 11.3 성능 병목 식별

```bash
# 데이터베이스 느린 쿼리 로그 확인
SELECT query, mean_time, calls FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

# Redis 메모리 사용량
UPSTASH_REDIS_REST_URL에서 대시보드 확인

# API 응답 시간 측정
curl -w "@curl-format.txt" -o /dev/null -s https://yourapi.com/contacts
```

---

## 부록: 자주 묻는 질문 (FAQ)

**Q1: Workflow를 수동으로 테스트하려면?**
```bash
# API 호출
curl -X POST http://localhost:3000/api/workflows/{id}/execute \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

**Q2: Contact의 렌즈 점수는 어떻게 계산되나?**
> 자동 분류: 고객 응답, 메시지 내용, 구매 패턴을 AI로 분석해 L0-L10 점수 산출 (0-100).  
> 수동 조정: 담당자가 직접 수정 가능. 변경 시 자동으로 workflow 재평가.

**Q3: SMS 발송 실패 시 자동 재시도는?**
> Yes. 최대 3회 재시도 (지수 백오프: 1초 → 5초 → 30초). 최종 실패 시 Risk Flag 생성.

**Q4: 외부 CRM과 Contact 동기화는?**
> Webhook API 사용. 마비즈에서 `contact_updated` 이벤트 발생 시 외부 CRM에 HTTP POST 요청.

---

**마지막 업데이트**: 2026-05-26  
**작성자**: AI Agent  
**버전**: 2.0 (Workflow + Psychology Lens 통합)

**다음 단계**:
- [ ] 개발팀: API 엔드포인트 구현 검증
- [ ] DevOps: 프로덕션 환경 설정 확인
- [ ] QA: 엔드투엔드 테스트 케이스 작성
- [ ] 파트너: 통합 가이드 검토
