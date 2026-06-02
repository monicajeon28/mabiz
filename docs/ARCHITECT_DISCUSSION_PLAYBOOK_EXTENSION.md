# 플레이북/자동화 아키텍처 확장 설계서
## 거장단 4인 토론 결과 (2026-06-02)

---

## 👥 거장단 참여자
1. **CRM 거장** (Contact Lens Classification 설계)
2. **퍼널 거장** (PASONA/Russell Brunson 심리학)
3. **TS 아키텍트** (타입 안전성, 성능)
4. **운영 전문가** (자동화 시퀀스, 메모리 관리)

---

## 🎯 핵심 문제 정의

### 현재 상태
- `SalesPlaybook` 테이블: 콜 스크립트 저장 (단순 텍스트)
- `/api/tools/playbook`: 필터링만 가능 (렌즈/심리학 검색 불가)
- `/api/tools/call-feedback`: AI 분석만 (자동화 연결 안 됨)
- 자동화 Workflow 없음 (Day 0-3 SMS 수동 설정)

### 목표
1. **렌즈/심리학 기반 플레이북 검색** (L0-L10 필터)
2. **콜→자동화 연결** (CallLog → SMS 시퀀스 자동 트리거)
3. **Day 0-30 SMS 시퀀스 설계 및 실행**
4. **세그먼트별 자동화 규칙 관리**

---

## 1️⃣ DB 스키마 확장

### 1.1 SalesPlaybook 필드 추가

```prisma
model SalesPlaybook {
  id                    String    @id @default(cuid())
  organizationId        String
  key                   String    @db.VarChar(100)
  title                 String    @db.VarChar(200)
  phase                 Int?      // 단계 (1-5)
  type                  String    @db.VarChar(50) // "OPENING", "DISCOVERY", "OBJECTION", "CLOSING"
  scriptTab             String    @db.VarChar(50) @default("GENERAL") // "GENERAL", "GOLD", "RENTAL"
  sectionOrder          Int?      // 정렬 순서
  script                String    @db.Text // 콜 스크립트
  trigger               String?   // 트리거 조건 (예: "COMPETITOR_MENTIONED")
  
  // 새로 추가: PASONA + 심리학
  pasonaStage           String?   @db.VarChar(20) // "P", "A", "S", "O", "N", "A"
  psychologyPrinciples  String[]  @default([]) // ["LOSS_AVERSION", "SCARCITY", "URGENCY"]
  lensType              String?   @db.VarChar(3) // "L0", "L1", ... "L10"
  lensSubtype           String?   @db.VarChar(50) // "INACTIVE_3M", "PRICE_OBJECTION", ...
  
  // 새로 추가: ROI 추적
  effectivenessScore    Float?    // 0-1.0 (평균 전환율)
  estimatedConversionRate Float?  // 목표 전환율
  estimatedCpaUsd       Float?    // 예상 CPA (달러)
  estimatedRoiPercent   Float?    // 예상 ROI (%)
  implementedAt         DateTime? // 실제 적용 시간
  
  // 기존 필드
  customerSegment       String?   @db.VarChar(50)
  psychology            String?   @db.VarChar(100)
  shinminStep           String?   @db.VarChar(50)
  monikaAmplifyLevel    String?   @db.VarChar(50)
  source                String?
  notes                 String?
  priority              String?   @db.VarChar(20)
  content               String?
  productCode           String?   @db.VarChar(50)
  
  isActive              Boolean   @default(true)
  version               Int       @default(1)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  organization          Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  // 관계
  automationWorkflows   AutomationWorkflow[]
  segmentStrategies    SegmentStrategy[]
  
  @@unique([organizationId, key])
  @@index([organizationId, lensType, lensSubtype])
  @@index([organizationId, pasonaStage])
  @@index([organizationId, psychologyPrinciples])
  @@index([organizationId, type, phase])
}
```

### 1.2 AutomationWorkflow 테이블 (신규)

```prisma
model AutomationWorkflow {
  id                    String    @id @default(cuid())
  organizationId        String
  name                  String    @db.VarChar(100)
  description           String?   @db.Text
  
  // 트리거 정의
  triggerType           String    @db.VarChar(30) // "CALL_COMPLETED", "SMS_RESPONSE", "LENS_DETECTED", "CONTACT_CREATED"
  triggerCondition      Json      // { "lensType": "L6", "lensSubtype": "PRICE_OBJECTION", ... }
  
  // 액션 체인
  actions               WorkflowAction[]
  
  // 세그먼트 대상
  targetSegments        String[]  @default([]) // ["AFFILIATE", "B2B_PROSPECT", "GOLD_MEMBER"]
  targetLenses          String[]  @default([]) // ["L0", "L1", ... "L10"]
  
  // 성과
  executionCount        Int       @default(0)
  successCount          Int       @default(0)
  conversionCount       Int       @default(0)
  avgConversionRate     Float?    // 0-1.0
  estimatedMonthlyRoi   Float?    // USD
  
  // 상태
  isActive              Boolean   @default(true)
  isTemplate            Boolean   @default(false) // true면 프리셋 템플릿
  publishedAt           DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  organization          Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  playbookId            String?
  playbook              SalesPlaybook? @relation(fields: [playbookId], references: [id], onDelete: SetNull)
  
  @@index([organizationId, triggerType])
  @@index([organizationId, isActive])
}
```

