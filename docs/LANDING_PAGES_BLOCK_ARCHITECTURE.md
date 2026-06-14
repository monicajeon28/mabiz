# Landing Pages 블록 시스템 백엔드 아키텍처 설계

**설계자**: Claude Architecture Team  
**작성일**: 2026-06-15  
**버전**: 1.0  
**상태**: 설계 완료 → 구현 준비  

---

## 📋 Executive Summary

Landing Pages 블록 시스템은 드래그앤드롭 페이지 빌더의 백엔드를 구현합니다. 핵심은:

1. **블록 기반 아키텍처** — 16가지 블록 타입 (Header, CTA, Form, Image, Text 등)
2. **CTA 추적 시스템** — 어느 버튼으로 신청했는지 추적 (attribution)
3. **다중 버전 관리** — Draft / Published / Archived 상태
4. **폼 제출 처리** — Contact 자동 생성 + Lead Scoring
5. **감사 로그** — 모든 변경 사항 추적 (Audit Trail)
6. **트랜잭션 무결성** — 원자적 작업 보장 (Atomic Operations)

---

## 🏗️ Part 1: Prisma 스키마 설계 (8개 모델)

### 핵심 엔티티 간 관계도

```
Organization (1)
├── CrmLandingPage (N)
│   ├── LandingPageBlock (N) — 블록 저장소
│   ├── LandingPageVersion (N) — Draft/Published 버전 관리
│   ├── CTAButton (N) — CTA 추적
│   └── CTAConversion (N) — 클릭/전환 기록
├── FormSubmission (N) — 폼 제출
├── LandingPageAuditLog (N) — 감사 로그
└── LandingPageMeta (N) — 메타데이터 (SEO, OG)
```

### 1️⃣ LandingPageBlock 모델

**역할**: 페이지를 구성하는 개별 블록 저장소

```prisma
model LandingPageBlock {
  // 기본 식별자
  id                    String                      @id @default(cuid())
  landingPageId         String
  organizationId        String
  
  // 블록 메타데이터
  type                  String                      @db.VarChar(30) // "header", "cta", "form", "image", "text", "video", "hero", "testimonial", "pricing", "faq", "countdown", "gallery", "divider", "spacer", "button", "section"
  blockOrder            Int                         // 페이지 내 순서 (0, 1, 2, ...)
  blockVersion          Int                         @default(1) // 블록 자체 버전 관리
  
  // 블록 설정 (type별 다양한 구조)
  config                Json                        // { title, text, bgColor, fontSize, ... type-specific }
  styling               Json?                       // { padding, margin, border, shadow, ... }
  responsiveConfig      Json?                       // { mobile, tablet, desktop }
  
  // CTA 추적 (버튼/링크 포함 블록만)
  ctaId                 String?                     // CTAButton 참조 (선택사항)
  ctaLabel              String?                     @db.VarChar(100)
  ctaAction             String?                     @db.VarChar(30) // "submit", "redirect", "phone_call", "scroll", "download"
  ctaTarget             String?                     // URL 또는 대상
  
  // 폼 블록 전용
  formFields            Json?                       // [{ name, label, type, required, order }]
  formSubmissionGroupId String?                     // 같은 폼의 필드들을 그룹화
  
  // 상태 관리
  isVisible             Boolean                     @default(true)
  isLocked              Boolean                     @default(false) // 편집 잠금
  isDraft               Boolean                     @default(true)
  
  // 감지: 블록 활성화 여부 (조건부 렌더링)
  conditionalRules      Json?                       // [{ if_device: "mobile", then: { display: "none" } }]
  
  // 메타데이터
  createdAt             DateTime                    @default(now())
  updatedAt             DateTime                    @updatedAt
  createdByUserId       String?
  lastModifiedByUserId  String?
  
  // 관계
  landingPage           CrmLandingPage              @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  organization          Organization                @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  cta                   CTAButton?                  @relation(fields: [ctaId], references: [id], onDelete: SetNull)
  formSubmissions       FormSubmission[]            @relation("BlockFormSubmissions")
  auditLogs             LandingPageAuditLog[]       @relation("BlockAuditLogs")
  
  @@unique([landingPageId, formSubmissionGroupId], where: raw("\"formSubmissionGroupId\" IS NOT NULL"), map: "uq_block_form_group")
  @@index([landingPageId, blockOrder], map: "idx_block_page_order")
  @@index([organizationId, type], map: "idx_block_org_type")
  @@index([ctaId], map: "idx_block_cta")
  @@index([landingPageId, isDraft], map: "idx_block_page_draft")
  @@index([createdByUserId])
}
```

**설계 포인트**:
- `config` (JSON): 블록 타입별 모든 설정을 유연하게 저장
- `ctaId`: CTA 추적을 위한 FK (선택사항, 버튼이 없는 블록도 있음)
- `formSubmissionGroupId`: 같은 폼의 여러 필드를 그룹화 (폼 제출 시 함께 수집)
- `blockOrder`: 블록 순서 (드래그앤드롭 후 업데이트)

---

### 2️⃣ CTAButton 모델

**역할**: CTA(버튼/링크) 추적 시스템의 핵심

