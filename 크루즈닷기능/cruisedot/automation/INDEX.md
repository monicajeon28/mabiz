# 크루즈닷 자동화 시스템 - 색인 & 요약

자동화 시스템의 전체 구조, 파일 위치, 주요 개념을 한눈에 보는 색인입니다.

---

## 📋 문서 네비게이션

| 문서 | 목적 | 대상 |
|------|------|------|
| **README.md** | 시스템 전체 개요, CRON/WEBHOOK/BATCH 상세 | 아키텍트, DevOps |
| **ARCHITECTURE.md** | 데이터 흐름, 타이밍 다이어그램, 보안 모델 | 아키텍트, 보안 담당자 |
| **BATCH_MATRIX.md** | 배치 작업 성능 분석, 최적화 전략 | 성능 분석가, 개발자 |
| **QUICKSTART.md** | 설정 및 실행 가이드 (5분~1시간) | 개발자, DevOps |
| **INDEX.md** | 이 파일 (색인 & 빠른 참조) | 모든 사용자 |

---

## 🗂️ 파일 구조

```
cruisedot/automation/
│
├── 📄 README.md              (완전 가이드 - 시작점)
├── 📄 ARCHITECTURE.md        (아키텍처 & 다이어그램)
├── 📄 BATCH_MATRIX.md        (배치 성능 분석)
├── 📄 QUICKSTART.md          (5분 설정 가이드)
├── 📄 INDEX.md               (이 파일)
├── 📄 .env.automation.example (환경 변수 템플릿)
│
├── 📁 cron/                  (20개 CRON 작업, 4,615 라인)
│   ├── 📁 images/            (4개) sync-images, sync-image-cache...
│   ├── 📁 payment/           (3개) payslip-sender, process-webhooks...
│   ├── 📁 trip/              (3개) trial-expire, trial-cleanup...
│   ├── 📁 cleanup/           (3개) cleanup-messages, expire-links...
│   └── 📁 maintenance/       (7개) backup, keep-alive, news...
│
├── 📁 webhook/               (7개 WEBHOOK, 2,645 라인)
│   ├── 📁 payment/           (5개) payapp, welcomepayments...
│   └── 📁 drive/             (1개) google-drive-sync
│
├── 📁 batch/                 (4개 배치, 1,284 라인)
│   ├── 📁 images/            (3개) batch-1, batch-2, sync
│   └── 📁 google-sheets/     (1개) sync-to-google
│
├── 📁 sync-api/              (6개 동기화 API - 추후 구현)
│
├── 📁 lib/                   (11개 핵심 라이브러리, 3,228 라인)
│   ├── drive-sync.ts         (665L) Google Drive 핵심
│   ├── image-cache-sync.ts   (454L) ImageCache 동기화
│   ├── apis-sync-queue.ts    (122L) 웹훅 비동기 큐
│   ├── cron-security.ts      (75L)  CRON 보안 검증
│   ├── batch-settlement.ts   (493L) 정산 배치
│   └── ... (6개 더)
│
├── 📁 scripts/               (15개 수동 스크립트, 3,311 라인)
│   ├── sync-drive-to-db.ts
│   ├── batch-2-images-sync.ts
│   ├── check-image-sync-progress.ts
│   ├── monitor-image-sync.sh
│   ├── trigger-cron.mjs
│   └── ... (10개 더)
│
└── (총 43개 파일, ~15,000 라인 코드)
```

---

## 🎯 빠른 참조

### CRON 작업 찾기

**필요한 CRON을 찾으려면**:

| 목적 | CRON 이름 | 파일 | 스케줄 |
|------|----------|------|--------|
| 이미지 동기화 | `sync-images` | `cron/images/sync-images/route.ts` | 매일 01:00 |
| Trial 만료 | `trial-expire` | `cron/trip/trial-expire/route.ts` | 4시간마다 |
| 결제 처리 | `process-payment-webhooks` | `cron/payment/process-payment-webhooks/route.ts` | 10초마다 |
| 뉴스 발행 | `news-auto-publish` | `cron/maintenance/news-auto-publish/route.ts` | 매일 23:00 |
| 데이터 백업 | `database-backup` | `cron/maintenance/database-backup/route.ts` | (필요 시) |

