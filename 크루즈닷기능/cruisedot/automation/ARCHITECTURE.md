# 자동화 시스템 아키텍처

자동화 시스템의 완전한 흐름, 타이밍, 상호 의존성을 그려낸 문서입니다.

## 1. 전체 시스템 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      cruisedot Automation System                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   CRON       │  │   WEBHOOK    │  │   BATCH      │  │   MANUAL     │ │
│  │   (20개)     │  │   (7개)      │  │   (4개)      │  │   (15개)     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│         │                   │                  │                │        │
│         └───────────────────┴──────────────────┴────────────────┘        │
│                              │                                           │
│                    ┌─────────▼────────────┐                             │
│                    │   Sync Queues &      │                             │
│                    │   Distributed Locks  │                             │
│                    └─────────┬────────────┘                             │
│                              │                                           │
│         ┌────────────────────┼────────────────────┐                     │
│         │                    │                    │                     │
│    ┌────▼──────┐  ┌──────────▼────────┐  ┌───────▼──────┐              │
│    │  Google   │  │  Neon PostgreSQL  │  │   External   │              │
│    │  Drive    │  │  (Source of Truth)│  │   Services   │              │
│    │  (Files)  │  │                   │  │  (PayApp,    │              │
│    └───────────┘  │  Tables:          │  │  Google      │              │
│                   │  - ProductImage   │  │  Sheets)     │              │
│                   │  - Payment        │  │              │              │
│                   │  - Trial          │  │              │              │
│                   │  - CronLock       │  │              │              │
│                   │  - ApisSyncQueue  │  │              │              │
│                   └───────────────────┘  └──────────────┘              │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CRON 스케줄 & 타이밍

### UTC 24시간 타임라인

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CRON EXECUTION TIMELINE (24 hours UTC)                                    │
└──────────────────────────────────────────────────────────────────────────┘

00:00 UTC
  │
  ├─ [매월 1일만] payslip-sender
  │  목적: 급여명세서 자동 발송
  │  소요시간: ~30s
  │  의존성: affilliate data
  │
  └─ [매년 1월 1일만] reset-ytd
     목적: 연간 누적액 초기화
     소요시간: ~10s
     의존성: none

01:00 UTC
  │
  └─ sync-images
     목적: Google Drive → DB ImageCache 동기화
     소요시간: ~30s (파일 1000개 기준)
     의존성: Google Drive API
     락: image-cache-sync (분산 Lock)

02:00 UTC
  │
  └─ [매주 일요일만] trial-cleanup
     목적: 만료된 Trial 데이터 정리
     소요시간: ~10s
     의존성: none
     배치 크기: deleteMany()

04:00, 08:00, 12:00, 16:00, 20:00, 24:00 UTC (4시간마다)
  │
  ├─ trial-expire
  │  목적: 72시간 경과 Trial 자동 만료
  │  소요시간: ~5s
  │  의존성: none
  │  배치 크기: updateMany()
  │  락: trial-expire (분산 Lock)
  │
  └─ keep-alive (실제로는 30분마다, 여기서는 표시만)

*/5 (5분마다)
  │
  └─ send-scheduled-messages
     목적: 예약된 메시지/공지 발송
     소요시간: ~30s
     의존성: Email service (SendGrid)
     배치 크기: 100개 메시지

*/10 (10초마다, Cron이 아닌 API 폴링)
  │
  └─ process-payment-webhooks
     목적: Webhook 큐 배치 처리
     소요시간: ~5s
     의존성: Payment gateway (PayApp, WelcomePayments)
     배치 크기: 100개 항목
     재시도: 3회 (exponential backoff)

17:00 UTC
  │
  └─ drive-sync
     목적: Google Drive 메타데이터 전체 동기화
     소요시간: ~60s (전체 폴더 재검사)
     의존성: Google Drive API
     락: drive-sync (분산 Lock)

23:00 UTC
  │
  └─ news-auto-publish
     목적: 뉴스 자동 발행
     소요시간: ~30s
     의존성: News content source
     락: news-publish (분산 Lock)