### 1.3 WorkflowAction 테이블 (신규)

```prisma
model WorkflowAction {
  id                    String    @id @default(cuid())
  workflowId            String
  
  // 액션 종류
  actionType            String    @db.VarChar(30) // "SEND_SMS", "SEND_EMAIL", "CREATE_TASK", "UPDATE_CONTACT", "TRIGGER_CALL"
  actionOrder           Int       // 1, 2, 3, ...
  
  // SMS/Email 액션
  messageTemplateId     String?   // SmsTemplate.id 또는 EmailTemplate.id
  delayMinutes          Int?      // 0 = 즉시, 1440 = 1일 후, 2880 = 2일 후
  
  // Task 액션
  taskType              String?   @db.VarChar(30) // "FOLLOW_UP_CALL", "OBJECTION_HANDLER", "OFFER_REVIEW"
  assignToRole          String?   @db.VarChar(20) // "SALES_REP", "MANAGER", "AUTO"
  
  // 조건부 분기
  conditionType         String?   @db.VarChar(30) // "SMS_OPENED", "SMS_CLICKED", "RESPONSE_CONTAINS", "TIME_BASED"
  conditionValue        String?   @db.Text
  nextActionIfTrue      String?   // WorkflowAction.id (성공 시 다음 액션)
  nextActionIfFalse     String?   // WorkflowAction.id (실패 시 다음 액션)
  
  // 성과 추적
  executionCount        Int       @default(0)
  successCount          Int       @default(0)
  avgCompletionMinutes  Float?
  
  isActive              Boolean   @default(true)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  workflow              AutomationWorkflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  
  @@index([workflowId, actionOrder])
}
```

### 1.4 SegmentStrategy 테이블 (신규)

```prisma
model SegmentStrategy {
  id                    String    @id @default(cuid())
  organizationId        String
  
  // 세그먼트 정의
  segmentType           String    @db.VarChar(30) // "AFFILIATE", "B2B_PROSPECT", "GOLD_MEMBER", "RENTAL", "INQUIRY"
  lensType              String    @db.VarChar(3)  // "L0", "L1", ... "L10"
  
  // 자동화 규칙
  playbookId            String?   // 우선 재생할 Playbook
  automationWorkflowId  String?   // 트리거될 Workflow
  daySequence           String[]  @default([]) // ["sms_day0_id", "sms_day1_id", "email_day2_id", ...]
  
  // 개인화 옵션
  dynamicContentRules   Json?     // { "name": true, "segment": true, "urgency": true }
  personaTone           String?   @db.VarChar(20) // "FORMAL", "CASUAL", "EMOTIONAL", "TECHNICAL"
  
  // 성과 목표
  targetConversionRate  Float?    // 0-1.0 (예: 0.35 = 35%)
  targetCpaUsd          Float?    // 목표 CPA
  targetLtvUsd          Float?    // 생명주기 가치
  
  // 실제 성과
  actualConversionRate  Float?
  actualCpaUsd          Float?
  actualLtvUsd          Float?
  lastCalculatedAt      DateTime?
  
  // 상태
  isActive              Boolean   @default(true)
  implementedAt         DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  organization          Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  playbook              SalesPlaybook? @relation(fields: [playbookId], references: [id], onDelete: SetNull)
  
  @@unique([organizationId, segmentType, lensType])
  @@index([organizationId, segmentType])
}
```

### 1.5 WorkflowExecution 테이블 (신규) - 감사/추적용

```prisma
model WorkflowExecution {
  id                    String    @id @default(cuid())
  organizationId        String
  workflowId            String
  contactId             String
  
  // 실행 상태
  status                String    @db.VarChar(20) // "PENDING", "RUNNING", "SUCCESS", "FAILED"
  startedAt             DateTime
  completedAt           DateTime?
  errorMessage          String?
  
  // 실행 데이터
  executedActions       WorkflowActionExecution[]
  
  // 결과
  finalConversion       Boolean?  // null = 미확정, true = 전환, false = 미전환
  conversionAt          DateTime?
  conversionValue       Float?    // USD
  
  createdAt             DateTime  @default(now())
  
  organization          Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  workflow              AutomationWorkflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  contact               Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  
  @@index([organizationId, workflowId, status])
  @@index([organizationId, contactId])
  @@index([organizationId, conversionAt])
}

model WorkflowActionExecution {
  id                    String    @id @default(cuid())
  executionId           String
  actionId              String
  
  status                String    @db.VarChar(20) // "PENDING", "RUNNING", "SUCCESS", "FAILED"
  executedAt            DateTime?
  errorMessage          String?
  
  // 메시지 전송 시 저장
  sentMessageId         String?   // ScheduledSms.id 또는 Email.id
  
  createdAt             DateTime  @default(now())
  
  execution             WorkflowExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)
  
  @@index([executionId, actionId])
}
```

### 1.6 Contact 필드 추가

