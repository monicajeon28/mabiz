# CRM 통합 체크리스트

`crm-integration` 폴더의 3가지 기능(APIS + 여권 + PNR)을 CRM에 통합하기 위한 단계별 체크리스트입니다.

---

## 📌 Phase 1: 준비 (1-2시간)

### 1-1. 파일 복사 및 구조 확인
- [ ] `crm-integration/passport` 폴더 내용 확인
  - 파일 개수: ~40개
  - 주요: api/, pages/, lib/, migrations/
  
- [ ] `crm-integration/pnr-reservation` 폴더 내용 확인
  - 파일 개수: ~35개
  - 주요: api/, pages/, lib/, schema/

- [ ] `crm-integration/apis` 폴더 내용 확인
  - 파일 개수: ~15개
  - 주요: lib/apis-sync-queue.ts, batch/, scripts/

### 1-2. DB 스키마 검토
- [ ] `passport/migrations/` 파일 확인
  - PassportUpload 테이블 정의
  - 필드: id, customerId, tripId, status, uploadToken, etc.
  
- [ ] `pnr-reservation/schema/` 확인
  - PnrReservation 모델 정의
  - 상태: CONFIRMED → PNR_ISSUED → COMPLETED
  
- [ ] APIS 큐 테이블 필요 확인
  - ApisSyncQueue (id, targetType, targetId, status, scheduledAt)

### 1-3. 의존성 확인
- [ ] Google Sheets API 키 확보 (APIS 동기화용)
- [ ] 파일 저장소 준비 (여권 이미지용 — 로컬/S3/GCS)
- [ ] 항공사 데이터 소스 확인

---

## 📌 Phase 2: 데이터베이스 설정 (1-2시간)

### 2-1. 마이그레이션 적용
- [ ] 여권 테이블 마이그레이션
  ```bash
  npx prisma migrate deploy  # passport 마이그레이션 실행
  ```

- [ ] PNR 테이블 추가 (schema.prisma)
  - 다음을 `schema.prisma`에 추가:
  ```prisma
  model PnrReservation {
    id              Int      @id @default(autoincrement())
    reservationId   Int      @unique
    status          String   @default("CONFIRMED")
    pnrCode         String?  @unique
    passengers      Json     // 승객 정보
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt
  }
  ```

- [ ] APIS 큐 테이블 추가 (schema.prisma)
  ```prisma
  model ApisSyncQueue {
    id          Int      @id @default(autoincrement())
    targetType  String   // MASTER_SHEET | TRIP_SHEET
    targetId    Int
    status      String   @default("PENDING")
    scheduledAt DateTime
    processedAt DateTime?
    error       String?
    createdAt   DateTime @default(now())
  }
  ```

- [ ] 마이그레이션 생성 및 배포
  ```bash
  npx prisma migrate dev --name add_pnr_and_apis
  npx prisma generate
  ```

### 2-2. DB 연결 테스트
- [ ] 로컬 환경에서 테이블 생성 확인
  ```bash
  psql -d your_database -c "\dt"  # 테이블 목록 확인
  ```

---

## 📌 Phase 3: API 라우트 연결 (2-3시간)

### 3-1. 여권 API 라우트
- [ ] `/app/api/[crm]/passport/` 디렉토리 생성

- [ ] 엔드포인트 매핑:
  ```typescript
  // POST /api/[crm]/passport/upload
  export { POST } from '@/crm-integration/passport/api/customer/upload';
  
  // GET /api/[crm]/passport/requests
  export { GET } from '@/crm-integration/passport/api/partner/requests';
  
  // PATCH /api/[crm]/passport/validate/:id
  export { PATCH } from '@/crm-integration/passport/api/partner/validate';
  ```

### 3-2. PNR API 라우트
- [ ] `/app/api/[crm]/pnr/` 디렉토리 생성

