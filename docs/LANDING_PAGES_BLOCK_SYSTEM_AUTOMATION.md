# Landing Pages 블록 시스템 자동화 아키텍처 (2026-06-15)

## 📌 개요

Landing Pages 폼 필드 템플릿을 JSON 기반 블록 시스템으로 자동화하여:
1. **10가지 폼 템플릿** JSON 사전 정의
2. **CTA 자동 매핑** (버튼 클릭 → CRM 태그 생성)
3. **Day 0-3 SMS 자동화** (폼 제출 → 자동 시퀀스 시작)
4. **심리학 렌즈 기반 세그먼테이션** (폼 응답 → L0-L10 자동 분류)
5. **성과 메트릭 자동 추적** (폼 타입별 전환율, LTV, Risk Score)

---

## 🏗️ 현재 상태 분석

### DB 스키마 (기존)
```prisma
model CrmLandingPage {
  id                String    @id @default(cuid())
  formConfig        Json?     // 현재: 폼 설정만 저장
  groupId           String?   // 그룹 배정 (자동분류)
  autoFunnelId      String?   // 퍼널 (SMS 시퀀스)
  smsL6Day0Enabled  Boolean   // L6 스코어시티 활성화
  smsL6Day1Enabled  Boolean
  smsL6Day2Enabled  Boolean
}

model CrmLandingRegistration {
  id                String   @id @default(cuid())
  landingPageId     String
  name              String
  phone             String
  email             String?
  customFields      Json?    // 추가 필드 저장
  metadata          Json?    // UTM, 기타 메타데이터
  funnelStarted     Boolean  // 퍼널 시작 여부
  registeredAt      DateTime
}

model Contact {
  phone             String
  organizationId    String
  tags              String[] // 자동 태그 배열
  leadScore         Int      // 종합 점수
  sourceType        String?  // "LANDING_PAGE"
  sourceId          String?  // landingPageId
}
```

### 현재 폼 기능 (register route)
- ✅ 필수 필드 검증 (name, phone)
- ✅ Contact upsert (자동 생성/업데이트)
- ✅ Group 자동 배정
- ✅ Funnel 자동 시작 (SMS Day 0-3)
- ⚠️ 폼 템플릿은 미분류 (각 페이지별 개별 설정)
- ⚠️ CTA → 태그 매핑 자동화 없음
- ⚠️ 렌즈 감지 (L0-L10) 구현 부분적

---

## 🎯 자동화 아키텍처

### 1️⃣ 폼 템플릿 JSON (10가지)

**위치**: `src/lib/landing-form-templates.ts`

