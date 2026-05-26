# Day 0-3 Sequence Tab Implementation Guide

**Date**: 2026-05-27  
**Status**: Planning Phase  
**Expected Duration**: 8-10 days (frontend: 3-4 days, backend APIs: 2-3 days, testing: 2-3 days)  
**Impact**: +$152K/month, Automation 20% → 80% (60% manual work reduction)

---

## 📋 Project Overview

### Current State
- Playbook page shows 2 tabs: 골드회원 (GOLD) + 일반여행상담 (GENERAL)
- Contains static sales scripts and AI patterns
- No SMS/Email sequence management
- No PASONA-based message automation
- No lens-specific variations

### Target State
- Add "Day 0-3 시퀀스" tab with complete message lifecycle management
- Manage 4 days of automated outreach (Day 0, 1, 2, 3)
- 5 message variants per day (for 5 psychology lenses)
- Real-time preview + A/B test simulation
- Performance tracking by day and lens
- One-click deployment to contacts/segments

---

## 🏗️ Architecture Design

### 1. Database Schema Extensions (Prisma)

Create new model: **SmsSequenceTemplate**

```prisma
model SmsSequenceTemplate {
  id                String                    @id @default(cuid())
  organizationId    String
  name              String                    // "크루즈 골드 Day 0-3"
  description       String?
  productCode       String                    // "CRUISE_GOLD", "RENTAL", etc.
  psychologyLens    String?                   // "L6_TIMING", "L10_CLOSING", etc.
  sequenceType      String                    // "DAY_0_3", "DAY_7_RECOVERY", etc.
  
  // Day-specific templates
  day0TemplateId    String?
  day1TemplateId    String?
  day2TemplateId    String?
  day3TemplateId    String?
  
  // Configuration
  day0Delay         Int       @default(0)    // minutes (0-1440)
  day1Delay         Int       @default(1440) // 1 day
  day2Delay         Int       @default(2880) // 2 days
  day3Delay         Int       @default(4320) // 3 days
  
  // Conditional rules
  conditions        Json?     // { "productCode": ["CRUISE_GOLD"], "lens": ["L6", "L10"], "minValue": 5000000 }
  triggerOn         String    @default("PURCHASE") // "PURCHASE", "OBJECTION", "INQUIRY"
  
  // Performance
  totalSent         Int       @default(0)
  totalOpened       Int       @default(0)
  totalClicked      Int       @default(0)
  totalConverted    Int       @default(0)
  
  // Status
  status            String    @default("DRAFT")   // "DRAFT", "ACTIVE", "ARCHIVED"
  isSystem          Boolean   @default(false)
  createdByUserId   String?
  deployedAt        DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  smsLogs           SmsLog[]
  
  @@index([organizationId, status])
  @@index([productCode])
  @@index([psychologyLens])
  @@map("SmsSequenceTemplate")
}

// Track active sequences per contact
model ContactSequenceInstance {
  id                String                @id @default(cuid())
  organizationId    String
  contactId         String
  sequenceId        String
  
  // Progress tracking
  day0SentAt        DateTime?
  day1SentAt        DateTime?
  day2SentAt        DateTime?
  day3SentAt        DateTime?
  
  day0OpenedAt      DateTime?
  day1OpenedAt      DateTime?
  day2OpenedAt      DateTime?
  day3OpenedAt      DateTime?
  
  // Conversion tracking
  convertedAt       DateTime?
  conversionDay     Int?      // which day user converted (0, 1, 2, 3, or null)
  
  // Status
  status            String    @default("ACTIVE") // "ACTIVE", "PAUSED", "COMPLETED", "FAILED"
  nextSendAt        DateTime?
  failureReason     String?
  pausedAt          DateTime?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@unique([contactId, sequenceId])
  @@index([organizationId, status, nextSendAt])
  @@index([contactId, status])
  @@map("ContactSequenceInstance")
}

// Track A/B test variations of sequences
model SmsSequenceVariant {
  id                String                @id @default(cuid())
  sequenceId        String
  variantCode       String                // "A", "B", "C" (for A/B/C tests)
  day               Int                   // 0, 1, 2, 3
  
  messageContent    String                // Actual SMS text
  psychology        String?               // "LOSS_AVERSION", "SCARCITY", etc.
  lensName          String?               // "L6 타이밍", "L10 클로징"
  
  // Performance metrics
  sentCount         Int       @default(0)
  openCount         Int       @default(0)
  clickCount        Int       @default(0)
  convertCount      Int       @default(0)
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@unique([sequenceId, variantCode, day])
  @@index([sequenceId])
  @@map("SmsSequenceVariant")
}
```

### 2. API Endpoints

#### GET /api/tools/day0-3-sequences
List all Day 0-3 sequence templates for organization

```typescript
GET /api/tools/day0-3-sequences?productCode=CRUISE_GOLD&status=ACTIVE

Response:
{
  ok: true,
  sequences: [
    {
      id: "seq_123",
      name: "크루즈 골드 Day 0-3",
      productCode: "CRUISE_GOLD",
      psychologyLens: "L6_TIMING",
      status: "ACTIVE",
      day0Delay: 0,
      day1Delay: 1440,
      day2Delay: 2880,
      day3Delay: 4320,
      totalSent: 5430,
      totalOpened: 1715,     // 31.6%
      totalClicked: 487,     // 8.97%
      totalConverted: 271,   // 4.99%
      templateIds: {
        day0: "tpl_123",
        day1: "tpl_124",
        day2: "tpl_125",
        day3: "tpl_126"
      },
      createdAt: "2026-05-20T10:00:00Z"
    }
  ]
}
```