```

### 병렬 실행 가능성 (No Conflicts)

```
시간별 동시 실행:
- 04:00, 08:00, 12:00, 16:00, 20:00, 24:00: trial-expire + keep-alive (conflict 없음)
- 01:00: sync-images 단독 (lock 사용)
- 17:00: drive-sync 단독 (lock 사용)
- 23:00: news-auto-publish 단독 (lock 사용)

락 전략: 최대 1개만 실행 (낙관적 Lock 사용)
락 TTL: 600초 (10분) - 타임아웃 방지
```

---

## 3. WEBHOOK 플로우

### 3.1 결제 결과 처리 (Payment Webhook)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Payment Webhook Flow: 결제 게이트웨이 → 시스템 업데이트                    │
└──────────────────────────────────────────────────────────────────────────┘

[PayApp / WelcomePayments]
  │
  │ HTTPS POST (HMAC 서명 포함)
  │ Payload: { mul_no, amount, status, timestamp, signature }
  ↓
[POST /api/webhook/payment/payapp]
  │
  ├─ 1. HMAC 서명 검증 (위변조 방지)
  │   └─ crypto.timingSafeEqual()
  │
  ├─ 2. Zod 입력 검증 (타입 안전)
  │   └─ paymentWebhookSchema.parse()
  │
  ├─ 3. 멱등성 검증 (중복 방지)
  │   └─ SELECT * FROM payment WHERE mul_no = ?
  │       ├─ 이미 존재: 200 OK (무시)
  │       └─ 신규: 계속
  │
  ├─ 4. 비동기 큐에 등록 (즉시 응답)
  │   └─ INSERT INTO apis_sync_queue
  │       { type: 'PAYMENT_WEBHOOK', status: 'PENDING', payload, retryCount: 0 }
  │
  └─ 5. 202 Accepted 반환 (< 1초)
      └─ Webhook sender에 즉시 응답

┌─ 백그라운드 처리 ─────────────────────────────────────────┐
│ (Cron: process-payment-webhooks, 10초마다 실행)            │
│                                                              │
│ 1. SELECT * FROM apis_sync_queue                           │
│    WHERE status = 'PENDING' LIMIT 100                      │
│                                                              │
│ 2. FOR EACH item IN pending:                               │
│      TRY:                                                    │
│        └─ BEGIN TRANSACTION                                │
│            ├─ INSERT INTO payment (...)                    │
│            ├─ INSERT INTO paymentLog (...)                 │
│            └─ COMMIT                                        │
│                                                              │
│      CATCH:                                                 │
│        ├─ retryCount < 3:                                  │
│        │  └─ UPDATE status = 'RETRYING'                   │
│        │     nextRetryAt = now() + (2 ^ retryCount) sec   │
│        │                                                    │
│        └─ retryCount >= 3:                                │
│           └─ UPDATE status = 'FAILED'                     │
│              errorMessage = 'Max retries exceeded'         │
│              alertSlack(...)                               │
└──────────────────────────────────────────────────────────────┘

[Neon PostgreSQL]
  ├─ payment (결제 완료)
  ├─ paymentLog (감사 로그)
  └─ apis_sync_queue (status = 'COMPLETED')
```

**성능 지표**:
- Webhook 응답: < 1초
- 큐 처리 지연: < 10초 (10초마다 배치)
- 재시도: 3회 (exponental backoff: 1s → 2s → 4s)
- 멱등성: mul_no로 중복 방지

---

### 3.2 Google Drive 변경 알림

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Google Drive Webhook Flow: 파일 변경 감지 → 동기화 트리거                  │
└──────────────────────────────────────────────────────────────────────────┘

[Google Drive]
  │
  │ Push Notification (Watch API)
  │ Headers: X-Goog-Resource-State = changes
  │ Body: { resourceId, resourceUri, changeType }
  ↓