```typescript
/**
 * Landing Pages 폼 템플릿 (10가지)
 * 각 템플릿 = { fields[], cta[], psychologyLens[], tagRules[], smsSequence }
 */

export type FormField = {
  id: string;           // "phone", "name", "email", "age", "destination", etc.
  label: string;        // UI 표시명
  type: "text" | "tel" | "email" | "select" | "radio" | "checkbox" | "date";
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  psych?: "L0" | "L1" | "L2" | "L3" | ... | "L10"; // 심리학 렌즈
};

export type FormCTA = {
  id: string;           // "inquiry_cruise", "rental_inquiry", "vip_contact"
  label: string;        // "상품 문의하기", "예약하기"
  actionType: "SEND_SMS" | "SCHEDULE_CALL" | "EMAIL_FOLLOW_UP" | "FUNNEL_START";
  tagRules: {
    autoTag: string[];  // ["크루즈관심", "6월출발", "VIP"]
    groupId?: string;   // 자동 배정 그룹 ID
    funnelId?: string;  // 연결할 SMS 퍼널
  };
  smsConfig?: {
    day0Template: string;   // PASONA P/A 단계
    day1Template: string;   // PASONA S 단계
    day2Template: string;   // PASONA O 단계
    day3Template: string;   // PASONA A/N 단계
  };
};

export type FormTemplate = {
  id: string;
  name: string;                    // "일반 폼", "VIP 폼", "설문폼"
  category: "GENERAL" | "VIP" | "SURVEY" | "EVENT" | "BOOKING" | "INQUIRY" | "NEWSLETTER" | "QUIZ" | "REFERRAL" | "REVIEW";
  description: string;
  
  // 필드 설정
  fields: FormField[];
  
  // CTA 버튼
  ctas: FormCTA[];
  
  // 심리학 렌즈 (자동 감지 규칙)
  psychologyLensMapping: {
    fieldId: string;      // "destination" 필드
    lensType: string;     // "L3" (차별성)
    detectionRules: string[]; // ["contains:크루즈", "contains:유럽"]
  }[];
  
  // SMS 시퀀스 설정
  smsSequenceConfig: {
    enabled: boolean;
    day0Delay: number;         // 5분 (가능한 즉시)
    day1Delay: number;         // 24시간
    day2Delay: number;         // 48시간
    day3Delay: number;         // 72시간
    psychologyPrinciple: "PASONA" | "SPIN" | "GRANT_CARDONE"; // "PASONA"
    urgencyType?: "L6" | "L10"; // 긴박감/즉시구매
  };
  
  // 렌즈 자동 세그먼테이션
  autoSegmentation: {
    enabled: boolean;
    rules: {
      fieldId: string;
      value: string;
      targetLens: string;        // "L3", "L6", "L10"
      autoGroupId?: string;      // 렌즈별 그룹
    }[];
  };
  
  // 성과 메트릭 기본값
  defaultMetrics: {
    expectedConversionRate: number; // 25% (일반) ~ 65% (VIP)
    expectedLTV: number;            // 800K ~ 1.5M
    riskScoreThreshold: number;     // 50 (일반) ~ 30 (VIP)
    expectedLeadScore: number;      // 30 (일반) ~ 80 (VIP)
  };
};
```

### 📋 10가지 템플릿 상세

| # | 템플릿명 | 필드 예시 | CTA 예시 | 심리학 렌즈 | SMS 시퀀스 | 기대 전환율 |
|---|---------|---------|---------|----------|----------|---------|
| **T1** | 일반 폼 | name, phone, email | "상품문의", "예약하기" | L3(차별성), L6(시간) | PASONA | 25% |
| **T2** | VIP 폼 | name, phone, email, age, income | "VIP전용상담", "프리미엄패키지" | L10(즉시), L7(동반) | GRANT_CARDONE | 60% |
| **T3** | 설문 폼 | 선호도(radio/checkbox), 예산(select) | "결과보기", "상담신청" | L1(가격), L5(적합성) | SPIN | 35% |
| **T4** | 이벤트 폼 | name, phone, event_type | "참가등록", "초대권신청" | L6(희소성), L8(재구매) | PASONA (짧음) | 45% |
| **T5** | 예약 폼 | name, phone, date, destination | "예약확정", "자세히보기" | L2(준비), L3(목적지) | PASONA (중간) | 55% |
| **T6** | 문의 폼 | name, phone, inquiry_type | "문의전송", "콜백신청" | L0(재활성), L1(가격) | SPIN | 30% |
| **T7** | 뉴스레터 | name, email, interest_type | "구독", "추천받기" | L8(습관), L5(적합) | PASONA (장기) | 20% |
| **T8** | 퀴즈 폼 | quiz_answers (dynamic) | "결과보기", "컨설팅받기" | L10(클로징), L3(비교) | GRANT_CARDONE | 50% |
| **T9** | 추천 폼 | name, phone, referee_name | "추천등록", "보상신청" | L7(동반), L8(재구매) | PASONA | 40% |
| **T10** | 리뷰 폼 | name, rating, review_text | "리뷰완료", "특전신청" | L8(신뢰), L9(의료) | PASONA | 35% |

---

### 2️⃣ CTA 자동 매핑 (버튼 → CRM 액션)

**위치**: `src/lib/landing-cta-engine.ts`

