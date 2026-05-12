# 🚀 CRM 통합 빠른 시작 가이드

**`crm-integration` 폴더를 사용하여 CRM에 APIS + 여권 + PNR 기능을 빠르게 통합하세요.**

---

## 📦 포함된 것

```
crm-integration/
├── passport/           ✅ 여권 제출/검증/승인 (40개 파일)
├── pnr-reservation/    ✅ PNR 발권/추적 (35개 파일)
├── apis/               ✅ Google Sheets 자동 동기화 (15개 파일)
├── README.md           📖 전체 기능 설명
├── INTEGRATION_CHECKLIST.md 📋 단계별 체크리스트
└── QUICK_START.md      🚀 이 파일
```

**총 87개 파일** — 프로덕션 준비 완료

---

## ⚡ 5분 안에 이해하기

### 1️⃣ **여권 관리** 
고객이 여권 사진을 업로드 → 대리점장이 검증 → 관리자가 승인/반려

```
📸 고객 업로드 → ✅ 대리점장 검증 → ✅ 관리자 승인 → 📋 여행에 적용
```

### 2️⃣ **PNR 발권**
예약 정보 → PNR 코드 생성 → 항공사에 제출 → 탑승권 발행

```
📅 예약 확정 → 📝 PNR 발권 → ✈️ 항공사 전달 → 🎫 탑승권 발행 → ✅ 완료
```

### 3️⃣ **APIS 자동화**
예약 정보를 자동으로 Google Sheets 마스터 시트에 동기화 (10분마다)

```
📊 예약 생성 → [10분 대기] → 자동 동기화 → Google Sheets 업데이트
```

---

## 🔧 최소 설정 (15분)

### Step 1: 폴더 복사
```bash
# 프로젝트 루트에서
cp -r crm-integration ./  # 이미 있음
```

### Step 2: DB 마이그레이션
```bash
npx prisma migrate dev --name "add_crm_features"
```

### Step 3: API 라우트 1개 테스트
```bash
# app/api/[crm]/passport/upload/route.ts 생성
export { POST } from '@/crm-integration/passport/api/customer/upload';
```

### Step 4: 로컬 테스트
```bash
npm run dev

# 다른 터미널에서
curl -X POST http://localhost:3000/api/[crm]/passport/upload \
  -F "file=@test.jpg" -F "customerId=1" -F "tripId=1"
```

---

## 📂 각 기능별 핵심 파일

### **여권 (`passport/`)**
| 파일 | 용도 |
|------|------|
| `api/customer/upload.ts` | 고객 여권 업로드 |
| `api/partner/validate.ts` | 대리점장 검증 |
| `api/admin/approve.ts` | 관리자 승인 |
| `lib/passport-utils.ts` | 유틸 함수 |
| `pages/*.tsx` | UI 페이지 |

### **PNR (`pnr-reservation/`)**
| 파일 | 용도 |
|------|------|
| `api/pnr/create.ts` | PNR 생성 |
| `api/pnr/update-status.ts` | 상태 업데이트 |
| `lib/utils/state-machine.ts` | 상태 전환 검증 |
| `pages/customer/*.tsx` | 고객 UI |
| `pages/admin/*.tsx` | 관리자 UI |

### **APIS (`apis/`)**
| 파일 | 용도 |
|------|------|
| `lib/apis-sync-queue.ts` | 동기화 큐 관리 |
| `lib/airlines.ts` | 항공사 정보 |
| `batch/google-sheets/` | Google Sheets 연동 |

---

## 🔌 API 엔드포인트

### 여권
```
POST   /api/[crm]/passport/upload         → 여권 업로드
GET    /api/[crm]/passport/requests       → 요청 목록
PATCH  /api/[crm]/passport/validate/:id   → 검증
PATCH  /api/[crm]/passport/approve/:id    → 승인
```

### PNR
```
POST   /api/[crm]/pnr/create              → PNR 생성
GET    /api/[crm]/pnr/:pnrId              → 상세 조회
PATCH  /api/[crm]/pnr/:pnrId/status       → 상태 업데이트
POST   /api/[crm]/pnr/:pnrId/ticket       → 탑승권 발행
```

### APIS
```
POST   /api/cron/apis-sync                → 동기화 실행 (Cron)
```

---

## 🧪 간단한 테스트

### 여권 테스트
```bash
# 1. 파일 준비
echo "test" > test.jpg

# 2. 업로드
curl -X POST http://localhost:3000/api/[crm]/passport/upload \
  -F "file=@test.jpg" \
  -F "customerId=1" \
  -F "tripId=1"

# 3. 결과 확인
# Response: { success: true, uploadId: 123, status: "PENDING" }
```

