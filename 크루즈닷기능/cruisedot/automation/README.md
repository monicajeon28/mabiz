# 크루즈닷 자동화 시스템 (Automation Hub)

완전 독립적인 CRON, WEBHOOK, 배치 작업 시스템. 모든 자동화 로직이 중앙화된 한 곳에서 관리되는 구조입니다.

## 개요

```
cruisedot/automation/
├── cron/              (20개 CRON 작업, 4,615 lines)
├── webhook/           (7개 WEBHOOK, 2,645 lines)
├── batch/             (4개 배치 작업, 1,284 lines)
├── sync-api/          (6개 동기화 API)
├── lib/               (11개 핵심 라이브러리, 3,228 lines)
├── scripts/           (15개 수동 트리거 스크립트, 3,311 lines)
└── README.md          (이 파일)

총 43개 파일, 약 15,000 라인 코드
```

---

## 1. CRON 작업 (20개)

### 구조
```
cron/
├── images/           (4개) 이미지 동기화 & 캐싱
├── payment/          (3개) 결제 처리 & 정산
├── trip/             (3개) 여행/시험 만료 & 정리
├── cleanup/          (3개) 메시지/링크/프라이버시 정리
└── maintenance/      (7개) 백업, 인덱싱, 봇, 메시지 발송
```

### 상세 목록

#### Images CRON (4개, 820 lines)
| 이름 | 스케줄 | 목적 | 라인 |
|------|--------|------|------|
| `sync-images` | 매일 01:00 UTC | Google Drive → DB ImageCache 동기화 | 141 |
| `sync-image-cache-to-cloudinary` | (필요 시) | ImageCache → Cloudinary CDN 업로드 | 332 |
| `sync-local-images-batch` | (필요 시) | 로컬 이미지 파일 → DB 일괄 등록 | 275 |
| `drive-sync` | 매일 17:00 UTC | Google Drive 메타데이터 전체 동기화 | 72 |

**핵심 기능**:
- 분산 Lock (Prisma CronLock) 기반 동시성 제어
- Rate Limiting (시간당 최대 1회)
- 에러 마스킹 + 구조화된 로깅
- Exponential backoff 재시도

**의존성**: `lib/drive-sync.ts`, `lib/image-cache-sync.ts`

---

#### Payment CRON (3개, 728 lines)
| 이름 | 스케줄 | 목적 | 라인 |
|------|--------|------|------|
| `payslip-sender` | 매월 1일 | 급여명세서 자동 발송 | 45 |
| `process-payment-webhooks` | (매 10초) | Webhook 큐 배치 처리 (PayApp/Iamport) | 567 |
| `reset-ytd` | 매년 1월 1일 | 연간 누적액 초기화 | 116 |

**핵심 기능**:
- 비동기 큐 기반 웹훅 처리
- 멱등성 검증 (mul_no, trx_id)
- 3회 재시도 (exponential backoff)
- 원자성 트랜잭션 (Prisma)

**의존성**: `lib/settlement-cron.ts`, `lib/apis-sync-queue.ts`

---

#### Trip CRON (3개, 383 lines)
| 이름 | 스케줄 | 목적 | 라인 |
|------|--------|------|------|
| `trial-expire` | 4시간마다 | 72시간 경과 Trial 자동 만료 | 110 |
| `trial-cleanup` | 매주 일요일 02:00 UTC | 만료된 Trial 데이터 정리 | 124 |
| `expire-trips` | (필요 시) | 종료된 여행 상태 자동 업데이트 | 149 |

**핵심 기능**:
- Trial 상태 머신 (ACTIVE → EXPIRED → CLEANED)
- 배치 업데이트 (updateMany)
- GDPR 90일 자동 삭제 규정

**의존성**: `lib/cron-security.ts`

---

