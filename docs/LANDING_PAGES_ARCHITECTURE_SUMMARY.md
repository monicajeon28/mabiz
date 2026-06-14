# Landing Pages 블록 시스템 아키텍처 완성 요약

**설계 완료일**: 2026-06-15  
**설계자**: Claude Architecture Team  
**상태**: ✅ 설계 완료 → 구현 준비 완료

---

## 🎯 아키텍처 설계 완성 내용

### Part 1: Prisma 스키마 (8개 모델)

✅ **LandingPageBlock** (블록)
- 16가지 블록 타입 지원 (Hero, CTA, Form, Image, Text, Video 등)
- 타입별 유연한 `config` (JSON) 저장
- 블록 순서 관리 (`blockOrder`)
- 블록 버전 추적 (`blockVersion`)
- 감지: 조건부 렌더링 (`conditionalRules`)
- 인덱스: 6개 (페이지별, 타입별, CTA별, 상태별)

✅ **CTAButton** (CTA 추적)
- 의미있는 `trackingId` (고유, 마케팅 추적 최적화)
- 성과 메트릭 캐시: `clickCount`, `conversionCount`, `conversionRate`
- CTA 버전 관리 (`version`, `versionNote`)
- 위치별 분류: `position` (hero, mid-page, footer)
- 인덱스: 5개 (페이지별, 추적ID, 위치별, 성과 순위)

✅ **CTAConversion** (개별 클릭/전환 기록)
- 이벤트 구분: `eventType` (click vs conversion)
- 익명 방문자 추적: `visitorSessionId` (Cookie 기반)
- UTM 파라미터 자동 수집
- 타이밍 분석: `clickedAt`, `conversionAt`, `timeToConversion`
- 디바이스 정보: `deviceType`, `userAgent`
- 인덱스: 7개 (CTA별, 시간별, 방문자별, 전환별)

✅ **FormSubmission** (폼 제출)
- 상태 워크플로우: PENDING → VERIFIED → PROCESSED
- 자동 Contact 생성/업데이트 (`contactId`)
- 폼 데이터 JSON 저장 (`formData`)
- CTA 연결: `ctaId`, `ctaConversionId`
- 영업사원 자동 할당: `assignedTo`
- 중복 방지: UNIQUE(email, landingPageId), UNIQUE(phone, landingPageId)
- 인덱스: 8개 (페이지별, 상태별, Contact별, CTA별, 할당자별)

✅ **LandingPageVersion** (버전 관리)
- 상태: DRAFT → PUBLISHED → ARCHIVED → SCHEDULED
- 스냅샷: `blocksSnapshot` (완전한 블록 복사본 JSON)
- CTA 매핑: `cta_mapping` (버전 복원 시 사용)
- 예약 퍼블리시: `scheduledPublishAt`
- 버전별 성과 메트릭: viewCount, uniqueVisitors, conversionCount
- 인덱스: 4개 (페이지별, 상태별, 퍼블리시 시간별)

✅ **LandingPageAuditLog** (감사)
- 모든 변경 추적: CREATE, UPDATE, DELETE, REORDER, PUBLISH 등
- 변경 전후 비교: `changesBefore`, `changesAfter`
- 사용자 정보 기록: userId, userName, userRole
- 보안 정보: ipAddress, userAgent
- 인덱스: 5개 (페이지별, 조직별, 사용자별, 액션별)

✅ **FormSubmissionAuditLog** (폼 제출 변경)
- 상태 변화 추적: statusBefore, statusAfter
- 구체적 변경사항: changes (JSON)
- 인덱스: 2개 (폼별, 조직+액션별)

✅ **LandingPageMeta** (SEO/OG)
- 메타데이터: title, description, keywords
- 소셜 공유: ogTitle, ogDescription, ogImage, twitterCard
- 구조화된 데이터: structuredData (JSON-LD)
- 표준 URL: canonical

**총 27개 인덱스로 쿼리 성능 최적화**

---

### Part 2: API 설계 (6개 엔드포인트 그룹)

#### 1️⃣ 블록 관리 (4개)

```
POST   /api/landing-pages/[id]/blocks              # 블록 생성
PATCH  /api/landing-pages/[id]/blocks/[blockId]   # 블록 수정
DELETE /api/landing-pages/[id]/blocks/[blockId]   # 블록 삭제
POST   /api/landing-pages/[id]/blocks/reorder      # 순서 변경 (배치)
```

**특징**:
- 모든 작업이 트랜잭션 보호
- 감사 로그 자동 기록
- 입력 검증 (Zod 스키마)
- CTA 자동 생성 (필요시)

