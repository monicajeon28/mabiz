# Day 0-3 Sequence Architecture & Data Flow

---

## 📊 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PLAYBOOK PAGE                                  │
│  ┌──────────────┬────────────────┬──────────────────────────────────┐   │
│  │ 골드회원     │ 일반여행상담   │ Day 0-3 시퀀스 (NEW TAB)          │   │
│  │ (existing)   │ (existing)     │ ├─ Sequence List                │   │
│  │              │                │ ├─ Sequence Editor             │   │
│  │              │                │ ├─ Performance Analytics        │   │
│  │              │                │ └─ Deploy/Test Controls         │   │
│  └──────────────┴────────────────┴──────────────────────────────────┘   │
│                                 │                                        │
│  7 API Endpoints                │                                        │
│  ├─ GET /day0-3-sequences       │ ◄─────────────────────────────────┘  │
│  ├─ POST /day0-3-sequences                                             │
│  ├─ GET /day0-3-sequences/:id                                          │
│  ├─ PUT /day0-3-sequences/:id                                          │
│  ├─ POST /day0-3-sequences/:id/test                                    │
│  ├─ POST /day0-3-sequences/:id/deploy                                  │
│  └─ GET /day0-3-sequences/:id/analytics                                │
│                                 │                                        │
├─────────────────────────────────┼────────────────────────────────────────┤
│                                 ▼                                        │
│           PostgreSQL DATABASE                                           │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ SmsSequenceTemplate (Sequence Config)                          │   │
│  │ ├─ id, name, productCode, psychologyLens                      │   │
│  │ ├─ day0/1/2/3TemplateId, day0/1/2/3Delay                    │   │
│  │ ├─ conditions (JSON), status, totalSent/Opened/Clicked/...  │   │
│  │ └─ createdAt, updatedAt, deployedAt                          │   │
│  │                                                                │   │
│  │ ContactSequenceInstance (Active Sequences)                    │   │
│  │ ├─ id, contactId, sequenceId                                 │   │
│  │ ├─ day0/1/2/3SentAt, day0/1/2/3OpenedAt                     │   │
│  │ ├─ convertedAt, conversionDay, status, nextSendAt           │   │
│  │ └─ createdAt, updatedAt                                      │   │
│  │                                                                │   │
│  │ SmsSequenceVariant (A/B Test Variants)                       │   │
│  │ ├─ id, sequenceId, variantCode (A-E), day                   │   │
│  │ ├─ messageContent, psychology, lensName                      │   │
│  │ ├─ sentCount, openCount, clickCount, convertCount           │   │
│  │ └─ createdAt, updatedAt                                      │   │
│  │                                                                │   │
│  │ [Existing Tables]                                            │   │
│  │ ├─ SmsTemplate (message templates)                           │   │
│  │ ├─ SmsLog (SMS delivery logs)                                │   │
│  │ ├─ Contact (customer data)                                   │   │
│  │ ├─ Organization (company)                                    │   │
│  │ └─ SmsABTest (A/B test configs)                             │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                 │                                        │
├─────────────────────────────────┼────────────────────────────────────────┤
│                                 ▼                                        │
│           CRON JOBS (Background Processing)                            │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ [Hourly] sms-day0-3-dispatch                                   │   │
│  │ ├─ Find ContactSequenceInstance where nextSendAt <= now()    │   │
│  │ ├─ Determine message (based on day & variant winner)         │   │
│  │ ├─ Send via Aligo SMS API                                    │   │
│  │ ├─ Log to SmsLog table                                       │   │
│  │ ├─ Update ContactSequenceInstance (nextSendAt)               │   │
│  │ └─ Return { sent: 543, failed: 2, scheduled: 1000 }         │   │
│  │                                                                │   │
│  │ [Daily, 11:55 PM] sms-day0-3-analytics                       │   │
│  │ ├─ Query SmsLog where sequenceId is not null                 │   │
│  │ ├─ Aggregate by day (0-3), by lens, by variant               │   │
│  │ ├─ Calculate open/click/convert rates                        │   │
│  │ ├─ Update SmsSequenceTemplate metrics                        │   │
│  │ ├─ Identify variant winner (A/B test)                        │   │
│  │ └─ Send admin notification if conversion < target            │   │
│  │                                                                │   │
│  │ [Weekly] sms-day0-3-cleanup                                   │   │
│  │ ├─ Archive sequences > 90 days old (status = ARCHIVED)      │   │
│  │ ├─ Delete ContactSequenceInstance for archived sequences     │   │
│  │ └─ Vacuum analyze for performance                            │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                 │                                        │
├─────────────────────────────────┼────────────────────────────────────────┤
│                                 ▼                                        │
│           EXTERNAL SERVICES                                            │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ Aligo SMS Gateway                                              │   │
│  │ ├─ /send/ endpoint                                            │   │
│  │ ├─ Input: phone, message, sender                              │   │
│  │ └─ Output: msgId, resultCode                                  │   │
│  │                                                                │   │
│  │ Analytics (Google Analytics 4)                                │   │
│  │ ├─ Event: sms_opened (via link tracking)                     │   │
│  │ ├─ Event: sms_clicked                                         │   │
│  │ └─ Event: sms_converted (purchase)                            │   │
│  └────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagram: Contact Lifecycle