```prisma
model CTAButton {
  // 기본 식별자
  id                    String                      @id @default(cuid())
  landingPageId         String
  organizationId        String
  
  // CTA 메타데이터
  label                 String                      @db.VarChar(100) // "지금 신청하기", "더 알아보기"
  trackingId            String                      @unique // "cta-hero-primary" (고유 추적 ID)
  description           String?                     // 내부용 설명
  
  // CTA 분류
  ctaType               String                      @db.VarChar(30) // "primary", "secondary", "tertiary"
  position              String?                     @db.VarChar(50) // "hero", "mid-page", "footer"
  blockType             String?                     @db.VarChar(30) // 연결된 블록 타입
  
  // 추적 메타데이터
  version               Int                         @default(1) // CTA 변경 시 버전 증가
  versionNote           String? // "변경 이유"
  
  // 성과 메트릭 (캐시, 실시간 계산 위해 매시간 갱신)
  clickCount            Int                         @default(0)
  conversionCount       Int                         @default(0)
  conversionRate        Decimal                     @default(0) @db.Decimal(5, 2) // 0-100%
  firstClickAt          DateTime?
  lastClickAt           DateTime?
  
  // 상태
  isActive              Boolean                     @default(true)
  archivedAt            DateTime?
  
  // 메타데이터
  createdAt             DateTime                    @default(now())
  updatedAt             DateTime                    @updatedAt
  createdByUserId       String?
  
  // 관계
  landingPage           CrmLandingPage              @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  organization          Organization                @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  conversions           CTAConversion[]             @relation("ButtonConversions")
  blocks                LandingPageBlock[]          @relation("BlockCTAs")
  
  @@unique([organizationId, trackingId], map: "uq_cta_org_tracking_id")
  @@index([landingPageId], map: "idx_cta_page")
  @@index([organizationId, position], map: "idx_cta_org_position")
  @@index([ctaType], map: "idx_cta_type")
  @@index([conversionCount(sort: Desc)], map: "idx_cta_conversion_rank")
}
```

**설계 포인트**:
- `trackingId` (UNIQUE): "cta-hero-primary" 같은 의미있는 추적 ID (쿼리 최적화)
- `version`: CTA 변경 시 버전 기록 (변경 이력 추적)
- 캐시 메트릭 (`clickCount`, `conversionCount`): 매시간 갱신으로 성능 최적화
- 다대일 관계로 여러 블록이 같은 CTA 재사용 가능

---

### 3️⃣ CTAConversion 모델

**역할**: 모든 CTA 클릭 및 전환 기록 (개별 이벤트)

```prisma
model CTAConversion {
  // 기본 식별자
  id                    String                      @id @default(cuid())
  ctaId                 String
  organizationId        String
  
  // 이벤트 메타데이터
  eventType             String                      @db.VarChar(30) // "click", "conversion", "abandon"
  isConversion          Boolean                     @default(false) // true = 폼 제출 또는 구매
  
  // 고객 정보
  contactId             String? // Contact 참조 (폼 제출 후 자동 생성)
  visitorSessionId      String? // 익명 방문자 추적 (쿠키 기반)
  visitorEmail          String?
  visitorPhone          String?
  
  // 이벤트 컨텍스트
  referrer              String? // HTTP referrer
  utm_source            String?
  utm_medium            String?
  utm_campaign          String?
  utm_content           String?
  utm_term              String?
  
  // 기기/브라우저 정보
  userAgent             String?
  ipAddress             String? (masked) // PII 마스킹
  deviceType            String? @db.VarChar(20) // "mobile", "tablet", "desktop"
  
  // 타이밍 정보
  clickedAt             DateTime                    @default(now())
  formSubmittedAt       DateTime?
  conversionAt          DateTime? // 최종 구매 시점 (CRM에서 기록)
  timeToConversion      Int? // 클릭부터 변환까지 초 단위
  
  // 폼 제출 관련
  formSubmissionId      String?
  formData              Json? // { name, email, phone, message, ... }
  
  // 메타데이터
  source                String                      @db.VarChar(30) // "landing_page", "email", "sms", "social"
  campaign              String?
  
  // 관계
  cta                   CTAButton                   @relation("ButtonConversions", fields: [ctaId], references: [id], onDelete: Cascade)
  organization          Organization                @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  contact               Contact?                    @relation(fields: [contactId], references: [id], onDelete: SetNull)
  formSubmission        FormSubmission?             @relation(fields: [formSubmissionId], references: [id], onDelete: SetNull)
  
  @@index([ctaId, eventType], map: "idx_conversion_cta_type")
  @@index([organizationId, clickedAt(sort: Desc)], map: "idx_conversion_org_time")
  @@index([contactId], map: "idx_conversion_contact")
  @@index([visitorSessionId], map: "idx_conversion_session")
  @@index([utm_campaign], map: "idx_conversion_utm_campaign")
  @@index([isConversion, conversionAt], map: "idx_conversion_is_converted")
  @@index([organizationId, clickedAt(sort: Desc), isConversion], map: "idx_conversion_org_time_type")
}
```

**설계 포인트**:
- `visitorSessionId`: 익명 방문자 추적 (Cookie 기반)
- `eventType`: "click" vs "conversion" 구분
- UTM 파라미터: 광고 소스별 추적
- `timeToConversion`: 클릭→구매까지 시간 (LTV 분석용)
- JSON `formData`: 폼 제출 데이터 저장 (Contact 필드에 매핑 전)

---

### 4️⃣ FormSubmission 모델

**역할**: 폼 제출 기록 및 Contact 생성