[POST /api/webhook/drive/google-drive-sync]
  │
  ├─ 1. 변경 확인 (resourceState)
  │   └─ if (req.headers['x-goog-resource-state'] !== 'exists')
  │       return 204 No Content
  │
  ├─ 2. 변경 파일 식별
  │   └─ google.drive.changes().list() → GET 파일 메타데이터
  │
  ├─ 3. 동기화 트리거 선택
  │   ├─ Option A: 즉시 sync-images 실행
  │   │  └─ syncImageCache() (비동기)
  │   │
  │   └─ Option B: Cron 스케줄 대기 (다음 01:00)
  │      └─ 다음 sync-images CRON 에서 처리
  │
  └─ 4. 204 No Content 반환 (< 3초)

[Background Sync]
  │
  └─ lib/drive-sync.ts
     ├─ 1. Drive API 폴더 재검사
     │     └─ listFilesRecursive(CRUISEINFO_FOLDER_ID)
     │
     ├─ 2. DB와 비교 (변경된 파일만)
     │     └─ SELECT drive_id, modified_time FROM product_image
     │         WHERE modified_time < ?
     │
     ├─ 3. WebP 변환 (로컬 또는 클라우드)
     │     └─ convertToWebP(file)
     │
     ├─ 4. DB 저장 (트랜잭션)
     │     └─ BEGIN TRANSACTION
     │         ├─ INSERT/UPDATE product_image
     │         ├─ INSERT image_access_log
     │         └─ COMMIT
     │
     └─ 5. 성공/실패 로깅
         └─ securityLogger.info('ImageSync completed')

[Neon PostgreSQL]
  ├─ product_image (새 이미지)
  ├─ image_access_log (감사 로그)
  └─ drive_metadata_cache (캐시 업데이트)
```

**성능 지표**:
- Webhook 응답: < 3초
- 동기화 시간: < 30초 (1000개 파일)
- 변경 감지: 즉시 (Push Notification)

---

## 4. BATCH 처리 플로우

### 4.1 이미지 일괄 처리 (Batch Images)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Batch Image Processing: 대량 이미지 등록 & 최적화                         │
└──────────────────────────────────────────────────────────────────────────┘

[관리자] (Admin Panel에서 시작)
  │
  ├─ "Batch 1: 이미지 등록" 클릭
  ↓
[POST /api/batch/images/batch-1]
  │
  │ Query params: ?startIndex=0&chunkSize=100&format=webp
  │
  ├─ 1. 이미지 목록 조회
  │   └─ SELECT * FROM pending_images OFFSET ? LIMIT 100
  │
  ├─ 2. 청크 처리 (메모리 효율)
  │   └─ for (const img of chunk) { /* 처리 */ }
  │
  ├─ 3. WebP 변환 (Sharp)
  │   ├─ sharp(imgBuffer)
  │   │  .toFormat('webp', { quality: 80 })
  │   │  .toBuffer()
  │   │
  │   └─ 저장 위치:
  │       ├─ 로컬: /public/images/webp/
  │       └─ 클라우드: (Cloudinary/S3)
  │
  ├─ 4. DB 저장 (배치 트랜잭션)
  │   └─ await prisma.$transaction([
  │        prisma.productImage.create({ ... }),
  │        prisma.productImage.create({ ... }),
  │        ...
  │      ])
  │
  ├─ 5. 진행률 리포트
  │   └─ { processed: 100, failed: 2, remaining: 8900, eta: '45 min' }
  │
  └─ 6. 200 OK 반환

[후속 처리]
  ├─ 관리자가 ETA를 보고 다음 배치 시작
  ├─ Cron이 나머지 이미지 처리
  └─ 모든 이미지 완료 후 알림
```

**진행률 추적**:
```typescript
const progress = {
  processed: 100,      // 완료된 항목
  failed: 2,           // 실패한 항목
  total: 10000,        // 전체 항목
  percentage: 1.02,    // 1.02%
  eta: '45 minutes',   // ETA
  remaining: 9900,     // 남은 항목
};
```