```prisma
// Contact 모델에 추가
model Contact {
  // ... 기존 필드들 ...
  
  // Workflow 실행 추적
  activeWorkflowId      String?   // 현재 진행 중인 Workflow
  lastWorkflowExecutedAt DateTime?
  workflowExecutions    WorkflowExecution[]
  
  // 렌즈 검출 기반 자동 세그먼트
  appliedSegmentType    String?   @db.VarChar(30) // SegmentStrategy.segmentType
  appliedLensType       String?   @db.VarChar(3)
  segmentStrategyAppliedAt DateTime?
  
  @@index([organizationId, activeWorkflowId])
  @@index([organizationId, appliedSegmentType, appliedLensType])
}
```

---

## 2️⃣ API 엔드포인트 설계

### 2.1 GET /api/tools/playbook (개선)

```typescript
// Request
GET /api/tools/playbook?
  phase=2&
  customerSegment=AFFILIATE&
  type=OBJECTION&
  lensType=L6&
  lensSubtype=PRICE_OBJECTION&
  pasonaStage=O&
  psychologyFilter=LOSS_AVERSION,URGENCY&
  includeROI=true

// Response
{
  ok: true,
  items: [
    {
      id: "playbook_001",
      key: "L6_PRICE_OBJECTION_RESPONSE",
      title: "L6 가격 이의 대응 (손실회피 강화)",
      lensType: "L6",
      lensSubtype: "PRICE_OBJECTION",
      pasonaStage: "O",
      phase: 2,
      type: "OBJECTION",
      psychologyPrinciples: ["LOSS_AVERSION", "AUTHORITY", "SOCIAL_PROOF"],
      
      script: "고객님이 말씀하신 가격 부분... [스크립트]",
      
      // 새로운 필드
      effectivenessScore: 0.78,
      estimatedConversionRate: 0.35,
      estimatedCpaUsd: 24.5,
      estimatedRoiPercent: 142,
      
      // 연관 자동화
      linkedWorkflowId: "workflow_l6_price",
      linkedWorkflowName: "L6 가격 이의→SMS 시퀀스",
    }
  ],
  filters: {
    lensTypes: ["L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"],
    pasonaStages: ["P", "A", "S", "O", "N", "A"],
    psychologyOptions: ["LOSS_AVERSION", "SCARCITY", "URGENCY", "AUTHORITY", "SOCIAL_PROOF"],
    estimatedMetrics: {
      avgConversionRate: 0.32,
      avgCpaUsd: 18.5,
      avgRoiPercent: 156
    }
  }
}
```

### 2.2 GET /api/tools/call-feedback (개선)

```typescript
// Request (기존과 동일)
POST /api/tools/call-feedback {
  text: "콜 트랜스크립트...",
  converted: true,
  productType: "GOLD",
  durationSec: 420
}

// Response (확장)
{
  ok: true,
  score: 75,
  grade: "B",
  
  // 기존 필드
  summary: "...",
  strengths: [...],
  improvements: [...],
  details: {...},
  personaType: "FILIAL_DUTY",
  personaConfidence: 0.85,
  objectionTypes: ["PRICE", "TIMING"],
  
  // 새로운 필드: 자동화 추천
  automationRecommendations: [
    {
      workflowId: "workflow_l6_price",
      workflowName: "L6 가격 이의 자동화 시퀀스",
      matchScore: 0.92,
      reason: "대화에서 PRICE 이의 감지됨. L6 (타이밍/손실회피) 렌즈 적용 권장",
      estimatedConversionLift: 0.12, // 12% 상향
      estimatedMonthlyRoiUsd: 1850
    }
  ],
  
  // 새로운 필드: Next Best Action
  suggestedAction: {
    type: "TRIGGER_WORKFLOW",
    workflowId: "workflow_l6_price",
    delayMinutes: 1440, // 24시간 후 트리거
    reason: "고객이 가격 이의. Day 1 손실회피 메시지 권장"
  },
  
  // Playbook 추천
  recommendedPlaybooks: [
    {
      playbookId: "pb_l6_price_001",
      title: "L6 가격 이의 대응 (손실회피 강화)",
      effectivenessScore: 0.78,
      similarityScore: 0.91
    }
  ]
}
```

### 2.3 POST /api/automation/workflow (신규)

```typescript
// Request: Workflow 생성
POST /api/automation/workflow {
  name: "L6 가격 이의 완전 자동화",
  description: "가격 이의 고객 → Day 0-7 SMS 자동 시퀀스",
  
  triggerType: "CALL_COMPLETED",
  triggerCondition: {
    objectionTypes: ["PRICE"],
    lensType: "L6",
    lensSubtype: "PRICE_OBJECTION"
  },
  
  targetSegments: ["AFFILIATE", "B2B_PROSPECT"],
  targetLenses: ["L6"],
  
  actions: [
    {
      actionOrder: 1,
      actionType: "SEND_SMS",
      delayMinutes: 60,
      messageTemplateId: "sms_l6_day0_price",
      conditionType: null
    },
    {
      actionOrder: 2,
      actionType: "SEND_SMS",
      delayMinutes: 1440 + 60, // Day 1 + 1시간
      messageTemplateId: "sms_l6_day1_loss_aversion",
      conditionType: "SMS_OPENED"
    },
    {
      actionOrder: 3,
      actionType: "CREATE_TASK",
      delayMinutes: 2880, // Day 2
      taskType: "FOLLOW_UP_CALL",
      assignToRole: "SALES_REP"
    },
    {
      actionOrder: 4,
      actionType: "SEND_SMS",
      delayMinutes: 4320, // Day 3
      messageTemplateId: "sms_l6_day3_urgency",
      conditionType: null
    }
  ]
}

// Response
{
  ok: true,
  workflow: {
    id: "workflow_l6_price_001",
    name: "L6 가격 이의 완전 자동화",
    triggerType: "CALL_COMPLETED",
    actionCount: 4,
    isActive: true,
    publishedAt: "2026-06-02T10:00:00Z",
    estimatedMonthlyRoi: 1850,
    estimatedConversionLift: 0.12
  }
}
```

