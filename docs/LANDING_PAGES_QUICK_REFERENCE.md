# Landing Pages 블록 시스템 — 빠른 참조 (Quick Reference)

**작성일**: 2026-06-15 | **대상**: 모든 팀

---

## 🎯 핵심 개념 (3줄 요약)

| 개념 | 설명 |
|------|------|
| **블록** | 페이지를 구성하는 최소 단위 (Hero, CTA, Form, Image, Text 등 16가지) |
| **CTA** | Call-To-Action 버튼/링크, 각 CTA의 클릭→전환을 추적 (attribution) |
| **폼 제출** | 방문자가 입력한 데이터 → Contact 자동 생성 + CRM 입력 |

---

## 📊 8가지 Prisma 모델

```
LandingPageBlock (블록)
├── id, landingPageId, type, blockOrder, config, ctaId
├── 16가지 타입: hero, cta, form, image, text, video, ...
└── 인덱스: 27개 (성능 최적화)

CTAButton (CTA 추적)
├── id, landingPageId, trackingId, label, ctaType
├── 메트릭: clickCount, conversionCount, conversionRate
└── 클릭 추적 ID: "cta-hero-primary"

CTAConversion (개별 클릭/전환)
├── id, ctaId, contactId, eventType (click vs conversion)
├── UTM 파라미터 저장
└── 타이밍: clickedAt, conversionAt, timeToConversion

FormSubmission (폼 제출)
├── id, landingPageId, contactId, formData (JSON)
├── 상태: PENDING → VERIFIED → PROCESSED
└── 자동 할당: assignedTo (영업사원)

LandingPageVersion (버전 관리)
├── 스냅샷: blocksSnapshot (모든 블록 JSON)
├── 상태: DRAFT → PUBLISHED → ARCHIVED
└── 예약 퍼블리시: scheduledPublishAt

LandingPageAuditLog (감사)
├── 모든 변경 추적: CREATE, UPDATE, DELETE, REORDER
├── changesBefore / changesAfter
└── userId, timestamp

FormSubmissionAuditLog (폼 제출 변경)
├── SUBMIT, UPDATE_STATUS, ASSIGN, VERIFY
└── statusBefore / statusAfter

LandingPageMeta (SEO/OG)
├── metaTitle, metaDescription, ogImage
└── structuredData (JSON-LD)
```

---

## 🔌 6개 핵심 API

### 1. 블록 관리

```bash
POST   /api/landing-pages/[id]/blocks
PATCH  /api/landing-pages/[id]/blocks/[blockId]
DELETE /api/landing-pages/[id]/blocks/[blockId]
POST   /api/landing-pages/[id]/blocks/reorder
```

**핵심**: 모든 작업이 트랜잭션 + 감사 로그

---

### 2. CTA 추적

```bash
POST   /api/landing-pages/[id]/ctas
GET    /api/landing-pages/[id]/ctas/analytics
```

**응답**: 각 CTA별 clickCount, conversionCount, conversionRate

---

### 3. 폼 제출 (공개 API)

```bash
POST   /api/landing-pages/[id]/submit-form      (인증 불필요)
GET    /api/landing-pages/[id]/forms             (관리자만)
```

**트랜잭션**: Contact 생성 + FormSubmission + CTAConversion 한 번에

---

### 4. 버전 관리

```bash
POST   /api/landing-pages/[id]/versions          (Draft 생성)
PATCH  /api/landing-pages/[id]/versions/[verId] (Publish)
GET    /api/landing-pages/[id]/versions          (목록)
```

---

### 5. 감사 로그

```bash
GET    /api/landing-pages/[id]/audit-log
GET    /api/forms/[formId]/audit-log
```

---

## 🔄 트랜잭션 3가지 핵심 케이스

### Case 1: 폼 제출 (가장 중요)

```
1. Contact 생성/업데이트 (upsert)
2. FormSubmission 생성
3. CTAConversion 생성 (클릭→전환 추적)
4. CTAButton 메트릭 업데이트 (conversionCount++)
5. 감사 로그 기록

❌ 실패: 모든 단계 롤백 (원자성 보장)
```

---

### Case 2: 블록 생성

```
1. CTA 생성 (필요시)
2. 블록 생성
3. 감사 로그 기록
```

---

### Case 3: 버전 스냅샷

```
1. 모든 블록 조회
2. 버전 번호 계산
3. blocksSnapshot 저장
4. isDraft → false (optional)
5. 감사 로그 기록
```

---

## 📈 성과 메트릭 계산식

```typescript
// 클릭율 (CTR)
CTR = clicks / page_views * 100

// 전환율 (CVR)
CVR = conversions / clicks * 100

// 전체 전환율
Overall_CVR = conversions / page_views * 100

// 평균 전환 시간
Avg_Time_To_Conversion = sum(timeToConversion) / conversion_count

// CPA (고객획득비용) - 별도 계산
CPA = ad_spend / conversions
```

---

## 🔐 데이터 무결성 규칙

### UNIQUE 제약 (중복 방지)

| 제약 | 효과 |
|------|------|
| `landingPageId, blockOrder` | 같은 페이지 내 블록 순서 중복 불가 |
| `organizationId, trackingId` | CTA 추적 ID 전사 유니크 |
| `organizationId, submitterEmail, landingPageId` | 같은 페이지에서 같은 이메일로 중복 제출 불가 |
| `landingPageId, versionNumber` | 버전 번호 유니크 |

### FK 삭제 전략

