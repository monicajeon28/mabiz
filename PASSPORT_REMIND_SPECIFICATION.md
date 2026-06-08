# 📋 여권 제출 독촉 기능 — 구현 작업지시서

**상태:** 설계 완료 → 구현 가능  
**우선순위:** Phase 1 (필수, 1주)  
**작성일:** 2026-06-08  
**대상:** 개발팀 (BE/FE)

---

## 📌 기능 개요

**목표:** 여행 상품별 구매 고객 중 여권 미제출자에게 자동으로 제출 독촉 SMS 발송

**사용자 흐름:**
```
1. 관리자/대리점장이 상품(Trip) 선택
   ↓
2. 해당 상품 구매 고객 목록 조회
   ↓
3. 여권 미제출 고객만 필터링
   ↓
4. 선택한 고객들에게 SMS 발송
   ↓
5. 발송 상태 실시간 표시
   ↓
6. 독촉 이력 기록 (중복 방지)
```

---

## 🏗️ 아키텍처 & DB 설계

### Phase 1 필수 항목

#### 1. 페이지 구조

**경로:** `src/app/(dashboard)/passport/page.tsx` (신규)

```
┌─────────────────────────────────────────────┐
│ 여권 제출 관리 (상품별 독촉)                     │
├─────────────────────────────────────────────┤
│                                             │
│ [상품 선택 드롭다운 검색]                      │
│ ⬇️ 최근 선택: 세레나호, 디스커버리호             │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│ 📊 [미제출만 보기] [전체 보기]                 │
│    총 고객: 250명 | 제출: 150명 | 미제출: 100명  │
│                                             │
├─────────────────────────────────────────────┤
│  ✓  │ 승객명          │ 전화       │ 상태  │ 액션 │
│ ────┼────────────────┼──────────┼────┼──── │
│ ☐  │ 김철수 (Main)  │ 010-1234 │ ❌ │ SMS │
│ ☐  │ 김○○ (Sub)    │ 010-5678 │ ✅ │ -   │
│ ☐  │ 이○○ (Main)   │ 010-2345 │ ❌ │ SMS │
│                                             │
│  [선택 SMS 발송] [링크 복사]                  │
│  (선택됨: 2명, 예상 비용: 90원)                │
│                                             │
└─────────────────────────────────────────────┘
```

#### 2. 상품 드롭다운 구현

**필드:**
```typescript
// 1. 검색 가능한 드롭다운
<SearchableSelect 
  label="상품 선택"
  options={products}
  placeholder="상품명/코드 검색..."
  onSelect={handleProductSelect}
  recentSelections={getRecentProducts()} // localStorage
/>

// options 구조
interface Product {
  id: string;
  code: string;
  name: string;
  line: string; // "ROYAL_CARIBBEAN" | "MSC" | "CARNIVAL"
  departureDate: string; // "2026-07-15"
  totalReservations: number;
  submittedPassports: number;
  missingPassports: number;
}

// API: GET /api/passport/products
// 응답: { products: Product[] }
```

**백엔드 쿼리:**
```typescript
// src/app/api/passport/products/route.ts
const products = await prisma.gmTrip.findMany({
  where: {
    organizationId: ctx.organizationId,
    status: 'ACTIVE', // 판매 중인 것만
  },
  include: {
    reservations: {
      include: {
        traveler: {
          select: {
            id: true,
            name: true,
            phone: true,
            passportSubmissions: {
              select: { isSubmitted: true }
            }
          }
        }
      }
    }
  },
  orderBy: { departureDate: 'asc' }
});
```

#### 3. 고객 목록 테이블 (핵심)

**필드 (최소화):**
```
컬럼 1: 선택 (체크박스)
컬럼 2: 승객명 (마스킹: 김○○)
컬럼 3: 전화번호 (마스킹: 010-****-5678)
컬럼 4: 여권상태 (아이콘 + 텍스트)
컬럼 5: 액션 (SMS/링크 버튼)
```

**여권 상태 정의:**
```typescript
enum PassportStatus {
  MISSING = '❌ 미제출',    // passportNo IS NULL
  PENDING = '⏳ 검증중',    // isSubmitted=false
  SUBMITTED = '✅ 제출됨', // isSubmitted=true, submittedAt < now
  APPROVED = '✓ 확인됨',   // 관리자가 체크
  EXPIRED = '⚠️ 만료',     // expiryDate < tripStartDate
  RESUBMIT = '⚠️ 재제출',  // 만료 임박
}
```