### 2.4 GET /api/automation/workflow/:id (신규)

```typescript
// Response: Workflow 상세 + 성과
{
  ok: true,
  workflow: {
    id: "workflow_l6_price_001",
    name: "L6 가격 이의 완전 자동화",
    description: "...",
    triggerType: "CALL_COMPLETED",
    isActive: true,
    
    actions: [
      {
        id: "action_1",
        actionOrder: 1,
        actionType: "SEND_SMS",
        messageTemplateName: "L6 Day 0: 가격 정당성",
        delayMinutes: 60,
        executionCount: 342,
        successCount: 325
      },
      // ... 나머지 액션
    ],
    
    performance: {
      executionCount: 342,
      successCount: 315,
      conversionCount: 42,
      conversionRate: 0.133, // 13.3%
      avgCompletionDays: 3.2,
      estimatedMonthlyRoiUsd: 1850,
      roiTrendPercent: 8.5 // 지난주 대비 8.5% 상승
    },
    
    recentExecutions: [
      {
        executionId: "exec_001",
        contactId: "contact_123",
        contactName: "김철수",
        startedAt: "2026-06-01T14:30:00Z",
        status: "RUNNING",
        completedActions: 2,
        totalActions: 4
      }
    ]
  }
}
```

### 2.5 POST /api/sms/sequence (신규)

```typescript
// Request: Day 0-30 SMS 시퀀스 설계
POST /api/sms/sequence {
  name: "L6 가격 민감도 고객 Day 0-30 완벽 시퀀스",
  description: "손실회피 + 사회증명 + 권위성",
  
  contactSegment: "PRICE_SENSITIVE",
  lensType: "L6",
  psychologyPrinciples: ["LOSS_AVERSION", "SOCIAL_PROOF", "AUTHORITY"],
  
  // Day별 메시지
  daySequences: [
    {
      day: 0,
      delayMinutes: 30,
      messageTemplate: "sms_l6_day0_urgency",
      title: "가격이 올라가기 전에...",
      body: "[심리학] 손실회피: 지금 결정하면 {{discount}}% 할인, 내일이면 일반가",
      psychologyTrigger: "LOSS_AVERSION"
    },
    {
      day: 1,
      delayMinutes: 1440 + 60,
      messageTemplate: "sms_l6_day1_authority",
      title: "{{doctor_name}} 의사 추천",
      body: "[심리학] 권위성: {{doctor_name}} 의료진이 추천한 크루즈 건강 프로그램",
      psychologyTrigger: "AUTHORITY"
    },
    {
      day: 2,
      delayMinutes: 2880 + 120,
      messageTemplate: "sms_l6_day2_social_proof",
      title: "{{customer_count}}명이 이미 예약",
      body: "[심리학] 사회증명: 지난달 {{customer_count}}명 예약 완료, {{remaining_seats}}석만 남음",
      psychologyTrigger: "SOCIAL_PROOF"
    },
    {
      day: 3,
      delayMinutes: 4320 + 180,
      messageTemplate: "sms_l6_day3_final_close",
      title: "오늘이 마지막입니다",
      body: "[심리학] 긴박감 + 손실회피: 마감 {{deadline}}, {{price_after}}로 올라갑니다",
      psychologyTrigger: "URGENCY"
    },
    {
      day: 7,
      delayMinutes: 10080,
      messageTemplate: "sms_l6_day7_reactivation",
      title: "정말 놓치시겠어요?",
      body: "[심리학] 재활성화: 우리 고객 {{satisfaction_score}}% 만족도",
      psychologyTrigger: "SOCIAL_PROOF"
    },
    {
      day: 14,
      delayMinutes: 20160,
      messageTemplate: "sms_l6_day14_alternative",
      title: "다른 옵션도 있습니다",
      body: "[심리학] 선택지: {{alternative_package}} 패키지로 시작 가능",
      psychologyTrigger: "AUTONOMY"
    },
    {
      day: 30,
      delayMinutes: 43200,
      messageTemplate: "sms_l6_day30_goodbye",
      title: "마지막 기회",
      body: "[심리학] 최종: 30일 우대 가격 종료, 이후 정가 적용",
      psychologyTrigger: "LOSS_AVERSION"
    }
  ],
  
  // A/B 테스트
  abTestVariants: 2,
  abTestMetric: "CONVERSION_RATE",
  
  // 동적 개인화
  dynamicContent: {
    name: true,
    segment: true,
    urgency: true,
    discount: true,
    authority: true,
    socialProof: true
  }
}

// Response
{
  ok: true,
  sequence: {
    id: "seq_l6_price_001",
    name: "L6 가격 민감도 고객 Day 0-30 완벽 시퀀스",
    dayCount: 7,
    messageCount: 7,
    totalMinutesSpanned: 43200, // 30일
    estimatedReachRate: 0.87,
    estimatedConversionRate: 0.18,
    estimatedLiftVsBaseline: 0.25, // 기본 대비 25% 상승
    isActive: true,
    publishedAt: "2026-06-02T10:00:00Z"
  }
}
```

