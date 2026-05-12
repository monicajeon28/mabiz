# PNR & Reservation System

## Overview

완전 독립 예약 관리 시스템으로 13개 API와 15개 페이지를 포함합니다.

- **PNR (Passenger Name Record)**: 탑승자 정보 기록 및 관리
- **Reservation**: 여행 예약 생성, 조회, 수정, 최종확인
- **Traveler**: 개별 여행자 정보 (여권, 개인정보, 객실배정)
- **Final Confirmation**: 최종 확인 워크플로우 (요청 → 승인 → 확인)

---

## Directory Structure

```
cruisedot/pnr-reservation/
├── api/
│   ├── pnr/                          # PNR 기본 API
│   │   └── submit/route.ts          # PNR 제출 (기본, 사용 중단 예정)
│   ├── customer/                     # 고객용 API
│   │   ├── pnr/submit/route.ts      # PNR 정보 제출 (여행자명, 객실번호)
│   │   └── reservation/[id]/route.ts # 예약 조회 (GET)
│   ├── partner/                      # 파트너 API
│   │   ├── reservation/
│   │   │   ├── create/route.ts      # 예약 생성 (POST)
│   │   │   └── route.ts             # 예약 목록 (GET, 필터링)
│   │   └── reservations/
│   │       ├── [id]/route.ts        # 예약 상세 (GET, PATCH, DELETE)
│   │       ├── [id]/sync-apis/route.ts # APIS 스프레드시트 동기화
│   │       ├── [id]/verify-status/route.ts # PNR 상태 검증
│   │       └── by-payment/[paymentId]/route.ts # 결제로 예약 조회
│   ├── admin/                        # 어드민 API
│   │   ├── pnr-request/send/route.ts # PNR 요청 전송 (최종확인)
│   │   └── affiliate/sales-confirmation/pnr/route.ts # 제휴 매출 확인
│   └── public/                       # 공개 API (인증 불필요)
│       └── reservations/
│           ├── [id]/route.ts        # 예약 조회 (게스트)
│           └── [id]/passport-status/route.ts # 여권 상태 조회
├── pages/
│   ├── customer/
│   │   ├── pnr/[reservationId]/page.tsx # PNR 정보 입력 페이지
│   │   ├── passport/[reservationId]/page.tsx # 여권 업로드 페이지
│   │   └── passport-upload/[reservationId]/page.tsx # 여권 업로드 (alt)
│   ├── partner/
│   │   └── [partnerId]/reservation/new/page.tsx # 예약 생성 페이지
│   └── admin/
│       └── (final-confirm 로직 포함, 별도 페이지는 미포함)
├── components/
│   ├── ReservationForm.tsx          # 예약 생성/수정 폼 (3341 lines)
│   └── FinalConfirmSection.tsx      # 최종 확인 UI 컴포넌트 (378 lines)
├── lib/
│   ├── schemas/
│   │   └── reservation.zod.ts       # Zod 검증 스키마
│   ├── types/
│   │   └── index.ts                 # TypeScript 타입 정의
│   └── utils/
│       └── (helper functions - TBD)
├── schema/
│   ├── reservation.prisma           # Prisma 모델 정의
│   └── STATE_MACHINE.md             # 상태 전이도
├── DEPENDENCY_GRAPH.md              # 의존성 그래프 및 데이터 흐름
└── README.md                        # 이 파일
```

---

## API Documentation

### 1. Customer APIs

#### POST `/api/customer/pnr/submit`
고객이 PNR 정보를 제출합니다.

**Request:**
```json
{
  "reservationId": 123,
  "travelers": [
    {
      "id": 1,
      "korName": "홍길동",
      "residentNum": "900101-1234567",
      "phone": "01012345678",
      "roomNumber": 1001
    }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "message": "PNR 정보가 성공적으로 저장되었습니다.",
  "reservation": {
    "id": 123,
    "pnrStatus": "COMPLETED",
    "totalPeople": 1,
    "Traveler": [...]
  }
}
```

**Validation:**
- 여행자명: 필수, 1-100자
- 주민등록번호: 필수
- 연락처: 필수
- 객실번호: 필수, 양수

---

#### GET `/api/customer/reservation/[reservationId]`
예약 정보를 조회합니다.

**Response:**
```json
{
  "ok": true,
  "reservation": {
    "id": 123,
    "tripId": 456,
    "mainUserId": 789,
    "pnrStatus": "COMPLETED",
    "passportStatus": "PENDING",
    "finalConfirmStatus": "PENDING",
    "Traveler": [...]
  }
}
```