#### GET /api/tools/day0-3-sequences/:id
Get single sequence with all day details + variants

```typescript
GET /api/tools/day0-3-sequences/seq_123

Response:
{
  ok: true,
  sequence: {
    id: "seq_123",
    name: "크루즈 골드 Day 0-3",
    days: [
      {
        day: 0,
        delay: 0,
        message: "프리미엄 크루즈 경험이 시작됩니다! 배 내부 투어 영상...",
        tone: "excited",
        psychology: "L6_TIMING",
        lens: "L6 타이밍 (손실회피)",
        framework: "PASONA: P(문제) + A(자극)",
        expectedOpenRate: "28-35%",
        expectedClickRate: "8-12%",
        actualStats: { opened: 1820, clicked: 487, openRate: "31.6%", clickRate: "8.9%" },
        variants: [
          {
            code: "A",
            message: "프리미엄 크루즈 경험이 시작됩니다! 배 내부 투어 영상 확인",
            psychology: "URGENCY",
            stats: { sent: 1815, opened: 573, clicked: 145, converted: 72 }
          },
          // ... B, C, D, E variants
        ]
      },
      // ... Day 1, 2, 3
    ],
    conditions: { productCode: ["CRUISE_GOLD"], lens: ["L6", "L10"] },
    performance: {
      day0: { openRate: "31.6%", clickRate: "8.9%", convertRate: "4.2%" },
      day1: { openRate: "22.5%", clickRate: "6.3%", convertRate: "2.8%" },
      day2: { openRate: "15.2%", clickRate: "3.9%", convertRate: "1.5%" },
      day3: { openRate: "18.7%", clickRate: "5.1%", convertRate: "2.5%" }
    }
  }
}
```

#### POST /api/tools/day0-3-sequences
Create new Day 0-3 sequence template

```typescript
POST /api/tools/day0-3-sequences

Body:
{
  name: "렌탈 Day 0-3",
  productCode: "RENTAL",
  psychologyLens: "L6_TIMING",
  day0Delay: 30,
  day1Delay: 1440,
  day2Delay: 2880,
  day3Delay: 4320,
  days: [
    {
      day: 0,
      message: "픽업 준비 체크리스트 + 24시간 콜센터 번호",
      tone: "helpful",
      psychology: "ACTION_READY",
      variants: [
        { code: "A", message: "...", psychology: "ACTION_READY" },
        { code: "B", message: "...", psychology: "TRUST_BUILDING" }
      ]
    },
    // ... Day 1-3
  ],
  conditions: {
    productCode: ["RENTAL"],
    minValue: 1000000,
    triggerOn: "PURCHASE"
  }
}

Response: { ok: true, id: "seq_456" }
```

#### PUT /api/tools/day0-3-sequences/:id
Update sequence (draft/active/archived status)

```typescript
PUT /api/tools/day0-3-sequences/seq_123

Body:
{
  day0Delay: 60,         // Change delay
  day1Message: "새로운 메시지...",  // Update specific day
  status: "ACTIVE"        // Deploy to production
}

Response: { ok: true, message: "Deployed to 5,430 contacts" }
```

#### POST /api/tools/day0-3-sequences/:id/test
Send test sequence to own phone number

```typescript
POST /api/tools/day0-3-sequences/seq_123/test

Body:
{
  contactPhone: "01012345678",
  startDay: 0,            // Start from Day 0
  delaySeconds: 5         // 5초씩 간격 for quick demo
}

Response: { ok: true, message: "Test SMS queued for 4 messages" }
```

#### POST /api/tools/day0-3-sequences/:id/deploy
Deploy sequence to specific contacts/segments

```typescript
POST /api/tools/day0-3-sequences/seq_123/deploy

Body:
{
  contactIds: ["contact_1", "contact_2"],  // OR
  segmentCode: "L6_TIMING_HIGH_VALUE",     // segment query
  deployMessage: "크루즈 골드 Day 0-3 시퀀스 배포"
}

Response: { 
  ok: true, 
  deployed: 5430,
  message: "5,430명에게 배포 완료. Day 0 SMS 30분 후 발송 시작."
}
```

#### GET /api/tools/day0-3-sequences/:id/analytics
Get performance analytics by day and lens