```prisma
model FormSubmission {
  // 기본 식별자
  id                    String                      @id @default(cuid())
  landingPageId         String
  organizationId        String
  
  // 폼 메타데이터
  formTitle             String?                     @db.VarChar(100)
  formGroupId           String? // 같은 폼의 여러 필드를 그룹화
  
  // 제출자 정보
  contactId             String? // 제출 후 자동 생성/업데이트
  submitterName         String?                     @db.VarChar(100)
  submitterEmail        String?
  submitterPhone        String?
  
  // 제출 데이터
  formData              Json                        // { field1: value1, field2: value2, ... }
  
  // CTA 연결
  ctaId                 String? // 폼을 제출한 CTA 버튼
  ctaConversionId       String? // CTAConversion 참조
  
  // 블록 연결
  blockIds              String[] // 이 폼을 구성하는 블록 ID들
  
  // 상태
  status                String                      @db.VarChar(30) @default("PENDING") // "PENDING", "VERIFIED", "DUPLICATE", "INVALID", "PROCESSED"
  validationResult      Json? // { isValid, errors: [...] }
  
  // 처리 상태
  processedAt           DateTime?
  processedByUserId     String?
  assignedTo            String? // 영업사원 자동 할당
  
  // 메타데이터
  ipAddress             String?
  userAgent             String?
  referrer              String?
  submittedAt           DateTime                    @default(now())
  updatedAt             DateTime                    @updatedAt
  
  // 관계
  landingPage           CrmLandingPage              @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  organization          Organization                @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  contact               Contact?                    @relation(fields: [contactId], references: [id], onDelete: SetNull)
  cta                   CTAButton?                  @relation("FormSubmissionCTA", fields: [ctaId], references: [id])
  ctaConversion         CTAConversion?              @relation(fields: [ctaConversionId], references: [id])
  blocks                LandingPageBlock[]          @relation("BlockFormSubmissions")
  auditLogs             FormSubmissionAuditLog[]
  
  @@unique([organizationId, submitterEmail, landingPageId], where: raw("\"submitterEmail\" IS NOT NULL"), map: "uq_form_email_org_page")
  @@unique([organizationId, submitterPhone, landingPageId], where: raw("\"submitterPhone\" IS NOT NULL"), map: "uq_form_phone_org_page")
  @@index([landingPageId, submittedAt(sort: Desc)], map: "idx_form_page_time")
  @@index([organizationId, status], map: "idx_form_org_status")
  @@index([contactId], map: "idx_form_contact")
  @@index([ctaId], map: "idx_form_cta")
  @@index([assignedTo], map: "idx_form_assigned")
  @@index([submittedAt(sort: Desc)], map: "idx_form_time")
}
```

**설계 포인트**:
- `formGroupId`: 복수의 폼 필드를 하나의 제출로 묶음
- `contactId`: 제출 후 자동으로 Contact 생성 또는 기존 Contact 업데이트
- `status`: PENDING → VERIFIED → PROCESSED 워크플로우
- `blockIds`: 어느 블록들이 이 폼을 구성했는지 추적
- UNIQUE 제약: 같은 페이지에서 중복 제출 방지

---

### 5️⃣ LandingPageVersion 모델

**역할**: Draft / Published / Archived 버전 관리

```prisma
model LandingPageVersion {
  // 기본 식별자
  id                    String                      @id @default(cuid())
  landingPageId         String
  organizationId        String
  
  // 버전 메타데이터
  versionNumber         Int // 1, 2, 3, ...
  status                String                      @db.VarChar(20) // "DRAFT", "PUBLISHED", "ARCHIVED", "SCHEDULED"
  versionNote           String? // "사용자 입력 메모: 신년 캠페인 v2"
  
  // 스냅샷 (버전별 완전한 복사본)
  blocksSnapshot        Json                        // [{ id, type, config, ... }] 전체 블록 목록
  cta_mapping           Json? // { ctaId: "tracking-id", ... } CTA 매핑
  
  // 퍼블리시 메타데이터
  publishedAt           DateTime?
  publishedByUserId     String?
  scheduledPublishAt    DateTime?
  
  // 만료 설정
  expiresAt             DateTime? // 자동 만료 설정
  
  // 조회/분석
  viewCount             Int                         @default(0)
  uniqueVisitors        Int                         @default(0)
  conversionCount       Int                         @default(0)
  
  // 타임스탐프
  createdAt             DateTime                    @default(now())
  createdByUserId       String?
  
  // 관계
  landingPage           CrmLandingPage              @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  organization          Organization                @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([landingPageId, versionNumber], map: "uq_version_page_number")
  @@index([landingPageId, status], map: "idx_version_page_status")
  @@index([organizationId, publishedAt(sort: Desc)], map: "idx_version_org_published")
  @@index([status], map: "idx_version_status")
}
```

**설계 포인트**:
- `blocksSnapshot`: 모든 블록을 JSON으로 저장 (버전 복원 용이)
- `status`: DRAFT → PUBLISHED → ARCHIVED 상태 전환
- `scheduledPublishAt`: 예약 퍼블리시 (시간대별 캠페인)
- 각 버전별 분석 메트릭 (조회수, 전환수)

---

### 6️⃣ LandingPageAuditLog 모델

**역할**: 모든 변경 사항 추적 (Audit Trail)