---

### 4.2 Google Sheets 동기화 (Batch Sheets)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Batch Google Sheets: DB → Google Sheets 내보내기                          │
└──────────────────────────────────────────────────────────────────────────┘

[Cron / 관리자 수동 트리거]
  │
  ├─ POST /api/batch/google-sheets/sync-to-google
  ↓
[Batch Processor]
  │
  ├─ 1. DB 데이터 조회 (Prisma select)
  │   └─ const data = await prisma.product.findMany({
  │        select: { id, name, price, ... }
  │      })
  │
  ├─ 2. Google Sheets 문서 인증
  │   └─ google.sheets.auth.getClient()
  │
  ├─ 3. 셀 형식 변환
  │   └─ [[id, name, price, ...], ...]
  │
  ├─ 4. 시트 추가/업데이트
  │   └─ sheets.spreadsheets.batchUpdate({
  │        requests: [
  │          { updateCells: { ... } }
  │        ]
  │      })
  │
  └─ 5. 완료 리포트
      └─ { rows: 5000, timestamp, url }
```

---

## 5. 의존성 & 우선순위 그래프

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Dependency DAG (Directed Acyclic Graph)                                   │
└──────────────────────────────────────────────────────────────────────────┘

Level 0 (독립적, 의존성 없음):
  ├─ keep-alive
  ├─ database-backup
  ├─ excel-backup
  └─ indexnow-ping

Level 1 (기본 리소스에만 의존):
  ├─ reset-ytd (none)
  ├─ payslip-sender (affiliate data)
  └─ trial-expire (none)

Level 2 (외부 서비스 의존):
  ├─ sync-images (Google Drive API)
  ├─ drive-sync (Google Drive API)
  ├─ sync-image-cache-to-cloudinary (Cloudinary API)
  ├─ sync-local-images-batch (로컬 파일)
  └─ process-payment-webhooks (Payment DB)

Level 3 (다른 작업의 결과에 의존):
  ├─ trial-cleanup (trial-expire 결과)
  ├─ news-auto-publish (뉴스 콘텐츠 소스)
  └─ community-bot (커뮤니티 데이터)

우선순위 (Criticality):
  P0 (Critical): 
    - process-payment-webhooks (결제 손실 방지)
    - trial-expire (법적 요구사항)
  
  P1 (Important):
    - sync-images (사용자 경험)
    - drive-sync (데이터 일관성)
  
  P2 (Nice-to-have):
    - news-auto-publish (콘텐츠)
    - community-bot (engagement)
```

---

## 6. 에러 처리 & 재시도 전략

### 6.1 Exponential Backoff

```
Attempt 1: 즉시 (0초)
Attempt 2: 2^1 = 2초 대기
Attempt 3: 2^2 = 4초 대기
Attempt 4 (실패): 최대 3회 재시도 → FAILED

구현:
const delay = Math.pow(2, retryCount - 1) * 1000; // ms
await new Promise(resolve => setTimeout(resolve, delay));
```

### 6.2 에러 분류

```
Retriable (재시도 가능):
  - Network timeout (< 5000ms)
  - Rate limit (429)
  - Temporary service outage (503)
  → 최대 3회 재시도

Non-retriable (재시도 불가):
  - Authentication failure (401)
  - Invalid input (400)
  - Resource not found (404)
  → 즉시 FAILED + Alert

Circuit Breaker:
  - 연속 5회 실패 → Circuit open (차단)
  - 10분 후 자동 recovery (half-open)
  - 성공 1회 → Circuit closed (정상)
```

---

## 7. 데이터 흐름 (Data Flow)

### 7.1 이미지 동기화 흐름