```
                        PURCHASE EVENT
                             │
                             ▼
                    ┌─────────────────┐
                    │ Contact Created │
                    │ (productCode,   │
                    │  value, lens)   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Trigger Check:  │
                    │ Match sequence  │
                    │ conditions?     │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │ No Match          │ Match             │ Multiple Match
         │                   ▼                   ▼
         │          ┌──────────────────┐  Create Instance
         │          │ Create Contact   │  for each matching
         │          │ Sequence         │  sequence
         │          │ Instance         │
         │          └─────┬────────────┘
         │                │
         │                ▼
         │       ┌──────────────────────┐
         │       │ Schedule 4 SMS:      │
         │       │ ├─ Day 0: +0min      │
         │       │ ├─ Day 1: +1440min   │
         │       │ ├─ Day 2: +2880min   │
         │       │ └─ Day 3: +4320min   │
         │       └─────┬────────────────┘
         │             │
         │             ▼
         │    [HOURLY DISPATCH JOB]
         │             │
         │    ┌────────┴────────┐
         │    ▼                 ▼
         │  Day 0           Day 1-3
         │  (Immediate)      (Queued)
         │    │                │
         │    ▼                │
         │  Send via Aligo     │
         │    │                │
         │    ▼                ▼
         │  Log to SmsLog ◄─ Await nextSendAt
         │    │
         │    ▼
         │  Update ContactSequenceInstance:
         │  ├─ day0SentAt = now()
         │  ├─ nextSendAt = now() + 1440min (for Day 1)
         │  └─ status = ACTIVE
         │
         └─► [Continue until Day 3 or Conversion]
             
             
             CONVERSION PATH:
             └─► ContactSequenceInstance.status = COMPLETED
                 ├─ convertedAt = now()
                 ├─ conversionDay = which day (0, 1, 2, 3)
                 └─ Update SmsSequenceTemplate.totalConverted++
```

---

## 📱 Frontend Component Tree

