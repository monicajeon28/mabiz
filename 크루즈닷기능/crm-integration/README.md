# CRM Integration — APIS + 여권 + PNR 관리 시스템

이 폴더는 **크루즈 CRM에 통합하기 위한 3가지 핵심 기능**을 담고 있습니다.

```
crm-integration/
├── apis/              # APIS 자동화 (Google Sheets 동기화)
├── passport/          # 여권 제출/확인 관리
└── pnr-reservation/   # PNR 발권/완료 관리
```

---

## 📋 기능 개요

### 1️⃣ **APIS 자동화** (`/apis`)
**항공사 승객 정보 시스템 — Google Sheets 자동 동기화**

```
✅ 기능:
  - 예약 정보 → 마스터 APIS 시트 자동 동기화
  - 여행 단위별 APIS 시트 생성
  - 배치 작업 (대량 승객 정보 업로드)
  - Cron 자동화 (10분마다 확인)

📁 구조:
  lib/apis-sync-queue.ts       # 동기화 큐 관리
  lib/airlines.ts              # 항공사 코드/정보
  batch/                        # Google Sheets 배치 작업
  scripts/                      # 초기 설정 및 테스트 스크립트
```

**사용 방법:**
```typescript
import { enqueueApisSync } from '@/crm-integration/apis/lib/apis-sync-queue';

// 사용자의 마스터 APIS 시트에 동기화 예약
await enqueueApisSync('MASTER_SHEET', userId);

// 특정 여행의 APIS 시트에 동기화 예약
await enqueueApisSync('TRIP_SHEET', tripId);
```

---

### 2️⃣ **여권 관리** (`/passport`)
**고객 여권 제출 → 확인 → 승인 워크플로우**

```
✅ 기능:
  - 고객 여권 이미지 업로드
  - 대리점장 검증 및 승인/반려
  - 관리자 수동 처리
  - 토큰 기반 보안 (IDOR 방지)

📁 구조:
  api/
    ├── customer/     # 고객: 여권 업로드/조회
    ├── partner/      # 대리점장: 검증/승인
    ├── admin/        # 관리자: 수동 처리
    └── public/       # 공개: 업로드 링크
  pages/              # UI 페이지들
  lib/passport-utils.ts
  schemas/            # Zod 검증 스키마
  migrations/         # DB 마이그레이션
```

**DB 모델:**
```prisma
model PassportUpload {
  id              Int       @id @default(autoincrement())
  customerId      Int
  tripId          Int
  
  # 파일 정보
  originalFileName String
  storagePath     String
  mimeType        String
  fileSize        Int
  
  # 상태 관리
  status          String    @default("PENDING")  // PENDING → APPROVED → REJECTED
  validatedAt     DateTime?
  approvedAt      DateTime?
  
  # 보안
  uploadToken     String    @unique
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**API 엔드포인트:**
```
POST   /api/passport/customer/upload
GET    /api/passport/customer/:id
PATCH  /api/passport/partner/validate/:id
POST   /api/passport/admin/manual-request
```

---

### 3️⃣ **PNR 관리** (`/pnr-reservation`)
**예약 PNR 발권 → 탑승권 발행 완료 추적**

```
✅ 기능:
  - 예약 정보 PNR 발권 (항공사 예약)
  - 발권 상태 추적 (예정 → 발권됨 → 완료)
  - 고객/대리점/관리자별 보기
  - 상태 머신 검증 (유효한 전환만 허용)

📁 구조:
  api/
    ├── customer/     # 고객: 예약 조회/발권 요청
    ├── partner/      # 대리점: 발권 관리
    ├── admin/        # 관리자: 발권 처리
    └── pnr/          # PNR API (발권/탑승권 생성)
  pages/              # UI 페이지들
  lib/
    ├── schemas/      # Zod 검증
    ├── types/        # TypeScript 타입
    └── utils/        # 상태 머신, 가격 계산
  schema/STATE_MACHINE.md
```

**상태 머신 (STATE_MACHINE.md):**
```
CONFIRMED → PNR_REQUESTED → PNR_ISSUED → TICKET_ISSUED → COMPLETED
   ↓
CANCELLED
```

**API 엔드포인트:**
```
POST   /api/pnr/create
GET    /api/pnr/:pnrId
PATCH  /api/pnr/:pnrId/status
POST   /api/pnr/:pnrId/ticket
```

---

## 🔗 통합 가이드

### **Step 1: 파일 복사**
```bash
# 각 기능별 폴더를 프로젝트에 복사
cp -r crm-integration/passport → app/[crm]/passport
cp -r crm-integration/pnr-reservation → app/[crm]/pnr
cp -r crm-integration/apis → lib/apis
```

### **Step 2: DB 마이그레이션**
```bash
# 여권 마이그레이션 실행
npx prisma migrate deploy  # passport 테이블 생성