```typescript
GET /api/tools/day0-3-sequences/seq_123/analytics?period=7d

Response:
{
  ok: true,
  analytics: {
    overallPerformance: {
      totalSent: 5430,
      totalOpened: 1715,
      totalClicked: 487,
      totalConverted: 271,
      cumulativeOpenRate: "31.6%",
      cumulativeClickRate: "8.97%",
      cumulativeConvertRate: "4.99%"
    },
    byDay: [
      {
        day: 0,
        sent: 5430,
        opened: 1715,
        clicked: 487,
        converted: 271,
        openRate: "31.6%",
        clickRate: "8.97%",
        convertRate: "4.99%",
        avgTimeToOpen: "2.3 hours"
      },
      {
        day: 1,
        sent: 5180,   // Some dropped out
        opened: 1166,
        clicked: 327,
        converted: 145,
        openRate: "22.5%",
        clickRate: "6.31%",
        convertRate: "2.80%",
        avgTimeToOpen: "8.5 hours"
      },
      // ... Day 2, 3
    ],
    byLens: [
      {
        lens: "L6_TIMING",
        sent: 3258,
        openRate: "33.2%",
        clickRate: "9.8%",
        convertRate: "5.2%"
      },
      {
        lens: "L10_CLOSING",
        sent: 2172,
        openRate: "29.1%",
        clickRate: "8.1%",
        convertRate: "4.7%"
      }
    ],
    variantPerformance: [
      {
        variant: "A",
        psychology: "LOSS_AVERSION",
        totalSent: 1086,
        openRate: "33.8%",
        clickRate: "10.2%",
        convertRate: "5.5%",
        winner: true
      },
      // ... B, C, D, E variants
    ]
  }
}
```

---

## 💻 Frontend Implementation

### 1. UI Component Structure

```
playbook/
├── page.tsx                        (Main page - add new "Day 0-3 시퀀스" tab)
├── components/
│   ├── Day0_3Tab.tsx              (New tab container)
│   ├── SequenceList.tsx           (All sequences list view)
│   ├── SequenceEditor.tsx         (Edit/create new sequence)
│   ├── DayMessageEditor.tsx       (Edit individual day message)
│   ├── VariantComparison.tsx      (A/B variant selector)
│   ├── SequencePreview.tsx        (Timeline preview + simulation)
│   ├── PerformanceChart.tsx       (Analytics visualization)
│   ├── TestSendDialog.tsx         (Test to own phone)
│   └── DeployModal.tsx            (Deploy confirmation)
```

### 2. Day 0-3 Tab UI Design

#### Tab Header
```
[골드회원] [일반여행상담] [Day 0-3 시퀀스] ← NEW TAB
```

#### Main Views (Tabs within Day 0-3)

**A. Sequence List View** (Initial view)
```
┌─────────────────────────────────────────────────────────┐
│ [+ 새 시퀀스 생성]  [배포 이력]  [A/B 테스트 비교]       │
├─────────────────────────────────────────────────────────┤
│ 시퀀스 이름          | 상품      | 심리학렌즈    | 상태   │
├─────────────────────────────────────────────────────────┤
│ ✓ 크루즈 골드 Day0-3 │ 크루즈골드│ L6 타이밍    │ ACTIVE │
│   📊 발송: 5,430    │           │              │        │
│   📖 오픈: 31.6%    │           │              │        │
│   🔗 클릭: 8.97%    │           │              │        │
│   ✅ 전환: 4.99%    │           │              │        │
│   [수정] [상세분석] [클론] [중단]│           │        │
├─────────────────────────────────────────────────────────┤
│ ⭕ 렌탈 Day 0-3    │ 렌탈      │ L6 타이밍    │ DRAFT  │
│   📊 발송: 0       │           │              │        │
│   [편집] [배포] [테스트]      │           │        │
├─────────────────────────────────────────────────────────┤
│ ⭕ 이의고객 가격    │ ALL       │ L1 가격      │ ACTIVE │
│   📊 발송: 2,180   │           │              │        │
│   [수정] [클론]    │           │              │        │
└─────────────────────────────────────────────────────────┘
```

**B. Sequence Editor View** (When editing/creating)
```
┌──────────────────────────────────────────────────────────┐
│ [← 목록으로]  새 시퀀스 생성                              │
├──────────────────────────────────────────────────────────┤
│ 기본정보                                                 │
│ ┌────────────────────────────────────────────────────┐  │
│ │ 시퀀스 이름: [크루즈 골드 Day 0-3]                 │  │
│ │ 상품 코드: [크루즈 골드] (드롭다운)                │  │
│ │ 심리학 렌즈: [L6 타이밍] (드롭다운)               │  │
│ │ 설명: [선택사항]                                  │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ 조건설정                                                 │
│ ┌────────────────────────────────────────────────────┐  │
│ │ 트리거: [구매 직후] (라디오)                      │  │
│ │ └─ PURCHASE / OBJECTION / INQUIRY                │  │
│ │ 적용 대상:                                        │  │
│ │ ☑ 크루즈 골드 구매자                            │  │
│ │ ☑ L6 렌즈 해당 고객                             │  │
│ │ ☑ 구매금액 5,000,000원 이상                     │  │
│ │ [+ 조건 추가]                                    │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ Day 0-3 메시지 설정                                     │
│ ┌─ Day 0 (즉시) ────────────────────────────────────┐  │
│ │ 발송 지연: [0] 분 후 (0-1440)                    │  │
│ │ 심리학 프레임: PASONA P+A (문제 + 자극)         │  │
│ │ [메시지 편집 →]                                  │  │
│ │ 미리보기: "프리미엄 크루즈 경험이 시작됩니다!...." │  │
│ │ 심리학 렌즈: L6 타이밍 (손실회피)               │  │
│ │ 예상 효과: 오픈율 28-35%, 클릭율 8-12%           │  │
│ │ 현황: 발송 1,815 | 오픈 573 | 클릭 145          │  │
│ │ [✓ A] [B] [C] [D] [E] (5가지 변형)              │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─ Day 1 (24시간 후) ────────────────────────────────┐  │
│ │ 발송 지연: [1440] 분 후                          │  │
│ │ 심리학 프레임: PASONA S (솔루션)               │  │
│ │ [메시지 편집 →]                                  │  │
│ │ 미리보기: "골드멤버 100명 특제 가이드북...."      │  │
│ │ [✓ A] [B] [C] [D] [E]                           │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─ Day 2 (48시간 후) ────────────────────────────────┐  │
│ │ ...                                                │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─ Day 3 (72시간 후) ────────────────────────────────┐  │
│ │ ...                                                │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ [테스트 발송]  [草案 저장]  [배포] (배포 시 즉시 활성) │
└──────────────────────────────────────────────────────────┘
```