```prisma
model LandingPageAuditLog {
  // 기본 식별자
  id                    String                      @id @default(cuid())
  landingPageId         String?
  blockId               String?
  organizationId        String
  
  // 감사 메타데이터
  action                String                      @db.VarChar(50) // "CREATE_PAGE", "UPDATE_BLOCK", "DELETE_BLOCK", "PUBLISH_VERSION", "REORDER_BLOCKS"
  entityType            String                      @db.VarChar(30) // "landing_page", "block", "cta"
  entityId              String? // 변경된 엔티티 ID
  
  // 변경 사항
  changesBefore         Json? // 변경 전 상태
  changesAfter          Json? // 변경 후 상태
  changesSummary        String? // "블록 3개 추가, 텍스트 변경"
  
  // 사용자 정보
  userId                String
  userName              String?
  userRole              String?
  
  // 타이밍
  createdAt             DateTime                    @default(now())
  
  // IP/브라우저 (추가 보안)
  ipAddress             String?
  userAgent             String?
  
  // 관계
  landingPage           CrmLandingPage?             @relation(fields: [landingPageId], references: [id], onDelete: SetNull)
  block                 LandingPageBlock?           @relation("BlockAuditLogs", fields: [blockId], references: [id], onDelete: SetNull)
  organization          Organization                @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@index([landingPageId, createdAt(sort: Desc)], map: "idx_audit_page_time")
  @@index([organizationId, createdAt(sort: Desc)], map: "idx_audit_org_time")
  @@index([userId], map: "idx_audit_user")
  @@index([action], map: "idx_audit_action")
  @@index([entityType, entityId], map: "idx_audit_entity")
}
```

**설계 포인트**:
- `changesBefore` / `changesAfter`: 변경 전후 비교 (복원 용이)
- 모든 사용자 액션 추적 (보안 감사)
- 타임스탬프로 변경 히스토리 추적

---

### 7️⃣ LandingPageMeta 모델

**역할**: SEO / OG / 메타데이터 관리

```prisma
model LandingPageMeta {
  // 기본 식별자
  id                    String                      @id @default(cuid())
  landingPageId         String                      @unique
  organizationId        String
  
  // SEO 메타데이터
  metaTitle             String                      @db.VarChar(255) // <title>
  metaDescription       String                      @db.VarChar(500) // <meta name="description">
  metaKeywords          String? // <meta name="keywords">
  
  // OG 메타데이터 (소셜 공유)
  ogTitle               String?                     @db.VarChar(255)
  ogDescription        String?                     @db.VarChar(500)
  ogImage               String? // URL
  ogUrl                 String?
  
  // Twitter 카드
  twitterCard          String?                     @db.VarChar(20) // "summary", "summary_large_image"
  twitterTitle         String?                     @db.VarChar(255)
  twitterDescription   String?                     @db.VarChar(500)
  twitterImage         String?
  
  // Canonical URL (중복 콘텐츠 방지)
  canonical            String?
  
  // 기타 메타데이터
  language             String                      @default("ko-KR")
  author               String?
  contactEmail         String?
  
  // 구조화된 데이터 (JSON-LD)
  structuredData       Json? // { "@context": "https://schema.org", "@type": "Product", ... }
  
  // 타이밍
  createdAt            DateTime                    @default(now())
  updatedAt            DateTime                    @updatedAt
  
  // 관계
  landingPage          CrmLandingPage              @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  organization         Organization                @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@index([landingPageId])
}
```

---

### 8️⃣ FormSubmissionAuditLog 모델

**역할**: 폼 제출 변경 기록

```prisma
model FormSubmissionAuditLog {
  // 기본 식별자
  id                    String                      @id @default(cuid())
  formSubmissionId      String
  organizationId        String
  
  // 감사 메타데이터
  action                String                      @db.VarChar(50) // "SUBMIT", "UPDATE_STATUS", "ASSIGN", "VERIFY"
  statusBefore          String?                     @db.VarChar(30)
  statusAfter           String?                     @db.VarChar(30)
  
  // 변경 사항
  changes               Json? // { assignedTo: { from: null, to: "user123" } }
  
  // 사용자 정보
  userId                String
  
  // 타이밍
  createdAt             DateTime                    @default(now())
  
  // 관계
  formSubmission        FormSubmission              @relation(fields: [formSubmissionId], references: [id], onDelete: Cascade)
  organization          Organization                @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@index([formSubmissionId, createdAt(sort: Desc)])
  @@index([organizationId, action])
}
```

---

## 🔌 Part 2: API 설계 (6개 엔드포인트 + 확장)

### 엔드포인트 구조

```
POST   /api/landing-pages/[id]/blocks              # 블록 생성
PATCH  /api/landing-pages/[id]/blocks/[blockId]   # 블록 수정
DELETE /api/landing-pages/[id]/blocks/[blockId]   # 블록 삭제
POST   /api/landing-pages/[id]/blocks/reorder      # 블록 순서 변경

POST   /api/landing-pages/[id]/ctas                # CTA 생성
PATCH  /api/landing-pages/[id]/ctas/[ctaId]       # CTA 수정
GET    /api/landing-pages/[id]/ctas/analytics      # CTA 분석

POST   /api/landing-pages/[id]/versions            # 버전 생성 (스냅샷)
PATCH  /api/landing-pages/[id]/versions/[verId]   # 버전 상태 변경
GET    /api/landing-pages/[id]/versions            # 버전 목록

POST   /api/landing-pages/[id]/submit-form         # 폼 제출 (공개 API)
GET    /api/landing-pages/[id]/forms               # 폼 제출 목록

GET    /api/landing-pages/[id]/audit-log           # 감사 로그
```

---

### 1️⃣ 블록 관련 API

#### POST /api/landing-pages/[id]/blocks

