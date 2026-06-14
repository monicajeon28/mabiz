# Landing Pages 블록 시스템 파일 맵 (2026-06-15)

## 📂 전체 파일 구조

```
D:\mabiz-crm\
│
├── src/
│   ├── lib/
│   │   ├── landing-form-templates.ts          ← [생성] 10가지 폼 템플릿 (850줄)
│   │   ├── landing-cta-engine.ts              ← [생성] CTA 실행 엔진 (300줄)
│   │   ├── landing-sms-templates.ts           ← [생성] SMS Day 0-3 템플릿 (400줄)
│   │   ├── landing-lens-detector.ts           ← [생성] 렌즈 감지 (350줄)
│   │   ├── landing-metrics-collector.ts       ← [생성] 메트릭 수집 (400줄)
│   │   ├── landing-psychology-mapper.ts       ← [생성] 심리학 매핑 (200줄)
│   │   │
│   │   ├── prisma.ts (기존)
│   │   ├── funnel-trigger.ts (기존)
│   │   ├── funnel-sms-trigger.ts (기존)
│   │   ├── lead-score.ts (기존 수정)          ← calculateLeadScoreIncrement() 추가
│   │   └── logger.ts (기존)
│   │
│   ├── app/
│   │   ├── api/
│   │   │   └── landing-pages/
│   │   │       └── [id]/
│   │   │           ├── register/
│   │   │           │   └── route.ts           ← [수정] CTA 실행 통합
│   │   │           │
│   │   │           ├── metrics/
│   │   │           │   └── route.ts           ← [생성] 메트릭 조회 API
│   │   │           │
│   │   │           ├── sms-trigger/route.ts (기존)
│   │   │           └── ... (기존 라우트들)
│   │   │
│   │   └── (dashboard)/
│   │       └── landing-pages/
│   │           ├── new/page.tsx (기존)
│   │           ├── [id]/
│   │           │   ├── page.tsx (기존)
│   │           │   │
│   │           │   └── metrics/
│   │           │       └── page.tsx           ← [생성] 메트릭 대시보드 (800줄)
│   │           │
│   │           └── templates/
│   │               └── page.tsx               ← [생성] 템플릿 관리 UI (600줄)
│   │
│   └── components/
│       └── landing-pages/
│           ├── FormTemplateSelector.tsx      ← [생성] 템플릿 선택 UI
│           ├── FormBuilder.tsx               ← [수정] formTemplateId 연동
│           ├── MetricsDashboard.tsx          ← [생성] 5계층 메트릭
│           ├── LensDistribution.tsx          ← [생성] 렌즈별 분석 차트
│           └── RiskScoreboard.tsx            ← [생성] 위험도 대시보드
│
├── prisma/
│   ├── schema.prisma                         ← [수정] formTemplateId, ctaId 추가
│   └── migrations/
│       └── [DATE]_add_form_template_fields/
│           └── migration.sql                 ← [생성] DB 마이그레이션
│
├── public/
│   └── landing-pages/
│       └── templates/
│           ├── GENERAL_FORM.json            ← [생성] 템플릿 JSON (시드)
│           ├── VIP_FORM.json
│           ├── SURVEY_FORM.json
│           └── ... (8가지 추가)
│
└── docs/
    ├── LANDING_PAGES_BLOCK_SYSTEM_AUTOMATION.md          ✅ (22.4KB)
    ├── LANDING_PAGES_BLOCK_IMPLEMENTATION_GUIDE.md       ✅ (37.0KB)
    ├── LANDING_PAGES_TEMPLATE_QUICK_REFERENCE.md         ✅ (9.5KB)
    ├── LANDING_PAGES_AUTOMATION_SUMMARY.md               ✅ (종합 요약)
    ├── LANDING_PAGES_FILE_STRUCTURE_MAP.md               ← 이 문서
    └── README_LANDING_PAGES_AUTOMATION.md                ← [생성] 빠른 시작
```

---

## 🔧 Phase별 파일 생성 순서

### Phase 1: 템플릿 정의
```
1. src/lib/landing-form-templates.ts (생성)
   ├─ FormField, FormCTA, FormTemplate 타입 정의
   ├─ 10가지 FORM_TEMPLATES 객체 정의
   └─ 유틸 함수 (getFormTemplate, getAllTemplates 등)

2. prisma/schema.prisma (수정)
   ├─ CrmLandingPage.formTemplateId 추가
   ├─ CrmLandingRegistration.ctaId 추가
   ├─ CrmLandingRegistration.detectedLens 추가
   └─ 인덱스 생성

3. prisma/migrations/[DATE]_add_form_template/migration.sql (생성)
```