#### Cleanup CRON (3개, 246 lines)
| 이름 | 스케줄 | 목적 | 라인 |
|------|--------|------|------|
| `cleanup-messages` | (필요 시) | 7일 이상 읽은 메시지 삭제 | 69 |
| `expire-links` | (필요 시) | 만료된 공유 링크 정리 | 103 |
| `privacy-auto-delete` | (필요 시) | 소프트 삭제된 사용자 90일 후 물리 삭제 | (추가 로직) |

**핵심 기능**:
- 소프트 삭제 기반 GDPR 규정 준수
- 배치 정리 (deleteMany)

**의존성**: `lib/cron-security.ts`

---

#### Maintenance CRON (7개, 2,438 lines)
| 이름 | 스케줄 | 목적 | 라인 |
|------|--------|------|------|
| `database-backup` | (필요 시) | PostgreSQL 풀 백업 | 45 |
| `excel-backup` | (필요 시) | 중요 데이터 Excel 내보내기 | 47 |
| `keep-alive` | 30분마다 | Vercel 인스턴스 "콜드 스타트" 방지 | 23 |
| `indexnow-ping` | (필요 시) | Microsoft IndexNow 핑 (SEO) | 134 |
| `daily-all` | (필요 시) | 전체 정리 통합 작업 | 184 |
| `send-scheduled-messages` | 5분마다 | 예약된 메시지/공지 발송 | 464 |
| `community-bot` | (필요 시) | 커뮤니티 자동 봇 작업 | 1,395 |
| `news-auto-publish` | 매일 23:00 UTC | 뉴스 자동 발행 | 220 |

**핵심 기능**:
- 통합 모니터링 (메모리, CPU, 에러)
- 알림 시스템 (이메일, 슬랙)

**의존성**: `lib/dashboard-sync.ts`, `lib/logger.ts`

---

### CRON 스케줄 타임라인 (24시간)

```
00:00 UTC
  ↓ (매월 1일만)
00:00 - [monthly] payslip-sender (월급 발송)
00:00 - [매년 1월 1일] reset-ytd (연간 누적액 초기화)

01:00 UTC
  ↓
01:00 - sync-images (Google Drive → DB)

02:00 UTC
  ↓ (매주 일요일만)
02:00 - [weekly] trial-cleanup (만료 Trial 정리)

04:00, 08:00, 12:00, 16:00, 20:00, 24:00 UTC
  ↓
4시간마다 - trial-expire (Trial 상태 만료)

05분마다
  ↓
*/5 - send-scheduled-messages (예약된 메시지 발송)

10초마다
  ↓
process-payment-webhooks (결제 웹훅 처리)

30분마다
  ↓
:00/:30 - keep-alive (인스턴스 유지)

17:00 UTC
  ↓
17:00 - drive-sync (Google Drive 메타데이터 전체 동기화)

23:00 UTC
  ↓
23:00 - news-auto-publish (뉴스 자동 발행)
```

---

## 2. WEBHOOK (7개)

### 구조
```
webhook/
├── payment/           (5개) PayApp, WelcomePayments, 아임포트 결제 알림
├── drive/             (1개) Google Drive 변경 알림
└── payapp-landing/    (1개) PayApp 랜딩 페이지 웹훅
```

### 상세 목록

#### Payment Webhooks (5개, 2,116 lines)
| 이름 | 소스 | 목적 | 라인 |
|------|------|------|------|
| `payapp/route.ts` | PayApp | 결제 확인 → Payment 레코드 생성 | 215 |
| `welcomepayments/route.ts` | WelcomePayments | 결제 확인 → Payment 레코드 생성 | 303 |
| `main/route.ts` | 아임포트 | 웹훅 라우팅 (PayApp/WelcomePayments 분기) | 1,100 |
| `payapp-landing/route.ts` | PayApp Landing | 랜딩 페이지 결제 처리 | 288 |