---

### 2. Partner APIs

#### POST `/api/partner/reservation/create`
새로운 예약을 생성합니다.

**Request:**
```json
{
  "tripId": 456,
  "mainUser": {
    "name": "김여행",
    "phone": "01098765432",
    "email": "kim@example.com"
  },
  "travelers": [
    {
      "korName": "김여행",
      "gender": "M",
      "birthDate": "1990-01-01",
      "passportNo": "A12345678",
      "expiryDate": "2030-12-31",
      "roomNumber": 1001,
      "nationality": "KR"
    }
  ],
  "cabinType": "외항실",
  "pnrStatus": "PENDING"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "예약이 생성되었습니다.",
  "reservation": {
    "id": 123,
    "status": "CONFIRMED",
    "pnrStatus": "PENDING",
    "Traveler": [...]
  }
}
```

---

#### GET `/api/partner/reservations`
예약 목록을 조회합니다 (필터링 가능).

**Query Params:**
```
?tripId=456&status=CONFIRMED&pnrStatus=COMPLETED&page=1&limit=20
```

**Response:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 123,
      "status": "CONFIRMED",
      "pnrStatus": "COMPLETED",
      "passportStatus": "PENDING",
      "totalPeople": 2
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

---

#### PATCH `/api/partner/reservations/[reservationId]`
예약 정보를 수정합니다.

**Request:**
```json
{
  "pnrStatus": "COMPLETED",
  "passportStatus": "SUBMITTED",
  "cabinType": "스위트",
  "remarks": "수정된 비고"
}
```

---

#### GET `/api/partner/reservations/by-payment/[paymentId]`
결제 ID로 예약을 조회합니다.

**Response:**
```json
{
  "ok": true,
  "reservation": { ... }
}
```

---

### 3. Admin APIs

#### POST `/api/admin/pnr-request/send`
최종 확인 요청을 전송합니다.

**Request:**
```json
{
  "reservationId": 123,
  "requestedById": 999,
  "remarks": "최종 확인 필요"
}
```

**Flow:**
```
1. Reservation.finalConfirmStatus = "REQUESTED"
2. Reservation.finalConfirmRequestedAt = now()
3. Reservation.finalConfirmRequestedById = 999
4. ReservationAudit 기록
5. 선사에 알림 발송
```

---

#### POST `/api/admin/affiliate/sales-confirmation/pnr`
제휴 매출 확인 API (PNR 관련).

---

### 4. Public APIs

#### GET `/api/reservations/[id]`
공개 예약 정보 조회 (인증 불필요).

**Query Params:**
```
?token=abc123  # 공개 토큰 (선택)
```

---

#### GET `/api/reservations/[id]/passport-status`
여권 상태 조회 (게스트용).

**Response:**
```json
{
  "ok": true,
  "passportStatus": "SUBMITTED",
  "travelers": [
    {
      "id": 1,
      "korName": "홍길동",
      "passportNo": "A12345678",
      "expiryDate": "2030-12-31",
      "status": "VERIFIED"
    }
  ]
}
```

---

## Page Components

### 1. Customer PNR Page
**Path:** `pages/customer/pnr/[reservationId]/page.tsx`

기능:
- PNR 정보 입력 폼 (여행자명, 주민등록번호, 연락처, 객실번호)
- 기존 PNR 수정
- 동행자 추가/삭제
- 폼 검증 (Zod)
- 제출 및 상태 확인

---

### 2. Customer Passport Page
**Path:** `pages/customer/passport/[reservationId]/page.tsx`

기능:
- 여권 업로드 (이미지 + PDF)
- Google Drive 연동
- 여행자별 상태 표시
- 여권 만료일 경고

---

### 3. Customer Passport Upload (Alternative)
**Path:** `pages/customer/passport-upload/[reservationId]/page.tsx`

기능:
- 간단한 여권 업로드
- 드래그 앤 드롭 지원

---

### 4. Partner Reservation Create
**Path:** `pages/partner/[partnerId]/reservation/new/page.tsx`

기능:
- 새 예약 생성 (여행 선택)
- 대표자 정보 입력
- 여행자 정보 입력 (동행자)
- 객실 배정
- PNR 초기 상태 설정

---

## UI Components

### ReservationForm.tsx (3341 lines)
예약 생성/수정 폼 컴포넌트