```
Google Drive
    │ (1,000+ 파일)
    │
    ├─ sync-images CRON (매일 01:00)
    │  또는 google-drive-sync WEBHOOK
    │
    ↓
lib/drive-sync.ts (665 lines)
    │ ├─ listFilesRecursive()
    │ ├─ filterChangedFiles()
    │ └─ downloadAndConvert()
    │
    ├─ 로컬 WebP 변환 (Sharp)
    │
    ├─ 또는 Cloudinary 업로드
    │   (deprecated: 메모리 하드코딩만 사용)
    │
    ↓
lib/image-cache-sync.ts (454 lines)
    │ ├─ syncProductImages()
    │ ├─ updateImageMetadata()
    │ └─ logImageAccess()
    │
    ├─ Prisma Transaction
    │   ├─ INSERT product_image
    │   ├─ INSERT image_access_log
    │   └─ UPDATE product (image_count)
    │
    ↓
Neon PostgreSQL
    ├─ product_image (NEW)
    ├─ image_access_log (감사)
    └─ image_cache_metadata (캐시)
    
    ↓
Application Layer
    └─ Next.js API → UI (ProductCard, Gallery)
```

### 7.2 결제 흐름

```
Payment Gateway (PayApp/WelcomePayments)
    │ (사용자 결제 완료)
    │
    ├─ POST /api/webhook/payment/payapp
    │  (HMAC 서명 + 멱등성 검증)
    │
    ↓
lib/apis-sync-queue.ts (122 lines)
    │ ├─ enqueueWebhook()
    │ └─ INSERT apis_sync_queue
    │
    └─ 즉시 응답 (202 Accepted)
    
    ↓ (백그라운드)
Cron: process-payment-webhooks (10초마다)
    │ ├─ selectPending() [PENDING]
    │ ├─ processPayment()
    │ └─ updateStatus() [COMPLETED/FAILED]
    │
    ├─ 3회 재시도 (exponential backoff)
    │ ├─ 1회 실패 → 2초 대기
    │ ├─ 2회 실패 → 4초 대기
    │ └─ 3회 실패 → FAILED + Alert
    │
    ↓
Prisma Transaction
    ├─ INSERT payment
    ├─ INSERT paymentLog
    ├─ UPDATE user.balance
    └─ UPDATE apis_sync_queue [COMPLETED]
    
    ↓
Neon PostgreSQL
    ├─ payment (구매 기록)
    ├─ paymentLog (감사 로그)
    ├─ user (잔액 반영)
    └─ apis_sync_queue (완료 기록)
```

---

## 8. 성능 지표 & SLA

### CRON 성능

| 작업 | 소요시간 | 99% 타일 | SLA |
|------|---------|---------|-----|
| sync-images | 30s | 45s | < 60s |
| trial-expire | 5s | 10s | < 15s |
| process-payment-webhooks | 5s | 8s | < 10s |
| drive-sync | 60s | 90s | < 120s |

### WEBHOOK 성능

| 작업 | 응답시간 | 99% 타일 | SLA |
|------|---------|---------|-----|
| PayApp | < 1s | 2s | < 3s |
| WelcomePayments | < 1s | 2s | < 3s |
| Google Drive | < 3s | 5s | < 10s |

### 데이터베이스 인덱스

```sql
-- CRON: sync-images
CREATE INDEX idx_product_image_drive_id 
  ON product_image(drive_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_product_image_created_at 
  ON product_image(created_at DESC);

-- CRON: trial-expire
CREATE INDEX idx_trial_status_expires_at 
  ON trial(status, expires_at) 
  WHERE status = 'ACTIVE';

-- CRON: process-payment-webhooks
CREATE INDEX idx_apis_sync_queue_status 
  ON apis_sync_queue(status, created_at);

-- WEBHOOK: payapp
CREATE INDEX idx_payment_mul_no 
  ON payment(mul_no) 
  WHERE deleted_at IS NULL;
```

---

## 9. 모니터링 & 알림

### 메트릭 수집