**C. Message Editor Dialog** (When editing individual day)
```
┌──────────────────────────────────────────────────────┐
│ Day 0 메시지 편집                          [×]        │
├──────────────────────────────────────────────────────┤
│ 메시지 내용:                                         │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 프리미엄 크루즈 경험이 시작됩니다! 배 내부 투어    │ │
│ │ 영상 확인 → [링크]                               │ │
│ │                                                   │ │
│ │ (155/160 글자)                                    │ │
│ └──────────────────────────────────────────────────┘ │
│                                                       │
│ 심리학 분석:                                         │
│ - 렌즈: L6 타이밍 (손실회피)                        │
│ - 기법: PASONA Problem + Agitate 단계             │
│ - 톤: 설렘, 기대감, 긴박감                          │
│                                                       │
│ 기대 효과:                                          │
│ - 오픈율: 28-35% (산업 평균 15%)                   │
│ - 클릭율: 8-12% (산업 평균 3%)                    │
│ - 전환율: 3-5% (구매/재확인)                       │
│                                                       │
│ 5가지 변형 (A/B/C/D/E):                           │
│ [✓ A - 기본]                                        │
│ "프리미엄 크루즈 경험이 시작됩니다!..."              │
│                                                       │
│ [B - 긴박감]                                        │
│ "크루즈 내부 투어 영상, 지금 바로 확인!..."         │
│                                                       │
│ [C - 신뢰감]                                        │
│ "600명 골드멤버가 선택한 프리미엄 크루즈...."       │
│                                                       │
│ [D - 손실회피]                                      │
│ "놓치면 안 되는 프리미엄 경험 준비됨...."           │
│                                                       │
│ [E - 사회증명]                                      │
│ "지난 달 5,430명 고객 만족도 98% 달성...."         │
│                                                       │
│ [저장]  [취소]                                      │
└──────────────────────────────────────────────────────┘
```

**D. Sequence Preview View** (Timeline visualization)
```
┌──────────────────────────────────────────────────────────┐
│ Day 0-3 시퀀스 미리보기                                 │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [구매]                                                 │
│    │                                                    │
│    ├─ 0분 ─→ [Day 0 SMS 발송]  📊 1,715명 오픈(31.6%)│
│    │           "프리미엘 크루즈..."                     │
│    │           📖 487명 클릭(8.97%)                    │
│    │           ✅ 271명 전환(4.99%)                    │
│    │                                                    │
│    ├─ +24시간 → [Day 1 SMS 발송]  📊 1,166명 오픈     │
│    │           "골드멤버 가이드북..."                   │
│    │           📖 327명 클릭                           │
│    │           ✅ 145명 전환                          │
│    │                                                    │
│    ├─ +48시간 → [Day 2 SMS 발송]  📊 892명 오픈      │
│    │           "FAQ + 의료정보..."                     │
│    │           📖 219명 클릭                           │
│    │           ✅ 83명 전환                           │
│    │                                                    │
│    └─ +72시간 → [Day 3 SMS 발송]  📊 1,057명 오픈    │
│                "마지막 제안: 이번주 결정..."           │
│                📖 277명 클릭                           │
│                ✅ 136명 전환                          │
│                                                          │
│ 누적 성과:                                             │
│ ├─ 총 발송: 5,430명                                   │
│ ├─ 누적 오픈: 1,715명 (31.6% ↑)                      │
│ ├─ 누적 클릭: 487명 (8.97% ↑)                        │
│ ├─ 누적 전환: 271명 (4.99% ↑)                        │
│ ├─ 예상 수익: 1,355,000,000원 (평균 단가 5M)         │
│ └─ ROI: 2,200% (SMS 비용 대비)                       │
│                                                          │
│ [시뮬레이션 시작 (5초 간격)]  [실제 데이터로 보기]    │
└──────────────────────────────────────────────────────────┘
```