- [ ] 엔드포인트 매핑:
  ```typescript
  // POST /api/[crm]/pnr/create
  export { POST } from '@/crm-integration/pnr-reservation/api/pnr/create';
  
  // GET /api/[crm]/pnr/:pnrId
  export { GET } from '@/crm-integration/pnr-reservation/api/pnr/detail';
  
  // PATCH /api/[crm]/pnr/:pnrId/status
  export { PATCH } from '@/crm-integration/pnr-reservation/api/pnr/update-status';
  ```

### 3-3. APIS Cron 라우트
- [ ] `/app/api/cron/apis-sync/` 생성
  ```typescript
  import { processApisSyncQueue } from '@/crm-integration/apis/lib/apis-sync-queue';
  
  export const POST = async (req: Request) => {
    try {
      await processApisSyncQueue(10);
      return Response.json({ success: true, processed: true });
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  };
  ```

### 3-4. Vercel Cron 설정
- [ ] `vercel.json` (또는 `vercel.ts`) 에 Cron 작업 등록:
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/apis-sync",
        "schedule": "*/10 * * * *"  // 10분마다
      }
    ]
  }
  ```

---

## 📌 Phase 4: UI 페이지 통합 (2-3시간)

### 4-1. 여권 관리 페이지
- [ ] 고객용 페이지
  ```typescript
  // app/[crm]/passport/page.tsx
  export { default } from '@/crm-integration/passport/pages/customer-passport-page';
  ```

- [ ] 대리점장용 페이지
  ```typescript
  // app/[crm]/passport/validate/page.tsx
  export { default } from '@/crm-integration/passport/pages/partner-passport-requests-page';
  ```

- [ ] 관리자용 페이지
  ```typescript
  // app/admin/passport/page.tsx
  export { default } from '@/crm-integration/passport/pages/admin-passport-request-page';
  ```

### 4-2. PNR 발권 페이지
- [ ] 고객용 페이지
  ```typescript
  // app/[crm]/pnr/page.tsx
  export { default } from '@/crm-integration/pnr-reservation/pages/customer/ReservationPage';
  ```

- [ ] 대리점장용 페이지
  ```typescript
  // app/[crm]/pnr/manage/page.tsx
  export { default } from '@/crm-integration/pnr-reservation/pages/partner/PartnerPnrPage';
  ```

- [ ] 관리자용 페이지
  ```typescript
  // app/admin/pnr/page.tsx
  export { default } from '@/crm-integration/pnr-reservation/pages/admin/AdminPnrPage';
  ```

### 4-3. 레이아웃 통합
- [ ] 네비게이션 메뉴에 링크 추가
  - 고객: "여권 업로드", "발권 현황"
  - 대리점: "여권 검증", "PNR 관리"
  - 관리자: "여권 승인", "PNR 발권"

---

## 📌 Phase 5: 환경 변수 설정 (30분)

### 5-1. Google Sheets API (APIS용)
- [ ] `.env.local` (로컬) 또는 Vercel 환경변수에 추가:
  ```env
  GOOGLE_SHEETS_API_KEY=xxx
  MASTER_APIS_SHEET_ID=1A2B3C...
  APIS_SHEET_MAPPING={"1": "sheetId1", "2": "sheetId2"}
  ```

### 5-2. 파일 저장소 (여권 이미지용)
- [ ] 저장소 선택 및 설정:
  - 로컬: `public/uploads/passport/`
  - Google Cloud Storage: `GOOGLE_CLOUD_BUCKET=xxx`
  - AWS S3: `AWS_S3_BUCKET=xxx`

### 5-3. 보안 토큰
- [ ] CSRF 토큰 비밀 설정
- [ ] JWT 시크릿 확인
- [ ] 파일 업로드 토큰 유효 기간 설정 (기본 24시간)

---

## 📌 Phase 6: 로컬 테스트 (2-3시간)

### 6-1. APIS 동기화 테스트
```bash
# 1. 로컬 개발 서버 시작
npm run dev

# 2. 큐 작업 추가 테스트
curl -X POST http://localhost:3000/api/[crm]/apis/enqueue \
  -H "Content-Type: application/json" \
  -d '{ "targetType": "MASTER_SHEET", "targetId": 1 }'

