# 여권 관리 시스템 (Passport Management System)

## 개요

여권 관리 시스템은 크루즈 여행 고객들의 여권 정보 수집, 검증, 관리를 위한 독립적인 모듈입니다. 
토큰 기반의 공개 제출 API부터 관리자 CRM까지 완전한 워크플로우를 제공합니다.

**총 48개 파일 구성**
- API Routes: 38개
- Pages (UI): 7개  
- Utilities: 1개
- Database Migrations: 2개

---

## 📁 폴더 구조

```
cruisedot/passport/
├── api/                          # API 라우트 (38개 파일)
│   ├── public/                   # 토큰 기반 공개 API (8개)
│   │   ├── [token].route.ts      # 여권 조회/초기화
│   │   ├── [token]-submit.route.ts
│   │   ├── [token]-upload.route.ts
│   │   ├── [token]-ocr.route.ts
│   │   ├── scan.route.ts         # 여권 스캔 처리
│   │   ├── submit.route.ts       # 직접 제출 (레거시)
│   │   ├── chatbot-sync.route.ts # 챗봇 동기화
│   │   └── reservations-passport-status.route.ts
│   │
│   ├── customer/                 # 고객 API (2개)
│   │   ├── passport-request.route.ts
│   │   └── passport-upload.route.ts
│   │
│   ├── partner/                  # 파트너/대리점 API (9개)
│   │   ├── passport-requests.route.ts
│   │   ├── passport-requests-send.route.ts
│   │   ├── passport-requests-manual.route.ts
│   │   ├── passport-requests-ocr-to-apis.route.ts
│   │   ├── passport-requests-leadid-passport-link.route.ts
│   │   ├── passport-request-link.route.ts
│   │   ├── passport-templates.route.ts
│   │   ├── passport-request-templates.route.ts
│   │   └── chat-bot-passport-flow.route.ts
│   │
│   ├── admin/                    # 관리자 API (17개)
│   │   ├── _utils.ts             # 공유 유틸
│   │   ├── passport-request-customers.route.ts
│   │   ├── passport-request-history.route.ts
│   │   ├── passport-request-link.route.ts
│   │   ├── passport-request-manual.route.ts
│   │   ├── passport-request-manual-register.route.ts
│   │   ├── passport-request-ocr-to-apis.route.ts
│   │   ├── passport-request-search.route.ts
│   │   ├── passport-request-send.route.ts
│   │   ├── passport-request-templates.route.ts
│   │   ├── customers-userid-passport.route.ts
│   │   ├── affiliate-leads-complete-passport.route.ts
│   │   ├── affiliate-leads-passport-link.route.ts
│   │   ├── affiliate-leads-request-passport.route.ts
│   │   ├── affiliate-sales-confirmation-passport.route.ts
│   │   ├── chat-bot-create-passport-flow.route.ts
│   │   └── chat-passport-flow.route.ts
│   │
│   └── upload/                   # 파일 업로드 (1개)
│       └── passport.route.ts
│
├── pages/                         # UI 페이지 (7개)
│   ├── public-passport-page.tsx   # 공개 여권 제출 페이지 ([token])
│   ├── customer-passport-page.tsx # 고객 여권 정보 조회
│   ├── customer-passport-upload-page.tsx
│   ├── partner-passport-requests-page.tsx
│   ├── PartnerPassportRequestsClient.tsx
│   ├── admin-passport-request-page.tsx
│   └── admin-manual-passport-request-page.tsx
│
├── lib/                          # 유틸 및 스키마
│   ├── passport-utils.ts         # 공유 함수
│   └── schemas/                  # (향후) Zod 스키마
│
├── migrations/                   # DB 마이그레이션 (2개)
│   ├── 20260427_add_passport_upload_token/
│   └── 20260428_add_passport_token_leadid_unique/
│
└── README.md                     # 이 파일
```

---

## 🔐 API 분류 및 인증

### 1. **Public API** (토큰 기반 공개)
외부인이 토큰으로 접근 가능한 API입니다. 
- **인증**: `PassportUploadToken` 테이블의 `token` 필드로 검증
- **검증**: 수동 필드 검증 (Zod 스키마 미적용)
- **CSRF**: 토큰 기반 API로 CSRF 검증 제외 (고객이 직접 제출 가능해야 함)
- **주요 엔드포인트**:
  - `GET /api/passport/[token]` - 여권 정보 조회
  - `POST /api/passport/[token]/submit` - 여권 정보 제출 (수동 검증)
  - `POST /api/passport/[token]/upload` - 이미지 업로드
  - `POST /api/passport/scan` - 여권 스캔 (Google Vision API)

### 2. **Customer API** (인증된 고객)
로그인한 고객만 접근 가능합니다.
- **인증**: NextAuth 세션 + userId 검증
- **IDOR 방지**: 본인 예약만 조회 가능