**E. Performance Analytics View**
```
┌────────────────────────────────────────────────────────────┐
│ 성과 분석                  [기간: 7일 ▼]  [내보내기]      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ 성과 지표:                                                │
│ ┌──────────────┬──────────────┬──────────────┬──────────┐ │
│ │ 지표         │ 현재         │ 목표         │ 달성도   │ │
│ ├──────────────┼──────────────┼──────────────┼──────────┤ │
│ │ 오픈율       │ 31.6% ↑      │ 25-35%       │ ✓ 달성   │ │
│ │ 클릭율       │ 8.97% ↑      │ 8-15%        │ ✓ 달성   │ │
│ │ 전환율       │ 4.99% ↑      │ 3-5%         │ ✓ 달성   │ │
│ │ CPA          │ 4,200원 ↓    │ <5,000원     │ ✓ 달성   │ │
│ └──────────────┴──────────────┴──────────────┴──────────┘ │
│                                                            │
│ Day별 성과:                                               │
│                                                            │
│ Day 0 (즉시)                                             │
│ ████████████████░░ 31.6% 오픈  (1,715명 / 5,430)        │
│ ████████░░░░░░░░░ 8.97% 클릭  (487명)                   │
│ █████░░░░░░░░░░░░ 4.99% 전환  (271명)                   │
│                                                            │
│ Day 1 (+24h)                                             │
│ ███████████████░░░ 22.5% 오픈  (1,166명 / 5,180)        │
│ ███████░░░░░░░░░░░ 6.31% 클릭  (327명)                  │
│ ████░░░░░░░░░░░░░░ 2.80% 전환  (145명)                  │
│                                                            │
│ Day 2 (+48h)                                             │
│ ██████████░░░░░░░░ 15.2% 오픈  (892명 / 5,872)          │
│ ████░░░░░░░░░░░░░░ 3.91% 클릭  (219명)                  │
│ ██░░░░░░░░░░░░░░░░ 1.49% 전환  (83명)                   │
│                                                            │
│ Day 3 (+72h)                                             │
│ ████████████░░░░░░ 18.7% 오픈  (1,057명 / 5,656)        │
│ █████░░░░░░░░░░░░░ 5.14% 클릭  (277명)                  │
│ ███░░░░░░░░░░░░░░░ 2.41% 전환  (136명)                  │
│                                                            │
│ 심리학 렌즈별 성과:                                       │
│                                                            │
│ L6 타이밍 (손실회피)    - 발송: 3,258 | 오픈: 33.2% ↑    │
│ L10 클로징 (즉시결정)   - 발송: 2,172 | 오픈: 29.1%      │
│                                                            │
│ 변형별 성과 (A/B Test):                                  │
│                                                            │
│ 🏆 [A] 기본 - 33.8% 오픈, 10.2% 클릭, 5.5% 전환 [승리] │
│    "프리미엘 크루즈 경험이 시작됩니다!..."               │
│                                                            │
│    [B] 긴박감 - 31.2% 오픈, 9.1% 클릭, 4.8% 전환       │
│    "크루즈 내부 투어 영상, 지금 바로 확인!..."          │
│                                                            │
│    [C] 신뢰감 - 29.5% 오픈, 8.3% 클릭, 4.2% 전환       │
│                                                            │
│ [CSV 내보내기]  [이메일 리포트]                          │
└────────────────────────────────────────────────────────────┘
```

### 3. Key React Components Code Structure