### PNR 테스트
```bash
# 1. PNR 생성
curl -X POST http://localhost:3000/api/[crm]/pnr/create \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "tripId": 1,
    "passengers": [{ "name": "John Doe", "passportNo": "A12345678" }]
  }'

# 2. 결과 확인
# Response: { success: true, pnrId: 456, pnrCode: "ABC123" }
```

### APIS 테스트
```bash
# 1. Cron 수동 실행
curl -X POST http://localhost:3000/api/cron/apis-sync

# 2. 결과 확인
# Response: { success: true, processed: 5, failed: 0 }
```

---

## 🔐 보안 체크리스트

- ✅ 파일 업로드: 매직 바이트 검증 (JPEG/PNG/GIF/WebP만)
- ✅ IDOR 방지: 모든 API에서 소유권 확인
- ✅ CSRF 방지: POST/PATCH에 토큰 필수
- ✅ 에러 마스킹: SQL/스택트레이스 노출 금지
- ✅ 토큰 보안: uploadToken 24시간 만료, HTTPS only

---

## 📊 DB 스키마

### PassportUpload
```sql
id              INT PRIMARY KEY
customerId      INT NOT NULL
tripId          INT NOT NULL
originalFileName VARCHAR
storagePath     VARCHAR
status          ENUM('PENDING', 'APPROVED', 'REJECTED')
uploadToken     VARCHAR UNIQUE
createdAt       TIMESTAMP
updatedAt       TIMESTAMP
```

### PnrReservation
```sql
id              INT PRIMARY KEY
reservationId   INT UNIQUE
status          ENUM('CONFIRMED', 'PNR_REQUESTED', 'PNR_ISSUED', 'COMPLETED')
pnrCode         VARCHAR UNIQUE
passengers      JSON
createdAt       TIMESTAMP
updatedAt       TIMESTAMP
```

### ApisSyncQueue
```sql
id              INT PRIMARY KEY
targetType      ENUM('MASTER_SHEET', 'TRIP_SHEET')
targetId        INT
status          ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')
scheduledAt     TIMESTAMP
processedAt     TIMESTAMP
createdAt       TIMESTAMP
```

---

## 🛠️ 트러블슈팅

### "여권 업로드 실패"
```
❌ 에러: File type not allowed
✅ 해결: JPEG/PNG/GIF/WebP 파일만 지원

❌ 에러: File size exceeds limit
✅ 해결: 10MB 이하 파일만 지원
```

### "PNR 상태 전환 실패"
```
❌ 에러: Invalid state transition
✅ 해결: CONFIRMED → PNR_ISSUED → COMPLETED 순서만 가능

❌ 에러: Missing required fields
✅ 해결: passengers 배열에 name, passportNo 필수
```

### "APIS 동기화 안 됨"
```
❌ 에러: Cron not executing
✅ 해결: vercel.json에 crons 설정 확인

❌ 에러: Google Sheets API key invalid
✅ 해결: .env 파일에서 GOOGLE_SHEETS_API_KEY 확인
```

---

## 📋 다음 단계

1. **전체 체크리스트 검토**
   - `/crm-integration/INTEGRATION_CHECKLIST.md` 읽기
   - 각 Phase별 요구사항 확인

2. **기능별 상세 문서 검토**
   - `passport/README.md` — 여권 시스템
   - `pnr-reservation/ARCHITECTURE.md` — PNR 아키텍처
   - `passport/FILE_INVENTORY.md` — 모든 파일 목록

3. **팀 분담**
   - Frontend: UI 페이지 통합 (Phase 4)
   - Backend: API 라우트 + DB (Phase 2-3)
   - DevOps: 환경변수 + 배포 (Phase 5-7)

4. **병렬 작업**
   - 3팀이 동시에 작업 가능
   - 예상 총 시간: 11-16시간
   - 병렬 작업 시: 1-2일

---

## 📞 문의 & 지원

각 기능별 구현 가이드:
- **여권**: `passport/` 폴더 내 문서
- **PNR**: `pnr-reservation/ARCHITECTURE.md`
- **APIS**: `apis/lib/apis-sync-queue.ts` 주석

---

**준비됐나요? 👉 `INTEGRATION_CHECKLIST.md` 시작하기**

---

**마지막 업데이트**: 2026-05-11  
**상태**: 🟢 프로덕션 준비 완료  
**배포 플랫폼**: Vercel (cruiseai.co.kr)