### Phase 2: CTA 엔진
```
1. src/lib/landing-cta-engine.ts (생성)
   ├─ CTAExecutionInput, CTAExecutionResult 타입
   ├─ executeCTA() — 메인 함수
   ├─ getCTAConfig() — CTA 로드
   ├─ calculateLeadScoreIncrement() — 점수 계산
   └─ applyTagsToContact() — 태그 적용

2. src/app/api/landing-pages/[id]/register/route.ts (수정)
   ├─ CTA 감지 로직 추가
   └─ executeCTA() 호출

3. src/lib/lead-score.ts (수정)
   └─ addLeadScore() 함수 강화
```

### Phase 3: SMS 자동화
```
1. src/lib/landing-sms-templates.ts (생성)
   ├─ SMSTemplate 타입
   ├─ SMS_GENERAL_PASONA (Day 0-3)
   ├─ SMS_VIP_GRANT_CARDONE (Day 0-3)
   ├─ SMS_SURVEY_SPIN (Day 0-3)
   └─ ... (7가지 추가)

2. src/lib/funnel-sms-trigger.ts (수정)
   └─ scheduleSmsSequence() 함수 추가

3. [Cron] src/app/api/cron/landing-sms/route.ts (생성)
   └─ Day 0-3 자동 발송 스케줄
```

### Phase 4: 렌즈 감지
```
1. src/lib/landing-lens-detector.ts (생성)
   ├─ LensDetectionInput, LensDetectionOutput 타입
   ├─ detectLensFromFormResponse() — 렌즈 감지
   ├─ LENS_DETECTION_RULES — L0-L10 규칙
   ├─ matchSignal() — 신호 매칭
   ├─ getLensGroupMapping() — 그룹 매핑
   └─ getFollowUpStrategy() — 전략 선택

2. src/app/api/landing-pages/[id]/register/route.ts (수정)
   └─ detectAndClassifyLens() 호출
```

### Phase 5: 메트릭 추적
```
1. src/lib/landing-metrics-collector.ts (생성)
   ├─ FormMetricsSnapshot 인터페이스
   ├─ collectFormMetrics() — 메트릭 수집
   ├─ calculateConversionMetrics()
   ├─ calculateCostMetrics()
   └─ calculateLTV()

2. src/app/api/landing-pages/[id]/metrics/route.ts (생성)
   └─ GET 엔드포인트

3. [BigQuery] src/lib/bigquery-loader.ts (수정)
   └─ 메트릭 데이터 저장
```

### Phase 6: 대시보드 UI
```
1. src/components/landing-pages/MetricsDashboard.tsx (생성)
   ├─ Hero KPI 섹션
   ├─ 렌즈 분포 차트
   ├─ SMS 효율성
   └─ Risk Score 보드

2. src/app/(dashboard)/landing-pages/[id]/metrics/page.tsx (생성)
   ├─ 메트릭 조회
   ├─ 필터링 UI (기간, 렌즈, 채널)
   └─ 차트 렌더링

3. src/app/(dashboard)/landing-pages/templates/page.tsx (생성)
   ├─ 템플릿 관리 UI
   ├─ 생성/수정/삭제
   └─ 미리보기
```

---

## 📝 각 파일 상세 (콘텐츠 요약)

### `src/lib/landing-form-templates.ts` (850줄)
```typescript
// 1. 타입 정의 (50줄)
export type FormField = { ... }
export type FormCTA = { ... }
export type FormTemplate = { ... }

// 2. 상수 정의 (600줄)
export const FORM_TEMPLATES: Record<string, FormTemplate> = {
  GENERAL_FORM: { ... },        // 150줄
  VIP_FORM: { ... },            // 150줄
  SURVEY_FORM: { ... },         // 100줄
  EVENT_FORM: { ... },          // 80줄
  BOOKING_FORM: { ... },        // 80줄
  // ... 나머지 5개 (50줄 each)
}

// 3. 유틸 함수 (100줄)
export function getFormTemplate(templateId: string): FormTemplate | null { ... }
export function getAllTemplates(): FormTemplate[] { ... }
export function getTemplateMetrics(templateId: string) { ... }
```