```
PlaybookPage
│
└─ [Sticky Header]
   ├─ [Tab Button] 골드회원
   ├─ [Tab Button] 일반여행상담
   └─ [Tab Button] Day 0-3 시퀀스 ◄─── NEW
       │
       └─ Day0_3Tab (Main Container)
          │
          ├─ SequenceList View (Initial)
          │  ├─ [+ 새 시퀀스 생성] button
          │  ├─ [배포 이력] button
          │  ├─ [A/B 테스트 비교] button
          │  │
          │  └─ For each sequence:
          │     ├─ Sequence Card
          │     │  ├─ Name, ProductCode, Lens
          │     │  ├─ KPI Display
          │     │  │  ├─ 📊 발송: 5,430
          │     │  │  ├─ 📖 오픈: 31.6%
          │     │  │  ├─ 🔗 클릭: 8.97%
          │     │  │  └─ ✅ 전환: 4.99%
          │     │  └─ [수정] [분석] [배포] [클론]
          │     │
          │     └─ On Click "수정":
          │        │
          │        └─ SequenceEditor View
          │           │
          │           ├─ Basic Info Section
          │           │  ├─ Name Input
          │           │  ├─ ProductCode Dropdown
          │           │  ├─ Lens Dropdown
          │           │  └─ Description Textarea
          │           │
          │           ├─ Conditions Section
          │           │  ├─ Trigger Radio (PURCHASE|OBJECTION|INQUIRY)
          │           │  ├─ Target Checkboxes
          │           │  └─ [+ Condition]
          │           │
          │           ├─ Day Configs (x4)
          │           │  │
          │           │  ├─ DayMessageCard (Day 0)
          │           │  │  ├─ Label: "Day 0 (즉시)"
          │           │  │  ├─ Framework Badge: "PASONA P+A"
          │           │  │  ├─ Delay Slider: 0-1440 min
          │           │  │  ├─ Message Preview
          │           │  │  ├─ [메시지 편집] button
          │           │  │  │  │
          │           │  │  │  └─ MessageEditDialog Modal
          │           │  │  │     ├─ Message Textarea
          │           │  │  │     ├─ Psychology Badges
          │           │  │  │     ├─ Expected Performance
          │           │  │  │     ├─ VariantSelector
          │           │  │  │     │  ├─ [✓ A] 기본
          │           │  │  │     │  ├─ [B] 긴박감
          │           │  │  │     │  ├─ [C] 신뢰감
          │           │  │  │     │  ├─ [D] 손실회피
          │           │  │  │     │  └─ [E] 사회증명
          │           │  │  │     └─ [저장] [취소]
          │           │  │  │
          │           │  │  ├─ Variant Buttons [A] [B] [C] [D] [E]
          │           │  │  └─ Stats: sent, open, click, convert
          │           │  │
          │           │  ├─ DayMessageCard (Day 1)
          │           │  │  ├─ Label: "Day 1 (24시간 후)"
          │           │  │  ├─ Framework: "PASONA S"
          │           │  │  └─ ... (similar to Day 0)
          │           │  │
          │           │  ├─ DayMessageCard (Day 2)
          │           │  │  ├─ Label: "Day 2 (48시간 후)"
          │           │  │  ├─ Framework: "PASONA O"
          │           │  │  └─ ... (similar)
          │           │  │
          │           │  └─ DayMessageCard (Day 3)
          │           │     ├─ Label: "Day 3 (72시간 후)"
          │           │     ├─ Framework: "PASONA A+N"
          │           │     └─ ... (similar)
          │           │
          │           ├─ SequencePreview
          │           │  └─ Timeline Visualization
          │           │     ├─ Day 0 node with stats
          │           │     ├─ Day 1 node with stats
          │           │     ├─ Day 2 node with stats
          │           │     ├─ Day 3 node with stats
          │           │     └─ Cumulative metrics
          │           │
          │           └─ Action Buttons
          │              ├─ [테스트 발송]
          │              │  │
          │              │  └─ TestSendDialog
          │              │     ├─ Phone Input
          │              │     ├─ Start Day Radio
          │              │     ├─ Delay Between Messages
          │              │     └─ [테스트 시작] [취소]
          │              │
          │              ├─ [초안 저장]
          │              └─ [배포]
          │                 │
          │                 └─ DeployModal
          │                    ├─ Contact/Segment Selector
          │                    ├─ Deploy Message
          │                    ├─ Confirmation
          │                    └─ [확인] [취소]
          │
          └─ On Click "분석":
             │
             └─ PerformanceAnalytics View
                │
                ├─ Period Filter: [7일 ▼] [내보내기]
                │
                ├─ KPI Cards
                │  ├─ Open Rate: 31.6% ↑
                │  ├─ Click Rate: 8.97% ↑
                │  ├─ Conversion: 4.99% ↑
                │  └─ CPA: 4,200원 ↓
                │
                ├─ Day-by-Day Breakdown
                │  ├─ Day 0 progress bars
                │  ├─ Day 1 progress bars
                │  ├─ Day 2 progress bars
                │  └─ Day 3 progress bars
                │
                ├─ Psychology Lens Performance
                │  ├─ L6 타이밍: 33.2% open
                │  └─ L10 클로징: 29.1% open
                │
                ├─ Variant A/B Test Results
                │  ├─ [🏆 A] 33.8% open (Winner)
                │  ├─ [B] 31.2% open
                │  ├─ [C] 29.5% open
                │  ├─ [D] 28.7% open
                │  └─ [E] 27.3% open
                │
                └─ Export Options
                   ├─ [CSV 내보내기]
                   └─ [이메일 리포트]
```

---

## 🔗 API Request/Response Flow

### 1. List Sequences
```
GET /api/tools/day0-3-sequences?productCode=CRUISE_GOLD&status=ACTIVE

Response:
{
  ok: true,
  sequences: [
    {
      id: "seq_123",
      name: "크루즈 골드 Day 0-3",
      productCode: "CRUISE_GOLD",
      status: "ACTIVE",
      totalSent: 5430,
      totalOpened: 1715,
      totalClicked: 487,
      totalConverted: 271
    }
  ]
}
```