**아키텍처**:
```
[결제 게이트웨이]
  ↓ HTTPS POST
[Webhook 수신] (3초 이내 응답)
  ↓ 202 Accepted
[ApisSyncQueue 등록] (PENDING)
  ↓
[Cron: process-payment-webhooks] (10초마다)
  ↓
[Payment, PayAppPayment 업데이트]
  ↓
[최대 3회 재시도]
```

**핵심 기능**:
- 멱등성 검증 (결제 고유 ID)
- HMAC 서명 검증 (웹훅 위변조 방지)
- Zod 입력 검증
- 비동기 큐 기반 처리 (최대 3초 응답)

**의존성**: `lib/apis-sync-queue.ts`, `lib/cron-security.ts`

---

#### Google Drive Sync Webhook (1개, 221 lines)
| 이름 | 소스 | 목적 | 라인 |
|------|------|------|------|
| `google-drive-sync/route.ts` | Google Drive | 파일 변경 알림 → DB 동기화 트리거 | 221 |

**기능**:
- Push Notification 확인
- 변경된 파일 식별
- `sync-images` CRON 트리거 (또는 즉시 동기화)

**의존성**: `lib/drive-sync.ts`

---

## 3. BATCH 작업 (4개)

### 구조
```
batch/
├── images/           (3개) 이미지 대량 처리
└── google-sheets/    (1개) Google Sheets 동기화
```

### 상세 목록

| 이름 | 목적 | 라인 | 트리거 |
|------|------|------|--------|
| `batch/images/batch-1` | 이미지 1차 일괄 등록 | 357 | 관리자 수동 |
| `batch/images/batch-2` | 이미지 2차 일괄 처리 (WebP 변환) | 422 | 관리자 수동 |
| `batch/images/sync` | 이미지 동기화 (DB ↔ CDN) | 326 | 관리자 수동 |
| `batch/google-sheets/sync-to-google` | DB → Google Sheets 내보내기 | 179 | Cron / 수동 |

**아키텍처**:
```
[대량 데이터]
  ↓
[배치 작업] (최대 300초)
  ↓
[Progress 추적] (progressBar, ETA)
  ↓
[결과 리포트] (성공/실패 수)
```

**핵심 기능**:
- 청크 처리 (메모리 효율)
- Progress 추적 + ETA 계산
- 실패 시 자동 재시도
- 에러 리포트 (CSV 내보내기)

**의존성**: `lib/image-cache-sync.ts`, `lib/drive-sync-service.ts`

---

## 4. SYNC API (6개)

동기화 관련 API 라우트들 (현재 위치: `/app/api/*/sync*`). 추후 `cruisedot/automation/sync-api/`로 이동 예정.

| 경로 | 목적 |
|------|------|
| `/api/trip/sync-apis` | Trip ↔ 외부 예약 시스템 동기화 |
| `/api/partner/reservations/sync-apis` | Reservation ↔ 파트너 시스템 |
| `/api/affiliate/sync-*` | Affiliate 데이터 동기화 |
| `/api/product/sync-*` | Product 정보 동기화 |

---

## 5. 핵심 라이브러리 (11개, 3,228 lines)

### 구조

| 파일 | 목적 | 라인 | 의존도 |
|------|------|------|--------|
| **drive-sync.ts** | Google Drive API 핵심 | 665 | ⭐⭐⭐ (모든 이미지 작업) |
| **image-cache-sync.ts** | ImageCache 레코드 동기화 | 454 | ⭐⭐⭐ (이미지 CRON) |
| **drive-sync-service.ts** | Drive API 서비스 래퍼 | 274 | ⭐⭐ (drive-sync 지원) |
| **batch-settlement.ts** | 정산 배치 처리 | 493 | ⭐⭐ (결제 정산) |
| **dashboard-sync.ts** | 대시보드 데이터 동기화 | 226 | ⭐ (모니터링) |
| **document-drive-sync.ts** | 서류 Google Drive 동기화 | 361 | ⭐⭐ (affiliate 문서) |
| **apis-sync-queue.ts** | 웹훅 비동기 큐 | 122 | ⭐⭐⭐ (웹훅 처리) |
| **cron-security.ts** | CRON 보안 검증 | 75 | ⭐⭐⭐ (모든 CRON) |
| **mabiz-sync.ts** | mabiz 데이터 동기화 | 103 | ⭐ (외부 연동) |
| **settlement-cron.ts** | 정산 CRON 스케줄러 | 11 | ⭐ (결제 정산) |
| **schemas.ts** | Zod 입력 검증 스키마 | 43 | ⭐⭐⭐ (모든 API) |

