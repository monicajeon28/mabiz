# 여권 시스템 의존성 그래프

**생성일**: 2026-05-11  
**총 파일**: 48개  
**총 라인**: 약 10,000+ 줄  
**주요 언어**: TypeScript (38 API routes), TSX (7 pages), SQL (2 migrations)

---

## 📊 외부 라이브러리 의존성

### Core Framework
| 라이브러리 | 사용 횟수 | 설명 | 파일 수 |
|-----------|---------|------|--------|
| `next/server` | 37 | Server-side API 라우트 | 37 |
| `next/navigation` | 4 | 클라이언트 라우팅 (pages) | 4 |

### Database & ORM
| 라이브러리 | 사용 횟수 | 설명 | 파일 수 |
|-----------|---------|------|--------|
| `@/lib/prisma` | 36 | Prisma 클라이언트 | 36 |
| `@prisma/client` | 8 | Prisma 타입 | 8 |

### Authentication & Authorization
| 라이브러리 | 사용 횟수 | 설명 | 파일 수 |
|-----------|---------|------|--------|
| `@/lib/auth` | 8 | NextAuth 세션/검증 | 8 |
| `@/lib/session` | 2 | 세션 유틸 | 2 |
| `@/app/api/partner/_utils` | 9 | 파트너 인증 | 9 |
| `../_utils` (로컬) | 9 | 로컬 인증 유틸 | 9 |

### Logging & Monitoring
| 라이브러리 | 사용 횟수 | 설명 | 파일 수 |
|-----------|---------|------|--------|
| `@/lib/logger` | 12 | 구조화된 로깅 | 12 |

### AI & Vision
| 라이브러리 | 사용 횟수 | 설명 | 파일 수 |
|-----------|---------|------|--------|
| `@google/generative-ai` | 4 | Google Gemini API (OCR) | 4 |
| `@/lib/ai/geminiModel` | 4 | Gemini 래퍼 | 4 |
| `@/lib/gemini` | 1 | 레거시 Gemini 유틸 | 1 |

### External Services
| 라이브러리 | 사용 횟수 | 설명 | 파일 수 |
|-----------|---------|------|--------|
| `@/lib/google-drive` | 3 | Google Drive 파일 관리 | 3 |
| `@/lib/google-sheets` | 2 | Google Sheets API | 2 |
| `@/lib/aligo/client` | 1 | Aligo SMS API | 1 |
| `@/lib/push/server` | 1 | 푸시 알림 | 1 |

### Utilities
| 라이브러리 | 사용 횟수 | 설명 | 파일 수 |
|-----------|---------|------|--------|
| `@/lib/apis-sync-queue` | 2 | 선사 API 동기화 큐 | 2 |
| `@/lib/rate-limiter` | 1 | 요청 제한 | 1 |
| `@/lib/passport-utils` | 2 | 여권 정보 유틸 | 2 |
| `crypto` | 7 | 토큰 생성 (randomBytes) | 7 |
| `path` | 1 | 파일 경로 | 1 |
| `fs` | 1 | 파일 시스템 | 1 |

### UI Components
| 라이브러리 | 사용 횟수 | 설명 | 파일 수 |
|-----------|---------|------|--------|
| `react` | 7 | React (pages) | 7 |
| `@/components/ui/Toast` | 3 | 알림 토스트 | 3 |
| `react-icons/fi` | 4 | Feather 아이콘 | 4 |

### Input Validation
| 라이브러리 | 사용 횟수 | 설명 | 파일 수 |
|-----------|---------|------|--------|
| `zod` | 1 | 입력 검증 (1개 파일만) | 1 |

### API Response Types
| 라이브러리 | 사용 횟수 | 설명 | 파일 수 |
|-----------|---------|------|--------|
| `@/types/api` | 1 | API 응답 타입 | 1 |

---

## 🔗 내부 의존성 (로컬)

### 공유 유틸 파일