---

#### 2️⃣ CTA 관리 (2개)

```
POST   /api/landing-pages/[id]/ctas
GET    /api/landing-pages/[id]/ctas/analytics
```

**응답 포함**:
- 각 CTA별 성능: clickCount, conversionCount, conversionRate
- 타이밍 분석: avgTimeToConversion
- 성과 순위: performanceRank (자동 계산)

---

#### 3️⃣ 폼 제출 (2개)

```
POST   /api/landing-pages/[id]/submit-form         # 공개 API (인증 X)
GET    /api/landing-pages/[id]/forms               # 관리 API
```

**공개 API 특징**:
- 인증 불필요 (방문자가 사용)
- Rate limiting (IP당 5회/5분)
- 트랜잭션: Contact + FormSubmission + CTAConversion 한 번에
- 중복 제출 방지 (UNIQUE 제약)

**관리 API**:
- 폼 제출 목록 조회
- 상태별 필터링
- 페이지네이션

---

#### 4️⃣ 버전 관리 (3개)

```
POST   /api/landing-pages/[id]/versions            # 스냅샷 생성
PATCH  /api/landing-pages/[id]/versions/[verId]   # 상태 변경 (Publish)
GET    /api/landing-pages/[id]/versions            # 버전 목록
```

---

#### 5️⃣ 감사 로그 (2개)

```
GET    /api/landing-pages/[id]/audit-log           # 페이지 감사
GET    /api/forms/[formId]/audit-log               # 폼 제출 감사
```

---

### Part 3: 트랜잭션 관리

✅ **3가지 핵심 트랜잭션 설계**

#### Case 1: 폼 제출 (가장 중요)
```
Step 1: Contact 생성/업데이트 (upsert)
Step 2: FormSubmission 생성
Step 3: CTAConversion 생성 (전환 추적)
Step 4: CTAButton 메트릭 증가 (conversionCount++)
Step 5: 감사 로그 기록

원자성: 모든 단계가 성공하거나 모두 롤백
데이터 무결성: UNIQUE 제약이 중복 제출 자동 방지
```

#### Case 2: 블록 생성
```
Step 1: CTA 생성 (필요시)
Step 2: 블록 생성
Step 3: 감사 로그 기록
```

#### Case 3: 버전 스냅샷
```
Step 1: 모든 블록 조회
Step 2: 버전 번호 계산
Step 3: blocksSnapshot 저장
Step 4: isDraft 상태 업데이트
Step 5: 감사 로그 기록
```

---

### Part 4: 데이터 무결성 전략

✅ **UNIQUE 제약 (중복 방지)**

| 제약 | 목적 | 효과 |
|------|------|------|
| `landingPageId, blockOrder` | 블록 순서 유니크 | 같은 페이지 내 순서 중복 불가 |
| `organizationId, trackingId` | CTA 추적 ID | 마케팅 추적 정확성 보장 |
| `organizationId, submitterEmail, landingPageId` | 폼 중복 | 같은 페이지에서 이메일 중복 불가 |
| `landingPageId, versionNumber` | 버전 체인 | 버전 무결성 보장 |

✅ **FK 삭제 전략**

| 관계 | ON DELETE | 이유 |
|------|-----------|------|
| Block → LandingPage | CASCADE | 페이지 삭제 시 블록도 삭제 |
| Block → CTA | SET NULL | CTA 삭제 시 블록은 유지 |
| FormSubmission → Contact | SET NULL | Contact 삭제 시 폼 기록은 유지 (분석용) |
| CTAConversion → Contact | SET NULL | Contact 삭제 시 전환 기록은 유지 |

**원칙**: 분석 데이터는 절대 CASCADE 삭제 금지 (감사 추적 필요)

---

### Part 5: 성과 추적 및 분석

✅ **5가지 핵심 메트릭**

```
1. 클릭율 (CTR) = clicks / page_views * 100
2. 전환율 (CVR) = conversions / clicks * 100
3. 전체 전환율 = conversions / page_views * 100
4. 평균 전환 시간 = sum(timeToConversion) / conversion_count
5. CTA 성과 순위 = sorted by conversionRate DESC

분석 쿼리:
├── CTA 순위 매기기 (성능 기준)
├── 폼 제출 퍼널 분석 (방문→클릭→제출→전환)
├── 디바이스별 분석 (모바일/태블릿/PC)
└── UTM 기반 캠페인 분석
```

---

### Part 6: 심리학 통합 (Optional)

✅ **Grant Cardone 10렌즈 적용 가능**