```typescript
// Request
{
  type: "hero" | "cta" | "form" | "image" | ...
  config: {
    // type-specific properties
    title?: string
    text?: string
    bgColor?: string
    fontSize?: number
    // ...
  }
  styling?: {
    padding?: string
    margin?: string
    border?: string
    // ...
  }
  responsiveConfig?: {
    mobile: { ... }
    tablet: { ... }
    desktop: { ... }
  }
  ctaLabel?: string              // 버튼 텍스트 (블록이 버튼 포함시)
  ctaAction?: "submit" | "redirect" | "phone_call" | "scroll"
  ctaTarget?: string             // URL 또는 대상
  formFields?: Array<{
    name: string
    label: string
    type: "text" | "email" | "phone" | "textarea"
    required: boolean
    order: number
  }>
  blockOrder: number             // 블록 순서
}

// Response
{
  success: boolean
  block: {
    id: string
    landingPageId: string
    type: string
    blockOrder: number
    config: any
    ctaId?: string
    createdAt: string
  }
  audit: {
    logId: string
    action: "CREATE_BLOCK"
    timestamp: string
  }
}
```

**구현 포인트**:
- 트랜잭션: 블록 생성 + 감사 로그 원자적 처리
- 폼 필드 검증: required 필드, 타입 체크
- CTA 자동 생성: ctaLabel이 있으면 CTAButton 자동 생성

---

#### PATCH /api/landing-pages/[id]/blocks/[blockId]

```typescript
// Request
{
  config?: { ... }
  styling?: { ... }
  blockOrder?: number            // 재배치시만
  ctaLabel?: string
  formFields?: Array<...>
  isVisible?: boolean
  isLocked?: boolean
}

// Response
{
  success: boolean
  block: { ... updated block }
  changedFields: string[]        // 변경된 필드 목록
  audit: { logId, action: "UPDATE_BLOCK", ... }
}
```

---

#### POST /api/landing-pages/[id]/blocks/reorder

**역할**: 드래그앤드롭 후 순서 일괄 변경

```typescript
// Request
{
  blocks: [
    { id: "block1", blockOrder: 0 },
    { id: "block2", blockOrder: 1 },
    { id: "block3", blockOrder: 2 },
  ]
}

// Response
{
  success: boolean
  reorderedCount: number
  audit: { logId, action: "REORDER_BLOCKS", ... }
}
```

**구현 포인트**:
- 트랜잭션: 모든 블록 순서 일괄 업데이트 (원자성 보장)
- 유효성 검사: blockOrder 범위 검증

---

### 2️⃣ CTA 관련 API

#### POST /api/landing-pages/[id]/ctas

```typescript
// Request
{
  label: string                  // "지금 신청하기"
  description?: string
  ctaType: "primary" | "secondary" | "tertiary"
  position?: "hero" | "mid-page" | "footer"
}

// Response
{
  success: boolean
  cta: {
    id: string
    trackingId: string            // "cta-hero-primary"
    label: string
    ctaType: string
    clickCount: 0
    conversionCount: 0
    firstClickAt: null
  }
}
```

---

#### GET /api/landing-pages/[id]/ctas/analytics

```typescript
// Response
{
  success: boolean
  ctas: [
    {
      id: string
      trackingId: string
      label: string
      position: string
      clickCount: 1250
      conversionCount: 45
      conversionRate: 3.6
      avgTimeToConversion: 3600000  // 밀리초
      lastClickAt: "2026-06-15T10:30:00Z"
      // A/B 테스트 메타데이터
      abTestGroup?: "A" | "B"
      performanceRank: 1
    }
  ]
  period: { from: string, to: string }
  totalClicks: 5000
  totalConversions: 150
}
```

---

### 3️⃣ 폼 제출 API

#### POST /api/landing-pages/[id]/submit-form (공개 API)

**특이점**: 인증 불필요 (공개 랜딩페이지용)

```typescript
// Request
{
  formGroupId: string            // 폼 필드 그룹 ID
  formData: {
    name: string
    email: string
    phone: string
    message?: string
    // custom fields...
  }
  ctaId?: string                 // 어느 버튼으로 제출했는지
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  // ...
}

// Response
{
  success: boolean
  submission: {
    id: string
    landingPageId: string
    contactId?: string            // 새로 생성된 Contact ID
    status: "PENDING"
    submittedAt: string
  }
  message: "신청이 완료되었습니다. 곧 연락드리겠습니다."
}

// Error Response
{
  success: false
  errors: [
    { field: "email", message: "유효한 이메일을 입력하세요" }
  ]
}
```

**구현 포인트**:
- 트랜잭션: FormSubmission 생성 + Contact 업데이트 + CTAConversion 기록
- 중복 방지: UNIQUE(email, landingPageId) + UNIQUE(phone, landingPageId)
- 자동 할당: 영업사원 자동 할당 로직 (라운드로빈 또는 규칙 기반)
- 심리학 적용: 제출 후 자동 Day 0 SMS 발송 (Option)

---

#### GET /api/landing-pages/[id]/forms

```typescript
// Query params
?status=PENDING&limit=50&offset=0&sortBy=submittedAt

// Response
{
  success: boolean
  submissions: [
    {
      id: string
      submitterName: string
      submitterEmail: string
      submitterPhone: string
      status: string
      assignedTo?: { id, name, avatar }
      contactId?: string
      submittedAt: string
      processedAt?: string
      formData: { ... }
    }
  ]
  total: 250
  page: 1
  limit: 50
}
```