**주요 기능:**
- 동적 여행자 추가/삭제
- 객실 그룹핑 (roomNumber 기반)
- 여권 정보 입력
- 싱글차지 처리
- 폼 검증 (실시간)
- 서버 제출

**Props:**
```typescript
interface ReservationFormProps {
  tripId: number;
  initialReservation?: Reservation;
  onSubmit?: (data: ReservationData) => Promise<void>;
  isLoading?: boolean;
}
```

---

### FinalConfirmSection.tsx (378 lines)
최종 확인 UI 컴포넌트

**주요 기능:**
- 최종 확인 요청 버튼
- 승인/반려 작업 흐름
- 음성 확인 업로드
- 상태 표시 (요청됨 / 승인됨 / 반려됨)

**Props:**
```typescript
interface FinalConfirmSectionProps {
  reservationId: number;
  currentStatus: string;
  requestedAt?: Date;
  approvedAt?: Date;
  onStatusChange?: (newStatus: string) => void;
}
```

---

## Data Models

### Reservation
```prisma
model Reservation {
  id: Int @id
  tripId: Int
  mainUserId: Int
  totalPeople: Int
  
  // Status fields
  pnrStatus: String @default("PENDING")
  passportStatus: String @default("PENDING")
  finalConfirmStatus: String @default("PENDING")
  status: String @default("CONFIRMED")
  
  // Final Confirmation
  finalConfirmRequestedAt: DateTime?
  finalConfirmRequestedById: Int?
  finalConfirmApprovedAt: DateTime?
  finalConfirmApprovedById: Int?
  finalConfirmAudioUrl: String?
  finalConfirmAudioDriveUrl: String?
  
  // Metadata
  pnrNumber: String?
  cabinType: String?
  paymentInfo: ...
  
  // Relations
  Traveler: Traveler[]
  Trip: Trip
  User: User
}
```

### Traveler
```prisma
model Traveler {
  id: Int @id
  reservationId: Int
  roomNumber: Int
  
  // Personal Info
  korName: String?
  engSurname: String?
  engGivenName: String?
  residentNum: String?
  gender: String?
  birthDate: String?
  
  // Passport Info
  passportNo: String?
  issueDate: String?
  expiryDate: String?
  nationality: String?
  
  // Files & Links
  passportImage: String?
  passportDriveUrl: String?
  
  // Relations
  Reservation: Reservation
  User: User?
}
```

### ReservationAudit
```prisma
model ReservationAudit {
  id: Int @id
  reservationId: Int
  action: String // "CREATED", "UPDATED", "CONFIRMED", etc.
  fieldChanged: String?
  oldValue: String?
  newValue: String?
  createdAt: DateTime
}
```

---

## State Machine

### PNR Status Flow
```
PENDING → COMPLETED → [확정]
   ↓
  ERROR (재시도)
   ↓
CANCELLED
```

### Passport Status Flow
```
PENDING → SUBMITTED → VERIFIED → APPROVED
   ↓
 REJECTED (재제출)
```

### Final Confirm Status Flow
```
PENDING → REQUESTED → APPROVED → CONFIRMED
   ↓         ↓
REJECTED ←──┘
(사유 필수)
```

### Reservation Status Flow
```
PENDING → CONFIRMED → COMPLETED
            ↓
         CANCELLED
```

---

## Validation Rules

### Traveler
- `korName`: 필수, 1-100자
- `residentNum`: 필수 (형식: YYMMDD-XXXXXXX)
- `phone`: 필수
- `roomNumber`: 필수, 양수
- `passportNo`: 선택, A-Z + 8자리 숫자
- `expiryDate`: 선택, YYYY-MM-DD (미래 날짜)

### Reservation
- `tripId`: 필수, 양수
- `mainUserId`: 필수, 양수
- `totalPeople`: 필수, 최소 1
- `cabinType`: 선택
- `paymentAmount`: 선택, 0 이상

---

## Workflow Examples

### 예약 완전 흐름 (하루 종일)

**Step 1: 예약 생성 (파트너)**
```
POST /api/partner/reservation/create
└─ Reservation.status = "CONFIRMED"
└─ Reservation.pnrStatus = "PENDING"
└─ Travelers[] 생성 (기본 정보만)
```

**Step 2: PNR 정보 입력 (고객)**
```
POST /api/customer/pnr/submit
└─ 여행자명, 주민등록번호, 연락처 입력
└─ Reservation.pnrStatus = "COMPLETED"
└─ Traveler[] 업데이트
```