**모든 CRON 목록**: README.md § 1 (CRON 작업)

---

### WEBHOOK 찾기

| 소스 | WEBHOOK | 파일 | 목적 |
|------|---------|------|------|
| PayApp | `payapp` | `webhook/payment/payapp/route.ts` | 결제 알림 |
| WelcomePayments | `welcomepayments` | `webhook/payment/welcomepayments/route.ts` | 결제 알림 |
| Google Drive | `google-drive-sync` | `webhook/drive/google-drive-sync/route.ts` | 파일 변경 감지 |

**모든 WEBHOOK 목록**: README.md § 2 (WEBHOOK)

---

### 배치 작업 찾기

| 작업 | 파일 | 용도 |
|------|------|------|
| Batch-1 | `batch/images/batch-1/route.ts` | 이미지 일괄 등록 |
| Batch-2 | `batch/images/batch-2/route.ts` | WebP 변환 |
| Batch-Sync | `batch/images/sync/route.ts` | 이미지 동기화 |
| Sync-to-Google | `batch/google-sheets/sync-to-google/route.ts` | Google Sheets 내보내기 |

**배치 상세 분석**: BATCH_MATRIX.md

---

### 라이브러리 찾기

| 용도 | 파일 | 라인 | 의존도 |
|------|------|------|--------|
| Google Drive API | `lib/drive-sync.ts` | 665 | ⭐⭐⭐ |
| 이미지 캐시 | `lib/image-cache-sync.ts` | 454 | ⭐⭐⭐ |
| 웹훅 큐 | `lib/apis-sync-queue.ts` | 122 | ⭐⭐⭐ |
| CRON 보안 | `lib/cron-security.ts` | 75 | ⭐⭐⭐ |

**모든 라이브러리 상세**: README.md § 5 (핵심 라이브러리)

---

### 스크립트 찾기

| 용도 | 파일 | 호출 방법 |
|------|------|---------|
| 동기화 진행 확인 | `scripts/check-image-sync-progress.ts` | `npx ts-node cruisedot/automation/scripts/check-image-sync-progress.ts` |
| 수동 CRON 트리거 | `scripts/trigger-cron.mjs` | `npx ts-node cruisedot/automation/scripts/trigger-cron.mjs sync-images` |
| 실시간 모니터링 | `scripts/monitor-image-sync.sh` | `bash cruisedot/automation/scripts/monitor-image-sync.sh` |
| 이미지 시스템 테스트 | `scripts/test-image-system.ts` | `npx ts-node cruisedot/automation/scripts/test-image-system.ts` |

**모든 스크립트**: README.md § 6 (수동 스크립트)

---

## 🚀 일반적인 작업

### "이미지 동기화가 안 되요"

```
1. 확인: npx ts-node cruisedot/automation/scripts/check-image-sync-progress.ts
2. 로그: tail -f logs/automation.log | grep sync-images
3. 수동 실행: npx ts-node cruisedot/automation/scripts/trigger-cron.mjs sync-images
4. 더 보기: QUICKSTART.md § 10 (문제 해결)
```

### "결제 웹훅이 처리 안 되요"

```
1. 큐 확인: SELECT COUNT(*) FROM apis_sync_queue WHERE status='PENDING';
2. 수동 처리: curl -X POST /api/cron/process-payment-webhooks -H "Authorization: Bearer $CRON_SECRET"
3. 더 보기: ARCHITECTURE.md § 3.1 (Payment Webhook Flow)
```

### "배치 작업을 실행하고 싶어요"

```
1. 이미지 등록: curl -X POST "/api/batch-1-images-sync?startIndex=0&chunkSize=100"
2. Google Sheets: curl -X POST "/api/batch/google-sheets/sync-to-google?table=product"
3. 더 보기: BATCH_MATRIX.md § 2-3 (배치 상세)
```

### "성능을 최적화하고 싶어요"

```
1. 병목 식별: BATCH_MATRIX.md § 4 (성능 비교)
2. 최적화: BATCH_MATRIX.md § 5 (최적화 가이드)
3. 메트릭 설정: README.md § 10 (모니터링)
```