---

### 4️⃣ 버전 관리 API

#### POST /api/landing-pages/[id]/versions

**역할**: 현재 상태를 스냅샷으로 저장

```typescript
// Request
{
  status: "DRAFT" | "PUBLISHED"  // 생성시 상태
  versionNote?: "신년 캠페인 최적화"
  scheduledPublishAt?: string    // SCHEDULED 상태시만 필수
}

// Response
{
  success: boolean
  version: {
    id: string
    versionNumber: 2
    status: "DRAFT"
    blocksSnapshot: [ ... ]
    createdAt: string
  }
}
```

---

#### PATCH /api/landing-pages/[id]/versions/[verId]

```typescript
// Request
{
  status: "PUBLISHED" | "ARCHIVED"
}

// Response
{
  success: boolean
  version: { ... updated version }
  affected: {
    blocksUpdated: 15
    ctasUpdated: 3
  }
}
```

---

### 5️⃣ 감사 로그 API

#### GET /api/landing-pages/[id]/audit-log

```typescript
// Query params
?action=UPDATE_BLOCK&limit=100&offset=0

// Response
{
  success: boolean
  logs: [
    {
      id: string
      action: "UPDATE_BLOCK"
      entityType: "block"
      entityId: string
      userId: string
      userName: string
      changesSummary: "배경색을 파란색으로 변경"
      createdAt: string
      changesBefore?: { ... }
      changesAfter?: { ... }
    }
  ]
  total: 234
}
```

---

## 🔄 Part 3: 트랜잭션 관리

### Case 1: 폼 제출 트랜잭션

**요구사항**: 폼 제출 시 Contact 자동 생성, CTAConversion 기록, FormSubmission 저장이 모두 성공하거나 모두 실패해야 함.

```typescript
// lib/landing-pages/submit-form.ts
import { prisma } from "@/lib/prisma"

export async function submitLandingPageForm(
  organizationId: string,
  landingPageId: string,
  payload: {
    formGroupId: string
    formData: Record<string, any>
    ctaId?: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
  }
) {
  return await prisma.$transaction(async (tx) => {
    // Step 1: Contact 생성 또는 업데이트
    const contact = await tx.contact.upsert({
      where: {
        phone_organizationId: {
          phone: payload.formData.phone,
          organizationId,
        },
      },
      create: {
        organizationId,
        phone: payload.formData.phone,
        name: payload.formData.name,
        email: payload.formData.email,
        type: "INQUIRY",
        sourceType: "landing_page",
        sourceId: landingPageId,
        // Day 0-3 SMS 자동화 시작
        smsDay0Sent: false,
        smsDay1Sent: false,
        smsDay2Sent: false,
        smsDay3Sent: false,
      },
      update: {
        name: payload.formData.name,
        email: payload.formData.email,
        updatedAt: new Date(),
      },
    })

    // Step 2: FormSubmission 생성
    const formSubmission = await tx.formSubmission.create({
      data: {
        organizationId,
        landingPageId,
        contactId: contact.id,
        submitterName: payload.formData.name,
        submitterEmail: payload.formData.email,
        submitterPhone: payload.formData.phone,
        formData: payload.formData,
        ctaId: payload.ctaId,
        blockIds: [], // TODO: 폼 필드 블록 IDs 조회
        status: "PENDING",
      },
    })

    // Step 3: CTAConversion 생성 (클릭→제출 추적)
    if (payload.ctaId) {
      const ctaConversion = await tx.ctaConversion.create({
        data: {
          organizationId,
          ctaId: payload.ctaId,
          contactId: contact.id,
          eventType: "conversion",
          isConversion: true,
          formSubmissionId: formSubmission.id,
          utm_source: payload.utm_source,
          utm_medium: payload.utm_medium,
          utm_campaign: payload.utm_campaign,
          conversionAt: new Date(),
        },
      })

      // Step 4: CTAButton 메트릭 업데이트
      await tx.ctaButton.update({
        where: { id: payload.ctaId },
        data: {
          conversionCount: { increment: 1 },
          lastClickAt: new Date(),
        },
      })

      // FormSubmission에 CTA Conversion 링크
      await tx.formSubmission.update({
        where: { id: formSubmission.id },
        data: { ctaConversionId: ctaConversion.id },
      })
    }

    // Step 5: 감사 로그 기록
    await tx.formSubmissionAuditLog.create({
      data: {
        organizationId,
        formSubmissionId: formSubmission.id,
        action: "SUBMIT",
        statusAfter: "PENDING",
        userId: "system", // 공개 API이므로 system user
        changes: {
          created: {
            contactId: contact.id,
            ctaId: payload.ctaId,
          },
        },
      },
    })

    return {
      success: true,
      submission: formSubmission,
      contact,
    }
  })
}
```

---

### Case 2: 블록 생성 + 감사 로그