### 핵심 메커니즘

#### 1. CRON 보안 (cron-security.ts)
```typescript
// Vercel Cron Secret 검증 (constant-time comparison)
const CRON_SECRET = process.env.CRON_SECRET;
export async function validateCronSecret(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const token = auth?.replace('Bearer ', '');
  
  // Constant-time 비교 (timing attack 방지)
  return crypto.timingSafeEqual(
    Buffer.from(token || ''),
    Buffer.from(CRON_SECRET)
  );
}

// 분산 Lock (낙관적 Lock)
export async function acquireSyncLock(key: string, ttl: number) {
  try {
    await prisma.cronLock.create({ data: { key, expiresAt: now + ttl } });
    return true;
  } catch (err) {
    // UNIQUE 제약 위반 = 다른 프로세스가 락 소유
    return false;
  }
}
```

#### 2. 이미지 동기화 (drive-sync.ts)
```typescript
// Google Drive 폴더 → DB ImageCache 동기화
export async function syncImageCache() {
  // 1. Drive API 폴더 스캔
  const files = await listFilesRecursive(CRUISEINFO_FOLDER_ID);
  
  // 2. DB와 비교 (변경된 파일만 처리)
  const changed = files.filter(f => !cached.has(f.id));
  
  // 3. WebP 변환 (로컬 또는 클라우드)
  const webpUrl = await convertToWebP(file);
  
  // 4. DB 저장 (트랜잭션)
  await prisma.$transaction([
    prisma.productImage.create(),
    prisma.imageAccessLog.create(),
  ]);
}
```

#### 3. 웹훅 비동기 큐 (apis-sync-queue.ts)
```typescript
// Webhook 수신 → 즉시 응답 (3초 이내)
export async function enqueueWebhook(payload: any) {
  await prisma.apisSyncQueue.create({
    data: {
      type: 'PAYMENT_WEBHOOK',
      status: 'PENDING',
      payload,
      retryCount: 0,
    },
  });
  return { status: 202, message: 'Queued' }; // 즉시 반환
}

// CRON: 10초마다 PENDING 배치 처리
export async function processPendingQueue() {
  const pending = await prisma.apisSyncQueue.findMany({
    where: { status: 'PENDING' },
    take: 100, // 배치 크기
  });
  
  for (const item of pending) {
    try {
      await processWebhook(item.payload);
      await prisma.apisSyncQueue.update({
        where: { id: item.id },
        data: { status: 'COMPLETED' },
      });
    } catch (err) {
      if (item.retryCount < 3) {
        // exponential backoff: 2^retryCount 초 대기
        await retryWithBackoff(item);
      } else {
        // 3회 실패 → FAILED
        await prisma.apisSyncQueue.update({
          where: { id: item.id },
          data: { status: 'FAILED', error: err.message },
        });
      }
    }
  }
}
```

---

## 6. 수동 스크립트 (15개, 3,311 lines)

### 구조

#### 동기화 스크립트 (5개)
| 파일 | 목적 | 라인 |
|------|------|------|
| `sync-drive-to-db.ts` | Google Drive → DB 수동 동기화 | 217 |
| `auto-restore-images-from-gdrive.ts` | 손상된 이미지 복구 | 185 |
| `restore-product-images.ts` | ProductImage 복구 | 99 |
| `sync-to-cloudinary.ts` | DB → Cloudinary 동기화 | 171 |