### 2. Get Sequence Details
```
GET /api/tools/day0-3-sequences/seq_123

Response:
{
  ok: true,
  sequence: {
    id: "seq_123",
    days: [
      {
        day: 0,
        delay: 0,
        message: "프리미엘 크루즈...",
        variants: [
          { code: "A", message: "...", stats: { sent: 1815, opened: 573 } },
          { code: "B", message: "...", stats: { sent: 1808, opened: 567 } }
        ]
      },
      // Days 1-3...
    ],
    performance: {
      day0: { openRate: "31.6%", clickRate: "8.9%" },
      day1: { openRate: "22.5%", clickRate: "6.3%" }
      // Days 2-3...
    }
  }
}
```

### 3. Deploy Sequence
```
POST /api/tools/day0-3-sequences/seq_123/deploy

Body:
{
  contactIds: ["contact_1", "contact_2"],
  deployMessage: "배포 사유"
}

Response:
{
  ok: true,
  deployed: 5430,
  message: "5,430명에게 배포. Day 0 SMS 30분 후 발송 시작."
}

Side Effects:
├─ Create 5,430 ContactSequenceInstance rows
├─ Set nextSendAt = now() + day0Delay for each
└─ [Hourly Job] → Dispatch SMS when nextSendAt <= now()
```

### 4. Test SMS
```
POST /api/tools/day0-3-sequences/seq_123/test

Body:
{
  contactPhone: "01012345678",
  startDay: 0,
  delaySeconds: 5
}

Response:
{
  ok: true,
  message: "Test SMS queued for 4 messages",
  schedule: [
    { day: 0, sendAt: "2026-05-27 10:00:00" },
    { day: 1, sendAt: "2026-05-27 10:00:05" },
    { day: 2, sendAt: "2026-05-27 10:00:10" },
    { day: 3, sendAt: "2026-05-27 10:00:15" }
  ]
}

Side Effects:
├─ Create 4 ScheduledSms entries (with delaySeconds intervals)
└─ [Cron Job] → Send test SMS at scheduled times
```

### 5. Get Analytics
```
GET /api/tools/day0-3-sequences/seq_123/analytics?period=7d

Response:
{
  ok: true,
  analytics: {
    overallPerformance: {
      totalSent: 5430,
      totalOpened: 1715,
      openRate: "31.6%",
      cumulativeConvertRate: "4.99%"
    },
    byDay: [
      {
        day: 0,
        sent: 5430,
        opened: 1715,
        openRate: "31.6%",
        clickRate: "8.97%",
        convertRate: "4.99%"
      },
      // Days 1-3...
    ],
    variantPerformance: [
      {
        variant: "A",
        totalSent: 1086,
        openRate: "33.8%",
        winner: true
      },
      // Variants B-E...
    ]
  }
}
```

---

## 📊 Database Entity Relationship Diagram

```
Organization (1)
    │
    ├─────────────────────────┬────────────────────────┐
    ▼                         ▼                        ▼
SmsSequenceTemplate     ContactSequenceInstance    SmsLog
├─ id (PK)              ├─ id (PK)                 ├─ id (PK)
├─ organizationId (FK)  ├─ organizationId (FK)     ├─ organizationId (FK)
├─ name                 ├─ contactId (FK)         ├─ contactId (FK)
├─ productCode          ├─ sequenceId (FK) ──┐    ├─ phone
├─ psychologyLens       ├─ day0/1/2/3SentAt  │    ├─ contentPreview
├─ day0/1/2/3TemplateId├─ convertedAt       │    ├─ status
├─ day0/1/2/3Delay     ├─ status            │    ├─ sequenceId
├─ conditions           ├─ nextSendAt        │    ├─ sequenceDay
├─ status               ├─ createdAt         │    ├─ variantCode
├─ totalSent            └─ updatedAt         │    ├─ abTestGroup
├─ totalOpened              │                │    ├─ openedAt
├─ totalClicked             │                │    ├─ clickedAt
├─ totalConverted           │                │    ├─ convertedAt
└─ createdAt/deployedAt     │                │    └─ sentAt
                            │                │
                            │                ├──► SmsSequenceVariant
                            │                     ├─ id (PK)
                            │                     ├─ sequenceId (FK)
                            │                     ├─ variantCode (A-E)
                            │                     ├─ day (0-3)
                            │                     ├─ messageContent
                            │                     ├─ sentCount
                            │                     ├─ openCount
                            │                     └─ convertCount
                            │
                            └─► SmsTemplate
                                 ├─ id (PK)
                                 ├─ title
                                 ├─ content
                                 └─ psychologyTag
```