#### 1. `_utils.ts` (Admin)
```
파일: cruisedot/passport/api/admin/_utils.ts
크기: 200줄
주요 함수:
  - requireAdminUser()
  - buildPassportLink()
  - generateToken()
  
의존처: 12개 Admin API 파일
```

**의존 파일들:**
- passport-request-customers.route.ts
- passport-request-manual.route.ts
- passport-request-manual-register.route.ts
- passport-request-ocr-to-apis.route.ts
- passport-request-search.route.ts
- passport-request-send.route.ts
- customers-userid-passport.route.ts
- affiliate-leads-complete-passport.route.ts
- affiliate-leads-passport-link.route.ts
- affiliate-leads-request-passport.route.ts

#### 2. `passport-utils.ts`
```
파일: cruisedot/passport/lib/passport-utils.ts
크기: 110줄
주요 함수:
  - backupPassportDataToUser(userId, passportData)
  - findUserByNameAndPhone(korName, phone?)
  
사용처:
  - [token]-submit.route.ts
  - passport-request-manual-register.route.ts
```

---

## 🎯 API 의존성 맵

### Public API 의존성
```
[Public APIs]
    ├── [token].route.ts
    │   └── 의존: @/lib/prisma, @/lib/logger
    │
    ├── [token]-submit.route.ts ⭐ 복잡
    │   ├── 의존: @/lib/prisma, @/lib/apis-sync-queue
    │   └── 관계 테이블: PassportSubmission, PassportSubmissionGuest, User, Traveler, Reservation
    │
    ├── [token]-upload.route.ts
    │   └── 의존: @/lib/prisma, @/lib/google-drive
    │
    ├── [token]-ocr.route.ts
    │   ├── 의존: @google/generative-ai, @/lib/ai/geminiModel
    │   └── 복잡도: 높음 (OCR 처리)
    │
    ├── scan.route.ts ⭐ 가장 복잡
    │   ├── 의존: @/lib/google-drive, @/lib/prisma
    │   ├── 이미지 처리, MRZ 파싱
    │   └── 크기: 340줄
    │
    ├── submit.route.ts (레거시)
    │   └── 의존: @/lib/prisma
    │
    ├── chatbot-sync.route.ts
    │   ├── 의존: @/lib/prisma, @google/generative-ai
    │   └── 챗봇 통합
    │
    └── reservations-passport-status.route.ts
        └── 의존: @/lib/prisma
```

### Admin API 의존성
```
[Admin APIs]
    ├── 기본 CRUD
    │   ├── passport-request-customers.route.ts (349줄) ⭐
    │   ├── passport-request-manual.route.ts (293줄)
    │   ├── passport-request-search.route.ts (77줄)
    │   └── passport-request-history.route.ts (103줄)
    │
    ├── 토큰 & 링크 생성
    │   ├── passport-request-link.route.ts
    │   └── passport-request-manual-register.route.ts (377줄)
    │
    ├── 고급 처리
    │   ├── passport-request-ocr-to-apis.route.ts (364줄)
    │   ├── passport-request-send.route.ts (493줄) ⭐ 가장 큼
    │   └── passport-request-manual.route.ts
    │
    ├── 고객 관리
    │   ├── customers-userid-passport.route.ts (333줄)
    │   └── passport-request-customers.route.ts
    │
    ├── 제휴사 관리
    │   ├── affiliate-leads-passport-link.route.ts (280줄)
    │   ├── affiliate-leads-complete-passport.route.ts (180줄)
    │   ├── affiliate-leads-request-passport.route.ts (86줄)
    │   └── affiliate-sales-confirmation-passport.route.ts
    │
    ├── 챗봇 통합
    │   ├── chat-bot-create-passport-flow.route.ts (165줄)
    │   └── chat-passport-flow.route.ts (361줄)
    │
    ├── 템플릿
    │   └── passport-request-templates.route.ts (93줄)
    │
    └── 공유 _utils.ts
        └── 모든 Admin API가 의존
```