#### 배치 처리 스크립트 (5개)
| 파일 | 목적 | 라인 |
|------|------|------|
| `batch-2-images-sync.ts` | 이미지 2차 배치 | 172 |
| `batch-4-upload.ts` | 이미지 업로드 | 218 |
| `execute-batch-3.ts` | 배치 3 실행 | 140 |
| `upload-images-batch-1.ts` | 1차 업로드 | 183 |
| `upload-images-batch-2.ts` | 2차 업로드 | 183 |

#### 모니터링 스크립트 (5개)
| 파일 | 목적 | 라인 |
|------|------|------|
| `check-image-sync-progress.ts` | 동기화 진행률 조회 | 138 |
| `monitor-image-sync.sh` | 실시간 모니터링 | 386 |
| `image-sync-status.js` | 동기화 상태 조회 | 295 |
| `trigger-cron.mjs` | 수동으로 CRON 트리거 | 40 |
| `test-image-system.ts` | 이미지 시스템 테스트 | 448 |

### 사용 예시

```bash
# 동기화 진행률 확인
npx ts-node cruisedot/automation/scripts/check-image-sync-progress.ts

# 수동으로 sync-images CRON 트리거
npx ts-node cruisedot/automation/scripts/trigger-cron.mjs sync-images

# 이미지 시스템 테스트
npx ts-node cruisedot/automation/scripts/test-image-system.ts

# 실시간 모니터링 (무한 루프)
bash cruisedot/automation/scripts/monitor-image-sync.sh
```

---

## 7. 환경 변수

### 필수 (.env.automation)

```env
# CRON 보안
CRON_SECRET=your-vercel-cron-secret

# Google Drive API
GOOGLE_DRIVE_API_KEY=...
GOOGLE_DRIVE_FOLDER_ID=...
CRUISEINFO_FOLDER_ID=...
AFFILIATE_DOCS_FOLDER_ID=...

# Google Sheets API
GOOGLE_SHEETS_API_KEY=...
GOOGLE_SHEETS_SPREADSHEET_ID=...

# 결제 게이트웨이
PAYAPP_WEBHOOK_SECRET=...
WELCOMEPAYMENTS_WEBHOOK_SECRET=...
IAMPORT_API_KEY=...
IAMPORT_SECRET=...

# 이메일 & 알림
SENDGRID_API_KEY=...
SLACK_WEBHOOK_URL=...

# 데이터베이스
DATABASE_URL=postgresql://...
```

### 예제 파일 생성

```bash
cp cruisedot/automation/.env.automation.example .env.automation
```

---

## 8. 보안 체크리스트

### CRON 보안
- [x] CRON_SECRET constant-time 검증
- [x] 분산 Lock (낙관적 Lock, Prisma)
- [x] Rate Limiting (시간당 최대 1회)
- [x] 에러 마스킹 (시스템 정보 노출 금지)
- [x] 구조화된 로깅 (userId, errorType, timestamp)

### WEBHOOK 보안
- [x] HMAC 서명 검증 (웹훅 위변조 방지)
- [x] Zod 입력 검증
- [x] 멱등성 검증 (결제 중복 방지)
- [x] 비동기 큐 (즉시 응답, 비동기 처리)
- [x] 에러 마스킹

### 데이터베이스 보안
- [x] Prisma 트랜잭션 (원자성)
- [x] 소프트 삭제 (물리 삭제 금지)
- [x] 복합 인덱스 (성능)
- [x] 감사 로그 (ImageAccessLog)

---

## 9. 성능 최적화

### CRON 성능
| 작업 | 소요 시간 | 최적화 |
|------|---------|--------|
| sync-images | < 30s | 청크 처리 (1000개 파일 기준) |
| process-payment-webhooks | < 5s | 배치 처리 (100개 배치) |
| trial-cleanup | < 10s | updateMany (단일 쿼리) |