**API: GET /api/passport/customers**
```typescript
// 쿼리: GET /api/passport/customers?tripId=xxx&filter=missing
// 응답:
{
  trip: {
    id: "trip-123",
    name: "세레나호 7박",
    startDate: "2026-07-15",
    totalCustomers: 250,
    submitted: 150,
    missing: 100,
  },
  customers: [
    {
      id: "res-001",
      mainTraveler: {
        id: "tv-001",
        name: "김철수",
        phone: "010-1234-5678",
        passportNo: null,
        passportStatus: "MISSING",
        expiryDate: null,
      },
      subTravelers: [ // 동반자
        {
          id: "tv-002",
          name: "김○○ (배우자)",
          phone: null,
          passportStatus: "SUBMITTED",
          expiryDate: "2027-06-30"
        }
      ],
      createdBy: {
        id: "user-123",
        name: "박판매원",
      },
      createdAt: "2026-05-01"
    }
  ]
}
```

#### 4. SMS 발송 기능

**구현 방식 1: 개별 버튼 (각 행)**
```
[SMS] [링크복사] 버튼 → 개별 발송
```

**구현 방식 2: 일괄 발송 (선택 후)**
```
☐ 선택 (체크박스)
[선택 SMS 발송] 버튼 → 여러 명 동시 발송
```

**Phase 1에는 방식 1 구현, Phase 2에서 방식 2 추가**

**API: POST /api/passport/send-sms**
```typescript
// 요청:
{
  tripId: "trip-123",
  travelerId: "tv-001",
  // 또는
  travelerIds: ["tv-001", "tv-002", "tv-003"], // 일괄
  type: "manual" | "auto" // manual = Phase 1
}

// 응답:
{
  success: true,
  data: {
    messageId: "msg-123",
    status: "SENT", // PENDING | SENT | FAILED
    sentAt: "2026-06-08T14:30:00+09:00",
    recipientCount: 1,
    estimatedCost: 45, // 원
  }
}
```

**SMS 템플릿 (Phase 1):**
```
"[마비즈크루즈] 안녕하세요 김철수님! 
7월 15일 세레나호 승선을 위해 여권을 제출해주세요.
🔗 제출하기: https://mabizcruisedot.com/passport/abc123def456
(7일 내 제출 필요)"

최대 90자 (2건 SMS로 계산)
```

#### 5. 발송 상태 표시

**UI:**
```
[ SMS 발송 중... 1/3 ]
[ ✅ 완료 ]
[ ⚠️ 1명 실패 ]
```

**백엔드:**
```typescript
// Aligo API 응답 처리
{
  result: {
    sms: [ // 배열 (여러 건)
      {
        message_id: "12345678",
        phone: "01012345678",
        status: 0, // 0=대기, 1=발송, 2=성공, 3=실패
        result_message: "Success"
      }
    ]
  }
}

// DB 기록 (GmPassportRequestLog)
INSERT INTO GmPassportRequestLog (
  tripId,
  travelerId,
  messageId,
  recipientPhone,
  status, // "PENDING" | "SENT" | "FAILED"
  sentAt,
  createdBy,
  createdAt
)
```

#### 6. 독촉 이력 추적 (Phase 1에서 기록, Phase 2에서 UI)

**기존 테이블 활용:**
```
GmPassportRequestLog
├─ id (primary)
├─ tripId (외래키)
├─ travelerId (외래키)
├─ messageId (Aligo)
├─ recipientPhone
├─ status ('PENDING' | 'SENT' | 'FAILED')
├─ sentAt (발송 시각)
├─ createdBy (발송자)
├─ createdAt
└─ updatedAt
```

**중복 방지 로직:**
```typescript
// 24시간 내 같은 고객에게 독촉한 적 있나?
const recentLog = await prisma.gmPassportRequestLog.findFirst({
  where: {
    travelerId: tv_id,
    tripId: trip_id,
    createdAt: { gte: now - 24h },
    status: 'SENT'
  }
});

if (recentLog) {
  return {
    warning: "어제 (2026-06-07 14:30) 이미 독촉 메시지를 보냈습니다.",
    proceed: confirm("계속 진행하시겠습니까?")
  }
}
```

---

## 📝 구현 체크리스트 (Phase 1)

### 백엔드 (API)

**신규 파일:**
- [ ] `src/app/api/passport/products/route.ts` (GET)
- [ ] `src/app/api/passport/customers/route.ts` (GET)
- [ ] `src/app/api/passport/send-sms/route.ts` (POST)

**수정 파일:**
- [ ] `src/lib/passport-utils.ts` (여권 상태 판단 함수)
- [ ] Prisma schema.prisma (GmPassportRequestLog 필드 확인)

