# 여권 시스템 파일 인벤토리

**생성일**: 2026-05-11  
**총 파일**: 48개  
**총 라인 수**: 10,217줄  
**총 크기**: 약 414KB

---

## 📋 API Routes (38개, 5,754줄)

### Public API (8개, 1,478줄)

| 파일 | 라인 | 크기 | 설명 |
|------|------|------|------|
| `[token].route.ts` | 149 | 8.0K | 여권 정보 조회 |
| `[token]-submit.route.ts` | 219 | 8.0K | 여권 정보 제출 (주요 엔드포인트) |
| `[token]-upload.route.ts` | 115 | 4.0K | 이미지 업로드 |
| `[token]-ocr.route.ts` | 150 | 8.0K | 여권 스캔 OCR |
| `scan.route.ts` | 340 | 16K | Google Vision 여권 스캔 ⭐ |
| `submit.route.ts` | 171 | 8.0K | 직접 제출 (레거시) |
| `chatbot-sync.route.ts` | 188 | 8.0K | 챗봇 동기화 |
| `reservations-passport-status.route.ts` | 76 | 4.0K | 예약별 여권 상태 조회 |

**특징:**
- 토큰 기반 인증
- 수동 입력 검증 (Zod 미적용)
- Google Vision API 사용
- 외부 고객 접근 가능

---

### Customer API (2개, 377줄)

| 파일 | 라인 | 크기 | 설명 |
|------|------|------|------|
| `passport-request.route.ts` | 126 | 8.0K | 여권 요청 조회 |
| `passport-upload.route.ts` | 251 | 8.0K | 이미지 업로드 |

**특징:**
- 로그인 필수 (NextAuth)
- IDOR 방지 (본인 예약만)
- 파일 업로드 처리

---

### Partner API (9개, 1,349줄)

| 파일 | 라인 | 크기 | 설명 |
|------|------|------|------|
| `passport-requests.route.ts` | 76 | 4.0K | 리드 여권 요청 목록 |
| `passport-requests-send.route.ts` | 13 | 4.0K | (레거시/비어있음) |
| `passport-requests-manual.route.ts` | 287 | 8.0K | 수동 등록 |
| `passport-requests-ocr-to-apis.route.ts` | 347 | 12K | OCR 자동화 ⭐ |
| `passport-requests-leadid-passport-link.route.ts` | 179 | 8.0K | 리드별 링크 생성 |
| `passport-request-link.route.ts` | 126 | 8.0K | 링크 생성 |
| `passport-request-templates.route.ts` | 76 | 4.0K | 템플릿 조회 |
| `passport-templates.route.ts` | 80 | 4.0K | 템플릿 관리 |
| `chat-bot-passport-flow.route.ts` | 151 | 8.0K | 챗봇 통합 |

**특징:**
- 파트너 인증 필수
- 대량 처리 지원
- OCR 자동화

---

### Admin API (17개, 2,550줄)

| 파일 | 라인 | 크기 | 설명 |
|------|------|------|------|
| `_utils.ts` | 200 | 8.0K | 공유 유틸 (requireAdminUser, buildPassportLink) |
| `passport-request-customers.route.ts` | 349 | 12K | 여권 요청 고객 목록 ⭐ |
| `passport-request-history.route.ts` | 103 | 4.0K | 요청 이력 조회 |
| `passport-request-link.route.ts` | 80 | 4.0K | 링크 생성 |
| `passport-request-manual.route.ts` | 293 | 8.0K | 수동 등록 |
| `passport-request-manual-register.route.ts` | 377 | 16K | 매뉴얼 등록 (복잡) ⭐ |
| `passport-request-ocr-to-apis.route.ts` | 364 | 16K | OCR 자동화 ⭐ |
| `passport-request-search.route.ts` | 77 | 4.0K | 여권 검색 |
| `passport-request-send.route.ts` | 493 | 16K | SMS 발송 (가장 큼) ⭐⭐ |
| `passport-request-templates.route.ts` | 93 | 4.0K | 템플릿 관리 |
| `customers-userid-passport.route.ts` | 333 | 12K | 고객별 여권 정보 ⭐ |
| `affiliate-leads-complete-passport.route.ts` | 180 | 8.0K | 제휴사 여권 완료 |
| `affiliate-leads-passport-link.route.ts` | 280 | 12K | 제휴사 링크 생성 ⭐ |
| `affiliate-leads-request-passport.route.ts` | 86 | 4.0K | 제휴사 요청 |
| `affiliate-sales-confirmation-passport.route.ts` | 125 | 8.0K | 판매 확인 여권 |
| `chat-bot-create-passport-flow.route.ts` | 165 | 8.0K | 챗봇 여권 플로우 생성 |
| `chat-passport-flow.route.ts` | 361 | 12K | 챗봇 여권 플로우 ⭐ |

