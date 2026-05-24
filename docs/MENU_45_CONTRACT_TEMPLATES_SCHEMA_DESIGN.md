# Menu #45: 계약서 템플릿 - 스키마 설계 문서

**작업 유형**: T3 (파트너 교육) + T5 (CRM 자동화) + T6 (대시보드/KPI)  
**작성일**: 2026-05-24  
**상태**: 설계 단계 (구현 전 검토)

---

## 📋 목차

1. [개요](#개요)
2. [Prisma 스키마 모델](#prisma-스키마-모델)
3. [API 엔드포인트 설계](#api-엔드포인트-설계)
4. [UI/UX 구조](#uiux-구조)
5. [심리학 + SMS 통합](#심리학--sms-통합)
6. [데이터베이스 마이그레이션](#데이터베이스-마이그레이션)
7. [성과 추적 메트릭](#성과-추적-메트릭)

---

## 개요

Menu #45는 **계약서 템플릿 관리 시스템**으로, 파트너와 고객을 위한 표준화된 계약서를 제공합니다.

### 핵심 기능
- **템플릿 목록**: 기본 제공 5가지 + 커스텀 템플릿
- **템플릿 편집**: Rich Text Editor (Draft.js) + 필드 매핑 ({{변수명}})
- **심리학 렌즈 태그**: L0-L10 선택으로 목표 고객 세그먼트 명확화
- **SMS 자동화**: Day 0-3 시퀀스 연동 (Template #4 통합)
- **미리보기/PDF**: 실제 계약서 렌더링 확인
- **사용 통계**: 템플릿별 생성된 계약서 수 추적
- **권한 관리**: 전체/팀장만/개인용 3단계 설정

### Psychology Lens 매핑

```
L0: 부재중 고객 재활성화 → "재계약 기회" 템플릿
L1: 가격 이의 대응 → "비용 절감" 계약 옵션
L2: 준비 불안감 해소 → "단계별 가이드" 포함 템플릿
L3: 차별성 강조 → "프리미엄" vs "표준" 2가지 템플릿
L5: 자기투영 → "맞춤 계약" 개인화 필드
L6: 타이밍/손실회피 → "제한된 기간" 문구 포함
L7: 동반자 설득 → "가족 동의" 서명란
L9: 의료 신뢰 → "의료 안전" 검증 포함 템플릿
L10: 즉시 구매 → "전자 서명 완료" 긴박감 표시
```

---

## Prisma 스키마 모델

### 1. ContractTemplate (핵심 테이블)

```prisma
model ContractTemplate {
  id                    String                     @id @default(cuid())
  organizationId        String
  
  // 템플릿 메타정보
  name                  String                     @db.VarChar(255)
  description           String?
  category              String                     @db.VarChar(50)  // "CRUISE"|"RENTAL"|"HOTEL"|"PACKAGE"|"OTHER"
  
  // Rich Text 본문 (Draft.js JSON 또는 HTML)
  htmlContent           String?                    // HTML 렌더링 용
  jsonContent           Json?                      // Draft.js raw content (향후 에디터용)
  
  // 필드 매핑: {{고객명}}, {{여행일자}} 등 자동치환
  fieldMapping          Json                       @default("{}")  // { "고객명": "contactName", "여행일자": "departureDate" }
  
  // Psychology Lens 태그 (다중선택)
  psychologyLenses      String[]                   @default([])    // ["L0", "L1", "L3"]
  
  // SMS 자동화 연동
  smsDay0TemplateId     String?                    // ScheduledSms 또는 SmsTemplate 참조
  smsDay1TemplateId     String?
  smsDay2TemplateId     String?
  smsDay3TemplateId     String?
  
  // 권한 관리
  visibility            String                     @default("ORGANIZATION")  // "ORGANIZATION"|"MANAGER_ONLY"|"PERSONAL"
  createdByUserId       String?
  
  // 사용 통계
  usageCount            Int                        @default(0)     // 이 템플릿으로 생성된 계약서 수
  lastUsedAt            DateTime?
  
  // 상태 관리
  status                String                     @default("ACTIVE")  // "ACTIVE"|"ARCHIVED"|"DRAFT"
  version               Int                        @default(1)
  isSystemTemplate      Boolean                    @default(false) // 시스템 기본 템플릿 여부
  
  // 타임스탬프
  createdAt             DateTime                   @default(now()) @db.Timestamptz(6)
  updatedAt             DateTime                   @updatedAt @db.Timestamptz(6)
  
  // 관계
  organization          Organization               @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  generatedContracts    ContractInstance[]         @relation("TemplateInstances")
  
  @@unique([organizationId, name], map: "uq_contract_template_org_name")
  @@index([organizationId, status])
  @@index([organizationId, category])
  @@index([organizationId, psychologyLenses])
  @@index([createdByUserId])
  @@map("ContractTemplate")
}
```

### 2. ContractInstance (생성된 계약서 인스턴스)

```prisma
model ContractInstance {
  id                    String                     @id @default(cuid())
  organizationId        String
  templateId            String
  contactId             String?
  
  // 계약서 정보
  documentTitle         String                     @db.VarChar(255)
  renderedHtml          String                     // 최종 렌더링된 HTML (변수치환 완료)
  pdfUrl                String?                    // PDF 저장 경로 (S3 또는 로컬)
  
  // 데이터 바인딩
  boundData             Json                       // { "고객명": "김민성", "여행일자": "2026-06-01" }
  
  // 계약 진행상태 (Menu #43 contracts와 유사 구조)
  status                String                     @default("DRAFT")  // "DRAFT"|"SENT"|"SIGNED"|"COMPLETED"
  
  // SMS 자동화 상태 추적 (Template #4 통합)
  smsDay0Sent           Boolean                    @default(false)
  smsDay0SentAt         DateTime?
  smsDay1Sent           Boolean                    @default(false)
  smsDay1SentAt         DateTime?
  smsDay2Sent           Boolean                    @default(false)
  smsDay2SentAt         DateTime?
  smsDay3Sent           Boolean                    @default(false)
  smsDay3SentAt         DateTime?
  
  // L10 렌즈: 시간 제한 및 긴박감
  expiresAt             DateTime?                  // 서명 제한 시간 (기본 24시간)
  
  // 생성/진행상황
  createdByUserId       String
  createdAt             DateTime                   @default(now()) @db.Timestamptz(6)
  updatedAt             DateTime                   @updatedAt @db.Timestamptz(6)
  
  // 관계
  template              ContractTemplate           @relation("TemplateInstances", fields: [templateId], references: [id], onDelete: Cascade)
  contact               Contact?                   @relation(fields: [contactId], references: [id], onDelete: SetNull)
  organization          Organization               @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@index([organizationId, status])
  @@index([templateId])
  @@index([contactId])
  @@index([createdAt(sort: Desc)])
  @@map("ContractInstance")
}
```

### 3. Organization 관계 추가

```prisma
model Organization {
  // ... 기존 필드 ...
  contractTemplates     ContractTemplate[]        // 새 관계
  contractInstances     ContractInstance[]        // 새 관계
}
```

---

## API 엔드포인트 설계

### 기본 구조
- **Base URL**: `/api/contract-templates`
- **인증**: getAuthContext() 사용 (기존 RBAC)
- **응답 형식**: { ok: boolean, data?: T, message?: string }

### 1. GET /api/contract-templates (목록 조회)

**목적**: 모든 템플릿 조회 + 사용 통계

**응답**:
```typescript
{
  ok: boolean;
  templates: Array<{
    id: string;
    name: string;
    description: string | null;
    category: "CRUISE" | "RENTAL" | "HOTEL" | "PACKAGE" | "OTHER";
    psychologyLenses: string[];  // ["L0", "L1"]
    usageCount: number;
    lastUsedAt: string | null;
    status: "ACTIVE" | "ARCHIVED" | "DRAFT";
    visibility: "ORGANIZATION" | "MANAGER_ONLY" | "PERSONAL";
    isSystemTemplate: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  totalCount: number;
  message?: string;
}
```

**쿼리 파라미터**:
- `category?: string` - 카테고리 필터
- `status?: string` - 상태 필터
- `lens?: string` - 심리학 렌즈 필터 (L0, L1 등)
- `sort?: "recent" | "mostUsed" | "alphabetical"` - 정렬 순서

---

### 2. GET /api/contract-templates/[id] (단일 조회)

**목적**: 템플릿 상세 조회 (편집/미리보기용)

**응답**:
```typescript
{
  ok: boolean;
  template: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    htmlContent: string;
    fieldMapping: Record<string, string>;
    psychologyLenses: string[];
    smsDay0TemplateId: string | null;
    smsDay1TemplateId: string | null;
    smsDay2TemplateId: string | null;
    smsDay3TemplateId: string | null;
    visibility: string;
    status: string;
    version: number;
    isSystemTemplate: boolean;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
  };
  message?: string;
}
```

---

### 3. POST /api/contract-templates (생성)

**목적**: 새 템플릿 생성

**요청 본문**:
```typescript
{
  name: string;              // 필수
  description?: string;
  category: string;          // 필수: CRUISE|RENTAL|HOTEL|PACKAGE|OTHER
  htmlContent: string;       // 필수: <p>{{고객명}}</p>
  fieldMapping: Record<string, string>;  // { "고객명": "contactName" }
  psychologyLenses: string[];            // ["L0", "L3", "L6"]
  smsDay0TemplateId?: string;
  smsDay1TemplateId?: string;
  smsDay2TemplateId?: string;
  smsDay3TemplateId?: string;
  visibility?: "ORGANIZATION" | "MANAGER_ONLY" | "PERSONAL";
  status?: "ACTIVE" | "DRAFT";
}
```

**응답**:
```typescript
{
  ok: boolean;
  template: { id: string; ... };
  message: string;  // "템플릿 생성 완료"
}
```

---

### 4. PATCH /api/contract-templates/[id] (수정)

**목적**: 기존 템플릿 수정 + 버전 관리

**요청 본문**: POST와 동일 (모든 필드 선택사항)

**응답**: GET /api/contract-templates/[id]와 동일

**버전 관리**:
- 수정 시마다 `version` 증가
- `isSystemTemplate=true`면 수정 불가 (복사 후 편집)

---

### 5. DELETE /api/contract-templates/[id] (삭제)

**목적**: 템플릿 삭제 (또는 ARCHIVED 상태로 변경)

**정책**:
- `isSystemTemplate=true`: 삭제 불가 (400 Bad Request)
- `usageCount > 0`: 논리적 삭제만 가능 (status → ARCHIVED)
- `usageCount = 0`: 물리적 삭제 또는 ARCHIVED 선택

**응답**:
```typescript
{
  ok: boolean;
  message: "템플릿 삭제됨" | "템플릿 보관됨";
}
```

---

### 6. POST /api/contract-templates/[id]/preview (미리보기)

**목적**: 샘플 데이터로 렌더링된 HTML/PDF 생성

**요청 본문**:
```typescript
{
  sampleData?: Record<string, string>;  // { "고객명": "김민성", "여행일자": "2026-06-01" }
  format: "html" | "pdf";               // 기본값: "html"
}
```

**응답**:
```typescript
{
  ok: boolean;
  html?: string;          // format="html"일 때
  pdfUrl?: string;        // format="pdf"일 때 (임시 URL, 1시간 유효)
  message?: string;
}
```

---

### 7. POST /api/contract-instances (인스턴스 생성)

**목적**: 템플릿으로부터 계약서 생성 + SMS 자동화 큐잉

**요청 본문**:
```typescript
{
  templateId: string;                    // 필수
  contactId?: string;
  boundData: Record<string, string>;     // { "고객명": "김민성", ... }
  autoSendSms: boolean;                  // Day 0-3 SMS 자동 발송 여부 (기본값: true)
}
```

**부작용**:
1. `ContractInstance` 생성
2. HTML 렌더링 (변수 치환)
3. PDF 생성 (선택)
4. SMS Day 0 큐잉 (autoSendSms=true 시)
5. ContactLensSequence 생성 (해당 렌즈별)

**응답**:
```typescript
{
  ok: boolean;
  instance: {
    id: string;
    templateId: string;
    status: "DRAFT";
    renderedHtml: string;
    pdfUrl?: string;
    expiresAt: string;      // 24시간 후
  };
  smsScheduled?: {
    day0: { sent: boolean; scheduledAt: string };
    day1: { sent: boolean; scheduledAt: string };
    day2: { sent: boolean; scheduledAt: string };
    day3: { sent: boolean; scheduledAt: string };
  };
  message: string;
}
```

---

### 8. GET /api/contract-instances (인스턴스 목록)

**목적**: 생성된 계약서 목록 + 진행상태 추적

**응답**:
```typescript
{
  ok: boolean;
  instances: Array<{
    id: string;
    templateId: string;
    templateName: string;
    contactId: string | null;
    contactName: string | null;
    status: "DRAFT" | "SENT" | "SIGNED" | "COMPLETED";
    expiresAt: string | null;
    timeRemaining: string;  // "12시간 30분" | "시간초과"
    smsStatus: {
      day0Sent: boolean;
      day0SentAt: string | null;
      day1Sent: boolean;
      day2Sent: boolean;
      day3Sent: boolean;
    };
    createdAt: string;
  }>;
  totalCount: number;
}
```

---

## UI/UX 구조

### 폴더 구조
```
src/app/(dashboard)/
├── contract-templates/
│   ├── page.tsx                 # 목록 페이지 (LIST)
│   ├── new/
│   │   └── page.tsx            # 생성 페이지 (CREATE)
│   ├── [id]/
│   │   ├── page.tsx            # 편집 페이지 (UPDATE)
│   │   └── preview/
│   │       └── page.tsx        # 미리보기 페이지
│   └── components/
│       ├── TemplateList.tsx     # 테이블 컴포넌트
│       ├── TemplateForm.tsx     # 폼 (생성/편집 공용)
│       ├── RichTextEditor.tsx   # Draft.js 에디터
│       ├── FieldMappingEditor.tsx
│       ├── PsychologyLensSelector.tsx
│       ├── SmsTemplateSelector.tsx
│       └── PreviewCard.tsx
```

### 페이지별 레이아웃

#### 1. 목록 페이지 (`/contract-templates`)
- **헤더**: "계약서 템플릿" + "새 템플릿" 버튼
- **필터 바**: 카테고리, 상태, 심리학 렌즈, 권한
- **테이블 컬럼**:
  - 템플릿명
  - 카테고리 배지
  - 심리학 렌즈 태그 (L0, L1 등)
  - 사용 횟수 (클릭하면 생성된 계약서 목록)
  - 마지막 사용일
  - 상태 배지 (ACTIVE/ARCHIVED)
  - 액션: 미리보기, 편집, 삭제

#### 2. 생성/편집 페이지 (`/contract-templates/new`, `/[id]`)
- **좌측 패널**: 폼 입력
  - 템플릿명 (텍스트)
  - 설명 (텍스트)
  - 카테고리 선택 (드롭다운)
  - 필드 매핑 에디터 (동적 추가/삭제)
  - 심리학 렌즈 체크박스 (L0-L10)
  - SMS 템플릿 선택 (Day 0-3 각각)
  - 권한 설정 (라디오 버튼)
  - 저장/취소 버튼

- **우측 패널**: 실시간 미리보기
  - HTML 렌더링된 계약서 미리보기
  - 필드 변경 시 실시간 업데이트
  - "PDF 다운로드" 버튼 (임시)

#### 3. 미리보기 페이지 (`/[id]/preview`)
- **상단**: 템플릿 정보 + 필드 입력 폼 (샘플 데이터)
- **중앙**: 렌더링된 HTML
- **하단**: "이 템플릿으로 계약서 생성하기" 버튼 (실제 고객 선택 모달)

---

## 심리학 + SMS 통합

### Template #3 + #5 통합 로직

#### A. 파트너 교육 (T3)
각 템플릿의 "설명" 섹션에 다음 정보 포함:
- **권장 대상**: "신입 파트너용" | "기존 파트너용" | "모두"
- **예상 전환 시간**: "1일" | "3일" | "7일"
- **필요 세그먼트**: L3 (차별성) + L6 (타이밍) 강조 시 "프리미엄" 버전

#### B. CRM 자동화 (T5)
템플릿 사용 시 자동화 흐름:

```
1. 사용자가 ContractInstance 생성
2. API가 psychologyLenses 읽음 (예: ["L0", "L6"])
3. ContactLensClassification 검색 또는 생성
4. ContactLensSequence 생성 (4일 자동화)
5. ScheduledSms 큐잉 (Day 0-3)
```

#### C. SMS Day 0-3 매핑

| Day | SMS 목적 (PASONA) | 예시 | Lens |
|-----|-------------------|------|------|
| **Day 0** | P(Problem) 단계: "계약서 초대" | "김민성님, 계약서 링크를 보내드렸습니다. 24시간 내 서명 완료 시 특별 혜택!" | L6 |
| **Day 1** | S(Solution) 단계: "필요한 서류 안내" | "서명 어려운 부분 있으신가요? 고객센터로 문의하세요." | L2 |
| **Day 2** | O(Offer) 단계: "혜택 강조" | "이 계약서로 월 50만원 절감 가능합니다 (예: L1 가격이의 대응)" | L1 |
| **Day 3** | A(Action) 단계: "긴박감 + 최종 결정" | "오늘까지만 유효합니다. 지금 바로 서명하세요!" | L10 |

#### D. 템플릿별 기본 SMS 설정

```
렌탈 상품 템플릿:
  - Day 0: "렌탈 계약서 안내" SMS
  - Day 1: "필요 서류 확인" SMS
  - Day 2: "월 절감액 계산" SMS
  - Day 3: "오늘까지 특별 가격" SMS

크루즈 패키지 템플릿:
  - Day 0: "해외여행 계약서 안내"
  - Day 1: "여권 제출 안내"
  - Day 2: "특별 할인 종료" 
  - Day 3: "최종 확인"
```

---

## 데이터베이스 마이그레이션

### 마이그레이션 전략

#### 1단계: Prisma 스키마 추가

```bash
# schema.prisma에 위의 ContractTemplate, ContractInstance 추가
# Organization 관계 추가
```

#### 2단계: 마이그레이션 생성

```bash
npx prisma migrate dev --name "add_contract_templates"
```

#### 3단계: 기본 데이터 시드 (선택)

```typescript
// prisma/seed.ts 또는 별도 seed 파일
const systemTemplates = [
  {
    name: "크루즈 표준 계약서",
    category: "CRUISE",
    htmlContent: "<p>계약자명: {{고객명}}</p><p>출발일: {{여행일자}}</p>...",
    fieldMapping: { "고객명": "contactName", "여행일자": "departureDate" },
    psychologyLenses: ["L0", "L6", "L7"],
    isSystemTemplate: true,
  },
  // ... 4개 더
];
```

---

## 성과 추적 메트릭

### Template #6 (KPI) 통합

#### 1. 템플릿 성과 대시보드

```typescript
interface ContractTemplateKPI {
  templateId: string;
  templateName: string;
  category: string;
  psychologyLenses: string[];
  
  // 사용 통계
  totalCreated: number;        // 이 템플릿으로 생성된 계약서 수
  totalSigned: number;         // 서명 완료된 계약서 수
  totalCompleted: number;      // 완료된 계약서 수
  signatureRate: number;       // (signed / created) * 100
  completionRate: number;      // (completed / created) * 100
  
  // SMS 효과 추적
  smsDay0SendCount: number;
  smsDay0ClickRate: number;    // Day 0 SMS 클릭율
  smsDay3ConversionRate: number; // Day 3 SMS → 계약 완료 전환율
  
  // 시간 메트릭
  avgSignatureDays: number;    // 평균 서명 완료 기간 (일)
  avgCompletionDays: number;
  
  // 렌즈별 효과
  lensPerformance: {
    L0: { createdCount: number; signatureRate: number };
    L1: { createdCount: number; signatureRate: number };
    // ...
  };
}
```

#### 2. 주간/월간 리포팅

- **주간**: 신규 계약서 수, 서명율, SMS 클릭율
- **월간**: 템플릿별 성과 비교, 렌즈별 효율성, 예상 수익

#### 3. 자동 경고 시스템

- 서명율 < 40%: "이 템플릿의 서명율이 저하했습니다. A/B테스트를 고려하세요."
- SMS Day 3 클릭율 < 15%: "Day 3 SMS 메시지 개선이 필요합니다."
- 사용 횟수 0 (30일): "사용되지 않는 템플릿입니다. 보관하시겠습니까?"

---

## 구현 체크리스트

### Phase 1: 스키마 + API (1-2일)
- [ ] Prisma 스키마 추가 (ContractTemplate, ContractInstance)
- [ ] DB 마이그레이션
- [ ] API 5개 엔드포인트 구현 (GET, POST, PATCH, DELETE, /preview)
- [ ] 기본 데이터 시드

### Phase 2: UI 페이지 (2-3일)
- [ ] 목록 페이지 (테이블 + 필터)
- [ ] 생성/편집 페이지 (폼 + 미리보기)
- [ ] 미리보기 페이지 (PDF 렌더링)
- [ ] 컴포넌트 (RichTextEditor, FieldMapper, PsychologyLensSelector)

### Phase 3: 자동화 + SMS (1-2일)
- [ ] ContractInstance 생성 시 SMS Day 0-3 큐잉
- [ ] ContactLensSequence 생성 자동화
- [ ] SMS 상태 추적 (smsDay0Sent, smsDay1Sent 등)
- [ ] SMS 자동 발송 (cron job)

### Phase 4: 성과 추적 (1일)
- [ ] 템플릿 KPI 계산 API
- [ ] 주간/월간 리포팅
- [ ] 자동 경고 시스템

### Phase 5: 테스트 + 배포 (1일)
- [ ] 통합 테스트
- [ ] UI/UX 검증
- [ ] 성능 최적화 (Lighthouse 95+)
- [ ] 접근성 (WCAG 2.1 AA)

---

## 참고: 기존 Menu 구조

### Menu #43 (계약서)
- 이미 존재하는 contracts 페이지
- ContractInstance와 유사한 구조 (invited/signed/completed 상태)
- Menu #45는 **템플릿 관리** 중심 (Menu #43은 **계약서 진행상황** 중심)

### Menu #38 (SMS 자동화)
- SmsTemplate, ScheduledSms 테이블 이미 있음
- Menu #45의 SMS Day 0-3는 이 인프라 활용

### Menu #37 (콜 플레이북)
- ScriptPattern, LensTemplate 활용 패턴 참고

---

## 결론

Menu #45 계약서 템플릿은 **T3 + T5 + T6 통합 메뉴**로:

1. **파트너 교육(T3)**: 템플릿의 설명과 가이드로 신입/기존 파트너 교육
2. **CRM 자동화(T5)**: 템플릿 사용 시 자동으로 Day 0-3 SMS 시퀀스 큐잉
3. **대시보드(T6)**: 템플릿별 성과(서명율, 완료율) 추적 + 렌즈별 효율성 분석

심리학 렌즈를 명확히 매핑하여 **"이 템플릿은 L6(타이밍) 고객을 노린다"**는 의도를 기술적으로 구현하고, SMS 자동화와 KPI 추적으로 **실제 전환율 개선**을 측정합니다.