**쿼리 검증:**
- [ ] Trip + Reservation + Traveler 최적화 JOIN 테스트
- [ ] 고객 1000명 조회 시간 < 1초 확인
- [ ] 여권 상태 필터링 쿼리 검증

### 프론트엔드 (UI)

**신규 컴포넌트:**
- [ ] `src/app/(dashboard)/passport/page.tsx` (메인 페이지)
- [ ] `src/components/PassportProductSearch.tsx` (드롭다운)
- [ ] `src/components/PassportCustomerTable.tsx` (고객 목록 테이블)
- [ ] `src/components/PassportStatusBadge.tsx` (상태 아이콘)

**UI 요구사항:**
- [ ] 상품 검색 드롭다운 (최소 500개 상품 지원)
- [ ] 고객 목록 테이블 (5개 컬럼, 모바일 반응형)
- [ ] SMS 발송 버튼 (개별)
- [ ] 발송 상태 실시간 표시
- [ ] 링크 복사 기능

### 보안 & 권한

- [ ] 권한 검증: 관리자만 접근 가능 (또는 대리점장)
- [ ] PII 마스킹: 이름 2자, 전화 뒤 4자리만
- [ ] CSRF 토큰 (POST /api/passport/send-sms)
- [ ] SMS 발송 전 확인 팝업

### 성능 & 모니터링

- [ ] 쿼리 성능 로깅 (N+1 감지)
- [ ] Aligo API 배치 처리 (배치 크기 10)
- [ ] SMS 비용 추적 (월별 집계)
- [ ] 에러 로깅 (발송 실패 사유)

---

## 🔄 API 명세 (상세)

### 1. 상품 목록 조회

```
GET /api/passport/products
쿼리 파라미터: 없음
권한: ADMIN | MANAGER
응답 시간: < 1초

Response:
{
  ok: true,
  data: {
    products: [
      {
        id: "trip-001",
        code: "SERANA-20260715",
        name: "세레나호 7박 카리브해",
        line: "ROYAL_CARIBBEAN",
        departureDate: "2026-07-15",
        totalReservations: 250,
        submittedPassports: 150,
        missingPassports: 100,
      }
    ]
  }
}
```

### 2. 고객 목록 조회

```
GET /api/passport/customers?tripId=trip-001&filter=missing
쿼리 파라미터:
  - tripId: "trip-001" (필수)
  - filter: "all" | "missing" | "submitted" (기본값: "all")
권한: ADMIN | MANAGER
응답 시간: < 2초

Response:
{
  ok: true,
  data: {
    trip: {
      id: "trip-001",
      name: "세레나호 7박",
      totalCustomers: 250,
      submitted: 150,
      missing: 100,
    },
    customers: [ ... ]
  }
}
```

### 3. SMS 발송

```
POST /api/passport/send-sms
Content-Type: application/json
권한: ADMIN | MANAGER
CSRF: 필수

Request Body:
{
  tripId: "trip-001",
  travelerId: "tv-001", // 개별
  // 또는
  travelerIds: ["tv-001", "tv-002"], // 일괄 (Phase 2)
  type: "manual"
}

Response:
{
  ok: true,
  data: {
    messageId: "msg-123",
    status: "SENT",
    sentAt: "2026-06-08T14:30:00+09:00",
    recipientCount: 1,
    estimatedCost: 45,
  }
}

Error:
{
  ok: false,
  error: "중복 발송: 24시간 내 이미 발송했습니다."
}
```

---

## 📊 DB 스키마 확인사항

### 기존 테이블 활용

```typescript
// 1. Trip (여행)
GmTrip {
  id: String @id
  productCode: String
  departureDate: DateTime
  reservations: GmReservation[]
}

// 2. Reservation (예약)
GmReservation {
  id: String @id
  tripId: String
  mainUserId: String
  traveler: GmTraveler[] // 탑승객
}

// 3. Traveler (탑승객 = 여권 제출자)
GmTraveler {
  id: String @id
  reservationId: String
  name: String
  phone: String
  passportNo: String? // null = 미제출
  expiryDate: String? // "2027-06-30"
  passportSubmissions: GmPassportSubmission[]
}

// 4. PassportSubmission (여권 제출 상태)
GmPassportSubmission {
  id: String @id
  travelerId: String
  tripId: String
  isSubmitted: Boolean
  submittedAt: DateTime?
  token: String @unique
  tokenExpiresAt: DateTime
}

// 5. PassportRequestLog (독촉 이력) ← 이 테이블이 핵심
GmPassportRequestLog {
  id: String @id
  tripId: String
  travelerId: String
  messageId: String? // Aligo message_id
  recipientPhone: String
  status: String // "PENDING" | "SENT" | "FAILED"
  sentAt: DateTime?
  createdBy: String // 발송자 userId
  createdAt: DateTime
  updatedAt: DateTime
}
```