```typescript
// Day0_3Tab.tsx - Main tab container
export default function Day0_3Tab() {
  const [view, setView] = useState<'LIST' | 'EDIT' | 'ANALYTICS'>('LIST');
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);
  const [sequences, setSequences] = useState<SmsSequenceTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSequences();
  }, []);

  async function loadSequences() {
    try {
      const res = await fetch('/api/tools/day0-3-sequences');
      const data = await res.json();
      if (data.ok) setSequences(data.sequences);
    } catch (err) {
      showError('시퀀스 로드 실패');
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {view === 'LIST' && (
        <SequenceList 
          sequences={sequences}
          onEdit={(id) => { setSelectedSequence(id); setView('EDIT'); }}
          onAnalytics={(id) => { setSelectedSequence(id); setView('ANALYTICS'); }}
          onNew={() => { setSelectedSequence(null); setView('EDIT'); }}
        />
      )}
      {view === 'EDIT' && (
        <SequenceEditor
          id={selectedSequence}
          onSave={() => { loadSequences(); setView('LIST'); }}
          onCancel={() => setView('LIST')}
        />
      )}
      {view === 'ANALYTICS' && (
        <PerformanceAnalytics
          id={selectedSequence!}
          onBack={() => setView('LIST')}
        />
      )}
    </div>
  );
}

// SequenceEditor.tsx - Create/edit sequences
export function SequenceEditor({ id, onSave, onCancel }: Props) {
  const [sequence, setSequence] = useState<SmsSequenceTemplate | null>(null);
  const [days, setDays] = useState<DayConfig[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [editingMessage, setEditingMessage] = useState<string>('');

  // Handle day delay change
  function handleDayDelayChange(day: number, minutes: number) {
    setDays(prev => prev.map((d, i) => 
      i === day ? { ...d, delay: minutes } : d
    ));
  }

  // Handle message edit
  function handleMessageEdit(day: number) {
    setSelectedDay(day);
    setEditingMessage(days[day].message);
  }

  // Preview with simulation timeline
  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="border rounded-lg p-4 space-y-3">
        <input 
          placeholder="시퀀스 이름"
          value={sequence?.name}
          onChange={(e) => setSequence({...sequence, name: e.target.value})}
          className="w-full px-3 py-2 border rounded"
        />
        {/* More fields */}
      </div>

      {/* Day 0-3 Message Editors */}
      <div className="space-y-4">
        {[0, 1, 2, 3].map(day => (
          <DayMessageCard
            key={day}
            day={day}
            delay={days[day].delay}
            message={days[day].message}
            onDelayChange={(mins) => handleDayDelayChange(day, mins)}
            onEdit={() => handleMessageEdit(day)}
            variants={days[day].variants}
          />
        ))}
      </div>

      {/* Message Edit Dialog */}
      <MessageEditDialog
        open={editingMessage !== null}
        day={selectedDay}
        message={editingMessage}
        onChange={(m) => {
          setDays(prev => prev.map((d, i) =>
            i === selectedDay ? { ...d, message: m } : d
          ));
          setEditingMessage('');
        }}
        onCancel={() => setEditingMessage('')}
      />

      {/* Preview Timeline */}
      <SequencePreview days={days} />

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 border rounded">
          취소
        </button>
        <button 
          onClick={() => onSave(sequence, days)}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          {id ? '업데이트' : '생성'}
        </button>
      </div>
    </div>
  );
}

// DayMessageCard.tsx - Individual day configuration
export function DayMessageCard({
  day,
  delay,
  message,
  variants,
  onDelayChange,
  onEdit
}: Props) {
  const dayLabels = ['Day 0 (즉시)', 'Day 1 (24시간)', 'Day 2 (48시간)', 'Day 3 (72시간)'];
  const frameworks = [
    'PASONA P+A (문제 + 자극)',
    'PASONA S (솔루션)',
    'PASONA O (오퍼)',
    'PASONA A+N (액션 + 좁혀진범위)'
  ];

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{dayLabels[day]}</h3>
        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
          {frameworks[day]}
        </span>
      </div>

      {/* Delay Slider */}
      <div>
        <label className="text-sm font-medium">
          발송 지연: {delay}분 (0-4320)
        </label>
        <input
          type="range"
          min="0"
          max="4320"
          value={delay}
          onChange={(e) => onDelayChange(parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Message Preview */}
      <div className="bg-gray-50 p-3 rounded">
        <p className="text-sm text-gray-600 truncate">{message}</p>
        <button
          onClick={onEdit}
          className="mt-2 text-xs text-blue-600 hover:underline"
        >
          메시지 편집
        </button>
      </div>

      {/* Variants */}
      <div className="flex gap-1">
        {variants.map((v, i) => (
          <button
            key={i}
            className={`px-2 py-1 text-xs rounded border ${
              v.isSelected ? 'bg-blue-100 border-blue-400' : 'border-gray-200'
            }`}
          >
            {v.code}
          </button>
        ))}
      </div>

      {/* Expected Performance */}
      <div className="grid grid-cols-3 gap-2 text-xs bg-blue-50 p-2 rounded">
        <div>📖 오픈: 28-35%</div>
        <div>🔗 클릭: 8-12%</div>
        <div>✅ 전환: 3-5%</div>
      </div>
    </div>
  );
}

// VariantSelector.tsx - A/B variant management
export function VariantSelector({ day, variants, selected, onChange }: Props) {
  return (
    <div className="space-y-2">
      {variants.map((variant) => (
        <label key={variant.code} className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={selected === variant.code}
            onChange={() => onChange(variant.code)}
          />
          <span className="text-sm">
            [{variant.code}] {variant.psychology} - {variant.message.substring(0, 40)}...
          </span>
        </label>
      ))}
    </div>
  );
}

// SequencePreview.tsx - Timeline visualization
export function SequencePreview({ days }: Props) {
  // Render Day 0-3 timeline with expected performance
  // Use Chart.js or Recharts for visualization
  return (
    <div className="border rounded-lg p-4">
      {/* Timeline rendering */}
    </div>
  );
}

// PerformanceAnalytics.tsx - Dashboard view
export function PerformanceAnalytics({ id }: Props) {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    fetch(`/api/tools/day0-3-sequences/${id}/analytics`)
      .then(r => r.json())
      .then(d => setAnalytics(d.analytics));
  }, [id]);

  if (!analytics) return <div>로딩 중...</div>;

  return (
    <div className="space-y-6">
      {/* Overall KPI cards */}
      {/* Day-by-day breakdown charts */}
      {/* Psychology lens performance */}
      {/* Variant A/B test comparison */}
    </div>
  );
}
```

---

## 🚀 Backend Implementation

### 1. API Routes to Create

```typescript
// src/app/api/tools/day0-3-sequences/route.ts
// GET /api/tools/day0-3-sequences
// POST /api/tools/day0-3-sequences

// src/app/api/tools/day0-3-sequences/[id]/route.ts
// GET /api/tools/day0-3-sequences/[id]
// PUT /api/tools/day0-3-sequences/[id]
// DELETE /api/tools/day0-3-sequences/[id]

// src/app/api/tools/day0-3-sequences/[id]/test/route.ts
// POST /api/tools/day0-3-sequences/[id]/test

// src/app/api/tools/day0-3-sequences/[id]/deploy/route.ts
// POST /api/tools/day0-3-sequences/[id]/deploy

// src/app/api/tools/day0-3-sequences/[id]/analytics/route.ts
// GET /api/tools/day0-3-sequences/[id]/analytics
```