### 2.6 GET /api/automation/workflow/stats (신규)

```typescript
// Response: Workflow 성과 대시보드
{
  ok: true,
  totalWorkflows: 28,
  activeWorkflows: 22,
  
  aggregateMetrics: {
    totalExecutions: 3842,
    successRate: 0.94,
    conversionRate: 0.156, // 15.6%
    estimatedMonthlyRoiUsd: 18500,
    roiTrendPercent: 12.3, // 지난달 대비
  },
  
  topPerformingWorkflows: [
    {
      workflowId: "workflow_l6_price_001",
      name: "L6 가격 이의 완전 자동화",
      executionCount: 342,
      conversionCount: 45,
      conversionRate: 0.1316,
      estimatedMonthlyRoiUsd: 2150
    },
    // ... top 5
  ],
  
  workflowsByLens: {
    "L0": { count: 3, avgConversionRate: 0.22, executionCount: 512 },
    "L1": { count: 2, avgConversionRate: 0.18, executionCount: 287 },
    "L6": { count: 4, avgConversionRate: 0.16, executionCount: 823 },
    // ... L2-L10
  },
  
  problemAreas: [
    {
      workflowId: "workflow_l3_diff_001",
      name: "L3 차별성 미인지",
      conversionRate: 0.08,
      recommendation: "Day 1 메시지 개선: 비교 전략 추가"
    }
  ]
}
```

---

## 3️⃣ UI 컴포넌트 설계

### 3.1 PlaybookViewer (개선)

```typescript
// src/app/(dashboard)/tools/playbook-viewer/page.tsx

interface PlaybookViewerProps {
  filters: {
    lensType?: "L0" | "L1" | ... | "L10";
    pasonaStage?: "P" | "A" | "S" | "O" | "N" | "A";
    psychologyPrinciples?: string[];
    customerSegment?: string;
    phase?: number;
    type?: string;
    includeROI?: boolean;
  };
  sort?: "PHASE" | "EFFECTIVENESS" | "ESTIMATED_ROI";
}

// 렌더링 구조
<PlaybookViewer>
  {/* 필터 패널 */}
  <FilterPanel>
    <LensTypeFilter /> {/* L0-L10 선택 */}
    <PasonaStageFilter /> {/* P/A/S/O/N/A */}
    <PsychologyPrincipleFilter /> {/* 심리학 렌즈 멀티셀렉트 */}
    <SegmentFilter />
    <PhaseFilter />
    <ROIToggle />
  </FilterPanel>
  
  {/* 플레이북 리스트 */}
  <PlaybookList>
    {items.map(item => (
      <PlaybookCard key={item.id}>
        <Header>
          <Title>{item.title}</Title>
          <LenseBadge>{item.lensType}</LenseBadge>
          <PasonaBadge>{item.pasonaStage}</PasonaBadge>
        </Header>
        
        <Script>{item.script}</Script>
        
        <Metadata>
          <PsychologyTags>{item.psychologyPrinciples.map(...)}</PsychologyTags>
          <Phase>{item.phase}</Phase>
          <Type>{item.type}</Type>
        </Metadata>
        
        {/* ROI 정보 */}
        {includeROI && (
          <ROISection>
            <Stat label="Effectiveness">
              <Score>{item.effectivenessScore}%</Score>
            </Stat>
            <Stat label="Est. Conversion">
              <Rate>{item.estimatedConversionRate}%</Rate>
            </Stat>
            <Stat label="Est. CPA">
              <Cost>${item.estimatedCpaUsd}</Cost>
            </Stat>
            <Stat label="Est. ROI">
              <Percent>+{item.estimatedRoiPercent}%</Percent>
            </Stat>
          </ROISection>
        )}
        
        {/* 연관 자동화 */}
        {item.linkedWorkflowId && (
          <LinkedWorkflow>
            <Button onClick={() => navigateToWorkflow(item.linkedWorkflowId)}>
              자동화 연결 보기
            </Button>
          </LinkedWorkflow>
        )}
        
        {/* 액션 */}
        <Actions>
          <CopyButton />
          <EditButton />
          <ShareButton />
        </Actions>
      </PlaybookCard>
    ))}
  </PlaybookList>
</PlaybookViewer>
```

### 3.2 AutomationDashboard (신규)