### `src/lib/landing-cta-engine.ts` (300줄)
```typescript
// 1. 타입 (30줄)
export type CTAExecutionInput = { ... }
export type CTAExecutionResult = { ... }

// 2. 메인 함수 (200줄)
export async function executeCTA(input: CTAExecutionInput): Promise<CTAExecutionResult> {
  // 1. CTA 설정 로드
  // 2. Contact 조회/생성
  // 3. 자동 태그 적용
  // 4. 그룹 자동 배정
  // 5. SMS 시퀀스 스케줄
  // 6. 렌즈 감지
  // 7. Lead Score 계산
  // 8. Contact 업데이트
}

// 3. 헬퍼 함수 (70줄)
function getCTAConfig(...)
async function scheduleSmsSequence(...)
async function detectAndClassifyLens(...)
function calculateLeadScoreIncrement(...)
```

### `src/lib/landing-sms-templates.ts` (400줄)
```typescript
// 1. SMS Day 0-3 (PASONA) — 일반 폼 (80줄)
export const SMS_GENERAL_PASONA: SMSSequenceConfig[] = [
  { day: 0, content: "...", principles: [...] },
  { day: 1, content: "...", principles: [...] },
  { day: 2, content: "...", principles: [...] },
  { day: 3, content: "...", principles: [...] },
]

// 2. SMS Day 0-3 (GRANT_CARDONE) — VIP (80줄)
export const SMS_VIP_GRANT_CARDONE: SMSSequenceConfig[] = [
  { day: 0, content: "...", closingType: "ASSUMPTIVE_CLOSE" },
  { day: 1, content: "...", closingType: "SOCIAL_PROOF_CLOSE" },
  { day: 2, content: "...", closingType: "SCARCITY_CLOSE" },
  { day: 3, content: "...", closingType: "LOSS_AVERSION_CLOSE" },
]

// 3. ... 나머지 8가지 시퀀스 (240줄)
```

### `src/lib/landing-lens-detector.ts` (350줄)
```typescript
// 1. 타입 (30줄)
export type LensDetectionInput = { ... }
export type LensDetectionOutput = { ... }

// 2. 렌즈 규칙 정의 (120줄)
const LENS_DETECTION_RULES: Record<string, any> = {
  L0: { name: "부재중", signals: [...], actionTags: [...] },
  L1: { name: "가격이의", signals: [...], actionTags: [...] },
  // ... L10까지
}

// 3. 메인 감지 함수 (150줄)
export async function detectLensFromFormResponse(...)

// 4. 헬퍼 함수 (50줄)
function matchSignal(...)
function getLensGroupMapping(...)
function getFollowUpStrategy(...)
```

### `src/lib/landing-metrics-collector.ts` (400줄)
```typescript
// 1. 인터페이스 정의 (50줄)
export interface FormMetricsSnapshot { ... }

// 2. 메트릭 수집 함수 (250줄)
export async function collectFormMetrics(...): Promise<FormMetricsSnapshot> {
  // 1. 폼 제출 통계
  // 2. 렌즈 분포
  // 3. SMS Day 0-3 추적
  // 4. 전환율 계산
  // 5. 비용 메트릭
  // 6. LTV 계산
  // 7. Risk Score
}

// 3. 헬퍼 함수 (100줄)
function calculateConversionMetrics(...)
function calculateCostMetrics(...)
function calculateLTV(...)
```

---

## 🔌 API 엔드포인트

### 기존 (수정)
```
POST /api/landing-pages/[id]/register
├─ 요청: { name, phone, email, customFields, formTemplateId, ctaId }
├─ 변경: executeCTA() 호출 추가
└─ 응답: { ok, tagApplied[], groupAssigned, smsScheduled, lensDetected }
```

### 신규
```
GET /api/landing-pages/[id]/metrics?period=1month&lens=L10&channel=GENERAL
├─ 응답: FormMetricsSnapshot
│   ├─ totalSubmissions
│   ├─ lensDist { L0: 5, L1: 12, ... L10: 4 }
│   ├─ smsMetrics { day0: {...}, day1: {...}, ... }
│   ├─ conversionMetrics { formToContact, contactToLead, ... }
│   ├─ costMetrics { cpa, roi, ... }
│   └─ ltv { avgFirstPurchase, repurchaseRate, ... }
```

---

## 🗄️ DB 마이그레이션 SQL