### 2. Cron Jobs to Create/Update

```typescript
// src/app/api/cron/sms-day0-3-dispatch.ts
// Runs every hour to dispatch scheduled SMS messages
// Filters by:
// - SequenceId + status = ACTIVE
// - ContactSequenceInstance.nextSendAt <= now()
// - Day (0, 1, 2, or 3)

// src/app/api/cron/sms-day0-3-analytics.ts
// Runs daily (11:55 PM) to aggregate analytics
// Calculates open/click/convert rates by day and lens
// Updates SmsSequenceTemplate.totalSent/Opened/Clicked/Converted

// src/app/api/cron/sms-day0-3-cleanup.ts
// Runs weekly to archive old sequences and clear stale data
```

### 3. Key Business Logic

**Trigger Detection**:
```typescript
// When contact is created/purchased, detect if matches sequence conditions
// If matches:
//   1. Create ContactSequenceInstance
//   2. Schedule Day 0 SMS for nextSendAt = now() + day0Delay
//   3. Pre-schedule Days 1-3

async function triggerSequenceStart(contact: Contact) {
  const sequences = await prisma.smsSequenceTemplate.findMany({
    where: {
      organizationId: contact.organizationId,
      status: 'ACTIVE',
      // Match conditions JSON
    }
  });

  for (const seq of sequences) {
    if (matchesConditions(contact, seq.conditions)) {
      // Create instance
      const instance = await prisma.contactSequenceInstance.create({
        data: {
          organizationId: contact.organizationId,
          contactId: contact.id,
          sequenceId: seq.id,
          nextSendAt: new Date(Date.now() + seq.day0Delay * 60000),
          status: 'ACTIVE'
        }
      });

      // Schedule Days 0-3
      await scheduleSequenceDays(instance, seq);
    }
  }
}
```

---

## 📊 PASONA Framework Mapping

### Day 0 (구매 직후)
**PASONA Stage**: Problem + Agitate  
**Goal**: 확인 + 긴박감 유발  
**Psychology Lenses**: L6 (타이밍/손실회피), L10 (즉시 결정)

**Message Examples**:
- **L6 Loss Aversion**: "크루즈 끝나고도 피로가 남아 있나요? 다음 여행은 이미 정해져 있나요?"
- **L10 Closing**: "프리미엘 크루즈 경험 준비 완료! 배 내부 투어 영상 지금 확인 → [링크]"

---

### Day 1 (24시간 후)
**PASONA Stage**: Solution  
**Goal**: 신뢰도 + 사회증명 강조  
**Psychology Lenses**: L8 (재구매/습관화), L9 (의료/신뢰)

**Message Examples**:
- **L8 Repurchase**: "골드멤버 100명 특제 가이드북 + 마음에 들지 않으면 환불해드립니다"
- **L9 Trust**: "의료진 승인 스트레스 해소 프로그램 + 보험 완벽 보장"

---

### Day 2 (48시간 후)
**PASONA Stage**: Offer (오퍼)  
**Goal**: 가치 강조 + 이의 사전 대응  
**Psychology Lenses**: L1 (가격), L2 (준비)

**Message Examples**:
- **L1 Price**: "가격 우려? 3가지 옵션: 분할결제 / 할인쿠폰 / 번들 패키지"
- **L2 Preparation**: "복잡한 준비는 끝! 5단계 체크리스트 + 24시간 콜센터"

---

### Day 3 (72시간 후)
**PASONA Stage**: Action + Narrow  
**Goal**: 최종 결정 촉구 + 긴박성 강조  
**Psychology Lenses**: L3 (차별성), L4-L7

**Message Examples**:
- **L3 Differentiation**: "경쟁사는 없는 프리미엘 서비스! 이번주 결정 시 추가 혜택"
- **L4-L7 Urgency**: "5월 말까지만 50% 할인권 유효. 놓치면 정가 구매됩니다"

---

## 🧪 PASONA + 렌즈별 매핑 Table

| 심리학 렌즈 | Day 0 | Day 1 | Day 2 | Day 3 |
|-----------|-------|-------|-------|-------|
| **L0 부재중** | 감정적 재연결 | 가치 제시 | FAQ | 최종 제안 |
| **L1 가격** | 옵션 제시 | 분할/할인 | 가격 정당화 | 마지막 할인 |
| **L2 준비** | 체크리스트 | 가이드북 | 불안감 해소 | 준비 완료 확인 |
| **L3 차별성** | 경쟁사 비교 | 유니크 가치 | 차별 강조 | 마지막 경고 |
| **L4-L5** | 스토리 | 맥락 추가 | 적합성 강조 | 신뢰도 |
| **L6 타이밍** | 긴박감 | 시간 제한 | 마감일 | 마지막 기회 |
| **L7 동반자** | 함께 결정 | 가족 고객사례 | 배우자 설득 | 함께 누리기 |
| **L8 재구매** | 반복 강조 | 습관화 이야기 | 충성도 보상 | 구독 제안 |
| **L9 의료/신뢰** | 의료진 | 안전성 | 보험 보장 | 신뢰도 최고 |
| **L10 클로징** | 즉시 결정 | 이미 결정 | 변경 어려움 | 지금이 아니면 안됨 |