---

## 📊 통계

### 코드 규모

```
전체: 43개 파일, 약 15,000 라인

분류별:
├── CRON:     20개, 4,615 라인
├── WEBHOOK:  7개,  2,645 라인
├── BATCH:    4개,  1,284 라인
├── LIB:      11개, 3,228 라인
└── SCRIPTS:  15개, 3,311 라인
```

### 의존성

```
가장 중요한 라이브러리:
├── lib/drive-sync.ts (665L) ← 모든 이미지 작업
├── lib/image-cache-sync.ts (454L) ← 동기화 작업
├── lib/apis-sync-queue.ts (122L) ← 웹훅 처리
└── lib/cron-security.ts (75L) ← 모든 CRON

가장 복잡한 CRON:
├── community-bot (1,395L)
├── send-scheduled-messages (464L)
└── process-payment-webhooks (567L)
```

### 복잡도

```
Low (단순):
├── keep-alive (23L)
├── reset-ytd (116L)
├── database-backup (45L)

Medium (중간):
├── sync-images (141L)
├── trial-expire (110L)
├── news-auto-publish (220L)

High (복잡):
├── process-payment-webhooks (567L)
├── send-scheduled-messages (464L)
├── community-bot (1,395L)
```

---

## 🔒 보안 체크리스트

### 필수 확인 사항

- [x] CRON_SECRET constant-time 비교
- [x] WEBHOOK HMAC 서명 검증
- [x] 멱등성 검증 (결제 중복 방지)
- [x] Zod 입력 검증
- [x] 에러 마스킹 (시스템 정보 노출 금지)
- [x] SQL Injection 방지 (Prisma 사용)
- [x] XSS 방지 (JSON 응답만)
- [x] Rate Limiting

**상세**: ARCHITECTURE.md § 10 (보안 고려사항)

---

## ⚡ 성능 목표

### SLA (Service Level Agreement)

| 작업 | 목표 | 99% 타일 |
|------|------|---------|
| CRON 응답 | < 60초 | < 90초 |
| WEBHOOK 응답 | < 3초 | < 5초 |
| 배치 처리 | 10-50분 | 변동 |

### 데이터베이스 인덱스

모든 CRON에 필요한 인덱스:

```sql
-- sync-images
CREATE INDEX idx_product_image_drive_id ON product_image(drive_id);

-- trial-expire
CREATE INDEX idx_trial_status_expires_at ON trial(status, expires_at);

-- process-payment-webhooks
CREATE INDEX idx_apis_sync_queue_status ON apis_sync_queue(status);
```

---

## 🛠️ 유지보수 팁

### 로그 확인

```bash
# CRON 로그
tail -f logs/cron.log

# WEBHOOK 로그
tail -f logs/payment-webhooks.log

# 에러만
tail -f logs/error.log | grep -E "ERROR|WARN"
```

### 모니터링

```bash
# 실시간 대시보드
bash cruisedot/automation/scripts/monitor-image-sync.sh

# Slack 알림 확인
# #automation-alerts 채널 확인
```

### 문제 진단

```bash
# DB 연결 확인
npx prisma db execute --stdin < /dev/null

# Drive API 테스트
npx ts-node cruisedot/automation/scripts/check-drive-access.ts

# 동기화 진행 확인
npx ts-node cruisedot/automation/scripts/check-image-sync-progress.ts
```

---

## 📚 추가 리소스

### 내부 문서

- 📖 **완전 가이드**: README.md
- 🏗️ **아키텍처 다이어그램**: ARCHITECTURE.md § 1-3
- 📊 **성능 분석**: BATCH_MATRIX.md § 4
- 🎓 **학습 자료**: QUICKSTART.md § 1-8

### 외부 문서