**특징:**
- 관리자만 접근
- 가장 복잡한 로직
- SMS, Google API 통합
- 트랜잭션 사용

---

### Upload API (1개, 158줄)

| 파일 | 라인 | 크기 | 설명 |
|------|------|------|------|
| `passport.route.ts` | 158 | 8.0K | 공용 파일 업로드 |

**특징:**
- 파일 유효성 검증
- Google Drive 저장

---

### API 요약 통계

```
Public API:   8개, 1,478줄 (26%)
Customer API: 2개,   377줄 (7%)
Partner API:  9개, 1,349줄 (24%)
Admin API:   17개, 2,550줄 (45%)
Upload API:   1개,   158줄 (3%)
────────────────────────────────
합계:        37개, 5,912줄
```

---

## 🎨 Pages (7개, 4,231줄)

### Public Pages

| 파일 | 라인 | 크기 | 설명 |
|------|------|------|------|
| `public-passport-page.tsx` | 781 | 32K | 여권 제출 페이지 ([token] 라우트) ⭐⭐ |

**특징:**
- 토큰 기반 접근
- 이미지 업로드 UI
- 실시간 OCR 프리뷰

---

### Customer Pages

| 파일 | 라인 | 크기 | 설명 |
|------|------|------|------|
| `customer-passport-page.tsx` | 1,366 | 56K | 여권 정보 조회 페이지 ⭐⭐⭐ |
| `customer-passport-upload-page.tsx` | 159 | 8.0K | 이미지 업로드 페이지 |

**특징:**
- 가장 복잡한 페이지 (1,366줄)
- 데이터 조회 및 편집
- 모바일 최적화

---

### Partner Pages

| 파일 | 라인 | 크기 | 설명 |
|------|------|------|------|
| `partner-passport-requests-page.tsx` | 87 | 4.0K | 파트너 요청 목록 페이지 |
| `PartnerPassportRequestsClient.tsx` | 482 | 24K | 파트너 요청 클라이언트 컴포넌트 ⭐⭐ |

**특징:**
- 클라이언트 컴포넌트 분리
- 상태 관리

---

### Admin Pages

| 파일 | 라인 | 크기 | 설명 |
|------|------|------|------|
| `admin-passport-request-page.tsx` | 1,276 | 56K | 관리자 여권 요청 CRM ⭐⭐⭐ |
| `admin-manual-passport-request-page.tsx` | 490 | 24K | 수동 등록 페이지 ⭐ |

**특징:**
- CRM 기능 완비
- 고객 검색, 필터링
- 일괄 작업

---

### Pages 요약 통계

```
Public Pages:   1개,   781줄 (18%)
Customer Pages: 2개, 1,525줄 (36%)
Partner Pages:  2개,   569줄 (13%)
Admin Pages:    2개, 1,766줄 (42%)
────────────────────────────────
합계:          7개, 4,231줄
```

---

## 📚 Utilities (1개, 110줄)

| 파일 | 라인 | 크기 | 설명 |
|------|------|------|------|
| `lib/passport-utils.ts` | 110 | 4.0K | 여권 정보 백업/복구 유틸 |

**주요 함수:**
- `backupPassportDataToUser()` - 여권 정보를 User에 백업
- `findUserByNameAndPhone()` - 이름+전화로 사용자 검색

**사용처:**
- 2개 파일 (passport-utils 직접 import)

---

## 🗄️ Database Migrations (2개, 26줄)

### Migration 1: Token 테이블 생성
```
파일: 20260427_add_passport_upload_token/migration.sql
크기: 22줄
목적: PassportUploadToken 테이블 생성
```

