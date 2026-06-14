# Landing Pages 블록 시스템 구현 가이드 (2026-06-15)

## 📋 목차
1. [파일 구조](#파일-구조)
2. [Phase 1: 템플릿 정의](#phase-1-템플릿-정의)
3. [Phase 2: CTA 엔진](#phase-2-cta-엔진)
4. [Phase 3: SMS 자동화](#phase-3-sms-자동화)
5. [Phase 4: 렌즈 감지](#phase-4-렌즈-감지)
6. [Phase 5: 메트릭 추적](#phase-5-메트릭-추적)
7. [DB 마이그레이션](#db-마이그레이션)
8. [테스트 시나리오](#테스트-시나리오)

---

## 🗂️ 파일 구조

```
src/
├── lib/
│   ├── landing-form-templates.ts      ← 10가지 폼 템플릿 정의
│   ├── landing-cta-engine.ts          ← CTA 실행 엔진
│   ├── landing-sms-templates.ts       ← SMS 시퀀스 템플릿
│   ├── landing-lens-detector.ts       ← 렌즈 감지 엔진
│   ├── landing-metrics-collector.ts   ← 메트릭 수집
│   └── landing-psychology-mapper.ts   ← 심리학 매핑
│
├── app/
│   ├── api/
│   │   └── landing-pages/
│   │       └── [id]/
│   │           ├── register/route.ts (수정) ← CTA 실행 통합
│   │           └── metrics/route.ts   ← 메트릭 조회 API
│   │
│   └── (dashboard)/
│       └── landing-pages/
│           ├── [id]/
│           │   └── metrics/page.tsx   ← 메트릭 대시보드
│           └── templates/page.tsx     ← 템플릿 관리 UI
│
└── prisma/
    └── schema.prisma (수정)           ← formTemplateId 추가

docs/
├── LANDING_PAGES_BLOCK_SYSTEM_AUTOMATION.md  (완료 ✅)
└── LANDING_PAGES_BLOCK_IMPLEMENTATION_GUIDE.md (이 문서)
```

---

## 🔧 Phase 1: 템플릿 정의

### 파일: `src/lib/landing-form-templates.ts`

```typescript
/**
 * Landing Pages 폼 템플릿 라이브러리
 * 10가지 폼 타입 × 심리학 렌즈 × CTA → 자동화 시퀀스
 */

// ─────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────

export type FormFieldType =
  | "text"
  | "tel"
  | "email"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "date"
  | "textarea"
  | "hidden";

export type LensType =
  | "L0"  // 부재중/재활성
  | "L1"  // 가격이의
  | "L2"  // 준비불안
  | "L3"  // 차별성미인지
  | "L4"  // 멤버십저항
  | "L5"  // 적합성의문
  | "L6"  // 시간감/긴박감
  | "L7"  // 동반자설득
  | "L8"  // 재구매고객
  | "L9"  // 의료/안전
  | "L10"; // 즉시구매

export type PsychologyPrinciple =
  | "LOSS_AVERSION"
  | "SOCIAL_PROOF"
  | "SCARCITY"
  | "URGENCY"
  | "CONSISTENCY"
  | "AUTHORITY"
  | "RECIPROCITY"
  | "GROUPTHINK"
  | "STORYTELLING"
  | "SELF_PROJECTION";

export type SMSTemplate = {
  id: string;
  day: 0 | 1 | 2 | 3;
  content: string;
  psychologyPrinciples: PsychologyPrinciple[];
  lensTargets: LensType[];
  charCount: number;
};

export type FormField = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  validationPattern?: string;
  options?: Array<{
    value: string;
    label: string;
  }>;
  psychologyLens?: LensType;
  autoTagRules?: string[];
};

export type FormCTA = {
  id: string;
  label: string;
  buttonColor?: "primary" | "secondary" | "success" | "danger";
  actionType: "SEND_SMS" | "SCHEDULE_CALL" | "EMAIL" | "WEBHOOK" | "FUNNEL_START";
  
  // 자동 태그 규칙
  tagRules: {
    autoTag: string[];
    groupId?: string;
    funnelId?: string;
    smsSequenceId?: string;
  };
  
  // SMS 설정
  smsConfig?: {
    day0TemplateId: string;
    day1TemplateId: string;
    day2TemplateId: string;
    day3TemplateId: string;
    psychologyFramework: "PASONA" | "SPIN" | "GRANT_CARDONE";
  };
  
  // 콜백 설정
  callbackConfig?: {
    scheduleType: "IMMEDIATE" | "NEXT_DAY" | "NEXT_BUSINESS_DAY" | "CUSTOM";
    timeSlot?: string; // "10:00-12:00"
    scriptId?: string;
  };
  
  // Webhook 설정
  webhookConfig?: {
    url: string;
    method: "POST" | "PUT";
    payloadTemplate?: Record<string, any>;
  };
};

export type FormTemplate = {
  id: string;
  name: string;
  category:
    | "GENERAL"      // 일반 폼
    | "VIP"          // VIP 폼
    | "SURVEY"       // 설문 폼
    | "EVENT"        // 이벤트 폼
    | "BOOKING"      // 예약 폼
    | "INQUIRY"      // 문의 폼
    | "NEWSLETTER"   // 뉴스레터
    | "QUIZ"         // 퀴즈
    | "REFERRAL"     // 추천
    | "REVIEW";      // 리뷰

  description: string;
  
  // 필드 설정
  fields: FormField[];
  
  // CTA 버튼들
  ctas: FormCTA[];
  
  // 기본 메트릭 (벤치마크)
  benchmarks: {
    expectedConversionRate: number;     // 0-100 (%)
    expectedLTV: number;                // 원화
    expectedLeadScore: number;          // 0-100
    expectedRiskScore: number;          // 0-100
    expectedRepurchaseRate: number;     // 0-100 (%)
  };
  
  // SMS 시퀀스 설정
  smsConfig: {
    enabled: boolean;
    day0Delay: { value: number; unit: "minute" | "hour" };
    day1Delay: { value: number; unit: "hour" };
    day2Delay: { value: number; unit: "hour" };
    day3Delay: { value: number; unit: "hour" };
    psychologyFramework: "PASONA" | "SPIN" | "GRANT_CARDONE";
    urgencyType?: LensType; // L6 or L10
  };
  
  // 렌즈 자동 세그먼테이션
  autoSegmentation: {
    enabled: boolean;
    rules: Array<{
      fieldId: string;
      fieldValue?: string | string[]; // exact match or contains
      targetLens: LensType;
      autoGroupId?: string;
      autoTag: string[];
    }>;
  };
  
  // 생성/업데이트 시간
  createdAt?: Date;
  updatedAt?: Date;
};

// ─────────────────────────────────────
// 10가지 템플릿 정의
// ─────────────────────────────────────

export const FORM_TEMPLATES: Record<string, FormTemplate> = {
  GENERAL_FORM: {
    id: "GENERAL_FORM",
    name: "일반 폼",
    category: "GENERAL",
    description: "기본 신청 폼 (이름, 전화, 이메일)",
    
    fields: [
      {
        id: "name",
        label: "이름",
        type: "text",
        required: true,
        placeholder: "홍길동",
      },
      {
        id: "phone",
        label: "연락처",
        type: "tel",
        required: true,
        placeholder: "010-0000-0000",
        validationPattern: "^01[0-9]-\\d{3,4}-\\d{4}$",
      },
      {
        id: "email",
        label: "이메일",
        type: "email",
        required: false,
        placeholder: "example@domain.com",
      },
      {
        id: "destination",
        label: "관심지역",
        type: "select",
        required: true,
        options: [
          { value: "EUROPE", label: "유럽" },
          { value: "ASIA", label: "아시아" },
          { value: "AMERICA", label: "미주" },
          { value: "CARIBBEAN", label: "카리브해" },
        ],
        psychologyLens: "L3", // 차별성
        autoTagRules: ["destination_selected"],
      },
      {
        id: "departure_month",
        label: "출발 예정월",
        type: "select",
        required: true,
        options: Array.from({ length: 12 }, (_, i) => ({
          value: String(i + 1).padStart(2, "0"),
          label: `${i + 1}월`,
        })),
        psychologyLens: "L6", // 시간감
        autoTagRules: ["month_selected"],
      },
    ],
    
    ctas: [
      {
        id: "inquiry_cruise",
        label: "상품 문의하기",
        buttonColor: "primary",
        actionType: "SEND_SMS",
        tagRules: {
          autoTag: ["크루즈관심", "일반신청"],
          groupId: "GRP_GENERAL", // 자동 배정 그룹
          smsSequenceId: "SMS_GENERAL_PASONA",
        },
        smsConfig: {
          day0TemplateId: "SMS_GENERAL_D0",
          day1TemplateId: "SMS_GENERAL_D1",
          day2TemplateId: "SMS_GENERAL_D2",
          day3TemplateId: "SMS_GENERAL_D3",
          psychologyFramework: "PASONA",
        },
      },
    ],
    
    benchmarks: {
      expectedConversionRate: 25,
      expectedLTV: 800000,
      expectedLeadScore: 40,
      expectedRiskScore: 50,
      expectedRepurchaseRate: 30,
    },
    
    smsConfig: {
      enabled: true,
      day0Delay: { value: 5, unit: "minute" },
      day1Delay: { value: 24, unit: "hour" },
      day2Delay: { value: 48, unit: "hour" },
      day3Delay: { value: 72, unit: "hour" },
      psychologyFramework: "PASONA",
      urgencyType: "L6",
    },
    
    autoSegmentation: {
      enabled: true,
      rules: [
        {
          fieldId: "destination",
          fieldValue: "EUROPE",
          targetLens: "L3",
          autoTag: ["유럽관심"],
        },
        {
          fieldId: "departure_month",
          fieldValue: ["06", "07", "08"],
          targetLens: "L6",
          autoTag: ["성수기"],
        },
      ],
    },
  },
  
  VIP_FORM: {
    id: "VIP_FORM",
    name: "VIP 폼",
    category: "VIP",
    description: "VIP 고객 전용 폼 (소비자, 의료진, CEO)",
    
    fields: [
      {
        id: "name",
        label: "이름",
        type: "text",
        required: true,
      },
      {
        id: "phone",
        label: "연락처",
        type: "tel",
        required: true,
        validationPattern: "^01[0-9]-\\d{3,4}-\\d{4}$",
      },
      {
        id: "email",
        label: "이메일",
        type: "email",
        required: true,
      },
      {
        id: "occupation",
        label: "직업",
        type: "select",
        required: true,
        options: [
          { value: "CEO", label: "CEO/경영진" },
          { value: "DOCTOR", label: "의료진" },
          { value: "EXECUTIVE", label: "임원진" },
          { value: "PROFESSIONAL", label: "전문직" },
          { value: "BUSINESS", label: "사업가" },
        ],
        psychologyLens: "L10", // 즉시구매
      },
      {
        id: "annual_income",
        label: "연간 여행 예산",
        type: "select",
        required: true,
        options: [
          { value: "5M_UP", label: "5,000만원 이상" },
          { value: "3M_5M", label: "3,000-5,000만원" },
          { value: "1M_3M", label: "1,000-3,000만원" },
        ],
        psychologyLens: "L10",
        autoTagRules: ["high_budget"],
      },
    ],
    
    ctas: [
      {
        id: "vip_consultation",
        label: "VIP 전용 상담신청",
        buttonColor: "success",
        actionType: "SCHEDULE_CALL",
        tagRules: {
          autoTag: ["VIP", "고예산고객"],
          groupId: "GRP_VIP",
          smsSequenceId: "SMS_VIP_GRANT_CARDONE",
        },
        smsConfig: {
          day0TemplateId: "SMS_VIP_D0",
          day1TemplateId: "SMS_VIP_D1",
          day2TemplateId: "SMS_VIP_D2",
          day3TemplateId: "SMS_VIP_D3",
          psychologyFramework: "GRANT_CARDONE",
        },
        callbackConfig: {
          scheduleType: "NEXT_DAY",
          timeSlot: "10:00-12:00",
          scriptId: "SCRIPT_VIP_CONSULTATION",
        },
      },
    ],
    
    benchmarks: {
      expectedConversionRate: 60,
      expectedLTV: 1500000,
      expectedLeadScore: 85,
      expectedRiskScore: 20,
      expectedRepurchaseRate: 70,
    },
    
    smsConfig: {
      enabled: true,
      day0Delay: { value: 2, unit: "minute" },
      day1Delay: { value: 24, unit: "hour" },
      day2Delay: { value: 48, unit: "hour" },
      day3Delay: { value: 72, unit: "hour" },
      psychologyFramework: "GRANT_CARDONE",
      urgencyType: "L10",
    },
    
    autoSegmentation: {
      enabled: true,
      rules: [
        {
          fieldId: "annual_income",
          fieldValue: "5M_UP",
          targetLens: "L10",
          autoTag: ["최고예산"],
        },
        {
          fieldId: "occupation",
          fieldValue: ["CEO", "DOCTOR"],
          targetLens: "L10",
          autoTag: ["의사결정권자"],
        },
      ],
    },
  },
  
  // 나머지 8가지 템플릿 (SURVEY_FORM, EVENT_FORM, BOOKING_FORM, INQUIRY_FORM, NEWSLETTER_FORM, QUIZ_FORM, REFERRAL_FORM, REVIEW_FORM)
  // ... (유사한 구조로 정의)
};

// ─────────────────────────────────────
// 유틸리티 함수
// ─────────────────────────────────────

export function getFormTemplate(templateId: string): FormTemplate | null {
  return FORM_TEMPLATES[templateId] || null;
}

export function getAllTemplates(): FormTemplate[] {
  return Object.values(FORM_TEMPLATES);
}

export function getTemplatesByCategory(
  category: FormTemplate["category"]
): FormTemplate[] {
  return Object.values(FORM_TEMPLATES).filter((t) => t.category === category);
}

export function getTemplateMetrics(templateId: string) {
  const template = getFormTemplate(templateId);
  return template?.benchmarks || null;
}
```

---

## 🎬 Phase 2: CTA 엔진

### 파일: `src/lib/landing-cta-engine.ts`

```typescript
/**
 * CTA 엔진: 폼 제출 + CTA 선택 → 자동 CRM 액션
 * - 자동 태그 적용
 * - 그룹 자동 배정
 * - SMS 시퀀스 시작
 * - 렌즈 감지 + 분류
 */

import prisma from "@/lib/prisma";
import { Contact } from "@prisma/client";

export type CTAExecutionInput = {
  formTemplateId: string;
  ctaId: string;
  registrationId: string;
  contactId: string;
  customFields: Record<string, any>;
  metadata: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    formFilledTimeMs: number;
    userAgent?: string;
  };
};

export type CTAExecutionResult = {
  ok: boolean;
  message?: string;
  actions: {
    tagsApplied: string[];
    groupAssigned?: { groupId: string; groupName: string };
    smsScheduled: number;
    lensDetected?: { lens: string; confidence: number };
    leadScoreIncrement: number;
  };
};

export async function executeCTA(
  input: CTAExecutionInput
): Promise<CTAExecutionResult> {
  try {
    // 1. CTA 정의 로드
    const ctaConfig = getCTAConfig(input.formTemplateId, input.ctaId);
    if (!ctaConfig) {
      return {
        ok: false,
        message: `CTA 설정을 찾을 수 없습니다: ${input.ctaId}`,
        actions: {
          tagsApplied: [],
          smsScheduled: 0,
          leadScoreIncrement: 0,
        },
      };
    }

    // 2. Contact 조회
    const contact = await prisma.contact.findUnique({
      where: { id: input.contactId },
    });

    if (!contact) {
      return {
        ok: false,
        message: "연락처를 찾을 수 없습니다",
        actions: {
          tagsApplied: [],
          smsScheduled: 0,
          leadScoreIncrement: 0,
        },
      };
    }

    // 3. 자동 태그 적용
    const tagsToApply = ctaConfig.tagRules.autoTag || [];
    const currentTags = contact.tags || [];
    const newTags = [...new Set([...currentTags, ...tagsToApply])];

    // 4. 그룹 자동 배정
    let groupAssigned: { groupId: string; groupName: string } | undefined;
    if (ctaConfig.tagRules.groupId) {
      const group = await prisma.contactGroup.findUnique({
        where: { id: ctaConfig.tagRules.groupId },
      });

      if (group) {
        // 그룹 멤버 추가
        await prisma.contactGroupMember.upsert({
          where: {
            groupId_contactId: {
              groupId: ctaConfig.tagRules.groupId,
              contactId: input.contactId,
            },
          },
          update: {},
          create: {
            groupId: ctaConfig.tagRules.groupId,
            contactId: input.contactId,
          },
        });

        groupAssigned = {
          groupId: group.id,
          groupName: group.name,
        };
      }
    }

    // 5. SMS 시퀀스 스케줄
    let smsScheduledCount = 0;
    if (ctaConfig.smsConfig) {
      smsScheduledCount = await scheduleSmsSequence({
        contactId: input.contactId,
        ctaConfig,
      });
    }

    // 6. 렌즈 감지 및 자동 분류
    const lensDetection = await detectAndClassifyLens(
      input.contactId,
      input.formTemplateId,
      input.customFields
    );

    // 7. Lead Score 계산
    const leadScoreIncrement = calculateLeadScoreIncrement(
      input.formTemplateId,
      input.customFields
    );

    // 8. Contact 업데이트
    await prisma.contact.update({
      where: { id: input.contactId },
      data: {
        tags: newTags,
        leadScore: {
          increment: leadScoreIncrement,
        },
        sourceType: "LANDING_PAGE",
        sourceId: input.formTemplateId,
      },
    });

    return {
      ok: true,
      actions: {
        tagsApplied: tagsToApply,
        groupAssigned,
        smsScheduled: smsScheduledCount,
        lensDetected: lensDetection,
        leadScoreIncrement,
      },
    };
  } catch (error) {
    console.error("[CTA Engine] Error:", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown error",
      actions: {
        tagsApplied: [],
        smsScheduled: 0,
        leadScoreIncrement: 0,
      },
    };
  }
}

function getCTAConfig(formTemplateId: string, ctaId: string) {
  const { FORM_TEMPLATES } = require("./landing-form-templates");
  const template = FORM_TEMPLATES[formTemplateId];
  return template?.ctas?.find((cta: any) => cta.id === ctaId);
}

async function scheduleSmsSequence(input: {
  contactId: string;
  ctaConfig: any;
}): Promise<number> {
  // SMS 시퀀스 스케줄링 (Day 0-3)
  // → src/lib/landing-sms-templates.ts에서 구현
  return 4; // Day 0, 1, 2, 3 = 4개 SMS
}

async function detectAndClassifyLens(
  contactId: string,
  formTemplateId: string,
  customFields: Record<string, any>
): Promise<{ lens: string; confidence: number } | undefined> {
  // 렌즈 감지 엔진 호출
  // → src/lib/landing-lens-detector.ts에서 구현
  return undefined;
}

function calculateLeadScoreIncrement(
  formTemplateId: string,
  customFields: Record<string, any>
): number {
  // Lead Score 계산
  let score = 10; // 기본 폼 제출: +10

  // 필드 채움도에 따른 가산
  const filledFieldCount = Object.values(customFields).filter(
    (v) => v !== null && v !== undefined && v !== ""
  ).length;
  score += filledFieldCount * 5;

  // 템플릿별 추가 점수
  if (formTemplateId === "VIP_FORM") score += 30;
  if (formTemplateId === "QUIZ_FORM") score += 15;

  return Math.min(score, 50); // 최대 +50
}
```

---

## 📧 Phase 3: SMS 자동화

### 파일: `src/lib/landing-sms-templates.ts`

```typescript
/**
 * Landing Pages SMS 템플릿 (Day 0-3)
 * PASONA 프레임워크 + Grant Cardone 클로징
 */

export type SMSSequenceConfig = {
  templateId: string;
  day: 0 | 1 | 2 | 3;
  delay: { value: number; unit: "minute" | "hour" };
  content: string;
  psychologyPrinciples: string[];
  lensTargets: string[];
};

// 일반 폼 → PASONA
export const SMS_GENERAL_PASONA: SMSSequenceConfig[] = [
  {
    templateId: "SMS_GENERAL_D0",
    day: 0,
    delay: { value: 5, unit: "minute" },
    content: `[문제] 크루즈 여행 계획 중에 가격이 걱정되세요?
[자극] 🎉 지금 신청하면 20% 추가 할인!
오늘 신청한 분들만 가능합니다.

→ 클릭해서 확인하세요: {{shortLink}}`,
    psychologyPrinciples: [
      "LOSS_AVERSION",
      "SCARCITY",
      "URGENCY",
    ],
    lensTargets: ["L6", "L1"],
  },
  {
    templateId: "SMS_GENERAL_D1",
    day: 1,
    delay: { value: 24, unit: "hour" },
    content: `[해결책] {{name}}님을 위해 준비했습니다!

유럽 크루즈 완벽 준비 가이드 PDF
→ 패킹 리스트, 필수 서류, 취소 정책까지

→ 무료 다운로드: {{shortLink}}`,
    psychologyPrinciples: [
      "RECIPROCITY",
      "SELF_PROJECTION",
    ],
    lensTargets: ["L2"],
  },
  {
    templateId: "SMS_GENERAL_D2",
    day: 2,
    delay: { value: 48, unit: "hour" },
    content: `[오퍼] 🎁 선착순 50명 특전!

✓ 공항 픽업 무료 (100만원 상당)
✓ 객실 업그레이드 (1단계)
✓ 온보드 크레딧 +50만원

현재 예약자: 37명/50명 (남은 자리 13석)

→ 지금 바로 신청: {{shortLink}}`,
    psychologyPrinciples: [
      "SOCIAL_PROOF",
      "SCARCITY",
    ],
    lensTargets: ["L6", "L8"],
  },
  {
    templateId: "SMS_GENERAL_D3",
    day: 3,
    delay: { value: 72, unit: "hour" },
    content: `[행동] {{name}}님, 이제 결정하셔야 합니다!

⏰ 지금 신청해야 하는 3가지 이유:
1️⃣ 내일부터 가격 10% 인상
2️⃣ 배치 조기마감 위험 (선착순 13명만 남음)
3️⃣ 정가격 고객은 특전 불가

→ 지금 예약 확정하기: {{shortLink}}

망설이고 계신가요? 
전문가와 무료 상담: {{consultLink}}`,
    psychologyPrinciples: [
      "URGENCY",
      "LOSS_AVERSION",
      "SCARCITY",
    ],
    lensTargets: ["L6", "L10"],
  },
];

// VIP 폼 → Grant Cardone
export const SMS_VIP_GRANT_CARDONE: SMSSequenceConfig[] = [
  {
    templateId: "SMS_VIP_D0",
    day: 0,
    delay: { value: 2, unit: "minute" },
    content: `VIP 고객 {{name}}님께만 제한 공개합니다.

🏆 프리미엘 크루즈 스위트 패키지
→ 72시간만 가능합니다

귀사의 위상에 맞춘 7가지 VIP 특전:
• 스위트 객실 (자동 업그레이드)
• 개인 콘시어주 24시간
• VIP 디너 초대 (캡틴 테이블)
• 무제한 스파 크레딧
• 공항 라운지 프리 패스
• 귀국 수하물 무료 배송
• 다음 여행 10% 할인 (평생)

→ VIP 패키지 확인: {{vipLink}}`,
    psychologyPrinciples: [
      "AUTHORITY",
      "SCARCITY",
      "EXCLUSIVITY",
    ],
    lensTargets: ["L10"],
  },
  {
    templateId: "SMS_VIP_D1",
    day: 1,
    delay: { value: 24, unit: "hour" },
    content: `{{name}}님, 소식이 있습니다.

지난주 VIP 고객 3분이 이미 예약했습니다:
✓ 한**님 (서울, 소비재 업 CEO)
✓ 이**님 (대구, 의료기관장)  
✓ 김**님 (부산, 건설업 대표)

당신도 그들과 같은 배를 탈 준비가 되셨나요?

→ VIP 공동 예약 확인: {{vipLink}}`,
    psychologyPrinciples: [
      "SOCIAL_PROOF",
      "AUTHORITY",
    ],
    lensTargets: ["L10", "L8"],
  },
  {
    templateId: "SMS_VIP_D2",
    day: 2,
    delay: { value: 48, unit: "hour" },
    content: `{{name}}님 주목!

프리미엄 스위트 패키지:
남은 자리 2석뿐입니다.

🚢 지난달 VIP 패키지는 24시간 만에 매진됐습니다.

당신의 자리를 예약하시겠습니까?

→ 지금 확인: {{vipLink}}

자리가 없으면 다음달(8월)로 미뤄집니다.`,
    psychologyPrinciples: [
      "SCARCITY",
      "LOSS_AVERSION",
    ],
    lensTargets: ["L6", "L10"],
  },
  {
    templateId: "SMS_VIP_D3",
    day: 3,
    delay: { value: 72, unit: "hour" },
    content: `{{name}}님께 마지막 안내입니다.

지금 예약하지 않으면 다음이 발생합니다:

⚠️ 자리가 없어질 수 있습니다 (60% 확률)
⚠️ 다음달로 미뤄지면 동반자들이 먼저 예약할 수 있음
⚠️ 이달 특전(추가 할인)은 받을 수 없습니다

→ [VIP 최종 예약 확정]

우려사항이 있으신가요?
전담 VIP 매니저와 통화: {{consultLink}}`,
    psychologyPrinciples: [
      "LOSS_AVERSION",
      "URGENCY",
      "SCARCITY",
    ],
    lensTargets: ["L10"],
  },
];

// ... 나머지 8가지 SMS 시퀀스 (SURVEY, EVENT, BOOKING, INQUIRY, NEWSLETTER, QUIZ, REFERRAL, REVIEW)
```

---

## 🧠 Phase 4: 렌즈 감지

### 파일: `src/lib/landing-lens-detector.ts`

```typescript
/**
 * 랜딩페이지 폼 응답 → 렌즈 L0-L10 자동 감지
 * Grant Cardone 10렌즈 프레임워크 적용
 */

export type LensDetectionInput = {
  formTemplateId: string;
  customFields: Record<string, any>;
  metadata: {
    utmSource?: string;
    formFilledTimeMs: number;
  };
};

export type LensDetectionOutput = {
  primaryLens: string;      // "L0" ~ "L10"
  confidenceScore: number;  // 0-100
  secondaryLenses: string[];
  autoTagRules: string[];
  suggestedGroupId?: string;
  followUpStrategy: "PASONA" | "SPIN" | "GRANT_CARDONE";
};

const LENS_DETECTION_RULES: Record<string, any> = {
  L0: {
    name: "부재중/재활성",
    signals: [
      { field: "previous_purchase", match: true },
      { field: "days_since_last_contact", match: "> 365" },
      { field: "status", match: "INACTIVE" },
    ],
    actionTags: ["재활성고객", "재참여필요"],
    expectedConversionRate: 15,
  },
  
  L1: {
    name: "가격이의",
    signals: [
      { field: "annual_income", match: ["<30M", "<50M"] },
      { field: "inquiry_type", match: "PRICE" },
      { field: "custom_message", keyword: ["저가", "할인", "세일", "저렴"] },
    ],
    actionTags: ["가격민감", "할인효과"],
    expectedConversionRate: 25,
  },
  
  L2: {
    name: "준비불안",
    signals: [
      { field: "travel_experience", match: "FIRST_TIME" },
      { field: "destination", match: "OVERSEAS" },
      { field: "inquiry_type", match: ["PREPARATION", "PACKING", "DOCUMENT"] },
    ],
    actionTags: ["준비불안", "가이드필요"],
    expectedConversionRate: 35,
  },
  
  L3: {
    name: "차별성미인지",
    signals: [
      { field: "competitor_research", match: true },
      { field: "inquiry_count", match: "> 3" },
      { field: "destination_selected", match: "POPULAR" },
    ],
    actionTags: ["차별성강조"],
    expectedConversionRate: 30,
  },
  
  L6: {
    name: "시간감/긴박감",
    signals: [
      { field: "departure_date", match: "< 60 days" },
      { field: "season", match: ["HIGH", "PEAK"] },
      { field: "inquiry_urgency", match: "HIGH" },
    ],
    actionTags: ["시간제한", "성수기", "긴박감"],
    expectedConversionRate: 40,
  },
  
  L7: {
    name: "동반자설득",
    signals: [
      { field: "group_size", match: ">= 2" },
      { field: "decision_factor", match: "FAMILY" },
      { field: "hesitation_signal", match: true },
    ],
    actionTags: ["동반자설득"],
    expectedConversionRate: 45,
  },
  
  L8: {
    name: "재구매고객",
    signals: [
      { field: "previous_purchase", match: true },
      { field: "frequency", match: ">= 2" },
      { field: "brand_loyalty", match: "HIGH" },
    ],
    actionTags: ["재구매고객", "VIP", "로열티"],
    expectedConversionRate: 50,
  },
  
  L10: {
    name: "즉시구매",
    signals: [
      { field: "annual_income", match: ">= 50M" },
      { field: "decision_maker", match: true },
      { field: "urgency_level", match: "CRITICAL" },
      { field: "occupation", match: ["CEO", "EXECUTIVE", "DOCTOR"] },
    ],
    actionTags: ["즉시구매대상", "VIP", "의사결정권자"],
    expectedConversionRate: 65,
  },
};

export async function detectLensFromFormResponse(
  input: LensDetectionInput
): Promise<LensDetectionOutput> {
  const matchedLenses: Array<{
    lens: string;
    confidence: number;
    tags: string[];
  }> = [];

  // 각 렌즈 규칙에 대해 신호 매칭
  for (const [lensType, config] of Object.entries(LENS_DETECTION_RULES)) {
    let matchCount = 0;
    const signals = config.signals || [];

    for (const signal of signals) {
      if (matchSignal(input.customFields, signal)) {
        matchCount++;
      }
    }

    // 신호 매칭도 기반 렌즈 점수 계산
    if (matchCount >= 2) {
      const confidence = Math.min(100, matchCount * 35);
      matchedLenses.push({
        lens: lensType,
        confidence,
        tags: config.actionTags || [],
      });
    }
  }

  // 신뢰도 기반 정렬
  matchedLenses.sort((a, b) => b.confidence - a.confidence);

  const primaryLens = matchedLenses[0] || { lens: "L3", confidence: 50, tags: [] };
  const secondaryLenses = matchedLenses.slice(1, 3).map((l) => l.lens);
  const allTags = [...new Set(matchedLenses.flatMap((l) => l.tags))];

  return {
    primaryLens: primaryLens.lens,
    confidenceScore: primaryLens.confidence,
    secondaryLenses,
    autoTagRules: allTags,
    suggestedGroupId: getLensGroupMapping(primaryLens.lens),
    followUpStrategy: getFollowUpStrategy(primaryLens.lens),
  };
}

function matchSignal(
  customFields: Record<string, any>,
  signal: any
): boolean {
  const fieldValue = customFields[signal.field];

  if (signal.match === true) {
    return fieldValue === true || fieldValue !== null;
  }

  if (Array.isArray(signal.match)) {
    return signal.match.includes(fieldValue);
  }

  if (typeof signal.match === "string") {
    if (signal.match.startsWith(">")) {
      const threshold = parseInt(signal.match.substring(1));
      return fieldValue > threshold;
    }
    if (signal.match.startsWith("<")) {
      const threshold = parseInt(signal.match.substring(1));
      return fieldValue < threshold;
    }
  }

  if (signal.keyword) {
    const message = String(fieldValue || "").toLowerCase();
    return signal.keyword.some((kw: string) => message.includes(kw));
  }

  return fieldValue === signal.match;
}

function getLensGroupMapping(lens: string): string {
  const mapping: Record<string, string> = {
    L0: "GRP_REACTIVATION",
    L1: "GRP_PRICE_SENSITIVE",
    L2: "GRP_PREPARATION_ANXIETY",
    L3: "GRP_DIFFERENTIATION",
    L6: "GRP_TIME_URGENCY",
    L7: "GRP_COMPANION_PERSUASION",
    L8: "GRP_REPEAT_CUSTOMER",
    L10: "GRP_VIP_IMMEDIATE",
  };
  return mapping[lens] || "GRP_DEFAULT";
}

function getFollowUpStrategy(lens: string):
  | "PASONA"
  | "SPIN"
  | "GRANT_CARDONE" {
  const strategyMap: Record<string, "PASONA" | "SPIN" | "GRANT_CARDONE"> = {
    L0: "SPIN",      // 상황/문제 기반 질문
    L1: "PASONA",    // 가격 문제 해결
    L2: "SPIN",      // 준비 불안 해소
    L3: "PASONA",    // 차별성 강조
    L6: "GRANT_CARDONE", // 긴박감 + 클로징
    L7: "PASONA",    // 동반자 설득
    L8: "PASONA",    // 재구매 강화
    L10: "GRANT_CARDONE", // 즉시 클로징
  };
  return strategyMap[lens] || "PASONA";
}
```

---

## 📊 Phase 5: 메트릭 추적

### 파일: `src/lib/landing-metrics-collector.ts`

```typescript
/**
 * Landing Pages 메트릭 수집 및 분석
 * - 폼 제출 → 전환율 추적
 * - SMS Day 0-3 추적
 * - 렌즈별 성과 분석
 * - LTV 계산
 */

import prisma from "@/lib/prisma";

export interface FormMetricsSnapshot {
  formTemplateId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  // 기본 통계
  totalSubmissions: number;
  uniqueContacts: number;
  
  // 렌즈 분포
  lensDist: Record<string, number>;
  
  // Day 0-3 SMS 추적
  smsMetrics: {
    day0: { sent: number; clicked: number; converted: number };
    day1: { sent: number; clicked: number; converted: number };
    day2: { sent: number; clicked: number; converted: number };
    day3: { sent: number; clicked: number; converted: number };
  };
  
  // 전환 메트릭
  conversionMetrics: {
    formToContact: number;     // %
    contactToLead: number;     // %
    leadToCustomer: number;    // %
    totalConversionRate: number; // %
  };
  
  // 비용 메트릭
  costMetrics: {
    totalCostPerForm: number;
    cpaPerLead: number;
    cpaPerCustomer: number;
    roi: number; // %
  };
  
  // LTV 메트릭
  ltv: {
    avgFirstPurchase: number;
    repurchaseRate: number;    // %
    avgLifetime: number;       // 개월
    totalLTV: number;
  };
  
  // Risk Score
  riskMetrics: {
    avgRiskScore: number;      // 0-100
    churnRiskCount: number;
    reactivationNeeded: number;
  };
}

export async function collectFormMetrics(
  formTemplateId: string,
  startDate: Date,
  endDate: Date
): Promise<FormMetricsSnapshot> {
  // 1. 폼 제출 통계
  const registrations = await prisma.crmLandingRegistration.findMany({
    where: {
      landingPageId: formTemplateId,
      registeredAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const totalSubmissions = registrations.length;
  const uniqueContacts = new Set(registrations.map((r) => r.phone)).size;

  // 2. 렌즈 분포
  const lensClassifications = await prisma.contactLensClassification.findMany({
    where: {
      identifiedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const lensDist: Record<string, number> = {};
  for (const lens of ["L0", "L1", "L2", "L3", "L6", "L7", "L8", "L10"]) {
    lensDist[lens] = lensClassifications.filter(
      (lc) => lc.lensType === lens
    ).length;
  }

  // 3. SMS Day 0-3 추적 (ContactLensSequence)
  const sequences = await prisma.contactLensSequence.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const smsMetrics = {
    day0: {
      sent: sequences.filter((s) => s.day0Sent).length,
      clicked: sequences.filter((s) => s.day0Clicked).length,
      converted: sequences.filter((s) => s.day0ConvertedAt).length,
    },
    day1: {
      sent: sequences.filter((s) => s.day1Sent).length,
      clicked: sequences.filter((s) => s.day1Clicked).length,
      converted: sequences.filter((s) => s.day1ConvertedAt).length,
    },
    day2: {
      sent: sequences.filter((s) => s.day2Sent).length,
      clicked: sequences.filter((s) => s.day2Clicked).length,
      converted: sequences.filter((s) => s.day2ConvertedAt).length,
    },
    day3: {
      sent: sequences.filter((s) => s.day3Sent).length,
      clicked: sequences.filter((s) => s.day3Clicked).length,
      converted: sequences.filter((s) => s.day3ConvertedAt).length,
    },
  };

  // 4. 전환율 계산
  const converted = sequences.filter(
    (s) =>
      s.day0ConvertedAt ||
      s.day1ConvertedAt ||
      s.day2ConvertedAt ||
      s.day3ConvertedAt
  ).length;

  const conversionMetrics = {
    formToContact: uniqueContacts > 0 ? (uniqueContacts / totalSubmissions) * 100 : 0,
    contactToLead: uniqueContacts > 0 ? (sequences.length / uniqueContacts) * 100 : 0,
    leadToCustomer: sequences.length > 0 ? (converted / sequences.length) * 100 : 0,
    totalConversionRate: totalSubmissions > 0 ? (converted / totalSubmissions) * 100 : 0,
  };

  // 5. 비용 메트릭 (예시)
  const costMetrics = {
    totalCostPerForm: 5000, // 광고+SMS 비용
    cpaPerLead: 12500,
    cpaPerCustomer: 50000,
    roi: conversionMetrics.totalConversionRate > 0 ? 120 : 0,
  };

  // 6. LTV 계산
  const ltv = {
    avgFirstPurchase: 800000,
    repurchaseRate: 30,
    avgLifetime: 24,
    totalLTV: 950000,
  };

  // 7. Risk Score
  const riskMetrics = {
    avgRiskScore: 45,
    churnRiskCount: 10,
    reactivationNeeded: 5,
  };

  return {
    formTemplateId,
    period: { startDate, endDate },
    totalSubmissions,
    uniqueContacts,
    lensDist,
    smsMetrics,
    conversionMetrics,
    costMetrics,
    ltv,
    riskMetrics,
  };
}
```

---

## 🗄️ DB 마이그레이션

### prisma/schema.prisma (수정 사항)

```prisma
model CrmLandingPage {
  id                    String    @id @default(cuid())
  organizationId        String
  title                 String
  slug                  String
  
  // ← 추가: 폼 템플릿 ID
  formTemplateId        String?   // "GENERAL_FORM", "VIP_FORM", "SURVEY_FORM", ...
  
  // ... 기존 필드들
  
  registrations         CrmLandingRegistration[]
  
  @@unique([slug, organizationId])
  @@index([formTemplateId]) // 성능 최적화
}

model CrmLandingRegistration {
  id                String   @id @default(cuid())
  landingPageId     String
  
  // ← 추가: CTA 매핑
  ctaId             String?  // "inquiry_cruise", "vip_consultation", ...
  
  // ← 추가: 렌즈 감지 결과
  detectedLens      String?  // "L3", "L6", "L10"
  lensConfidence    Int      @default(0) // 0-100
  
  // ... 기존 필드들
  
  @@index([landingPageId, detectedLens])
}
```

---

## ✅ 테스트 시나리오

### 테스트 1: 일반 폼 제출 → PASONA SMS
```
1. 사용자가 GENERAL_FORM 작성 (이름, 전화, 목적지=유럽, 출발월=7월)
2. "상품 문의하기" CTA 클릭
3. 기대 결과:
   ✓ Contact 생성 (tag: ["크루즈관심", "7월출발"])
   ✓ GroupId = "GRP_GENERAL" 배정
   ✓ Lens 감지 = L3(차별성) + L6(시간감)
   ✓ SMS Day 0-3 스케줄 (PASONA)
   ✓ Lead Score +20
```

### 테스트 2: VIP 폼 제출 → Grant Cardone 클로징
```
1. 사용자가 VIP_FORM 작성 (직업=CEO, 예산=5000만원 이상)
2. "VIP 전용 상담신청" CTA 클릭
3. 기대 결과:
   ✓ Contact 생성 (tag: ["VIP", "고예산고객"])
   ✓ GroupId = "GRP_VIP" 배정
   ✓ Lens 감지 = L10(즉시구매) + L7(동반)
   ✓ SMS Day 0-3 스케줄 (Grant Cardone)
   ✓ 콜백 예약 (Day 1, 10:00)
   ✓ Lead Score +50
```

### 테스트 3: 메트릭 조회
```
1. API: GET /api/landing-pages/[id]/metrics?period=1month
2. 기대 결과:
   ✓ 폼 제출 수: 150
   ✓ 렌즈 분포: L10(20), L8(15), L6(50), ...
   ✓ SMS 오픈율: 40%
   ✓ 전환율: 28%
   ✓ CPA: 12,500원
   ✓ LTV: 850K
```

---

## 📝 다음 단계

1. **Phase 1 구현** (3-5일)
   - 10가지 폼 템플릿 JSON 정의
   - DB 마이그레이션 (formTemplateId)
   
2. **Phase 2 구현** (2-3일)
   - CTA 엔진 개발
   - Register 라우트 통합

3. **Phase 3 구현** (2-3일)
   - SMS 시퀀스 자동화
   - Cron 작업 설정

4. **Phase 4 구현** (2-3일)
   - 렌즈 감지 엔진
   - ContactLensClassification 자동 생성

5. **Phase 5 구현** (2-3일)
   - 메트릭 수집
   - 대시보드 UI

6. **테스트 & 배포** (2-3일)
   - 통합 테스트
   - 성과 검증
   - Vercel 배포

**예상 총 소요 기간**: 2-3주 (병렬 에이전트 3-4명)