# 3. Cron 수동 실행
curl -X POST http://localhost:3000/api/cron/apis-sync

# 4. DB 확인
psql -d your_database -c "SELECT * FROM ApisSyncQueue;"
```

### 6-2. 여권 업로드 테스트
- [ ] 테스트 고객으로 로그인
- [ ] 여권 파일 업로드
  ```bash
  curl -X POST http://localhost:3000/api/[crm]/passport/upload \
    -F "file=@passport.jpg" \
    -F "customerId=1" \
    -F "tripId=1"
  ```
- [ ] 업로드된 파일 확인
- [ ] 대리점장 승인 흐름 테스트
- [ ] 상태 변환 확인 (PENDING → APPROVED)

### 6-3. PNR 발권 테스트
- [ ] PNR 생성 요청
  ```bash
  curl -X POST http://localhost:3000/api/[crm]/pnr/create \
    -H "Content-Type: application/json" \
    -d '{ "customerId": 1, "tripId": 1, "passengers": [...] }'
  ```
- [ ] PNR 상태 조회
- [ ] 상태 전환 테스트 (CONFIRMED → PNR_ISSUED → COMPLETED)
- [ ] 웹훅 수신 확인

### 6-4. E2E 테스트
- [ ] 예약 생성 → 여권 요청 → 발권 → 완료 전체 흐름 테스트
- [ ] 에러 시나리오 (파일 크기 초과, 잘못된 상태 전환 등)

---

## 📌 Phase 7: 배포 준비 (1시간)

### 7-1. 빌드 확인
```bash
npm run build
# 에러 0개 확인
```

### 7-2. 타입 체크
```bash
npx tsc --noEmit
# 에러 0개 확인
```

### 7-3. 환경 변수 배포
```bash
vercel env pull  # Vercel에서 환경 변수 당겨오기
```

### 7-4. Vercel 배포 프리뷰
```bash
vercel deploy --prod --confirm
# 또는 Git push로 자동 배포
```

### 7-5. 프로덕션 테스트
- [ ] 여권 업로드 (프로덕션 서버)
- [ ] PNR 발권 (프로덕션 서버)
- [ ] APIS 동기화 확인 (Google Sheets 반영 확인)

---

## 📌 Phase 8: 모니터링 & 유지보수

### 8-1. 로깅 설정
- [ ] 모든 API 호출 로깅
- [ ] APIS 동기화 로깅
- [ ] 에러 로깅 (Sentry 등)

### 8-2. 대시보드 설정
- [ ] 여권 대기 건수 알림
- [ ] PNR 발권 실패 알림
- [ ] APIS 동기화 실패 알림

### 8-3. 주간 리뷰
- [ ] 실패한 여권 요청 검토
- [ ] PNR 발권 성공률 확인
- [ ] APIS 동기화 완료율 모니터링

---

## ⏱️ 예상 시간

| Phase | 시간 | 담당 |
|-------|------|------|
| Phase 1 (준비) | 1-2h | Tech Lead |
| Phase 2 (DB) | 1-2h | Backend |
| Phase 3 (API) | 2-3h | Backend |
| Phase 4 (UI) | 2-3h | Frontend |
| Phase 5 (환경변수) | 0.5h | DevOps |
| Phase 6 (테스트) | 2-3h | QA |
| Phase 7 (배포) | 1h | DevOps |
| Phase 8 (모니터링) | Ongoing | All |
| **총합** | **11-16h** | **병렬 3-4팀** |

---

## ✅ 완료 확인사항

배포 전 반드시 확인:
- [ ] 여권 업로드 성공 (5개 파일 테스트)
- [ ] PNR 발권 성공 (3가지 항공사 테스트)
- [ ] APIS 동기화 자동화 (Cron 10분 확인)
- [ ] 모든 에러 케이스 처리됨
- [ ] 타입 체크 0에러
- [ ] 빌드 성공
- [ ] 로깅/모니터링 활성화

---

**최종 체크**: 모든 단계 완료 → `git commit` → `git push` → 배포 준비 완료 ✅