### WEBHOOK 성능
| 작업 | 응답 시간 | 최적화 |
|------|---------|--------|
| PayApp | < 1s | 비동기 큐 |
| WelcomePayments | < 1s | 비동기 큐 |
| Google Drive | < 3s | 증분 동기화 |

### 데이터베이스 인덱스
```sql
-- images/sync-images CRON
CREATE INDEX idx_product_image_drive_id 
  ON product_image(drive_id) 
  WHERE deleted_at IS NULL;

-- payment/process-payment-webhooks CRON
CREATE INDEX idx_apis_sync_queue_status 
  ON apis_sync_queue(status, created_at);

-- trial/trial-expire CRON
CREATE INDEX idx_trial_status_expires_at 
  ON trial(status, expires_at) 
  WHERE status = 'ACTIVE';
```

---

## 10. 배포 & 모니터링

### Vercel CRON 설정 (vercel.json)
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-images",
      "schedule": "0 1 * * *"
    },
    {
      "path": "/api/cron/trial-expire",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

### 모니터링 대시보드
- **Google Cloud Console**: Drive API 할당량 + 에러 추적
- **Vercel Dashboard**: CRON 실행 기록 + 로그
- **Slack 알림**: 실패한 CRON/WEBHOOK 자동 알림
- **커스텀 대시보드**: `cruisedot/dashboard-sync.ts`에서 조회

### 알림 설정
```typescript
// Cron 실패 시 자동 Slack 알림
export async function notifyFailure(jobName: string, error: Error) {
  await sendSlackMessage({
    channel: '#automation-alerts',
    text: `⚠️ CRON 실패: ${jobName}`,
    error: error.message,
    timestamp: new Date().toISOString(),
  });
}
```

---

## 11. 마이그레이션 & 롤백

### 기존 경로 → 새 경로 매핑

| 기존 경로 | 새 경로 | 상태 |
|---------|--------|------|
| `/app/api/cron/*` | `cruisedot/automation/cron/*` | ✅ 복사 완료 |
| `/app/api/webhook/*` | `cruisedot/automation/webhook/*` | ✅ 복사 완료 |
| `/app/api/batch*` | `cruisedot/automation/batch/*` | ✅ 복사 완료 |
| `/lib/drive-sync.ts` | `cruisedot/automation/lib/drive-sync.ts` | ✅ 복사 완료 |
| `/scripts/sync-*.ts` | `cruisedot/automation/scripts/` | ✅ 복사 완료 |

### 점진적 마이그레이션 계획
1. **Phase 1**: 읽기 전용 (현재 경로 유지, 새 경로 공존)
2. **Phase 2**: 임포트 재지정 (`/app/api → /cruisedot/automation`)
3. **Phase 3**: 기존 경로 제거

---

## 12. 문제 해결

### CRON 실행 안 됨
```bash
# 1. Vercel CRON Secret 확인
echo $CRON_SECRET

# 2. CRON 로그 확인
tail -f logs/cron.log

# 3. 수동으로 트리거
curl -X POST https://your-app.vercel.app/api/cron/sync-images \
  -H "Authorization: Bearer $CRON_SECRET"
```

### WEBHOOK 처리 지연
```bash
# 1. 큐 상태 확인
npx ts-node cruisedot/automation/scripts/check-queue-status.ts

# 2. PENDING 항목 수
SELECT count(*) FROM apis_sync_queue WHERE status = 'PENDING';

# 3. CRON: process-payment-webhooks 실행 확인
tail -f logs/payment-webhooks.log
```

### 이미지 동기화 실패
```bash
# 1. Drive API 권한 확인
npx ts-node cruisedot/automation/scripts/check-drive-access.ts

# 2. 동기화 진행률
npx ts-node cruisedot/automation/scripts/check-image-sync-progress.ts

# 3. 손상된 이미지 복구
npx ts-node cruisedot/automation/scripts/auto-restore-images-from-gdrive.ts
```

---

## 13. 참고 자료

- [Vercel Cron Triggers](https://vercel.com/docs/cron-jobs)
- [Google Drive API](https://developers.google.com/drive/api)
- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [웹훅 보안 (HMAC)](https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks)

---

## 파일 구조 요약

```
cruisedot/automation/
├── cron/
│   ├── images/
│   │   ├── sync-images/route.ts (141L)
│   │   ├── sync-image-cache-to-cloudinary/route.ts (332L)
│   │   ├── sync-local-images-batch/route.ts (275L)
│   │   └── drive-sync/route.ts (72L)
│   ├── payment/
│   │   ├── payslip-sender/route.ts (45L)
│   │   ├── process-payment-webhooks/route.ts (567L)
│   │   └── reset-ytd/route.ts (116L)
│   ├── trip/
│   │   ├── trial-expire/route.ts (110L)
│   │   ├── trial-cleanup/route.ts (124L)
│   │   └── expire-trips/route.ts (149L)
│   ├── cleanup/
│   │   ├── cleanup-messages/route.ts (69L)
│   │   └── expire-links/route.ts (103L)
│   └── maintenance/
│       ├── database-backup/route.ts (45L)
│       ├── excel-backup/route.ts (47L)
│       ├── keep-alive/route.ts (23L)
│       ├── indexnow-ping/route.ts (134L)
│       ├── daily-all/route.ts (184L)
│       ├── send-scheduled-messages/route.ts (464L)
│       ├── community-bot/route.ts (1,395L)
│       └── news-auto-publish/route.ts (220L)
│
├── webhook/
│   ├── payment/
│   │   ├── payapp/route.ts (215L)
│   │   ├── welcomepayments/route.ts (303L)
│   │   ├── main/route.ts (1,100L)
│   │   └── payapp-landing/route.ts (288L)
│   └── drive/
│       └── google-drive-sync/route.ts (221L)
│
├── batch/
│   ├── images/
│   │   ├── batch-1/route.ts (357L)
│   │   ├── batch-2/route.ts (422L)
│   │   └── sync/route.ts (326L)
│   └── google-sheets/
│       └── sync-to-google/route.ts (179L)
│
├── sync-api/ (추후 구현)
│
├── lib/
│   ├── drive-sync.ts (665L)
│   ├── image-cache-sync.ts (454L)
│   ├── drive-sync-service.ts (274L)
│   ├── batch-settlement.ts (493L)
│   ├── dashboard-sync.ts (226L)
│   ├── document-drive-sync.ts (361L)
│   ├── apis-sync-queue.ts (122L)
│   ├── cron-security.ts (75L)
│   ├── mabiz-sync.ts (103L)
│   ├── settlement-cron.ts (11L)
│   └── schemas.ts (43L)
│
├── scripts/
│   ├── sync-drive-to-db.ts (217L)
│   ├── auto-restore-images-from-gdrive.ts (185L)
│   ├── restore-product-images.ts (99L)
│   ├── sync-to-cloudinary.ts (171L)
│   ├── batch-2-images-sync.ts (172L)
│   ├── batch-4-upload.ts (218L)
│   ├── execute-batch-3.ts (140L)
│   ├── upload-images-batch-1.ts (183L)
│   ├── upload-images-batch-2.ts (183L)
│   ├── check-image-sync-progress.ts (138L)
│   ├── monitor-image-sync.sh (386L)
│   ├── image-sync-status.js (295L)
│   ├── trigger-cron.mjs (40L)
│   └── test-image-system.ts (448L)
│
├── .env.automation.example (추후 생성)
└── README.md (이 파일)
```

---

**최종 통계**:
- **43개 파일** (CRON 20, WEBHOOK 7, BATCH 4, LIB 11, SCRIPTS 15)
- **약 15,000 라인** (전체 코드)
- **완전 독립 시스템** (중앙화된 관리, 재사용 가능한 라이브러리)