### 추가 필드 검토

```typescript
// PassportRequestLog에 추가 필요?
// [ ] messageBody (실제 발송된 SMS 내용) - 감시용
// [ ] failureReason (발송 실패 사유) - 통계용
// [ ] cost (발송 비용, 원) - 비용 추적용
// [ ] organizationId (조직별 추적) - 권한용
```

---

## 🧪 테스트 케이스

### 1. Happy Path (정상 흐름)

```
Step 1: 상품 선택 (세레나호)
  → GET /api/passport/products
  ✓ 상품 250개 반환

Step 2: 고객 목록 조회 (미제출만)
  → GET /api/passport/customers?tripId=trip-001&filter=missing
  ✓ 100명 반환 (< 2초)

Step 3: 고객 1명 SMS 발송
  → POST /api/passport/send-sms { travelerId: "tv-001" }
  ✓ messageId 반환, status=SENT

Step 4: 고객이 링크 클릭
  → GET /passport/[token]
  ✓ 여권 제출 페이지 로드

Step 5: 고객이 여권 제출
  → POST /api/passport/submit { token, passportNo }
  ✓ GmPassportSubmission.isSubmitted = true
```

### 2. Edge Cases

```
Case 1: 24시간 내 중복 발송 시도
  → 경고: "어제 발송했습니다"
  ✓ confirm 필수

Case 2: SMS 발송 실패 (Aligo API 오류)
  → 에러 메시지: "SMS 발송 실패. 관리자에게 문의하세요"
  ✓ 로그 기록 + 재시도 가능

Case 3: 여권 이미 제출됨
  → 테이블에서 회색 처리 (disabled)
  ✓ SMS 버튼 비활성화

Case 4: 토큰 만료
  → 에러: "링크 만료. 새 링크를 요청하세요"
  ✓ 새 링크 발급 UI
```

---

## 🚀 배포 체크리스트

### 코드 품질

- [ ] TSC 컴파일 통과 (`npx tsc --noEmit`)
- [ ] ESLint 통과 (`npm run lint`)
- [ ] 보안 취약점 스캔 (`npm audit`)

### 성능

- [ ] DB 쿼리 성능 < 2초 (고객 1000명 기준)
- [ ] API 응답 < 500ms
- [ ] Lighthouse 점수 > 90

### 데이터

- [ ] GmPassportRequestLog 테이블 생성 확인
- [ ] 기존 여권 데이터 마이그레이션 불필요 (읽기만)
- [ ] 백업 완료

### 운영

- [ ] 에러 로깅 설정 (Sentry/CloudWatch)
- [ ] SMS 비용 모니터링
- [ ] 롤백 계획 수립

---

## 📞 Q&A & 주의사항

### Q: Aligo API 한계가 있나?
**A:** 초당 500건, 일일 100K건 제한.  
→ **해결:** 배치 처리 (크기 10) + 큐 시스템 (SQS/Redis)

### Q: 여권 중복 제출은?
**A:** DB UNIQUE 인덱스 확인 필수.  
→ **확인:** `UNIQUE(reservationId, passportNo)` 부분 인덱스 존재?

### Q: 시간대 버그는?
**A:** KST/UTC 불일치 가능.  
→ **해결:** `src/lib/passport-date.ts` 사용 (기존 완료)

### Q: 권한은 어떻게?
**A:** 관리자만 모든 상품 조회. 대리점장은 자신의 고객만.  
→ **구현:** `Contact.assignedUserId === session.userId` 필터

### Q: 모바일에서도 작동하나?
**A:** 테이블이 길어서 스크롤 필요.  
→ **해결:** 컬럼 5개 → 3개 (스크롤형) 또는 카드형 (모바일)

---

## 📈 성공 지표 (KPI)

**Phase 1 목표 (2주):**
```
여권 제출율: ?? % → 60% (동기화율 140%)
SMS 비용: 월 ~9000원 (배치)
시간 절감: 월 10시간
```

**Phase 2 목표 (4주):**
```
여권 제출율: 60% → 80% (자동 재발송)
완전 자동화율: 30% → 50%
```

---

**다음:** Phase 1 구현 시작 시 이 문서를 참고하세요.

최종 승인: __________  
승인일: __________