---

## 📈 Expected Business Impact

### Current State (Before)
- Manual SMS sending: 20 hours/week per person
- Ad-hoc sequences: 0% automation
- SMS open rate: 10-15% (industry average)
- Conversion rate: 0.5-1%

### Target State (After)
- Automated sequences: 100% (cron jobs)
- Manual intervention: 2-3 hours/week (deploy + monitoring)
- SMS open rate: 25-35% (PASONA + lens targeting)
- SMS click rate: 8-15% (psychology triggers)
- Conversion rate: 3-5% (lens-specific messaging)
- 자동화율: 20% → 80% (60% 수동작업 단축)
- **예상 추가 수익: $152K/월 (한화 2억 원/월)**

### ROI Calculation
```
현재 연간 매출: 1,800,000,000원
심리학 적용 후: +18억 원 (+100%)

자동화 효과:
- 인건비 절감: 월 500만원 (주 20시간 × 인건비)
- 전환율 향상: 월 1억 5,200만원 (4.99% × 평균단가)
- 리텐션 증가: 월 2,000만원 (재구매 3회/년)

연간 기대효과: 1,819,200,000원 증가
```

---

## ✅ Implementation Checklist

### Phase 1: Database & API (Days 1-2)
- [ ] Add SmsSequenceTemplate, ContactSequenceInstance, SmsSequenceVariant models to Prisma schema
- [ ] Run `npx prisma migrate dev` to create tables
- [ ] Create `/api/tools/day0-3-sequences` route (GET, POST)
- [ ] Create `/api/tools/day0-3-sequences/[id]` route (GET, PUT, DELETE)
- [ ] Create `/api/tools/day0-3-sequences/[id]/test` route (POST)
- [ ] Create `/api/tools/day0-3-sequences/[id]/deploy` route (POST)
- [ ] Create `/api/tools/day0-3-sequences/[id]/analytics` route (GET)

### Phase 2: Frontend Components (Days 3-5)
- [ ] Create Day0_3Tab.tsx component
- [ ] Create SequenceList.tsx component
- [ ] Create SequenceEditor.tsx component
- [ ] Create DayMessageCard.tsx component
- [ ] Create MessageEditDialog.tsx component
- [ ] Create VariantSelector.tsx component
- [ ] Create SequencePreview.tsx (timeline visualization)
- [ ] Create PerformanceAnalytics.tsx (dashboard)
- [ ] Add "Day 0-3 시퀀스" tab to main playbook/page.tsx
- [ ] Integrate with existing Toast/Error handling

### Phase 3: Cron Jobs (Days 6-7)
- [ ] Create `/api/cron/sms-day0-3-dispatch` route
- [ ] Implement sequence trigger detection (on contact create/purchase)
- [ ] Create `/api/cron/sms-day0-3-analytics` route
- [ ] Create `/api/cron/sms-day0-3-cleanup` route

### Phase 4: Testing & Deployment (Days 8-10)
- [ ] Unit tests for API endpoints
- [ ] Integration tests for sequence dispatch
- [ ] E2E tests for UI flows
- [ ] Load testing for cron jobs
- [ ] Seed test data (5 sample sequences)
- [ ] Deploy to staging environment
- [ ] Smoke tests in staging
- [ ] Deploy to production
- [ ] Monitor initial deployments
- [ ] Collect feedback and iterate

---

## 🎯 Success Metrics

| Metric | Baseline | Target | Success Criteria |
|--------|----------|--------|------------------|
| **Automation Rate** | 20% | 80% | 60% 이상 증가 |
| **Manual Work Hours** | 20h/week | 8h/week | 40% 이상 단축 |
| **SMS Open Rate** | 10-15% | 25-35% | +100% 이상 |
| **SMS Click Rate** | 2-5% | 8-15% | +200% 이상 |
| **Conversion Rate** | 0.5-1% | 3-5% | +300% 이상 |
| **Monthly Revenue** | 1.8B | 1.95B+ | +150M+ 추가 |
| **CPA** | 10-15K | 4-6K | 50% 이상 감소 |
| **LTV** | 600K | 950K | 50% 이상 증가 |
| **User Satisfaction** | - | 8/10 | Scale 1-10 |

---

## 📚 Reference Memory Files

- [[CLAUDE_AGENT_PROMPTS.md - Template 4]]: SMS 자동화 설계
- [[CLAUDE_AGENT_PROMPTS.md - Template 5]]: CRM 규칙 + 자동화
- [[rental_sms_3day_sequence]]: Day 0-3 기본 프레임워크
- [[pasona_framework_complete]]: PASONA 6단계 완전 가이드
- [[grant_cardone_closing]]: 클로징 심리학
- [[l6_timing_loss_aversion]]: L6 렌즈 (타이밍/손실회피)
- [[l10_immediate_purchase_closing]]: L10 렌즈 (즉시 구매)

---

**Next Step**: Start with Phase 1 (Database & API) on Day 1