```typescript
/**
 * CTA 엔진: 폼 제출 + CTA 선택 → 자동 CRM 액션
 */

export type CTAExecutionContext = {
  formTemplateId: string;
  ctaId: string;
  registrationId: string;
  contactId: string;
  metadata: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    formFilledTime: number; // ms
  };
};

export async function executeCTA(ctx: CTAExecutionContext): Promise<{
  ok: boolean;
  tagApplied: string[];
  groupAssigned?: string;
  funnelStarted?: boolean;
  smsScheduled?: number; // 예약된 SMS 개수
}> {
  // 1. CTA 정의 조회
  const cta = await getCTAConfig(ctx.formTemplateId, ctx.ctaId);
  
  // 2. 자동 태그 적용
  const autoTags = cta.tagRules.autoTag || [];
  await applyTagsToContact(ctx.contactId, autoTags);
  
  // 3. 그룹 자동 배정
  if (cta.tagRules.groupId) {
    await assignContactToGroup(ctx.contactId, cta.tagRules.groupId);
  }
  
  // 4. SMS 시퀀스 시작
  let smsCount = 0;
  if (cta.smsConfig) {
    smsCount = await scheduleSmsSequence({
      contactId: ctx.contactId,
      templates: [
        { day: 0, content: cta.smsConfig.day0Template },
        { day: 1, content: cta.smsConfig.day1Template },
        { day: 2, content: cta.smsConfig.day2Template },
        { day: 3, content: cta.smsConfig.day3Template },
      ],
    });
  }
  
  // 5. 렌즈 감지 + 자동분류
  await detectAndClassifyLens(ctx.contactId, cta, ctx.metadata);
  
  return {
    ok: true,
    tagApplied: autoTags,
    groupAssigned: cta.tagRules.groupId,
    funnelStarted: !!cta.tagRules.funnelId,
    smsScheduled: smsCount,
  };
}
```

### 3️⃣ 폼 제출 워크플로우 (3가지 시나리오)

#### 시나리오 A: 기본 폼 제출 (일반 폼)
```
사용자가 [일반 폼] 입력 → "상품문의" 버튼 클릭
  ↓
API /api/landing-pages/[id]/register (POST)
  ├─ formTemplateId = "GENERAL_FORM"
  ├─ ctaId = "inquiry_cruise"
  └─ customFields = { destination: "유럽", date: "2026-07-01" }
  ↓
① Contact 생성/업데이트
② 자동 태그 적용 ["크루즈관심", "7월출발"]
③ 그룹 배정 (defaultGroupId)
④ Lens 감지 (L3=차별성, L6=시간감)
  └─ ContactLensClassification 생성
⑤ SMS Day 0-3 예약
  ├─ Day 0: P(문제)+A(자극) — PASONA "지금 예약하면 20% 할인"
  ├─ Day 1: S(해결) — "유럽 크루즈 완벽 준비 가이드"
  ├─ Day 2: O(오퍼) — "선착순 50명 추가 혜택"
  └─ Day 3: A(행동) — "오늘 예약해야 하는 3가지 이유"
⑥ Lead Score 계산
  └─ +10 (폼 제출) + 15 (목적지 선택) + 20 (날짜 결정) = 45점
↓
반환: { ok: true, tagApplied: 2, groupAssigned: "GRP_001", smsScheduled: 4 }
```

#### 시나리오 B: VIP 퀴즈 폼 (고 전환율)
```
사용자가 [퀴즈 폼] 입력 (5개 질문) → "결과보기" 클릭
  ↓
① Contact 생성 + VIP 태그 자동 추가
② Quiz 결과 분석 (심리학 프로필)
  └─ "프리미엄 크루즈 선호", "5000만원 이상 예산", "연 2회 이상 여행"
③ Lens 자동분류 (L10=즉시구매, L7=동반, L8=재구매)
④ SMS 시퀀스 (GRANT_CARDONE 메서드)
  ├─ Day 0: "VIP 전용 이 패키지는 72시간만 가능합니다"
  ├─ Day 1: "지난주 VIP 3명이 예약했습니다" (사회증명)
  ├─ Day 2: "남은 자리 2석뿐입니다" (희소성)
  └─ Day 3: "지금 예약하지 않으면 다음달이 되겠습니다" (손실회피)
⑤ Lead Score: 80점 (VIP 프로필 분석)
⑥ 자동 콜백 예약 (Day 1, 10:00 AM)
↓
반환: { ok: true, vipEnrolled: true, callScheduled: true, smsScheduled: 4 }
```