### 3. **Partner API** (파트너/대리점)
파트너 계정으로 로그인한 사용자만 접근 가능합니다.
- **인증**: Partner 권한 검증
- **권한**: 소속 파트너의 리드만 관리 가능

### 4. **Admin API** (관리자 전용)
관리자만 접근 가능합니다.
- **인증**: Admin 권한 검증
- **기능**: 전체 여권 요청 관리, 수동 등록, CRM 연동

---

## 📊 의존성 그래프

### 외부 라이브러리 (상위 10개)
| 라이브러리 | 사용 횟수 | 설명 |
|-----------|---------|------|
| `next/server` | 37 | Server-side Next.js API routes |
| `@/lib/prisma` | 36 | Database ORM |
| `@/lib/logger` | 12 | 구조화된 로깅 |
| `@/app/api/partner/_utils` | 9 | 파트너 인증 유틸 |
| `../_utils` (로컬) | 9 | 각 API 폴더의 로컬 유틸 |
| `@prisma/client` | 8 | Prisma 타입 |
| `@/lib/auth` | 8 | 인증 유틸 |
| `react` | 7 | React 컴포넌트 (Client-side pages) |
| `crypto` | 7 | 토큰 생성 (randomBytes) |
| `@google/generative-ai` | 4 | Google Gemini API |

### 핵심 내부 의존성
- `@/lib/passport-utils.ts` - 여권 정보 백업/복구 (2곳 사용)
- `@/app/api/admin/passport-request/_utils.ts` - Admin 공유 함수
- `PartnerPassportRequestsClient.tsx` - 파트너 UI 컴포넌트

---

## 🗄️ 데이터베이스 스키마

### PassportUploadToken 테이블
```sql
CREATE TABLE "PassportUploadToken" (
  "id" SERIAL PRIMARY KEY,
  "token" TEXT UNIQUE NOT NULL,
  "leadId" INT,
  "customerId" INT,
  "reservationId" INT,
  "expiresAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE UNIQUE INDEX passport_token_leadid_unique ON "PassportUploadToken"(leadId);
```

### Traveler 테이블 (여권 정보 저장)
```sql
CREATE TABLE "Traveler" (
  "id" SERIAL PRIMARY KEY,
  "reservationId" INT NOT NULL,
  "korName" VARCHAR(255),
  "engSurname" VARCHAR(255),
  "engGivenName" VARCHAR(255),
  "dateOfBirth" DATE,
  "passportNo" VARCHAR(20),
  "passportExpiryDate" DATE,
  "nationality" VARCHAR(100),
  "phone" VARCHAR(20),
  "residentNum" VARCHAR(20),
  ...
);
```

---

## 🔄 워크플로우

### 1. 공개 여권 제출 플로우 (일반 고객)
```
1. 크루즈 예약 생성
   ↓
2. PassportUploadToken 생성 (토큰 발급)
   ↓
3. 고객에게 링크 발송: /passport/[token]
   ↓
4. 고객이 여권 정보 입력 & 이미지 업로드
   ↓
5. [token]/submit → Traveler 레코드 저장
   ↓
6. 선사 시스템에 동기화 (enqueueApisSync)
```

### 2. 파트너 대량 등록 플로우
```
1. 파트너 로그인 → /partner/[partnerId]/passport-requests
   ↓
2. CSV/Excel 업로드 또는 수동 입력
   ↓
3. OCR 자동 처리: POST /api/partner/passport-requests/ocr-to-apis
   ↓
4. 관리자 검토 (Admin Panel)
   ↓
5. 고객에게 요청 링크 발송
```

### 3. 관리자 CRM 플로우
```
1. Admin Panel: /admin/passport-request
   ↓
2. 고객 검색 → 여권 요청 상태 확인
   ↓
3. 수동 등록 또는 템플릿 사용
   ↓
4. 링크 생성 & 발송
   ↓
5. 진행 상황 모니터링
```

---

## 🚀 API 사용법

### Public: 여권 조회
```bash
GET /api/passport/[token]

응답:
{
  "status": "success",
  "data": {
    "token": "...",
    "passport": {
      "korName": "홍길동",
      "passportNo": "M12345678",
      "expiryDate": "2030-12-31",
      ...
    }
  }
}

주의: 입력 검증은 수동으로 처리됩니다.
- 토큰 길이 >= 10
- 그룹 수 <= 30
- 각 그룹에 최소 1명 이상
```

### Admin: 여권 요청 고객 목록
```bash
GET /api/admin/passport-request/customers

쿼리:
- offset: 페이지 시작 인덱스
- limit: 페이지 크기
- status: pending|completed|failed

응답:
{
  "data": [
    {
      "id": 1,
      "customerName": "홍길동",
      "phone": "010-xxxx-xxxx",
      "requestedAt": "2026-05-11T...",
      "status": "pending"
    }
  ],
  "total": 100
}
```