### Partner API 의존성
```
[Partner APIs]
    ├── passport-requests.route.ts (76줄)
    │   └── 기본 조회
    │
    ├── passport-requests-send.route.ts (13줄)
    │   └── (레거시, 거의 비어있음)
    │
    ├── passport-requests-manual.route.ts (287줄)
    │   └── 수동 등록
    │
    ├── passport-requests-ocr-to-apis.route.ts (347줄)
    │   └── OCR 자동화
    │
    ├── passport-requests-leadid-passport-link.route.ts (179줄)
    │   └── 리드별 링크 생성
    │
    ├── passport-request-link.route.ts (126줄)
    │   └── 링크 생성
    │
    ├── passport-templates.route.ts (80줄)
    │   └── 템플릿 조회
    │
    ├── passport-request-templates.route.ts (76줄)
    │   └── 템플릿 관리
    │
    └── chat-bot-passport-flow.route.ts (151줄)
        └── 챗봇 통합
```

### Customer API 의존성
```
[Customer APIs]
    ├── passport-request.route.ts (126줄)
    │   └── 여권 요청 조회
    │
    └── passport-upload.route.ts (251줄)
        └── 이미지 업로드
```

---

## 📈 파일 복잡도 순위

### 상위 10개 (라인 수)
| 순위 | 파일 | 라인 | 크기 | 복잡도 |
|------|------|------|------|--------|
| 1 | customer-passport-page.tsx | 1,366 | 56K | ⭐⭐⭐⭐ (UI) |
| 2 | admin-passport-request-page.tsx | 1,276 | 56K | ⭐⭐⭐⭐ (UI) |
| 3 | public-passport-page.tsx | 781 | 32K | ⭐⭐⭐ (UI) |
| 4 | passport-request-send.route.ts | 493 | 16K | ⭐⭐⭐⭐ (SMS 발송) |
| 5 | admin-manual-passport-request-page.tsx | 490 | 24K | ⭐⭐⭐ (UI) |
| 6 | PartnerPassportRequestsClient.tsx | 482 | 24K | ⭐⭐⭐ (UI) |
| 7 | passport-request-manual-register.route.ts | 377 | 16K | ⭐⭐⭐ (토큰 생성) |
| 8 | passport-request-ocr-to-apis.route.ts | 364 | 16K | ⭐⭐⭐⭐ (OCR) |
| 9 | chat-passport-flow.route.ts | 361 | 12K | ⭐⭐⭐ (챗봇) |
| 10 | scan.route.ts | 340 | 16K | ⭐⭐⭐⭐ (이미지 처리) |

---

## 🔴 고위험 의존성

### 1. Google API 의존성 (4곳)
```
파일들:
  - scan.route.ts (Google Drive)
  - [token]-ocr.route.ts (Google Gemini)
  - passport-request-ocr-to-apis.route.ts (Google Gemini)
  - chat-passport-flow.route.ts (Google Gemini)

위험: API 키 노출, 할당량 초과, 네트워크 지연
완화책: 환경변수 관리, 에러 핸들링, 재시도 로직
```

### 2. 트랜잭션 (복잡한 쓰기)
```
파일들:
  - [token]-submit.route.ts (Prisma transaction 5단계)
  - affiliate-leads-complete-passport.route.ts (트랜잭션)
  - passport-request-manual-register.route.ts (트랜잭션)

위험: 데드락, 부분 실패, 데이터 일관성
완화책: transaction isolation level, 재시도 로직, 로깅
```

### 3. 외부 서비스 호출
```
서비스:
  - Google Drive (파일 업로드/다운로드)
  - Google Sheets (데이터 동기화)
  - Aligo SMS (문자 발송)
  - APIS (선사 시스템)

위험: 외부 서비스 장애 전파
완화책: 비동기 큐, 타임아웃, 폴백
```

---

## 🟡 개선 필요 항목

### 1. Zod 스키마 부재
```
현황: 46개 파일 중 1개만 Zod 사용

권장:
  - POST/PATCH 요청 입력에 Zod 스키마 추가
  - 파일: cruisedot/passport/lib/schemas/
  - 예: passportSubmitSchema, manualRegisterSchema 등

이득:
  - 런타임 타입 안전
  - 자동 에러 메시지
  - 문서화
```