#### 시나리오 C: 설문 폼 (세그먼트별 분기)
```
사용자가 [설문 폼] 입력 (선호도, 예산)
  ↓
① 설문 응답 저장 (customFields)
② 세그먼트 자동 분류
  ├─ "예산 > 5000만원" → L5(적합성) + L7(동반) → VIP 그룹
  ├─ "예산 2000-5000만원" → L6(시간감) + L1(가격) → 일반 그룹
  └─ "예산 < 2000만원" → L0(재활성) + L1(가격) → 신입 그룹
③ 렌즈별 맞춤 SMS 시퀀스 시작
④ Contact 태그 자동 생성
  └─ ["설문완료", "예산_3000만원대", "가족여행", "여름성수기"]
⑤ Lead Score: 40-80점 (응답 기반)
↓
반환: { ok: true, segmented: true, segmentLabel: "STANDARD", smsScheduled: 4 }
```

---

### 4️⃣ SMS 자동화 시퀀스 (Day 0-3 + Grant Cardone)

**위치**: `src/lib/landing-sms-templates.ts`

#### T1: 일반 폼 → PASONA 시퀀스
```json
{
  "templateId": "GENERAL_FORM_PASONA",
  "day0": {
    "delay": 5,
    "delayUnit": "minute",
    "content": "[문제] 크루즈 여행 계획 중인데 가격이 걱정되시나요?\n[자극] 지금 예약하면 20% 추가 할인! 오늘 신청자만 가능합니다.",
    "psychologyPrinciple": "LOSS_AVERSION + SCARCITY",
    "lensTarget": ["L6", "L3"]
  },
  "day1": {
    "delay": 24,
    "delayUnit": "hour",
    "content": "[해결책] 유럽 크루즈 완벽 준비 가이드를 무료로 드립니다.\n→ 클릭하고 '패킹 리스트' 다운로드 받으세요",
    "psychologyPrinciple": "RECIPROCITY",
    "lensTarget": ["L2"]
  },
  "day2": {
    "delay": 48,
    "delayUnit": "hour",
    "content": "[오퍼] 선착순 50명 추가 혜택: 공항 픽업 무료!\n현재 37명이 예약했습니다.",
    "psychologyPrinciple": "SOCIAL_PROOF + SCARCITY",
    "lensTarget": ["L6", "L8"]
  },
  "day3": {
    "delay": 72,
    "delayUnit": "hour",
    "content": "[행동] 지금 예약해야 하는 3가지 이유:\n1) 내일부터 가격 10% 인상\n2) 정가격 고객만 추가 혜택 불가\n3) 배치 조기 마감 가능\n→ 지금 바로 예약하기",
    "psychologyPrinciple": "URGENCY + LOSS_AVERSION",
    "lensTarget": ["L6", "L10"]
  }
}
```