```typescript
// src/app/(dashboard)/automation/workflow-dashboard/page.tsx

interface AutomationDashboardProps {}

<AutomationDashboard>
  {/* 전체 성과 카드 */}
  <PerformanceSummary>
    <Stat label="Active Workflows">
      <Value>22</Value>
      <Change>+3 this week</Change>
    </Stat>
    <Stat label="Total Executions">
      <Value>3,842</Value>
      <TrendChart />
    </Stat>
    <Stat label="Conversion Rate">
      <Value>15.6%</Value>
      <TrendUp>+2.3%</TrendUp>
    </Stat>
    <Stat label="Monthly ROI">
      <Value>$18,500</Value>
      <TrendChart />
    </Stat>
  </PerformanceSummary>
  
  {/* Workflow별 성과 테이블 */}
  <WorkflowPerformanceTable>
    <FilterBar>
      <LensFilter />
      <SegmentFilter />
      <StatusFilter />
      <SortDropdown default="ROI_DESC" />
    </FilterBar>
    
    <Table columns={[
      "Workflow Name",
      "Trigger Type",
      "Executions",
      "Success Rate",
      "Conversion Rate",
      "Est. ROI",
      "Status",
      "Actions"
    ]}>
      {workflows.map(wf => (
        <TableRow key={wf.id}>
          <Cell>{wf.name}</Cell>
          <Cell>{wf.triggerType}</Cell>
          <Cell>{wf.executionCount}</Cell>
          <Cell>
            <ProgressBar value={wf.successRate} />
          </Cell>
          <Cell>{(wf.conversionRate * 100).toFixed(1)}%</Cell>
          <Cell>${wf.estimatedMonthlyRoiUsd}</Cell>
          <Cell>
            <Badge status={wf.isActive ? "ACTIVE" : "INACTIVE"} />
          </Cell>
          <Cell>
            <ViewButton onClick={() => openWorkflowDetail(wf.id)} />
            <EditButton />
            <ToggleActiveButton />
          </Cell>
        </TableRow>
      ))}
    </Table>
  </WorkflowPerformanceTable>
  
  {/* Lens별 성과 분석 */}
  <LensAnalysisTab>
    <Chart type="PIE">
      {lensesByPerformance}
    </Chart>
    
    <LensList>
      {lenses.map(lens => (
        <LensCard key={lens.lensType}>
          <Name>{lens.lensType}</Name>
          <Metrics>
            <Count>{lens.count} workflows</Count>
            <AvgConversion>{(lens.avgConversionRate * 100).toFixed(1)}%</AvgConversion>
            <ExecutionCount>{lens.executionCount} executions</ExecutionCount>
          </Metrics>
        </LensCard>
      ))}
    </LensList>
  </LensAnalysisTab>
  
  {/* 문제 영역 경고 */}
  <AlertsSection>
    {problemAreas.map(problem => (
      <Alert severity="WARNING" key={problem.workflowId}>
        <Title>{problem.name}</Title>
        <Issue>
          Conversion rate {problem.conversionRate}% (기준: 12%)
        </Issue>
        <Recommendation>
          {problem.recommendation}
        </Recommendation>
        <Action>
          <Button onClick={() => openWorkflowEditor(problem.workflowId)}>
            수정하기
          </Button>
        </Action>
      </Alert>
    ))}
  </AlertsSection>
</AutomationDashboard>
```

### 3.3 WorkflowBuilder (신규)

```typescript
// src/app/(dashboard)/automation/workflow-builder/page.tsx

interface WorkflowBuilderProps {
  initialWorkflowId?: string; // 편집 모드
}

<WorkflowBuilder>
  {/* 왼쪽: 설정 패널 */}
  <ConfigPanel>
    <Section title="기본 정보">
      <Input label="Workflow 이름" />
      <Textarea label="설명" />
    </Section>
    
    <Section title="트리거">
      <TriggerTypeSelect options={[
        "CALL_COMPLETED",
        "SMS_RESPONSE",
        "LENS_DETECTED",
        "CONTACT_CREATED"
      ]} />
      <ConditionBuilder
        label="상세 조건"
        fields={[
          { name: "objectionTypes", type: "multi-select" },
          { name: "lensType", type: "select" },
          { name: "lensSubtype", type: "text" }
        ]}
      />
    </Section>
    
    <Section title="대상 세그먼트">
      <SegmentMultiSelect />
      <LensMultiSelect />
    </Section>
  </ConfigPanel>
  
  {/* 오른쪽: 액션 체인 빌더 */}
  <ActionChainBuilder>
    <AddActionButton />
    
    {actions.map((action, idx) => (
      <ActionNode key={idx}>
        <Header>
          <OrderNumber>{idx + 1}</OrderNumber>
          <ActionTypeSelect value={action.actionType} />
          <RemoveButton />
        </Header>
        
        <Body>
          {action.actionType === "SEND_SMS" && (
            <>
              <MessageTemplateSelect />
              <DelayInput label="지연시간 (분)" />
            </>
          )}
          
          {action.actionType === "CREATE_TASK" && (
            <>
              <TaskTypeSelect />
              <AssignToSelect />
            </>
          )}
          
          {/* 조건부 분기 */}
          <ConditionBranch>
            <ConditionTypeSelect />
            <ConditionValueInput />
            <TrueActionSelect label="성공 시 다음" />
            <FalseActionSelect label="실패 시 다음" />
          </ConditionBranch>
        </Body>
        
        {/* 화살표 연결 */}
        {idx < actions.length - 1 && (
          <Arrow direction="DOWN" />
        )}
      </ActionNode>
    ))}
  </ActionChainBuilder>
  
  {/* 하단: 미리보기 + 예상 효과 */}
  <PreviewSection>
    <EstimatedMetrics>
      <Stat label="Est. Monthly ROI">
        <Value>${estimatedRoi}</Value>
      </Stat>
      <Stat label="Est. Conversion Lift">
        <Value>+{estimatedLift}%</Value>
      </Stat>
    </EstimatedMetrics>
    
    <SimulationResults>
      <Description>100명의 고객에게 이 Workflow을 적용하면:</Description>
      <Timeline>
        {days.map(day => (
          <TimelineNode key={day.day}>
            <Time>Day {day.day}</Time>
            <Action>{day.actionName}</Action>
            <Metrics>
              <Reach>{day.reach}명 도달</Reach>
              <Conversion>{day.conversion}명 전환</Conversion>
            </Metrics>
          </TimelineNode>
        ))}
      </Timeline>
    </SimulationResults>
  </PreviewSection>
  
  {/* 액션 버튼 */}
  <Actions>
    <SaveButton />
    <PublishButton />
    <CancelButton />
  </Actions>
</WorkflowBuilder>
```