- [Vercel Cron Triggers](https://vercel.com/docs/cron-jobs)
- [Google Drive API](https://developers.google.com/drive/api)
- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [웹훅 보안](https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks)

---

## 🎓 개념 이해

### 핵심 개념

| 개념 | 설명 | 관련 문서 |
|------|------|---------|
| **CRON** | 시간 기반 자동화 작업 | README.md § 1 |
| **WEBHOOK** | 이벤트 기반 자동화 작업 | README.md § 2 |
| **BATCH** | 대량 데이터 일괄 처리 | README.md § 3 |
| **Distributed Lock** | 동시성 제어 (분산 환경) | ARCHITECTURE.md § 6 |
| **Exponential Backoff** | 재시도 전략 | ARCHITECTURE.md § 6 |
| **멱등성** | 같은 요청 여러 번 = 1회 | ARCHITECTURE.md § 5 |

### 데이터 흐름

```
이미지 동기화:
Google Drive → sync-images CRON → drive-sync.ts → product_image → UI

결제 처리:
PayApp → payapp WEBHOOK → apis_sync_queue → process-payment-webhooks → payment → 잔액

배치 작업:
관리자 → batch-1 API → 청크 처리 → DB → 완료 알림
```

---

## 🚨 긴급 대응

### CRON 완전히 실패

```bash
# 1. 즉시 수동 처리
curl -X POST https://your-app.vercel.app/api/cron/sync-images \
  -H "Authorization: Bearer $CRON_SECRET"

# 2. Vercel 상태 확인
vercel status

# 3. DB 연결 확인
npx prisma db execute --stdin < /dev/null

# 4. 환경 변수 확인
echo $CRON_SECRET | wc -c  # 0이면 설정 안 됨
```

### WEBHOOK 폭주

```bash
# 1. 큐 일시 중지 (Process 중단)
# → 코드에서 check 추가: if (paused) return 202;

# 2. 큐 상태 확인
SELECT COUNT(*) FROM apis_sync_queue WHERE status='PENDING';

# 3. 배치 처리
for i in {1..10}; do
  curl https://your-app.vercel.app/api/cron/process-payment-webhooks \
    -H "Authorization: Bearer $CRON_SECRET"
  sleep 2
done

# 4. 실패 항목 검토
SELECT * FROM apis_sync_queue WHERE status='FAILED' LIMIT 10;
```

---

## ✅ 배포 체크리스트

### 배포 전

- [ ] 모든 환경 변수 설정 완료
- [ ] DB 마이그레이션 적용
- [ ] 인덱스 생성 확인
- [ ] CRON Secret 생성 및 설정
- [ ] WEBHOOK 엔드포인트 등록
- [ ] Slack 알림 설정
- [ ] 로그 시스템 구성

### 배포 후

- [ ] 첫 CRON 실행 모니터링
- [ ] 웹훅 테스트 (PayApp 샌드박스)
- [ ] 이미지 동기화 확인
- [ ] 데이터 일관성 검증
- [ ] 1시간 집중 모니터링

**상세**: QUICKSTART.md § 11

---

## 🎯 다음 단계

### 우선순위 순서

1. **즉시**: CRON 작업 활성화 (README.md § 1)
2. **오늘**: WEBHOOK 설정 (QUICKSTART.md § 4)
3. **이번 주**: 배치 작업 테스트 (QUICKSTART.md § 6)
4. **이번 달**: 성능 최적화 (BATCH_MATRIX.md § 5)

### 확장 가능성

- Google Sheets 동기화 자동화
- 예약 메시지 발송 고도화
- 뉴스 자동 발행 AI 통합
- 정산 대시보드 구축

---

## 📞 지원

### 빠른 답변

**Q: 어느 문서를 읽어야 하나요?**
- 시작: QUICKSTART.md
- 상세: README.md
- 아키텍처: ARCHITECTURE.md
- 성능: BATCH_MATRIX.md

**Q: 내 문제는 어디에 있나요?**
- CRON 관련: README.md § 1 + ARCHITECTURE.md § 2
- WEBHOOK 관련: README.md § 2 + ARCHITECTURE.md § 3
- 배치 관련: README.md § 3 + BATCH_MATRIX.md § 2-3
- 성능 관련: BATCH_MATRIX.md § 4-5

**Q: 지금 당장 뭘 하나요?**
- QUICKSTART.md § 1-5 따라가기 (1시간)

---

**마지막 업데이트**: 2026-05-11  
**시스템 버전**: 1.0.0  
**문서 버전**: 1.0.0