#### T2: VIP 폼 → Grant Cardone 시퀀스
```json
{
  "templateId": "VIP_FORM_GRANT_CARDONE",
  "authorityFramework": "GRANT_CARDONE_10_CLOSES",
  "day0": {
    "delay": 2,
    "delayUnit": "minute",
    "content": "[VIP 전용] 이 프리미엄 패키지는 72시간만 가능합니다.\n귀사의 특별함을 위해 준비한 7개 특전이 있습니다.",
    "closingType": "ASSUMPTIVE_CLOSE",
    "psychologyPrinciple": "AUTHORITY + SCARCITY + EXCLUSIVITY"
  },
  "day1": {
    "delay": 24,
    "delayUnit": "hour",
    "content": "지난주 VIP 3명이 이미 예약했습니다:\n- 한**님 (서울, 소비재 CEO)\n- 이**님 (대구, 의료기관장)\n- 김**님 (부산, 건설업 대표)\n당신도 그들과 함께할 준비가 되셨나요?",
    "closingType": "SOCIAL_PROOF_CLOSE",
    "psychologyPrinciple": "SOCIAL_PROOF + AUTHORITY"
  },
  "day2": {
    "delay": 48,
    "delayUnit": "hour",
    "content": "프리미엄 패키지: 남은 자리 2석뿐입니다.\n→ 지금 확인: [링크]\n\n자리가 없으면 다음달(8월)로 밀릴 수 있습니다.",
    "closingType": "SCARCITY_CLOSE",
    "psychologyPrinciple": "SCARCITY + LOSS_AVERSION"
  },
  "day3": {
    "delay": 72,
    "delayUnit": "hour",
    "content": "마지막 확인입니다.\n지금 예약하지 않으면:\n• 자리가 없어질 수 있음 (60% 확률)\n• 다음달로 미뤄지면 일정 변경됨\n• 동반자들이 먼저 예약할 수 있음\n\n→ [최종 예약 확정]",
    "closingType": "LOSS_AVERSION_CLOSE",
    "psychologyPrinciple": "LOSS_AVERSION + URGENCY + SCARCITY"
  }
}
```

---

### 5️⃣ 렌즈 감지 엔진 (L0-L10 자동 분류)

**위치**: `src/lib/landing-lens-detector.ts`

```typescript
/**
 * 랜딩페이지 폼 응답 → 렌즈 자동 감지
 */

export type LensDetectionInput = {
  formTemplateId: string;
  customFields: Record<string, any>;
  metadata: {
    utmSource?: string;
    formFilledTime: number;
  };
};

export async function detectLensFromFormResponse(
  input: LensDetectionInput
): Promise<{
  primaryLens: string;      // "L3", "L6", "L10"
  confidenceScore: number;  // 0-100
  secondaryLenses: string[];
  tagRules: string[];       // 자동 태그
  groupId?: string;
  followUpStrategy: string; // "GRANT_CARDONE" | "PASONA" | "SPIN"
}> {
  const rules = {
    // L0: 부재중/재활성 고객 (구매 경험 있으나 오래 안 함)
    L0: {
      signals: ["previous_purchase", "lastContact > 1year", "status=INACTIVE"],
      actionTag: ["재활성고객"],
    },
    
    // L1: 가격 이의 (예산 낮음 / 가격 민감)
    L1: {
      signals: ["budget < 3000000", "inquiry_type=PRICE", "keyword:저가"],
      actionTag: ["가격민감", "할인선호"],
    },
    
    // L2: 준비 불안 (처음 여행, 준비 복잡도 높음)
    L2: {
      signals: ["firstTrip=true", "destination=OVERSEAS", "inquiry_type=PREPARATION"],
      actionTag: ["준비불안", "가이드필요"],
    },
    
    // L3: 차별성 미인지 (경쟁사 고려, 비교검색)
    L3: {
      signals: ["competitor_mention", "multiple_inquiries", "destination=POPULAR"],
      actionTag: ["차별성강조"],
    },
    
    // L6: 시간감/긴박감 (제한된 배치, 성수기)
    L6: {
      signals: ["departure_date < 60days", "season=HIGH", "keyword:마감"],
      actionTag: ["시간제한", "성수기"],
    },
    
    // L7: 동반자 설득 (가족/커플, 주저)
    L7: {
      signals: ["group_size >= 2", "hesitation_signal", "family_type"],
      actionTag: ["동반자설득"],
    },
    
    // L8: 재구매 고객 (기존 고객, 습관 형성)
    L8: {
      signals: ["repeat_customer=true", "frequency=ANNUAL", "brand_loyalty_high"],
      actionTag: ["재구매고객", "VIP"],
    },
    
    // L10: 즉시 구매 (높은 예산, 결정력 강함)
    L10: {
      signals: ["budget > 5000000", "decision_maker=true", "urgency_high"],
      actionTag: ["즉시구매대상", "VIP"],
    },
  };
  
  // 폼 응답 분석
  const detectedLenses = [];
  for (const [lensType, config] of Object.entries(rules)) {
    const matchCount = config.signals.filter(s => matchesSignal(input, s)).length;
    if (matchCount >= 2) {
      detectedLenses.push({
        lens: lensType,
        confidence: Math.min(100, matchCount * 30),
        tags: config.actionTag,
      });
    }
  }
  
  // 가장 높은 신뢰도 렌즈 선택
  const primaryLens = detectedLenses.sort((a, b) => b.confidence - a.confidence)[0];
  
  return {
    primaryLens: primaryLens?.lens || "L3",
    confidenceScore: primaryLens?.confidence || 50,
    secondaryLenses: detectedLenses.slice(1, 3).map(l => l.lens),
    tagRules: [...new Set(detectedLenses.flatMap(l => l.tags))],
    groupId: getLensGroupMapping(primaryLens?.lens),
    followUpStrategy: getFollowUpStrategy(primaryLens?.lens),
  };
}

function matchesSignal(input: LensDetectionInput, signal: string): boolean {
  // 신호 매칭 로직 (간단한 예시)
  if (signal === "firstTrip=true") {
    return input.customFields.travel_experience === "FIRST_TIME";
  }
  // ... 더 많은 신호 규칙
  return false;
}
```