```sql
-- CrmLandingPage 테이블
ALTER TABLE "CrmLandingPage" 
ADD COLUMN "formTemplateId" TEXT;

CREATE INDEX idx_crm_landing_page_form_template_id 
ON "CrmLandingPage"("formTemplateId");

-- CrmLandingRegistration 테이블
ALTER TABLE "CrmLandingRegistration"
ADD COLUMN "ctaId" TEXT,
ADD COLUMN "detectedLens" VARCHAR(3),
ADD COLUMN "lensConfidence" INTEGER DEFAULT 0;

CREATE INDEX idx_crm_landing_registration_detected_lens
ON "CrmLandingRegistration"("landingPageId", "detectedLens");
```

---

## 🧪 테스트 파일 (생성 예정)

```
tests/
├── landing-form-templates.test.ts           (150줄)
│   ├─ getFormTemplate() 테스트
│   ├─ getAllTemplates() 테스트
│   └─ 템플릿 구조 검증
│
├── landing-cta-engine.test.ts               (200줄)
│   ├─ executeCTA() 테스트
│   ├─ 태그 적용 검증
│   ├─ SMS 스케줄 검증
│   └─ Lead Score 계산 검증
│
├── landing-lens-detector.test.ts            (180줄)
│   ├─ detectLensFromFormResponse() 테스트
│   ├─ L0-L10 신호 매칭 테스트
│   └─ 그룹 매핑 검증
│
├── landing-metrics-collector.test.ts        (150줄)
│   ├─ collectFormMetrics() 테스트
│   ├─ 전환율 계산 검증
│   └─ LTV 계산 검증
│
└── e2e/landing-pages.e2e.ts                 (200줄)
    ├─ 폼 제출 → CTA → SMS 전체 플로우
    ├─ 메트릭 조회 통합
    └─ 대시보드 렌더링 검증
```

---

## 📊 코드 라인수 요약

| 파일명 | 라인수 | 복잡도 |
|--------|--------|--------|
| landing-form-templates.ts | 850 | ⭐⭐⭐ |
| landing-cta-engine.ts | 300 | ⭐⭐⭐⭐ |
| landing-sms-templates.ts | 400 | ⭐⭐ |
| landing-lens-detector.ts | 350 | ⭐⭐⭐⭐⭐ |
| landing-metrics-collector.ts | 400 | ⭐⭐⭐ |
| MetricsDashboard.tsx | 800 | ⭐⭐⭐ |
| **합계** | **3,100** | - |

---

## 🚀 구현 체크리스트

### 코드 작성
- [ ] landing-form-templates.ts (850줄)
- [ ] landing-cta-engine.ts (300줄)
- [ ] landing-sms-templates.ts (400줄)
- [ ] landing-lens-detector.ts (350줄)
- [ ] landing-metrics-collector.ts (400줄)
- [ ] API route: /api/landing-pages/[id]/metrics
- [ ] Dashboard: /landing-pages/[id]/metrics/page.tsx (800줄)

### DB 마이그레이션
- [ ] prisma/schema.prisma 수정
- [ ] migration 생성 및 실행
- [ ] 인덱스 생성 검증

### 테스트
- [ ] 단위 테스트 (각 함수)
- [ ] 통합 테스트 (폼 → 메트릭)
- [ ] E2E 테스트 (Playwright)

### 배포
- [ ] 로컬 테스트 (npm run dev)
- [ ] TSC 검증 (npx tsc --noEmit)
- [ ] 성과 검증 (메트릭 수집)
- [ ] Vercel 배포

---

## 📞 개발 진행 상황 추적

### Week 1
- [ ] Day 1-2: Phase 1 (템플릿) 완료
- [ ] Day 3-4: DB 마이그레이션 완료
- [ ] Day 5-6: Phase 2 (CTA) 완료
- [ ] Day 7: 통합 테스트

### Week 2
- [ ] Day 1-2: Phase 3 (SMS) 완료
- [ ] Day 3-4: Phase 4 (렌즈) 완료
- [ ] Day 5-6: Event Tracking 완료
- [ ] Day 7: 단위 테스트

### Week 3
- [ ] Day 1-2: Phase 5 (메트릭) 완료
- [ ] Day 3-4: API 개발 완료
- [ ] Day 5-6: Phase 6 (대시보드) 완료
- [ ] Day 7: 최종 테스트 + 배포

---

**마지막 업데이트**: 2026-06-15  
**문서 버전**: 1.0  
**상태**: ✅ 설계 완료, 구현 준비 중