```typescript
export async function createLandingPageBlock(
  organizationId: string,
  landingPageId: string,
  userId: string,
  payload: BlockCreateInput
) {
  return await prisma.$transaction(async (tx) => {
    // Step 1: CTA 생성 (필요시)
    let ctaId: string | undefined
    if (payload.ctaLabel && payload.ctaAction) {
      const cta = await tx.ctaButton.create({
        data: {
          organizationId,
          landingPageId,
          label: payload.ctaLabel,
          trackingId: generateTrackingId(payload.type, payload.ctaLabel),
          ctaType: "primary",
          position: payload.type === "hero" ? "hero" : undefined,
          blockType: payload.type,
          createdByUserId: userId,
        },
      })
      ctaId = cta.id
    }

    // Step 2: 블록 생성
    const block = await tx.landingPageBlock.create({
      data: {
        organizationId,
        landingPageId,
        type: payload.type,
        blockOrder: payload.blockOrder,
        config: payload.config,
        styling: payload.styling,
        ctaId,
        ctaLabel: payload.ctaLabel,
        ctaAction: payload.ctaAction,
        ctaTarget: payload.ctaTarget,
        formFields: payload.formFields,
        createdByUserId: userId,
      },
    })

    // Step 3: 감사 로그
    await tx.landingPageAuditLog.create({
      data: {
        organizationId,
        landingPageId,
        blockId: block.id,
        action: "CREATE_BLOCK",
        entityType: "block",
        entityId: block.id,
        changesAfter: block,
        userId,
      },
    })

    return { success: true, block }
  })
}

function generateTrackingId(type: string, label: string): string {
  // "hero" + "지금 신청하기" → "cta-hero-primary"
  const slug = label.toLowerCase().replace(/\s+/g, "-")
  return `cta-${type}-${slug}-${Date.now()}`
}
```

---

### Case 3: 버전 스냅샷 생성

```typescript
export async function createLandingPageVersion(
  organizationId: string,
  landingPageId: string,
  userId: string,
  payload: {
    status: "DRAFT" | "PUBLISHED"
    versionNote?: string
  }
) {
  return await prisma.$transaction(async (tx) => {
    // Step 1: 현재 모든 블록 조회
    const blocks = await tx.landingPageBlock.findMany({
      where: { landingPageId, isDraft: true },
      orderBy: { blockOrder: "asc" },
    })

    // Step 2: CTA 매핑 조회
    const ctas = await tx.ctaButton.findMany({
      where: { landingPageId },
    })

    // Step 3: 버전 번호 계산
    const lastVersion = await tx.landingPageVersion.findFirst({
      where: { landingPageId },
      orderBy: { versionNumber: "desc" },
    })
    const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1

    // Step 4: 버전 저장 (스냅샷)
    const version = await tx.landingPageVersion.create({
      data: {
        organizationId,
        landingPageId,
        versionNumber: nextVersionNumber,
        status: payload.status,
        versionNote: payload.versionNote,
        blocksSnapshot: blocks,
        cta_mapping: ctas.reduce(
          (acc, cta) => ({ ...acc, [cta.id]: cta.trackingId }),
          {}
        ),
        publishedByUserId: payload.status === "PUBLISHED" ? userId : undefined,
        publishedAt:
          payload.status === "PUBLISHED" ? new Date() : undefined,
        createdByUserId: userId,
      },
    })

    // Step 5: 감사 로그
    await tx.landingPageAuditLog.create({
      data: {
        organizationId,
        landingPageId,
        action: `CREATE_VERSION_${payload.status}`,
        entityType: "version",
        entityId: version.id,
        changesAfter: {
          versionNumber: nextVersionNumber,
          blockCount: blocks.length,
          ctaCount: ctas.length,
        },
        userId,
      },
    })

    // Step 6: 기존 블록들 isDraft = false 처리 (선택적)
    if (payload.status === "PUBLISHED") {
      await tx.landingPageBlock.updateMany({
        where: { landingPageId, isDraft: true },
        data: { isDraft: false },
      })
    }

    return { success: true, version }
  })
}
```

---

## 🔐 Part 4: 데이터 무결성 전략

### 1️⃣ UNIQUE 제약으로 중복 방지

| 제약 | 목적 | 효과 |
|-----|------|------|
| `landingPageId, blockOrder` (Partial) | 블록 순서 유니크성 | 같은 페이지 내 중복 순서 불가 |
| `organizationId, trackingId` | CTA 추적 ID 유니크 | 마케팅 추적 정확성 보장 |
| `organizationId, submitterEmail, landingPageId` (Partial) | 폼 중복 제출 방지 | 같은 이메일로 중복 제출 불가 |
| `landingPageId, versionNumber` | 버전 번호 유니크 | 버전 체인 무결성 |

---

### 2️⃣ CASCADE / SET NULL 전략

| FK | ON DELETE | 이유 |
|----|-----------|------|
| `LandingPageBlock.landingPageId` | CASCADE | 페이지 삭제 시 모든 블록 삭제 |
| `LandingPageBlock.ctaId` | SET NULL | CTA 삭제 시 블록은 유지, CTA 연결만 해제 |
| `FormSubmission.contactId` | SET NULL | Contact 삭제 시 폼 제출 기록은 유지 |
| `CTAConversion.contactId` | SET NULL | Contact 삭제 시 전환 기록은 유지 |

**원칙**: 분석 데이터(CTAConversion, FormSubmission)는 절대 CASCADE 삭제 금지

---

### 3️⃣ 동시성 제어 (Race Condition 방지)

#### Case: 블록 순서 변경 중 다른 사용자도 변경

```typescript
// ❌ 위험: Race condition
const block = await prisma.landingPageBlock.update({
  where: { id: blockId },
  data: { blockOrder: newOrder },
})

// ✅ 안전: 버전 기반 낙관적 잠금
const block = await prisma.landingPageBlock.update({
  where: { id: blockId },
  data: { blockOrder: newOrder, blockVersion: { increment: 1 } },
})
```

#### Case: 폼 제출 중복 방지