---

### 6️⃣ 성과 메트릭 자동 추적 대시보드

**위치**: `src/app/(dashboard)/landing-pages/[id]/metrics/page.tsx`

#### 메트릭 정의
```typescript
export interface FormMetrics {
  formTemplateId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  // 기본 성과
  totalSubmissions: number;
  uniqueContacts: number;
  
  // 렌즈별 분석
  lensDist: {
    L0: number;  // 부재중
    L1: number;  // 가격이의
    L2: number;  // 준비불안
    // ... L10
  };
  
  // Day 0-3 추적
  smsMetrics: {
    day0Sent: number;
    day0Clicked: number;
    day0Converted: number;
    
    day1Sent: number;
    day1Clicked: number;
    day1Converted: number;
    // ... day3
  };
  
  // 전환 메트릭
  conversionMetrics: {
    formToContact: number;     // 폼 제출 → Contact 생성 (%)
    contactToLead: number;     // Contact → Lead 전환 (%)
    leadToCustomer: number;    // Lead → 구매 전환 (%)
    totalConversionRate: number; // 폼 제출 → 구매 (%)
  };
  
  // 비용 메트릭
  costMetrics: {
    totalCostPerForm: number;  // 폼 1개당 비용 (광고+SMS)
    cpaPerLead: number;        // Lead 1명당 획득비용
    cpaPerCustomer: number;    // 고객 1명당 획득비용
    roi: number;               // 투자 대비 수익률 (%)
  };
  
  // LTV 메트릭
  ltv: {
    avgFirstPurchase: number;  // 평균 첫 구매액
    repurchaseRate: number;    // 재구매율 (%)
    avgLifetime: number;       // 평균 고객 생명주기 (개월)
    totalLTV: number;          // 고객 생명주기 가치
  };
  
  // Risk Score (위험도)
  riskMetrics: {
    avgRiskScore: number;      // 0-100 (0=저위험, 100=고위험)
    churnRiskCount: number;    // 이탈 위험 고객 수
    reactivationNeeded: number; // 재활성 필요 고객 수
  };
  
  // SMS 효율성
  smsEfficiency: {
    avgOpenRate: number;       // (%)
    avgClickRate: number;      // (%)
    conversionRatePerSms: number; // (%)
    unsubscribeRate: number;   // (%)
  };
}
```