---

## 🔄 Variant Selection Logic (A/B Test Winner)

```
[Daily 11:55 PM] Analytics Aggregation Job
│
├─ Query SmsLog where sequenceId = X, day = 0
│
├─ Group by variantCode (A, B, C, D, E)
│
├─ For each variant, calculate:
│  ├─ Total Sent
│  ├─ Open Rate = totalOpened / totalSent * 100
│  ├─ Click Rate = totalClicked / totalSent * 100
│  ├─ Convert Rate = totalConverted / totalSent * 100
│  └─ Score = (OpenRate * 0.3) + (ClickRate * 0.5) + (ConvertRate * 0.2)
│
├─ Identify Variant with Highest Score = WINNER
│
├─ Update SmsSequenceVariant.isWinner = true for winner
│
└─ For Day 1-3 Messages:
   └─ [Hourly Dispatch Job] uses winner variant
      ├─ SELECT * FROM SmsSequenceVariant
      │  WHERE sequenceId = X AND day = N AND isWinner = true
      ├─ Use messageContent from winner
      └─ Log variant code to SmsLog for tracking
```

---

## 📅 Timeline Example: Single Contact Lifecycle

```
2026-05-27 09:30:00 - Contact Purchases Cruise Gold ($5M)
│
├─ Trigger: contactCreated event
├─ Check: Matches sequence conditions? YES (productCode, value, lens)
├─ Create: ContactSequenceInstance
│  └─ nextSendAt = 09:30:00 (Day 0 delay = 0 min)
│
09:30:00 - Day 0 SMS queued in ScheduledSms
│
10:00:00 - [Hourly Dispatch Cron Job]
│  ├─ Find: ContactSequenceInstance.nextSendAt <= now()
│  ├─ Send: "프리미엘 크루즈 경험이 시작됩니다!" to +82-10-1234-5678
│  ├─ Log: SmsLog { msgId, status=SENT, sequenceId, day=0, variant=A }
│  ├─ Update: ContactSequenceInstance.day0SentAt = 10:00:00
│  └─ Schedule: ContactSequenceInstance.nextSendAt = 09:30:00 + 1440min
│
10:15:00 - Contact opens SMS (clicks link)
│  └─ GA4 event → SmsLog.openedAt = 10:15:00
│
22:00:00 (11:00 PM) - [Daily Analytics Job]
│  ├─ Aggregate Day 0 stats
│  │  └─ Variant A: 1815 sent, 573 opened (31.6% open rate) ← WINNER
│  ├─ Update SmsSequenceTemplate.totalSent += 1815
│  ├─ Update SmsSequenceTemplate.totalOpened += 573
│  └─ Update SmsSequenceVariant.openCount += 1
│
Next Day (2026-05-28) 09:30:00 - Day 1 SMS
│  ├─ Dispatch Job detects: nextSendAt <= now()
│  ├─ Send: "골드멤버 100명 특제 가이드북..." (Variant A - winner)
│  ├─ Log: SmsLog { sequenceId, day=1, variant=A }
│  └─ Update: nextSendAt = 09:30:00 + 2880min (Day 2)
│
Next Day (2026-05-30) 09:30:00 - Day 2 SMS
│  └─ ... (similar flow)
│
Next Day (2026-05-31) 09:30:00 - Day 3 SMS
│  ├─ Send: "이번주 결정 시 추가 혜택 50% 할인권!"
│  └─ Update: nextSendAt = null (no Day 4 scheduled)
│
2026-06-01 18:00:00 - Contact Purchases Additional Product
│  ├─ Purchase triggered from SMS Day 3
│  ├─ Log: SmsLog.convertedAt = 18:00:00
│  ├─ Update: ContactSequenceInstance.convertedAt = 18:00:00
│  ├─ Update: ContactSequenceInstance.conversionDay = 3 (Day 3 conversion)
│  ├─ Update: ContactSequenceInstance.status = COMPLETED
│  └─ Update: SmsSequenceTemplate.totalConverted += 1
│
2026-06-02 (Next Daily Analytics) - Final Tally
│  └─ Sequence updated: totalSent=5430, totalConverted=271 (4.99%)
```

---

This comprehensive architecture ensures scalability, reliability, and clear data tracking throughout the Day 0-3 sequence lifecycle.