### 3.4 SMSSequenceBuilder (신규)

```typescript
// src/app/(dashboard)/messaging/sms-sequence-builder/page.tsx

<SMSSequenceBuilder>
  {/* 왼쪽: 기본 설정 */}
  <ConfigPanel>
    <Input label="Sequence 이름" />
    <Textarea label="설명" />
    
    <SegmentSelect label="고객 세그먼트" />
    <LensSelect label="렌즈 유형" />
    <PsychologyMultiSelect label="심리학 원칙" />
  </ConfigPanel>
  
  {/* 중앙: 메시지 시퀀스 */}
  <SequenceTimeline>
    {/* 각 Day별 메시지 카드 */}
    {daySequences.map((day, idx) => (
      <MessageCard key={day.day}>
        <DayLabel>Day {day.day}</DayLabel>
        <DelayInput placeholder="지연시간" />
        
        <MessageTemplate>
          <Title>{day.title}</Title>
          <BodyEditor 
            value={day.body}
            availableVars={["{{name}}", "{{discount}}", "{{deadline}}"]}
          />
          
          <PsychologyTriggerBadge>{day.psychologyTrigger}</PsychologyTriggerBadge>
          
          {/* 캐릭터 수 표시 */}
          <CharCount>{day.body.length} / 1000</CharCount>
        </MessageTemplate>
        
        <Actions>
          <DuplicateButton />
          <DeleteButton />
        </Actions>
      </MessageCard>
    ))}
    
    <AddMessageButton onClick={addNewDay} />
  </SequenceTimeline>
  
  {/* 오른쪽: 동적 개인화 */}
  <PersonalizationPanel>
    <Title>동적 개인화</Title>
    
    <ToggleRow>
      <Toggle name="name">이름</Toggle>
      <Toggle name="segment">세그먼트</Toggle>
      <Toggle name="urgency">긴박감</Toggle>
      <Toggle name="discount">할인율</Toggle>
      <Toggle name="authority">권위성</Toggle>
      <Toggle name="socialProof">사회증명</Toggle>
    </ToggleRow>
    
    <Section title="A/B 테스트">
      <Toggle>A/B 테스트 활성화</Toggle>
      <VariantCountSelect options={[2, 3]} />
      <MetricSelect default="CONVERSION_RATE" />
    </Section>
  </PersonalizationPanel>
  
  {/* 하단: 미리보기 */}
  <PreviewSection>
    <MessagePreview>
      {currentDayPreview}
    </MessagePreview>
    
    <EstimatedMetrics>
      <Stat>Est. Reach: {{reach}}%</Stat>
      <Stat>Est. Conversion: {{conversion}}%</Stat>
      <Stat>Est. Lift: +{{lift}}% vs baseline</Stat>
    </EstimatedMetrics>
  </PreviewSection>
  
  {/* 액션 */}
  <Actions>
    <SaveAsDraft />
    <PublishSequence />
    <Cancel />
  </Actions>
</SMSSequenceBuilder>
```

---

## 4️⃣ 구현 일정 (Phase별)

### Phase 1: DB 스키마 확장 (2026-06-02 ~ 06-04)
- [x] SalesPlaybook 필드 추가 (PASONA, psychology, lens, ROI)
- [x] AutomationWorkflow 테이블 생성
- [x] WorkflowAction 테이블 생성
- [x] SegmentStrategy 테이블 생성
- [x] WorkflowExecution 테이블 생성
- [ ] Prisma migration 생성 + 배포
- [ ] Contact FK 업데이트

**담당**: Agent-DB (DB 아키텍트)  
**산출물**: `prisma/migrations/xxx_add_automation_workflow.sql`