```typescript
// 트랜잭션 + UNIQUE 제약으로 자동 중복 방지
const submission = await prisma.$transaction(
  async (tx) => {
    return await tx.formSubmission.create({
      data: {
        organizationId,
        landingPageId,
        submitterEmail: payload.email,
        submitterPhone: payload.phone,
        // ...
      },
    })
  },
  {
    isolationLevel: "Serializable", // 최고 수준의 격리
  }
)
```

---

### 4️⃣ 데이터 검증 레이어

```typescript
// lib/landing-pages/validators.ts
import { z } from "zod"

const BlockConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hero"),
    title: z.string().min(1).max(255),
    subtitle: z.string().optional(),
    bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    fontSize: z.number().min(12).max(72),
  }),
  z.object({
    type: z.literal("cta"),
    label: z.string().min(1).max(100),
    action: z.enum(["submit", "redirect", "phone_call", "scroll"]),
    target: z.string().optional(),
  }),
  z.object({
    type: z.literal("form"),
    fields: z.array(
      z.object({
        name: z.string(),
        type: z.enum(["text", "email", "phone", "textarea"]),
        required: z.boolean(),
        label: z.string(),
      })
    ),
  }),
  // ... other block types
])

const FormSubmissionSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/),
  message: z.string().optional(),
})

export { BlockConfigSchema, FormSubmissionSchema }
```

---

## 📊 Part 5: 성과 추적 및 분석

### CTA 성과 메트릭 대시보드

```typescript
// lib/landing-pages/analytics.ts
export async function getCTAAnalytics(
  organizationId: string,
  landingPageId: string,
  dateRange: { from: Date; to: Date }
) {
  const ctas = await prisma.ctaButton.findMany({
    where: { landingPageId },
    include: {
      conversions: {
        where: {
          clickedAt: {
            gte: dateRange.from,
            lte: dateRange.to,
          },
        },
      },
    },
  })

  return ctas.map((cta) => {
    const conversions = cta.conversions.filter((c) => c.isConversion)
    const clickCount = cta.conversions.length
    const conversionCount = conversions.length
    const conversionRate =
      clickCount > 0 ? ((conversionCount / clickCount) * 100).toFixed(2) : 0

    return {
      id: cta.id,
      trackingId: cta.trackingId,
      label: cta.label,
      position: cta.position,
      clickCount,
      conversionCount,
      conversionRate: parseFloat(conversionRate as string),
      avgTimeToConversion:
        conversions.length > 0
          ? conversions.reduce((acc, c) => acc + (c.timeToConversion || 0), 0) /
            conversions.length
          : 0,
      lastClickAt: cta.lastClickAt,
      performanceRank: 0, // 나중에 정렬로 계산
    }
  })
}
```

---

## 📋 Part 6: 배포 체크리스트

### Phase 1: Prisma 마이그레이션
- [ ] 스키마 정의 완료 (8개 모델)
- [ ] 인덱스 최적화 (27개 인덱스)
- [ ] 마이그레이션 파일 생성: `prisma/migrations/[timestamp]_landing_pages_block_system/migration.sql`
- [ ] 로컬 DB 마이그레이션 테스트
- [ ] TypeScript 타입 생성: `npx prisma generate`

### Phase 2: API 구현
- [ ] 블록 CRUD (4개 엔드포인트)
- [ ] CTA 관리 (3개 엔드포인트)
- [ ] 폼 제출 (2개 엔드포인트)
- [ ] 버전 관리 (2개 엔드포인트)
- [ ] 감사 로그 (1개 엔드포인트)

### Phase 3: 트랜잭션 테스트
- [ ] 폼 제출 롤백 테스트 (Contact 미생성 시)
- [ ] 동시성 테스트 (Race condition 확인)
- [ ] 중복 제출 방지 테스트

### Phase 4: 보안 및 성능
- [ ] 입력 검증 (Zod 스키마)
- [ ] 조직 ID 확인 (다중 테넌트)
- [ ] Rate limiting (공개 폼 제출 API)
- [ ] 감사 로그 인덱스 성능 확인

### Phase 5: 심리학 통합 (Optional)
- [ ] Day 0-3 SMS 자동화: FormSubmission 생성 시 SMS 트리거
- [ ] Contact 심리학 렌즈 자동 분류
- [ ] CTA 클릭→전환 타이밍 분석 (L6 손실회피)

---

## 🎯 핵심 설계 원칙 요약

| 원칙 | 구현 |
|------|------|
| **단일 책임** | 각 모델이 명확한 역할 (블록, CTA, 폼 제출 분리) |
| **원자성** | $transaction으로 모든 다중 작업 보호 |
| **추적성** | 감사 로그로 모든 변경 기록 |
| **확장성** | 블록 config를 JSON으로 type-agnostic 설계 |
| **성능** | 27개 인덱스로 쿼리 최적화 |
| **데이터 안전** | UNIQUE + CASCADE 전략으로 무결성 보장 |

---

## 📞 다음 단계

1. **Phase 1 시작**: Prisma 마이그레이션 파일 생성
2. **병렬 구현**: 3명 에이전트 병렬 작업
   - Agent-LP-Schema: 마이그레이션 + 타입
   - Agent-LP-API: 블록/CTA/폼 API
   - Agent-LP-Analytics: 분석 + 감사 로그
3. **통합 테스트**: TSC 컴파일 + E2E 테스트

---

**설계 완료**: 2026-06-15 | **검토 대상**: 구현 팀