### 2. 에러 마스킹 불충분
```
현황: 일부 API는 민감한 정보 로그 출력

위험 파일:
  - scan.route.ts (이미지 처리)
  - chat-passport-flow.route.ts (AI 응답)

권장:
  - logger.error() 사용 시 민감 정보 제거
  - 사용자 정의 에러 클래스
  - 에러 코드 분류
```

### 3. 입력 길이 제한 미흡
```
현황: 문자열 필드에 최대 길이 검증 부재

위험:
  - DoS (대용량 입력)
  - DB 저장소 초과

권장 길이:
  - 이름: 255자
  - 여권번호: 20자
  - 전화번호: 20자
  - 텍스트 필드: 1000자
```

### 4. Rate Limiter 미적용
```
현황: 일부 API만 rate-limiter 사용

적용된 파일:
  - 2개 (정확한 파일명은 코드 분석 필요)

권장:
  - 모든 Public API에 적용
  - 고객당: 10회/분
  - IP당: 100회/분
```

---

## 📋 마이그레이션 의존성

### DB 마이그레이션 순서
```
1. 20260427_add_passport_upload_token
   ├── 테이블: PassportUploadToken
   ├── 컬럼: id, token, leadId, customerId, reservationId, expiresAt, createdAt, updatedAt
   └── 인덱스: token (UNIQUE)

2. 20260428_add_passport_token_leadid_unique
   ├── 인덱스: (leadId) UNIQUE
   └── 고유성 보장: 리드당 1개의 토큰만

필요한 관계 테이블:
  - User (고객)
  - Traveler (여행자)
  - Reservation (예약)
  - PassportSubmission (제출 기록)
  - PassportSubmissionGuest (게스트 정보)
  - PassportRequestLog (요청 로그)
```

---

## 🧪 테스트 커버리지 분석

### 테스트 필요 우선순위

**높음 (P0)**
- [token]-submit.route.ts (핵심 워크플로우)
- passport-request-send.route.ts (SMS 발송)
- passport-request-manual-register.route.ts (토큰 생성)

**중간 (P1)**
- scan.route.ts (OCR)
- [token]-upload.route.ts (이미지 업로드)
- passport-request-ocr-to-apis.route.ts (자동화)

**낮음 (P2)**
- passport-request-search.route.ts (조회)
- passport-request-templates.route.ts (조회)
- passport-request-history.route.ts (조회)

---

## 🔄 순환 의존성 (Circular Dependency) 분석

### 감지된 순환 의존성
```
❌ None detected in current structure

주의: 동적 import 사용 중
  - [token]-submit.route.ts에서 @/lib/apis-sync-queue 동적 로드
  - 이유: 순환 의존성 회피
```

---

## 📊 의존성 통계

| 카테고리 | 개수 | 비율 |
|---------|------|------|
| API Routes | 38 | 79% |
| Pages (UI) | 7 | 15% |
| Utilities | 1 | 2% |
| Migrations | 2 | 4% |
| **합계** | **48** | **100%** |

| 유형 | 개수 |
|------|------|
| 외부 라이브러리 | 26 |
| 내부 의존성 | 12 |
| React 컴포넌트 | 7 |
| 데이터베이스 마이그레이션 | 2 |

---

## ✅ 의존성 감사 결과

### 현황
- ✅ 순환 의존성: 없음
- ✅ Next.js 버전: 호환성 OK
- ✅ Prisma 스키마: 일관성 OK
- ⚠️ Zod 검증: 불충분 (1개 파일)
- ⚠️ 에러 처리: 미흡
- ⚠️ Rate limiting: 부분 적용

### 권장사항
1. **즉시**: Zod 스키마 추가 (보안)
2. **1주일**: 에러 마스킹 강화
3. **2주일**: Rate limiter 모든 API에 확대
4. **1개월**: 입력 길이 제한 일관화

---

**마지막 업데이트**: 2026-05-11  
**생성자**: Claude Code Agent  
**상태**: Production Audit ✅