**스키마:**
```sql
CREATE TABLE "PassportUploadToken" (
  id SERIAL PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  leadId INT,
  customerId INT,
  reservationId INT,
  expiresAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

### Migration 2: 고유 인덱스 추가
```
파일: 20260428_add_passport_token_leadid_unique/migration.sql
크기: 4줄
목적: leadId 고유성 보장
```

**인덱스:**
```sql
CREATE UNIQUE INDEX passport_token_leadid_unique 
ON "PassportUploadToken"(leadId);
```

---

## 📊 파일 크기 분포

### 크기별 분류

**매우 큼 (40K 이상)**
- customer-passport-page.tsx (1,366줄, 56K)
- admin-passport-request-page.tsx (1,276줄, 56K)

**큼 (20-40K)**
- public-passport-page.tsx (781줄, 32K)
- PartnerPassportRequestsClient.tsx (482줄, 24K)
- admin-manual-passport-request-page.tsx (490줄, 24K)

**중간 (8-20K)**
- passport-request-send.route.ts (493줄, 16K)
- passport-request-manual-register.route.ts (377줄, 16K)
- passport-request-ocr-to-apis.route.ts (364줄, 16K)
- scan.route.ts (340줄, 16K)
- 기타 10개 파일

**작음 (4K 이하)**
- 대부분의 조회/검색 API
- 템플릿 관리
- 링크 생성

---

## 🔗 의존 관계 매트릭스

### 파일별 의존성 수

| 파일 | 의존 라이브러리 | 내부 의존성 |
|------|-----------------|-----------|
| scan.route.ts | 6개 | 2개 |
| [token]-submit.route.ts | 4개 | 1개 |
| admin-passport-request-page.tsx | 5개 | 3개 |
| customer-passport-page.tsx | 5개 | 2개 |
| passport-request-send.route.ts | 6개 | 2개 |

---

## ✅ 품질 지표

### 코드 복잡도

**높음 (복잡한 로직)**
- scan.route.ts - 이미지 처리, MRZ 파싱
- [token]-submit.route.ts - 트랜잭션, 다중 테이블 업데이트
- passport-request-send.route.ts - SMS 발송, 템플릿 처리
- passport-request-ocr-to-apis.route.ts - OCR + API 호출

**중간**
- passport-request-manual-register.route.ts - 토큰 생성
- chat-passport-flow.route.ts - AI 통합
- 관리자 페이지들

**낮음**
- 조회/검색 API
- 템플릿 관리
- 링크 생성

### 에러 처리

**우수 (try-catch + 로깅)**
- 대부분의 API routes

**미흡 (수동 검증만)**
- Public API
- 일부 Customer API

---

## 📈 성능 최적화 포인트

### 최적화 필요 파일 (우선순위)

**P0 (높음)**
1. scan.route.ts - 이미지 처리 최적화 (Sharp WebP 변환)
2. passport-request-send.route.ts - SMS 배치 처리
3. [token]-submit.route.ts - 트랜잭션 최적화

**P1 (중간)**
4. admin-passport-request-page.tsx - 페이지네이션
5. customer-passport-page.tsx - 데이터 로딩 최적화
6. passport-request-ocr-to-apis.route.ts - 병렬 처리

**P2 (낮음)**
7. 조회 API - 캐싱 추가

---

## 🚀 배포 체크리스트

### Pre-Deployment Checks

```
[배포 전 확인사항]

파일 존재성:
☐ 모든 48개 파일 존재 확인
☐ 마이그레이션 파일 Prisma 미러링 확인

타입 안전성:
☐ npm run build 성공 (0 errors)
☐ TypeScript strict mode

보안:
☐ 환경변수 설정 (Google API, SMS API 키)
☐ Rate limiter 활성화
☐ CORS 설정 확인

데이터베이스:
☐ 마이그레이션 순서 확인
☐ 인덱스 생성 확인
☐ 백업 생성

성능:
☐ Lighthouse 85+ (pages)
☐ API 응답시간 < 500ms
☐ 메모리 누수 검사 (Node.js profiler)

테스트:
☐ Public API 토큰 테스트
☐ 고객 로그인 IDOR 테스트
☐ 관리자 권한 테스트
```

---

## 📞 파일 참조 가이드

### API 추가 시 참고할 파일
1. `api/admin/_utils.ts` - 관리자 인증 및 공유 함수
2. `lib/passport-utils.ts` - 여권 정보 백업

### UI 추가 시 참고할 파일
1. `pages/admin-passport-request-page.tsx` - CRM UI 패턴
2. `pages/customer-passport-page.tsx` - 조회 UI 패턴
3. `pages/PartnerPassportRequestsClient.tsx` - 클라이언트 컴포넌트 패턴

### 마이그레이션 추가 시
1. `migrations/20260427_add_passport_upload_token/` 참고
2. SQL 문법 및 인덱싱 전략 참고

---

## 📊 최종 통계

| 항목 | 값 |
|------|-----|
| **총 파일** | 48개 |
| **총 라인 수** | 10,217줄 |
| **총 크기** | ~414KB |
| **API Routes** | 38개 (5,912줄) |
| **Pages/Components** | 7개 (4,231줄) |
| **Utilities** | 1개 (110줄) |
| **Migrations** | 2개 (26줄) |
| **평균 파일 크기** | 212.8K |
| **평균 라인 수** | 213줄 |
| **가장 큰 파일** | customer-passport-page.tsx (1,366줄) |
| **가장 작은 파일** | migration.sql (4줄) |

---

**마지막 업데이트**: 2026-05-11  
**생성자**: Claude Code Agent  
**상태**: Complete Inventory ✅