#### 대시보드 UI 구성 (5계층)
```
┌─ Hero KPI (주요 지표 - 현재 vs 목표)
│  ├─ 전환율: 28% (목표: 35%) ✅ -7%p
│  ├─ CPA: 12,500원 (목표: 10,000원) ❌ +25%
│  ├─ LTV: 850K (목표: 950K) ⚠️ -11%
│  └─ Risk Score: 45/100 (낮음) ✅
│
├─ 렌즈별 성과 분해 (Lens Distribution)
│  ├─ L0 (부재중): 5명 | 전환율 15% | LTV 600K
│  ├─ L1 (가격이의): 12명 | 전환율 25% | LTV 800K
│  ├─ L2 (준비불안): 8명 | 전환율 35% | LTV 750K
│  ├─ L3 (차별성): 10명 | 전환율 30% | LTV 920K
│  ├─ L6 (시간감): 15명 | 전환율 40% | LTV 1000K
│  ├─ L7 (동반자): 6명 | 전환율 45% | LTV 1100K
│  └─ L10 (즉시): 4명 | 전환율 65% | LTV 1500K
│
├─ 채널별 성과 Matrix (CPA vs ROAS)
│  └─ 4사분면 분석 (High CPA/High ROAS vs Low CPA/Low ROAS)
│
├─ 위험도 대시보드 (Risk Scoring)
│  ├─ GREEN (위험도 < 30): 28명 ✅
│  ├─ YELLOW (30-60): 18명 ⚠️
│  └─ RED (> 60): 5명 ❌
│
└─ 세부 필터링
   ├─ 기간 필터 (어제/이주/이달/사용자정의)
   ├─ 렌즈 필터 (L0-L10, 다중선택)
   ├─ 채널 필터 (랜딩페이지별)
   └─ 담당자 필터 (담당자별)
```

---

## 🔄 구현 로드맵 (Phase 1-3)

### Phase 1: 기초 (1주)
- [ ] FormTemplate JSON 10가지 정의 (`src/lib/landing-form-templates.ts`)
- [ ] CTA 엔진 개발 (`src/lib/landing-cta-engine.ts`)
- [ ] DB 마이그레이션 (formTemplateId 추가)

### Phase 2: 자동화 (1주)
- [ ] SMS 시퀀스 템플릿 (Day 0-3) 구현
- [ ] 렌즈 감지 엔진 구현
- [ ] Register 라우트 통합 (CTA 실행)

### Phase 3: 추적 (1주)
- [ ] 메트릭 수집 및 저장
- [ ] 대시보드 UI (5계층)
- [ ] A/B 테스트 자동화

---

## 🧠 심리학 프레임워크 통합

### PASONA 매핑 (SMS Day 0-3)
```
Day 0: P(Problem) + A(Agitate)   — "지금이 기회다"
Day 1: S(Solution)               — "우리가 해결책이다"
Day 2: O(Offer) + N(Narrow)      — "이 가격, 이 시간뿐"
Day 3: A(Action)                 — "지금 행동하라"
```

### Grant Cardone 10가지 클로징 (VIP/L10)
1. Assumptive Close (당연한 것처럼)
2. Social Proof Close (사회증명)
3. Scarcity Close (희소성)
4. Loss Aversion Close (손실회피)
5. Authority Close (권위성)
6. Reciprocity Close (상호성)
7. Urgency Close (긴박감)
8. Companion Close (동반자 설득)
9. Consistency Close (일관성)
10. Anchoring Close (가격 앵커)

---

## 📊 예상 성과

| 메트릭 | 현재 | 목표 | 개선율 |
|--------|------|------|--------|
| 폼 제출 → 전환율 | 25% | 35-45% | +40-80% |
| CPA | 15,000원 | 10,000원 | -33% |
| LTV | 800K | 950K-1.1M | +18-38% |
| Day 0-3 SMS 오픈율 | 25% | 40% | +60% |
| 렌즈별 세그먼트 전환율 | N/A | L10: 65%, L8: 50% | N/A |
| 자동화 효율성 | 0% | 80% | +∞ |

---

## 🛠️ 기술 스택

- **ORM**: Prisma (JSON 스키마)
- **캐싱**: Redis (템플릿 캐싱)
- **메시징**: Aligo API (SMS 자동 발송)
- **분석**: BigQuery (메트릭 추적)
- **워크플로우**: Cron + Webhook (Day 0-3 자동화)

---

## 📝 참고 메모리 파일

- [[PASONA_framework_complete]]
- [[grant_cardone_10_closes]]
- [[sms_day0_3_sequence]]
- [[lens_detection_engine]]
- [[contact_group_assignment]]
- [[lead_score_calculation]]