# PNR 테이블 추가 (schema.prisma에 다음 추가):
model PnrReservation { ... }

# APIS 큐 테이블 추가:
model ApisSyncQueue { ... }
```

### **Step 3: API 라우트 연결**
```typescript
// app/api/[crm]/passport/upload/route.ts
export { POST } from '@/crm-integration/passport/api/customer/upload';

// app/api/[crm]/pnr/create/route.ts
export { POST } from '@/crm-integration/pnr-reservation/api/pnr/create';
```

### **Step 4: UI 페이지 연결**
```typescript
// app/[crm]/passport/page.tsx
export { default } from '@/crm-integration/passport/pages/customer-passport-page';

// app/[crm]/pnr/page.tsx
export { default } from '@/crm-integration/pnr-reservation/pages/customer/ReservationPage';
```

### **Step 5: 환경 변수 설정**
```env
# Google Sheets API
GOOGLE_SHEETS_API_KEY=***
MASTER_APIS_SHEET_ID=***

# APIS 시트 ID별 정보
APIS_SHEET_MAPPING={"userId1": "sheetId1", ...}

# 항공사 정보
AIRLINE_API_KEY=***  # 필요시
```

### **Step 6: Cron 작업 등록**
```typescript
// app/api/cron/apis-sync/route.ts
import { processApisSyncQueue } from '@/crm-integration/apis/lib/apis-sync-queue';

export const POST = async () => {
  await processApisSyncQueue(10);
  return Response.json({ success: true });
};
```

---

## 🧪 테스트

각 기능별 테스트 절차:

### **APIS 테스트**
```bash
# 1. 로컬 DB에 ApisSyncQueue 테이블 생성
npx prisma migrate

# 2. 큐 작업 추가
node crm-integration/apis/scripts/test-apis-sync.ts

# 3. Cron 실행 시뮬레이션
curl http://localhost:3000/api/cron/apis-sync
```

### **여권 테스트**
```bash
# 1. 테스트 고객으로 로그인
email: test@example.com
password: testpass123

# 2. 여권 파일 업로드
POST /api/passport/customer/upload
body: { customerId, tripId, file }

# 3. 대리점장 승인 확인
GET /api/passport/partner/requests
```

### **PNR 테스트**
```bash
# 1. 예약 생성
POST /api/pnr/create
body: { customerId, tripId, passengers, ... }

# 2. PNR 상태 확인
GET /api/pnr/:pnrId

# 3. 상태 전환 테스트
PATCH /api/pnr/:pnrId/status
body: { status: "PNR_ISSUED" }
```

---

## 📚 문서

각 폴더 내 문서:
- **passport/README.md** — 여권 시스템 상세 설명
- **passport/FILE_INVENTORY.md** — 모든 파일 목록
- **pnr-reservation/ARCHITECTURE.md** — PNR 아키텍처
- **pnr-reservation/STATE_MACHINE.md** — 상태 전환 규칙
- **apis/QUICKSTART.md** — APIS 빠른 시작 (구현 예정)

---

## ⚠️ 주의사항

### **보안**
- ✅ IDOR 방지: 소유권 항상 확인 (customerId, partnerId 검증)
- ✅ CSRF 방지: 상태 변경은 CSRF 토큰 필수
- ✅ PII 마스킹 금지: 관리자 패널은 여권번호/연락처 마스킹 X (선사 요구)
- ✅ 토큰 보안: uploadToken은 HTTPS만, 만료 시간 설정

### **성능**
- ⚡ APIS 동기화는 비동기 큐 사용 (동기 API 블로킹 방지)
- ⚡ PNR 상태 변환 시 원자성 보장 (Prisma Transaction)
- ⚡ 여권 파일은 웹P 변환 저장 (용량 최소화)

### **에러 처리**
- 모든 API는 구조화된 에러 응답 (ErrorCode + Message)
- 민감 정보(SQL, 스택트레이스) 노출 금지
- 모든 에러는 logger로 기록

---

## 🚀 다음 단계

1. **기존 CRM과 통합** — 예약/여행/고객 테이블과 연결
2. **웹훅 연동** — passport-approved, reservation-updated 웹훅 처리
3. **대시보드** — 관리자 패널에 여권/PNR 대기건 알림
4. **이메일 알림** — 승인/반려 시 자동 이메일 발송

---

## 📞 문의

각 기능의 구현 팀:
- **APIS**: 자동화 팀 (cruisedot/automation)
- **여권**: passport-team
- **PNR**: reservation-team

---

**마지막 업데이트**: 2026-05-11  
**상태**: 🟢 프로덕션 준비 완료  
**배포**: Vercel (cruiseai.co.kr)