```
폼 제출 → Contact 자동 생성 후 자동화:
├── Day 0: SMS 발송 (신청 감사)
├── Day 1-3: PASONA 프레임워크 (P→S→O→A→N)
├── Day 7+: Grant Cardone Follow-up

Contact 렌즈 자동 분류:
├── L6 (타이밍/손실회피): priceDeadlineDate 분석
├── L10 (즉시 구매): closingStage 업데이트
└── 기타 렌즈: 폼 응답 분석으로 분류
```

---

## 📋 완성된 문서 3개

1. **LANDING_PAGES_BLOCK_ARCHITECTURE.md** (63KB)
   - 8가지 Prisma 모델 상세 설계
   - 6개 API 엔드포인트 명세
   - 3가지 트랜잭션 코드 예제
   - 데이터 무결성 전략
   - 배포 체크리스트

2. **LANDING_PAGES_IMPLEMENTATION_GUIDE.md** (45KB)
   - Prisma 마이그레이션 SQL 템플릿
   - 구현 패턴 3가지 (블록, 폼, 분석)
   - Unit 테스트 사례
   - 성과 분석 쿼리

3. **LANDING_PAGES_QUICK_REFERENCE.md** (15KB)
   - 빠른 참조 가이드
   - 핵심 개념 3줄 요약
   - 모델/API/메트릭 요약표
   - 디버깅 팁

---

## 🚀 다음 단계: 구현 준비

### Phase 1: Prisma 마이그레이션 (2-3일)
```bash
npx prisma migrate dev --name landing_pages_block_system
npx prisma generate
npm run tsc  # TypeScript 컴파일
```

### Phase 2: API 구현 (3-4일)
- 병렬 3명 에이전트
- Agent-LP-Schema: 마이그레이션 + 타입
- Agent-LP-API: CRUD API
- Agent-LP-Analytics: 분석 + 감사

### Phase 3: 통합 테스트 (2-3일)
- Unit 테스트 (Jest)
- 트랜잭션 테스트
- E2E 테스트

### Phase 4: 배포 (1일)
- Staging → Production
- 모니터링 설정

**총 소요시간**: 8-11일 (병렬 3명 에이전트)

---

## ✨ 설계의 주요 강점

1. **원자성 보장** — 모든 다중 작업이 트랜잭션으로 보호
2. **데이터 안전성** — UNIQUE + CASCADE + 감사 로그로 무결성 보장
3. **성능 최적화** — 27개 인덱스로 쿼리 성능 보장
4. **확장성** — 블록 config (JSON)로 새로운 타입 추가 용이
5. **추적성** — 모든 변경사항 감사 로그로 기록
6. **심리학 통합** — Day 0-3 SMS + 렌즈 자동 분류 가능

---

## 📊 아키텍처 메트릭

| 항목 | 수치 |
|------|------|
| Prisma 모델 | 8개 |
| API 엔드포인트 | 15개 (블록 4 + CTA 2 + 폼 2 + 버전 3 + 감사 2 + 추가) |
| 인덱스 | 27개 |
| 트랜잭션 케이스 | 3개 (폼 제출, 블록 생성, 버전 스냅샷) |
| 단위 테스트 | 4개 (테스트 템플릿 제공) |
| 문서 파일 | 3개 (총 120KB) |

---

## 🎯 설계 원칙 최종 확인

✅ **ACID 준수**
- Atomicity: 트랜잭션으로 보호
- Consistency: UNIQUE + FK + 검증으로 보장
- Isolation: Serializable 격리 수준 사용 가능
- Durability: PostgreSQL 엔진에 위임

✅ **CAP 정리**
- Consistency: UNIQUE 제약 + 트랜잭션
- Availability: 읽기 성능 최적화 (인덱스)
- Partition tolerance: 조직별 격리 (tenantId)

✅ **심리학 통합**
- Grant Cardone 10렌즈 3개 이상 적용 가능
- Day 0-3 SMS 시퀀스 자동화
- Contact 렌즈 분류 자동화
- 성과 메트릭 추적 (전환율, LTV)

---

## 📞 질문 및 피드백

| 항목 | 연락처 |
|------|--------|
| 아키텍처 검토 | Claude Architecture Team |
| 구현 시작 | Agent-LP (병렬 3명) |
| 배포 지원 | DevOps Team |

---

**설계 완료**: 2026-06-15 21:30 KST  
**다음 단계**: 구현팀 검토 → Phase 1 Prisma 마이그레이션 시작

🎯 **최종 상태**: ✅ 설계 완료 → 📋 구현 준비 완료 → 🚀 배포 대기