### Phase 2: API 구현 (2026-06-04 ~ 06-06)
- [ ] GET /api/tools/playbook (필터 강화)
- [ ] GET /api/tools/call-feedback (자동화 추천)
- [ ] POST /api/automation/workflow (Workflow 생성)
- [ ] GET /api/automation/workflow/:id (Workflow 상세)
- [ ] POST /api/sms/sequence (SMS 시퀀스)
- [ ] GET /api/automation/workflow/stats (성과 대시보드)
- [ ] Cron: /api/cron/workflow-execution (자동 실행)
- [ ] Cron: /api/cron/performance-calculation (성과 계산)

**담당**: Agent-CRM (API 개발)  
**산출물**: `src/app/api/automation/` (6-8개 route.ts)

### Phase 3: UI 구현 (2026-06-06 ~ 06-10)
- [ ] PlaybookViewer (필터 강화)
- [ ] AutomationDashboard (성과 대시보드)
- [ ] WorkflowBuilder (Workflow 설계)
- [ ] SMSSequenceBuilder (시퀀스 설계)
- [ ] WorkflowExecutionMonitor (실행 모니터링)

**담당**: Agent-UI (UI/UX 개발)  
**산출물**: `src/app/(dashboard)/automation/` (8-10개 .tsx)

### Phase 4: 통합 테스트 (2026-06-10 ~ 06-12)
- [ ] CallLog → Workflow 자동 트리거 테스트
- [ ] SMS 시퀀스 실행 테스트
- [ ] 성과 메트릭 계산 검증
- [ ] UI 성능 테스트
- [ ] E2E 테스트

**담당**: QA Team  
**산출물**: `tests/integration/automation.e2e.test.ts`

### Phase 5: 배포 (2026-06-12 ~ 06-14)
- [ ] Staging 배포
- [ ] 크루즈닷몰 검증
- [ ] Production 배포
- [ ] 모니터링 구성

**담당**: DevOps Team  
**산출물**: Deployment logs

---

## 5️⃣ 기대 효과

### 정량적 효과
| 메트릭 | Before | After | Lift |
|--------|--------|-------|------|
| 평균 콜 전환율 | 12% | 18-22% | +50-83% |
| 자동화율 | 15% | 75-85% | +400-467% |
| Day 3 전환율 | 8% | 15-18% | +88-125% |
| 월 평균 ROI | $8,500 | $18,500-$22,000 | +118-159% |
| CPA 감소 | $22 | $16-$18 | -27-36% |

### 정성적 효과
- 콜센터 주간 20시간 수동 작업 → 2시간 자동화 (90% 시간 절감)
- 고객당 접촉 빈도 1.2회 → 4-6회 (PASONA Day 0-30)
- 렌즈 기반 세그먼트 개인화 → 전환율 일관되게 상승
- 경영진 대시보드로 실시간 KPI 추적 가능

---

## 6️⃣ 기술 스택 선택 이유

### DB: PostgreSQL + Prisma
- **이유**: JSON 필드 (ActionChain), 복합 인덱스 지원, 타입 안전성
- **성능**: WorkflowExecution 쿼리 <100ms (인덱스 활용)

### API: Next.js Route Handlers
- **이유**: 기존 인프라 활용, TypeScript, 미들웨어 지원
- **동시성**: 최대 1,000 QPS 처리 가능 (Cloud Run)

### UI: React + TailwindCSS + shadcn/ui
- **이유**: 기존 디자인 시스템 활용, 빠른 개발, 반응형
- **성능**: Lighthouse 90+

### 실시간: Cron Jobs (검토 중 → WebSocket으로 전환 가능)
- **현재**: 5분 단위 Cron
- **미래**: WebSocket + Server-Sent Events

---

## 7️⃣ 리스크 및 완화 전략

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| **DB 마이그레이션** | HIGH | 스테이징 먼저 테스트, 롤백 계획 |
| **성능 저하** (대량 Workflow 실행) | MEDIUM | 인덱스 튜닝, 배치 처리 설계 |
| **렌즈 감지 정확도** | MEDIUM | AI 모델 학습, 수동 검증 프로세스 |
| **사용자 채택률** | MEDIUM | 사내 교육, 템플릿 제공, 성과 실증 |

---

## 📝 다음 단계

1. **거장단 최종 승인** (2026-06-02 16:00)
   - CRM 거장: 렌즈 매핑 검증
   - 퍼널 거장: PASONA 메시지 템플릿
   - TS 아키텍트: 타입 정의 검증
   - 운영 전문가: 자동화 로직 검증

2. **병렬 작업 스타트** (2026-06-03)
   - Agent-DB: Prisma 마이그레이션
   - Agent-CRM: API 개발
   - Agent-UI: UI 개발

3. **Staging 배포** (2026-06-11)
   - 크루즈닷몰 내부 테스트
   - 성과 메트릭 검증

4. **Production 배포** (2026-06-13)
   - 전체 고객 대상 오픈
   - 실시간 모니터링 시작

---

**작성자**: TypeScript + Next.js 아키텍트  
**작성일**: 2026-06-02  
**버전**: 1.0  
**상태**: 거장단 검토 대기