| FK | ON DELETE | 이유 |
|----|-----------|------|
| Block → LandingPage | CASCADE | 페이지 삭제 시 블록도 삭제 |
| Block → CTA | SET NULL | CTA 삭제 시 블록은 유지 |
| FormSubmission → Contact | SET NULL | Contact 삭제 시 폼 기록은 유지 (분석용) |
| CTAConversion → Contact | SET NULL | Contact 삭제 시 전환 기록은 유지 |

---

## 🧩 블록 타입 구성

```
16가지 블록 타입:
├── Content: header, hero, text, image, video
├── Interactive: cta, form, button
├── Social: testimonial, gallery
├── Info: pricing, faq, divider, spacer
├── Advanced: countdown, section

각 블록의 config (JSON):
{
  "type": "hero",
  "title": "설정값",
  "bgColor": "#FF0000",
  "fontSize": 32,
  // type별로 다름
}
```

---

## 📱 폼 필드 타입

```typescript
FormField = {
  name: string           // 필드 ID (Contact 매핑)
  type: "text" | "email" | "phone" | "textarea"
  label: string          // 화면 표시 텍스트
  required: boolean
  order: number
  placeholder?: string
  validation?: "email" | "phone" | "custom"
}

예:
[
  { name: "name", type: "text", label: "이름", required: true, order: 0 },
  { name: "email", type: "email", label: "이메일", required: true, order: 1 },
  { name: "phone", type: "phone", label: "전화", required: true, order: 2 },
]
```

---

## 🎯 Contact 매핑 (FormSubmission → Contact)

```
formData.name     → Contact.name
formData.email    → Contact.email
formData.phone    → Contact.phone
formData.message  → Contact.adminMemo

추가 자동 설정:
├── sourceType = "landing_page"
├── sourceId = landingPageId
├── type = "INQUIRY"
└── 렌즈 분류: 자동 실행 (선택사항)
```

---

## ✅ 검증 규칙

```typescript
// Contact 폼 필드
Email: z.string().email()
Phone: z.string().regex(/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/) // 한국 번호

// Rate limiting (공개 API)
Max 5 submissions per IP per 5 minutes

// 블록 설정
blockOrder: 0 ≤ order < block_count
fontSize: 12 ≤ fontSize ≤ 72
```

---

## 🚀 배포 순서 (병렬 3개 팀)

```
Day 1-2: Prisma 마이그레이션 (Team 1)
├── migration.sql 생성
├── npx prisma migrate dev
└── npx prisma generate

Day 2-3: API 구현 (Team 2)
├── POST /blocks
├── POST /submit-form
└── GET /analytics

Day 3-4: 테스트 및 통합 (Team 3)
├── Unit tests (jest)
├── 트랜잭션 테스트
└── npx tsc --noEmit

Day 5: 배포
├── Staging
├── Production
└── 모니터링
```

---

## 🔍 디버깅 팁

### 폼 제출 실패
```
1. FormSubmission.status = "INVALID" 확인
2. FormSubmission.validationResult 확인
3. Contact.phone, email 중복 확인 (UNIQUE 제약)
4. 감사 로그에서 에러 메시지 확인
```

### CTA 추적 안됨
```
1. CTAButton.clickCount 확인 (0이면 클릭 기록 안됨)
2. ctaId가 정확한지 확인
3. trackingId가 고유한지 확인 (organizationId, trackingId)
4. CTAConversion 테이블 직접 조회
```

### 버전 스냅샷 손상
```
1. LandingPageVersion.blocksSnapshot JSON 유효성 확인
2. cta_mapping이 모든 CTA ID를 포함하는지 확인
3. 롤백: 이전 버전의 blocksSnapshot으로 복원
```

---

## 📊 인덱스 성능 가이드

```
주요 쿼리 성능:
- 블록 조회 (페이지별): idx_block_page_order (빠름)
- CTA 분석: idx_cta_page + idx_conversion_cta_type (빠름)
- 폼 제출 목록: idx_form_page_time (빠름)
- 감사 로그: idx_audit_page_time (빠름)

대량 작업 최적화:
- 블록 50개 이상: 배치 업데이트 사용
- 전환 분석: 월별로 파티셔닝 고려
```

---

## 🧠 심리학 통합 (Optional)

```
폼 제출 후 자동화 (Day 0-3):
├── Day 0: 신청 완료 감사 메시지 + SMS
├── Day 1: Follow-up + 가치 강조
├── Day 2: 사례 스토리 + 심리학 렌즈 적용
└── Day 3: 긴박감 + 최종 결정 촉구

Contact 렌즈 자동 분류:
├── L6 (타이밍/손실회피): priceDeadlineDate 분석
├── L10 (즉시 구매): closingStage 업데이트
└── 기타: 폼 응답 분석
```

---

## 📞 빠른 문제 해결

| 문제 | 원인 | 해결책 |
|------|------|--------|
| 폼 제출 중복 | 같은 이메일/전화 | UNIQUE 제약이 작동함 (정상) |
| CTA 메트릭 0 | trackingId 불일치 | CTAButton의 trackingId 확인 |
| 감사 로그 누락 | 트랜잭션 실패 | 모든 작업이 롤백됨 (정상) |
| 버전 복원 실패 | blocksSnapshot 손상 | 이전 버전에서 수동 복사 |

---

**마지막 업데이트**: 2026-06-15  
**다음 문서**: LANDING_PAGES_BLOCK_ARCHITECTURE.md (상세 설계)