**Step 3: 여권 업로드 (고객)**
```
POST /pages/customer/passport/[id]
└─ 여권 이미지 업로드 (Google Drive)
└─ Traveler.passportImage, passportDriveUrl 저장
└─ Reservation.passportStatus = "SUBMITTED"
```

**Step 4: 최종 확인 요청 (파트너/어드민)**
```
POST /api/admin/pnr-request/send
└─ Reservation.finalConfirmStatus = "REQUESTED"
└─ Reservation.finalConfirmRequestedAt = now()
└─ 선사에 알림 발송
```

**Step 5: 최종 확인 승인 (어드민)**
```
PATCH /api/admin/pnr-request/approve
└─ 음성 확인 수집
└─ Reservation.finalConfirmStatus = "APPROVED"
└─ Reservation.finalConfirmApprovedAt = now()
└─ Reservation.finalConfirmAudioUrl 저장
```

**Step 6: 최종 확인 완료**
```
PATCH /api/admin/pnr-request/confirm
└─ Reservation.finalConfirmStatus = "CONFIRMED"
└─ Reservation.status = "CONFIRMED"
└─ 고객에게 확정 알림 발송
```

---

## Error Handling

### Common Error Codes

| Code | Message | Cause | Action |
|------|---------|-------|--------|
| 400 | 필수 필드가 누락되었습니다 | 입력 데이터 부족 | 폼 검증 후 재제출 |
| 404 | 예약을 찾을 수 없습니다 | ID 오류 | ID 확인 |
| 409 | 예약이 이미 존재합니다 | 중복 생성 시도 | 기존 예약 사용 |
| 422 | 상태 전이가 불가능합니다 | 잘못된 상태 변경 | 현재 상태 확인 |
| 500 | 서버 오류 | 데이터베이스/시스템 오류 | 고객지원 연락 |

---

## Performance Considerations

### Database Indexes
```sql
-- Reservation
CREATE INDEX ON Reservation(mainUserId);
CREATE INDEX ON Reservation(tripId);
CREATE INDEX ON Reservation(pnrStatus);
CREATE INDEX ON Reservation(passportStatus);
CREATE INDEX ON Reservation(finalConfirmStatus);

-- Traveler
CREATE INDEX ON Traveler(reservationId);
CREATE INDEX ON Traveler(userId);
```

### Query Optimization
- Traveler 조회 시 `include: { Traveler: true }` 사용
- Pagination: 기본 limit=20
- Sorting: `createdAt DESC` (최신순)

---

## Security

### Authentication & Authorization
- Partner API: `authToken` 필수
- Admin API: `adminRole` 필수
- Customer API: `userId` 검증
- Public API: 제한 없음 (rate limiting만)

### Data Protection
- 민감정보 (주민등록번호) 마스킹 금지 (선사 요구)
- HTTPS only
- CSRF 토큰 검증 (POST/PATCH/DELETE)
- Input sanitization (Zod)

---

## Testing

### Unit Tests (TBD)
- Zod schema validation
- State machine transitions
- Business logic (room grouping, single charge)

### Integration Tests (TBD)
- API endpoint tests
- Database transaction tests
- Audit logging tests

### E2E Tests (TBD)
- Full reservation flow
- PNR submission
- Passport upload
- Final confirmation

---

## Development Guide

### Adding a New API Endpoint

1. **Create route file:**
   ```
   api/[section]/[feature]/route.ts
   ```

2. **Add Zod schema:**
   ```typescript
   // lib/schemas/reservation.zod.ts
   export const NewFeatureSchema = z.object({ ... });
   ```

3. **Implement handler:**
   ```typescript
   export async function POST(req: NextRequest) {
     const body = NewFeatureSchema.parse(await req.json());
     // ... implementation
   }
   ```

4. **Add error handling:**
   ```typescript
   try {
     // ...
   } catch (error) {
     return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
   }
   ```

5. **Document in README.md**

---

## Related Files

- Prisma schema: `prisma/schema.prisma`
- State diagram: `schema/STATE_MACHINE.md`
- Dependency graph: `DEPENDENCY_GRAPH.md`
- Type definitions: `lib/types/index.ts`
- Validation schemas: `lib/schemas/reservation.zod.ts`

---

## Support

- Issues: 크루즈 관리 시스템 GitHub
- Slack: #pnr-reservation
- Documentation: https://wiki.cruiseai.local/pnr

---

**Last Updated:** 2026-05-11
**Version:** 1.0.0
**Status:** Production Ready