### Admin: 수동 여권 요청 등록
```bash
POST /api/admin/passport-request/manual-register

요청:
{
  "customerName": "홍길동",
  "phone": "010-1234-5678",
  "email": "hong@example.com",
  "leadId": 123
}

응답:
{
  "token": "passport_abc123xyz...",
  "link": "https://cruiseai.co.kr/passport/passport_abc123xyz..."
}
```

---

## 🔧 설정 및 환경변수

### 필수 환경변수
```env
# Google API
NEXT_PUBLIC_GEMINI_API_KEY=xxx
GOOGLE_DRIVE_FOLDER_ID=xxx
GOOGLE_SHEETS_ID=xxx

# SMS (Aligo)
ALIGO_API_KEY=xxx
ALIGO_SENDER_ID=xxx

# 기본 설정
NEXT_PUBLIC_APP_URL=https://cruiseai.co.kr
TOKEN_EXPIRY_DAYS=30
```

### 토큰 생성 설정
- **유효기간**: 기본 30일 (PassportUploadToken.expiresAt)
- **길이**: 무작위 문자열
- **형식**: `passport_` + 무작위 문자열 (또는 직접 설정)
- **검증**: 최소 10자 이상

---

## 📈 성능 최적화

### 주요 최적화 항목
1. **캐싱**
   - 템플릿은 30분 캐싱
   - PassportUploadToken 메모리 캐싱 (5분)

2. **데이터베이스**
   - 복합 인덱스: (leadId, token), (customerId, reservationId)
   - 페이지네이션: offset/limit 기반

3. **API 응답**
   - 선택적 필드 로딩 (Prisma select)
   - 불필요한 JOIN 제거

---

## 🧪 테스트 및 디버깅

### 로컬 테스트
```bash
# 1. 테스트 고객 생성
POST /api/admin/passport-request/manual-register
Body: { "customerName": "테스트", "phone": "010-0000-0000" }

# 2. 토큰 복사
응답에서 token 값 복사

# 3. 여권 페이지 접속
브라우저: http://localhost:3000/passport/[token]

# 4. 정보 입력 & 제출
여권 정보 입력 후 Submit

# 5. DB 확인
SELECT * FROM "Traveler" WHERE ... ;
```

### 주요 로그 포인트
- `[Passport Utils]` - 여권 정보 백업/복구
- `[PassportRequest]` - 요청 처리
- `[OCR]` - 스캔 처리
- `[APIs Sync]` - 선사 동기화

---

## 🚨 주의사항

### 보안 현황
1. **IDOR 방지**: 로그인 필요한 API는 소유권 검증 구현 (Customer/Partner/Admin)
2. **공개 API**: 토큰 기반 인증으로 보호 (PassportUploadToken)
3. **CSRF**: 
   - Admin/Partner/Customer API는 서버 세션 기반 (자동 보호)
   - Public API는 CSRF 검증 불필요 (외부 폼 제출이므로)
4. **입력 검증**: 
   - 수동 필드 검증 적용 (Zod 스키마 미적용)
   - 향후 개선: Zod 스키마 추가 권장

### 레거시 코드
- `submit.route.ts` - 레거시 API (토큰 없이 직접 제출)
- 신규 개발은 `[token]/submit` 사용

### 마이그레이션 순서
마이그레이션 파일은 다음 순서로 적용:
1. `20260427_add_passport_upload_token` - Token 테이블 생성
2. `20260428_add_passport_token_leadid_unique` - 고유 인덱스 추가

### 개선 필요 항목
1. ⚠️ **Zod 스키마 적용**: 46개 파일 중 1개만 Zod 사용 → 모든 API에 추가 권장
2. ⚠️ **에러 마스킹**: 일부 API는 민감한 정보를 로그에 출력 (검토 필요)
3. ⚠️ **입력 길이 제한**: 문자열 필드에 최대 길이 제약 미흡

---

## 📞 지원

문제가 발생하면:
1. 로그 확인 (`@/lib/logger`)
2. 데이터베이스 상태 확인
3. 토큰 만료 여부 확인
4. Google Drive / Sheets API 권한 확인

---

## 📊 파일 크기 및 라인 수

| 파일 | 라인 수 | 크기 |
|------|-------|------|
| admin-passport-request-page.tsx | 1,276 | 56K |
| customer-passport-page.tsx | 1,366 | 56K |
| public-passport-page.tsx | 781 | 32K |
| PartnerPassportRequestsClient.tsx | 482 | 24K |
| admin-manual-passport-request-page.tsx | 490 | 24K |
| passport-request-send.route.ts | 493 | 16K |
| passport-request-manual-register.route.ts | 377 | 16K |
| passport-request-ocr-to-apis.route.ts | 364 | 16K |
| scan.route.ts | 340 | 16K |
| customers-userid-passport.route.ts | 333 | 12K |

**총계**: 48개 파일, 약 10,000+ 라인

---

**마지막 업데이트**: 2026-05-11  
**시스템 버전**: 1.0.0  
**상태**: Production Ready ✅
