# Landing Pages 블록 커스터마이징 시스템 - 데이터 모델 설계

**버전**: 1.0  
**작성일**: 2026-06-15  
**상태**: 설계 완료 (구현 준비)

---

## 📋 목차

1. [개요](#개요)
2. [Block 데이터 모델](#block-데이터-모델)
3. [Form 데이터 모델](#form-데이터-모델)
4. [Form Field 데이터 모델](#form-field-데이터-모델)
5. [미리보기 & 응답 데이터](#미리보기--응답-데이터)
6. [TypeScript 타입 정의](#typescript-타입-정의)
7. [Prisma 마이그레이션](#prisma-마이그레이션)
8. [API 스펙](#api-스펙)
9. [구현 로드맵](#구현-로드맵)

---

## 개요

### 현재 상태
- CrmLandingPage: `formConfig` (JSON) 필드에 폼 설정 저장 중
- FormBuilder: 기본 필드 (이름, 전화, 이메일) + 커스텀 필드 추가 가능
- CrmLandingRegistration: 고객 응답 저장 (name, phone, email만 구조화)

### 목표
- **블록 기반 페이지 구성**: Hero, Problem, Solution, Offer, Social Proof, FAQ, CTA 블록 조합
- **동적 필드**: 각 블록마다 고유한 필드 세트 정의 가능
- **강타입 검증**: Zod/TypeScript로 각 블록 타입 및 필드 검증
- **응답 데이터 구조화**: 고객 제출 데이터를 블록별로 정렬

---

## Block 데이터 모델

### 1️⃣ 블록의 기본 구조

```typescript
// 모든 블록이 공통으로 가져야 할 필드
interface BlockBase {
  id: string                    // UUID: unique block ID within page
  type: BlockType              // 'hero' | 'problem' | 'solution' | 'offer' | 'social_proof' | 'faq' | 'cta'
  order: number                // 0부터 시작하는 정렬 순서
  enabled: boolean             // 블록 활성화/비활성화
  config: BlockConfig          // 블록 타입별 설정 (polymorphic)
}

// 블록 타입 enum
type BlockType = 
  | 'hero' 
  | 'problem' 
  | 'solution' 
  | 'offer' 
  | 'social_proof' 
  | 'faq' 
  | 'cta'
  | 'countdown'        // L6 렌즈: 타이밍/손실회피
  | 'testimonial'      // 신뢰감 강화
  | 'form'             // 폼 필드 수집
  | 'rich_text'        // 일반 텍스트/마크다운
```

### 2️⃣ 블록별 설정 (BlockConfig)

#### Hero 블록
```typescript
interface HeroBlockConfig {
  title: string                    // 메인 제목
  subtitle?: string                // 부제목
  description?: string             // 추가 설명 (마크다운)
  backgroundImage?: {
    url: string
    altText?: string
    position: 'cover' | 'contain' | 'center'  // CSS background-size
  }
  backgroundVideo?: {
    url: string                    // MP4/WebM
    autoplay: boolean
    muted: boolean
  }
  cta?: {
    text: string                   // 버튼 텍스트
    color: string                  // hex: #FF6B6B
    link?: string                  // 클릭 시 이동 URL
    scrollTo?: string              // 블록 ID로 스크롤
  }
  textColor?: string               // 텍스트 색상 (밝은/어두운 배경 대비)
  minHeight?: number               // px 단위 (기본 400)
}
```

#### Problem 블록
```typescript
interface ProblemBlockConfig {
  title: string                    // "이런 문제 겪고 있나요?"
  description?: string             // 문제 소개
  problems: Array<{
    id: string
    title: string                  // "비용이 너무 비싸요"
    description: string
    icon?: string                  // SVG 또는 이모지
    order: number
  }>
  layout: 'list' | 'grid'          // 2x2 그리드 또는 세로 리스트
}
```

#### Solution 블록
```typescript
interface SolutionBlockConfig {
  title: string
  description?: string
  solutions: Array<{
    id: string
    title: string                  // "어디서나 예약 가능"
    description: string
    icon?: string
    image?: {
      url: string
      altText?: string
    }
    order: number
  }>
  layout: 'list' | 'grid'          // 세 단계 프로세스 또는 feature grid
  processSteps?: boolean           // true면 1→2→3 번호 표시
}
```

#### Offer 블록
```typescript
interface OfferBlockConfig {
  title: string                    // "한정된 시간 동안..."
  description?: string
  pricing: {
    original?: number              // 원가
    discounted: number             // 할인가
    currency: 'KRW' | 'USD'
    period?: 'onetime' | 'monthly' | 'yearly'
  }
  // L6 렌즈: 타이밍/손실회피
  urgency?: {
    type: 'countdown' | 'stock' | 'deadline'
    countdownEndTime?: Date        // 타이머 종료
    stockRemaining?: number        // 남은 좌석/상품
    deadline?: Date                // 마감일
    urgencyText: string            // "지금 신청하지 않으면..."
  }
  features: Array<{
    id: string
    title: string
    description?: string
    icon?: string
    order: number
  }>
  cta?: {
    text: string
    color: string
    link?: string
  }
}
```

#### Social Proof 블록
```typescript
interface SocialProofBlockConfig {
  title?: string
  description?: string
  proof_type: 'testimonials' | 'stats' | 'logos' | 'reviews'
  
  // testimonials 타입
  testimonials?: Array<{
    id: string
    name: string
    role?: string                  // 고객 직책
    company?: string
    content: string                // 리뷰 텍스트
    rating?: number                // 1-5
    avatar?: string                // 프로필 이미지 URL
    order: number
  }>
  
  // stats 타입 (숫자 카운터)
  stats?: Array<{
    id: string
    label: string                  // "10,000명 고객"
    value: number
    unit?: string
    icon?: string
    order: number
  }>
  
  // logos 타입 (고객사 로고)
  logos?: Array<{
    id: string
    name: string
    logoUrl: string
    link?: string
    order: number
  }>
  
  // reviews 타입 (상품 리뷰)
  reviews?: Array<{
    id: string
    platform: 'google' | 'naver' | 'trustpilot' | 'custom'
    rating: number
    title?: string
    content: string
    author: string
    order: number
  }>
  
  layout: 'carousel' | 'grid'
  autoScroll?: boolean
  displayCount?: number            // 한 번에 몇 개 표시
}
```

#### FAQ 블록
```typescript
interface FaqBlockConfig {
  title: string
  description?: string
  faqs: Array<{
    id: string
    question: string
    answer: string                 // 마크다운
    category?: string              // 그룹핑 (여권/비용/일정)
    order: number
  }>
  layout: 'accordion' | 'tabs'     // 아코디언 또는 탭
  initialExpanded?: boolean        // 기본 전개
}
```

#### CTA (Call-to-Action) 블록
```typescript
interface CtaBlockConfig {
  title: string
  description?: string
  buttonText: string
  buttonColor: string              // hex
  buttonStyle: 'solid' | 'outline' | 'ghost'
  action: {
    type: 'link' | 'form' | 'scroll' | 'modal'
    target?: string                // URL 또는 블록 ID
  }
  // 폼 제출과 연결할 필드 (선택사항)
  linkedFormFields?: string[]      // FormField ID 배열
  trackingInfo?: {
    which_cta?: string
    cta_text?: string
    tracking_id?: string
  }
}
```

#### Countdown 블록 (L6 렌즈 전용)
```typescript
interface CountdownBlockConfig {
  title?: string
  description?: string
  countdownEndTime: Date
  display: 'timer' | 'progress' | 'text'  // 시간:분:초 vs 진행률 바
  timerFormat: 'HH:MM:SS' | 'DD:HH:MM'
  urgencyText?: string             // "신청 마감까지"
  backgroundColor?: string
  textColor?: string
  // 타이머 종료 시 행동
  onExpire: {
    type: 'hide' | 'message' | 'redirect'
    redirectUrl?: string
    expireMessage?: string
  }
}
```

#### Testimonial 블록
```typescript
interface TestimonialBlockConfig {
  title?: string
  testimonials: Array<{
    id: string
    name: string
    title?: string                 // "크루즈 선회 회원"
    content: string
    image?: {
      url: string
      altText?: string
    }
    rating?: number
    order: number
  }>
  layout: 'carousel' | 'grid' | 'single'
  autoScroll?: boolean
}
```

#### Form 블록 (폼 필드 수집)
```typescript
interface FormBlockConfig {
  title?: string
  description?: string
  fields: FormField[]              // 아래 Form Field 섹션 참조
  submitButtonText: string
  submitButtonColor: string
  theme: 'light' | 'dark'
  // 폼 제출 후
  onSubmit: {
    type: 'redirect' | 'message' | 'webhook'
    redirectUrl?: string
    successMessage?: string
    webhookUrl?: string
  }
  // 응답 데이터 저장
  storeResponses: boolean          // CrmLandingRegistration에 저장
  // 이메일 자동 발송 (선택)
  sendConfirmationEmail?: boolean
  confirmationEmailTemplate?: string
}
```

#### Rich Text 블록
```typescript
interface RichTextBlockConfig {
  content: string                  // 마크다운
  backgroundColor?: string
  textColor?: string
  maxWidth?: number                // 컨테이너 최대 너비 (px)
}
```

---

## Form 데이터 모델

### 페이지 레벨 폼 설정

```typescript
// CrmLandingPage.formConfig 구조
interface LandingPageFormConfig {
  // 메타데이터
  version: '1.0'                   // 마이그레이션 대비용
  blocks: Block[]
  
  // 페이지 전역 설정
  theme?: {
    primaryColor: string           // hex: #FF6B6B
    secondaryColor?: string
    backgroundColor?: string
    fontFamily: 'sans' | 'serif'
    fontSize: 'small' | 'normal' | 'large'
    mobileWidth?: number           // 기본 480px
    containerMaxWidth?: number     // 기본 1200px
  }
  
  // SEO/메타데이터
  seoTitle?: string
  seoDescription?: string
  ogImage?: string
  
  // 추적
  analyticsConfig?: {
    googleAnalyticsId?: string
    pixelId?: string               // Facebook Pixel
    customEvents?: Array<{
      name: string
      trigger: 'page_load' | 'button_click' | 'form_submit'
      blockId?: string
    }>
  }
}

// 저장 구조 (DB formConfig JSON)
{
  "version": "1.0",
  "blocks": [
    {
      "id": "hero-1",
      "type": "hero",
      "order": 0,
      "enabled": true,
      "config": { ... }
    },
    {
      "id": "problem-1",
      "type": "problem",
      "order": 1,
      "enabled": true,
      "config": { ... }
    },
    {
      "id": "cta-1",
      "type": "cta",
      "order": 10,
      "enabled": true,
      "config": { ... }
    }
  ],
  "theme": { ... }
}
```

---

## Form Field 데이터 모델

### FormField 기본 구조

```typescript
interface FormField {
  id: string                       // UUID: "field-name-001"
  name: string                     // form submit name: "customer_name"
  label: string                    // UI 표시: "고객 이름"
  type: FormFieldType
  required: boolean
  placeholder?: string
  helpText?: string                // 필드 아래 작은 설명
  
  // 값 설정
  defaultValue?: string | number | boolean
  options?: SelectOption[]         // select/checkbox/radio 타입용
  
  // 검증
  validation?: {
    minLength?: number
    maxLength?: number
    pattern?: string               // regex: "^[0-9]{10,11}$" (전화번호)
    email?: boolean
    customMessage?: string         // 검증 실패 메시지
  }
  
  // UI 설정
  width?: 'full' | 'half' | 'third' // 컬럼 너비
  className?: string               // 커스텀 CSS 클래스
  disabled?: boolean
  
  // 고급 설정
  conditional?: {                  // 조건부 표시
    fieldId: string                // 다른 필드 참조
    operator: 'equals' | 'contains' | 'gt' | 'lt'
    value: string | number
  }
  
  // L10 렌즈: 감정적 연결을 위한 메타데이터
  emotionalContext?: string        // "가족과의 추억" 같은 심리학 트리거
}

type FormFieldType = 
  | 'text'
  | 'number'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'time'
  | 'password'
  | 'hidden'
  | 'file'
  | 'button'

interface SelectOption {
  label: string
  value: string
  disabled?: boolean
  order?: number
}
```

### 특수 필드 타입

#### 이름 필드
```typescript
interface NameField extends FormField {
  type: 'text'
  name: 'customer_name' | 'name'
  validation: {
    minLength: 2
    maxLength: 50
    pattern: '^[가-힣a-zA-Z\\s]+$'  // 한글/영문/공백만
    customMessage: '올바른 이름을 입력하세요'
  }
}
```

#### 전화번호 필드
```typescript
interface PhoneField extends FormField {
  type: 'tel'
  name: 'phone' | 'customer_phone'
  validation: {
    pattern: '^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$'  // 010-1234-5678
    customMessage: '올바른 전화번호를 입력하세요 (010-0000-0000)'
  }
  format: 'auto'                   // 입력 중 자동 포맷팅
}
```

#### 선택 필드 (드롭다운/라디오/체크박스)
```typescript
interface SelectField extends FormField {
  type: 'select' | 'radio' | 'checkbox'
  options: Array<{
    label: string
    value: string
    // L10 렌즈: 감정적 연결
    emotionalAppeal?: string       // "럭셔리한 스위트룸" 
  }>
  // radio/checkbox: 복수 선택 가능
  multiple?: boolean
}
```

#### 동의/체크박스 필드
```typescript
interface CheckboxField extends FormField {
  type: 'checkbox'
  label: string                    // "마케팅 정보 수신에 동의합니다"
  required: boolean                // 필수 체크
  checkboxText?: string            // 체크박스 옆 텍스트
}
```

### 기본 필드 템플릿

```typescript
const DEFAULT_FORM_FIELDS: Record<string, FormField> = {
  name: {
    id: 'field-name-001',
    name: 'customer_name',
    label: '고객 이름',
    type: 'text',
    required: true,
    placeholder: '이름을 입력하세요',
    validation: {
      minLength: 2,
      maxLength: 50,
      pattern: '^[가-힣a-zA-Z\\s]+$',
      customMessage: '올바른 이름을 입력하세요'
    },
    width: 'half'
  },
  
  phone: {
    id: 'field-phone-001',
    name: 'phone',
    label: '전화번호',
    type: 'tel',
    required: true,
    placeholder: '010-0000-0000',
    validation: {
      pattern: '^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$',
      customMessage: '올바른 전화번호를 입력하세요'
    },
    width: 'half'
  },
  
  email: {
    id: 'field-email-001',
    name: 'email',
    label: '이메일',
    type: 'email',
    required: false,
    placeholder: 'example@email.com',
    validation: {
      email: true,
      customMessage: '올바른 이메일 주소를 입력하세요'
    },
    width: 'full'
  },
  
  department: {
    id: 'field-dept-001',
    name: 'department',
    label: '부서',
    type: 'select',
    required: false,
    options: [
      { label: '영업', value: 'sales' },
      { label: '마케팅', value: 'marketing' },
      { label: '운영', value: 'operations' }
    ],
    width: 'half'
  },
  
  marketingConsent: {
    id: 'field-consent-001',
    name: 'marketing_consent',
    label: '마케팅 정보 수신 동의',
    type: 'checkbox',
    required: false,
    width: 'full'
  }
};
```

---

## 미리보기 & 응답 데이터

### 어드민 에디터 vs 고객 뷰

```typescript
// 어드민 에디터 (CRM 담당자)
interface EditorView {
  blocks: Block[]                  // 모든 블록 표시
  editMode: true
  actions: {
    addBlock: (type: BlockType) => void
    deleteBlock: (blockId: string) => void
    reorderBlocks: (blockIds: string[]) => void
    editBlockConfig: (blockId: string, config: BlockConfig) => void
    addField: (blockId: string, field: FormField) => void
    removeField: (blockId: string, fieldId: string) => void
  }
}

// 고객 뷰 (방문자)
interface CustomerView {
  blocks: Block[]                  // enabled: true인 블록만
  editMode: false
  actions: {
    submitForm: (blockId: string, formData: FormSubmission) => Promise<void>
    trackEvent: (eventName: string, blockId: string) => void
  }
}
```

### 응답 데이터 저장 구조

```typescript
// CrmLandingRegistration 확장
interface LandingPageResponse {
  id: string
  landingPageId: string
  // 기본 필드
  name: string
  phone: string
  email?: string
  // 블록별 응답 데이터
  blockResponses: Array<{
    blockId: string              // "form-1"
    blockType: 'form' | 'cta'
    responses: Record<string, any>  // { customer_name: "홍길동", department: "sales" }
    submittedAt: Date
  }>
  // 추적
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  metadata?: Record<string, any>
  // L10 렌즈 추적
  emotionalConnectionRating?: number  // 1-5 (선택사항)
  conversionPath?: string[]        // 클릭한 블록 순서
  
  funnelStarted: boolean
  createdAt: Date
}

// 폼 제출 페이로드
interface FormSubmission {
  blockId: string
  responses: Record<string, string | string[] | boolean>
  metadata?: {
    pageUrl: string
    userAgent: string
    timestamp: Date
    clientIp?: string
  }
}
```

### Prisma 마이그레이션

#### 기존 CrmLandingRegistration 확장

```prisma
model CrmLandingRegistration {
  id                String         @id @default(cuid())
  landingPageId     String
  
  // 기본 필드
  name              String
  phone             String
  email             String?
  
  // 블록별 응답 데이터 (JSON)
  blockResponses    Json?          // BlockResponse[] 배열
  
  // 추적
  utmSource         String?
  utmMedium         String?
  utmCampaign       String?
  metadata          Json?          // 자유형 메타데이터
  
  // L10 렌즈: 감정적 연결 추적
  emotionalRating   Int?           // 1-5
  conversionPath    String[]       // 클릭 순서: ["hero-cta", "solution-cta"]
  
  funnelStarted     Boolean        @default(false)
  createdAt         DateTime       @default(now())
  
  landingPage       CrmLandingPage @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  
  @@unique([landingPageId, phone])
  @@index([landingPageId])
  @@index([utmSource, utmMedium])
  @@map("CrmLandingRegistration")
}
```

---

## TypeScript 타입 정의

### 통합 타입 시스템

```typescript
// src/types/landing-page-blocks.ts

// ─── Block 통합 타입 ───
export type Block = 
  | {
      id: string
      type: 'hero'
      order: number
      enabled: boolean
      config: HeroBlockConfig
    }
  | {
      id: string
      type: 'problem'
      order: number
      enabled: boolean
      config: ProblemBlockConfig
    }
  | {
      id: string
      type: 'solution'
      order: number
      enabled: boolean
      config: SolutionBlockConfig
    }
  | {
      id: string
      type: 'offer'
      order: number
      enabled: boolean
      config: OfferBlockConfig
    }
  | {
      id: string
      type: 'social_proof'
      order: number
      enabled: boolean
      config: SocialProofBlockConfig
    }
  | {
      id: string
      type: 'faq'
      order: number
      enabled: boolean
      config: FaqBlockConfig
    }
  | {
      id: string
      type: 'cta'
      order: number
      enabled: boolean
      config: CtaBlockConfig
    }
  | {
      id: string
      type: 'countdown'
      order: number
      enabled: boolean
      config: CountdownBlockConfig
    }
  | {
      id: string
      type: 'testimonial'
      order: number
      enabled: boolean
      config: TestimonialBlockConfig
    }
  | {
      id: string
      type: 'form'
      order: number
      enabled: boolean
      config: FormBlockConfig
    }
  | {
      id: string
      type: 'rich_text'
      order: number
      enabled: boolean
      config: RichTextBlockConfig
    }

// ─── Validation Schemas (Zod) ───
import { z } from 'zod'

export const BlockBaseSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['hero', 'problem', 'solution', 'offer', 'social_proof', 'faq', 'cta', 'countdown', 'testimonial', 'form', 'rich_text']),
  order: z.number().int().nonnegative(),
  enabled: z.boolean().default(true)
})

export const HeroBlockConfigSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  backgroundImage: z.object({
    url: z.string().url(),
    altText: z.string().optional(),
    position: z.enum(['cover', 'contain', 'center'])
  }).optional(),
  cta: z.object({
    text: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9A-F]{6}$/i),
    link: z.string().url().optional(),
    scrollTo: z.string().optional()
  }).optional(),
  minHeight: z.number().int().positive().default(400)
})

export const FormFieldSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  type: z.enum(['text', 'email', 'tel', 'select', 'checkbox', 'radio', 'textarea', 'date']),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z.array(z.object({
    label: z.string(),
    value: z.string(),
    disabled: z.boolean().optional()
  })).optional(),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    email: z.boolean().optional(),
    customMessage: z.string().optional()
  }).optional()
})

export const LandingPageFormConfigSchema = z.object({
  version: z.literal('1.0'),
  blocks: z.array(z.union([
    BlockBaseSchema.extend({ type: z.literal('hero'), config: HeroBlockConfigSchema }),
    // 다른 블록들...
  ])),
  theme: z.object({
    primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
    fontFamily: z.enum(['sans', 'serif']).default('sans')
  }).optional()
})

export type LandingPageFormConfig = z.infer<typeof LandingPageFormConfigSchema>
export type FormField = z.infer<typeof FormFieldSchema>
```

---

## Prisma 마이그레이션

### 마이그레이션 파일

```sql
-- prisma/migrations/[timestamp]_add_block_system_to_landing_pages/migration.sql

-- 1. CrmLandingRegistration에 blockResponses 컬럼 추가
ALTER TABLE "CrmLandingRegistration" 
ADD COLUMN "blockResponses" jsonb;

ALTER TABLE "CrmLandingRegistration" 
ADD COLUMN "emotionalRating" INTEGER;

ALTER TABLE "CrmLandingRegistration" 
ADD COLUMN "conversionPath" text[];

-- 2. formConfig 마이그레이션 (기존 데이터를 새 스키마로)
-- 기존: formConfig = { fields: [...] }
-- 신규: formConfig = { version: "1.0", blocks: [...], theme: {...} }

-- 인덱스 추가
CREATE INDEX "idx_crm_landing_registration_emotion" 
ON "CrmLandingRegistration"("emotionalRating");

CREATE INDEX "idx_crm_landing_registration_conversion_path" 
ON "CrmLandingRegistration" USING GIN ("conversionPath");
```

---

## API 스펙

### 1. 페이지 저장 (PATCH /api/landing-pages/[id])

```typescript
// 요청 바디
interface PatchLandingPageRequest {
  formConfig?: LandingPageFormConfig
  // 다른 필드들...
}

// 응답
interface LandingPageResponse {
  ok: boolean
  page: {
    id: string
    formConfig: LandingPageFormConfig
    // 다른 필드들...
  }
}
```

### 2. 응답 저장 (POST /api/landing-pages/[id]/register)

```typescript
// 요청 바디
interface RegisterRequest {
  name: string
  phone: string
  email?: string
  blockResponses?: Array<{
    blockId: string
    blockType: 'form' | 'cta'
    responses: Record<string, any>
  }>
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  emotionalRating?: number
  conversionPath?: string[]
}

// 응답
interface RegisterResponse {
  ok: boolean
  registrationId?: string
}
```

### 3. 블록 검증 (POST /api/landing-pages/validate-block)

```typescript
// 요청
interface ValidateBlockRequest {
  block: Block
  blockResponses?: Record<string, any>  // 필드값 검증 시
}

// 응답
interface ValidateBlockResponse {
  ok: boolean
  errors?: Array<{
    fieldId?: string
    message: string
  }>
}
```

---

## 구현 로드맵

### Phase 1: 기초 인프라 (1주)
- [ ] TypeScript 타입 시스템 완성 (src/types/landing-page-blocks.ts)
- [ ] Zod 검증 스키마 작성
- [ ] Prisma 마이그레이션 + 데이터 마이그레이션 (기존 formConfig → 새 구조)

### Phase 2: 어드민 에디터 (2주)
- [ ] Block 추가/삭제/재정렬 UI
- [ ] 각 블록 타입별 Config 에디터
- [ ] 실시간 JSON 저장
- [ ] 미리보기 (split-screen)

### Phase 3: 고객 뷰 (1주)
- [ ] 블록 렌더링 엔진 (React 컴포넌트)
- [ ] 폼 필드 검증 + 제출
- [ ] 응답 데이터 저장 (blockResponses)

### Phase 4: L6/L10 렌즈 통합 (1주)
- [ ] Countdown 블록 (L6 타이밍)
- [ ] 감정적 연결 추적 (L10 감정)
- [ ] 우급감/스톡 표시

### Phase 5: 테스트 & 최적화 (1주)
- [ ] E2E 테스트 (Playwright)
- [ ] 성능 최적화 (이미지 lazy loading)
- [ ] 배포 및 A/B 테스트

---

## 설계 원칙

### 1. 확장성
- 새 블록 타입 추가 시 Block union 타입만 확장
- 필드 검증은 Zod 스키마로 관리

### 2. 타입 안전성
- TypeScript + Zod로 런타임 검증
- 폴리모르픽 타입으로 각 블록 설정 강제

### 3. 심리학 렌즈 통합
- L6 (타이밍/손실회피): Countdown, Urgency, Stock 표시
- L10 (즉시 구매): emotionalRating, conversionPath 추적

### 4. 데이터 일관성
- formConfig는 단일 JSON 필드 (No normalization)
- blockResponses는 응답 저장 시만 사용 (읽기 전용)

---

## 참고 문서

- [CLAUDE.md](./CLAUDE.md) - 심리학 렌즈 (L6, L10)
- [landing-page-utils.ts](../src/lib/landing-page-utils.ts) - 기존 유틸리티
- [FormBuilder.tsx](../src/components/forms/FormBuilder.tsx) - 기존 폼 빌더

---

**다음 단계**: 이 설계를 바탕으로 Phase 1 구현 시작