```typescript
// CRON 시작 시
securityLogger.info('SyncImages started', {
  timestamp: new Date().toISOString(),
  jobId: uuid(),
  status: 'STARTED',
});

// CRON 완료 시
securityLogger.info('SyncImages completed', {
  timestamp: new Date().toISOString(),
  jobId: uuid(),
  status: 'COMPLETED',
  duration: endTime - startTime,
  itemsProcessed: 1000,
  itemsFailed: 2,
  itemsSkipped: 50,
});

// 에러 발생 시
securityLogger.error('SyncImages failed', {
  timestamp: new Date().toISOString(),
  jobId: uuid(),
  status: 'FAILED',
  error: err.message,
  stack: err.stack,
  retryCount: 3,
});
```

### Slack 알림

```
⚠️ CRON FAILURE
Job: sync-images
Time: 2026-05-11 01:45 UTC
Error: Google Drive API quota exceeded
Duration: 120s
Retry: 3/3

👉 Action: Check Drive API quota
👉 Docs: https://console.developers.google.com
```

---

## 10. 보안 고려사항

### 1. CRON 보안

```typescript
// Vercel CRON Secret (constant-time comparison)
export function verifyCronSecret(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '');
  
  // ⚠️ 타이밍 어택 방지
  return crypto.timingSafeEqual(
    Buffer.from(bearerToken || ''),
    Buffer.from(cronSecret)
  );
}
```

### 2. WEBHOOK 보안

```typescript
// HMAC 서명 검증 (PayApp)
export function verifyPayAppSignature(payload: string, signature: string) {
  const secret = process.env.PAYAPP_WEBHOOK_SECRET;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(signature)
  );
}
```

### 3. 멱등성 & 중복 방지

```typescript
// 결제 웹훅 멱등성
const existingPayment = await prisma.payment.findUnique({
  where: { mul_no: webhook.mul_no },
});

if (existingPayment) {
  // 이미 처리됨 → 무시
  return { status: 200, message: 'Already processed' };
}

// 신규 → 처리
await prisma.payment.create({ ... });
```

---

## 11. 배포 체크리스트

### 사전 배포 검증

- [ ] 모든 CRON Secret 환경변수 설정
- [ ] Google Drive API 권한 확인
- [ ] Database 마이그레이션 적용
- [ ] 인덱스 생성 확인
- [ ] 웹훅 엔드포인트 HTTPS 활성화
- [ ] Rate limit 설정
- [ ] 로깅 & 모니터링 확인
- [ ] Slack 알림 채널 설정

### 배포 후 검증

- [ ] CRON 실행 로그 확인 (첫 3회)
- [ ] WEBHOOK 수신 테스트 (PayApp 샌드박스)
- [ ] BATCH 작업 진행률 확인
- [ ] 데이터 일관성 검증

---

## 12. 트러블슈팅 가이드

### CRON 실행 안 됨

```bash
# 1. Vercel CRON 로그 확인
vercel logs --follow

# 2. 수동 트리거
curl -X POST https://your-app.vercel.app/api/cron/sync-images \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"

# 3. CRON Secret 확인
echo $CRON_SECRET

# 4. Database 연결 확인
npx prisma db execute --stdin < check-db.sql
```

### WEBHOOK 지연

```bash
# 1. 큐 상태 확인
SELECT count(*) as pending 
FROM apis_sync_queue 
WHERE status = 'PENDING';

# 2. CRON 실행 확인
SELECT * FROM cron_lock 
WHERE key = 'payment-webhooks'
  AND expires_at > now();

# 3. 강제 처리
curl -X POST https://your-app.vercel.app/api/cron/process-payment-webhooks \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 이미지 동기화 실패

```bash
# 1. Google Drive 액세스 확인
npx ts-node scripts/check-drive-access.ts

# 2. 동기화 진행률
npx ts-node scripts/check-image-sync-progress.ts

# 3. 손상된 이미지 복구
npx ts-node scripts/auto-restore-images-from-gdrive.ts
```

---

## 참고 자료

- vercel.json CRON 설정: `cruisedot/automation/README.md` § 10
- 환경변수 예제: `.env.automation.example`
- 라이브러리 상세: `cruisedot/automation/lib/README.md` (추후)
