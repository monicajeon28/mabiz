# 크루즈닷 자동화 시스템 빠른 시작 가이드

자동화 시스템을 설정하고 실행하는 단계별 가이드입니다.

## 1. 환경 설정 (5분)

### 1.1 환경 변수 설정

```bash
# 프로젝트 루트에서
cp cruisedot/automation/.env.automation.example .env.automation

# 텍스트 에디터에서 열기
nano .env.automation  # 또는 code .env.automation
```

### 1.2 필수 환경 변수 채우기

**최소한 이 3개는 필수**:

```bash
# 1. Vercel CRON Secret
# Vercel Dashboard → Project Settings → Environment Variables에서 복사
CRON_SECRET=your_secret_key

# 2. Google Drive API
# Google Cloud Console에서 Service Account 생성
GOOGLE_DRIVE_API_KEY=AIzaSy...
CRUISEINFO_FOLDER_ID=1a2b3c...

# 3. 데이터베이스
# Neon Dashboard에서 복사
DATABASE_URL=postgresql://...
```

### 1.3 선택 환경 변수

기능을 사용하려면:

- **결제 기능**: `PAYAPP_WEBHOOK_SECRET`, `WELCOMEPAYMENTS_WEBHOOK_SECRET`
- **Google Sheets**: `GOOGLE_SHEETS_API_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`
- **Slack 알림**: `SLACK_WEBHOOK_URL`
- **이메일**: `SENDGRID_API_KEY`

---

## 2. 데이터베이스 마이그레이션 (2분)

```bash
# Prisma 마이그레이션 확인 & 적용
npx prisma migrate deploy

# (필요 시) 새 마이그레이션 생성
npx prisma migrate dev --name add_automation_tables

# DB 상태 확인
npx prisma db execute --stdin < scripts/check-db.sql
```

---

## 3. CRON 작업 활성화 (3분)

### 3.1 vercel.json 확인

```bash
cat vercel.json | grep -A 50 '"crons"'
```

**기대 결과**:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-images",
      "schedule": "0 1 * * *"
    },
    ...
  ]
}
```

### 3.2 수동 CRON 트리거 테스트 (실제 배포 후)

```bash
# sync-images CRON 수동 실행
curl -X POST https://your-app.vercel.app/api/cron/sync-images \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"

# 응답 (성공)
{
  "status": "success",
  "message": "Sync completed",
  "itemsProcessed": 150,
  "itemsFailed": 2,
  "duration": 23456  // ms
}
```

---

## 4. WEBHOOK 설정 (5분)

### 4.1 PayApp 웹훅 등록

1. **PayApp Admin** 접속: https://admin.payapp.kr/
2. **Settings → Webhooks** 메뉴
3. **Add Webhook** 클릭
4. URL 입력:
   ```
   https://your-app.vercel.app/api/webhook/payment/payapp
   ```
5. 이벤트 선택: `payment.completed`, `payment.failed`
6. **Save** 클릭

### 4.2 Google Drive Push Notification 설정

```bash
# Drive API watch 등록 (수동 스크립트)
npx ts-node cruisedot/automation/scripts/setup-drive-watch.ts

# 프롬프트 따라가기:
# → Folder ID 입력: $CRUISEINFO_FOLDER_ID
# → Webhook URL 입력: https://your-app.vercel.app/api/webhook/drive/google-drive-sync
```

---

## 5. 이미지 동기화 테스트 (3분)

### 5.1 동기화 진행률 확인

```bash
# 현재 동기화 상태 확인
npx ts-node cruisedot/automation/scripts/check-image-sync-progress.ts

# 예상 출력:
```
✅ Image Sync Progress Report

Total Images in DB: 5,234
Synced: 4,912
Pending: 322
Failed: 0
Success Rate: 93.86%

Last Sync: 2026-05-11 01:15:23 UTC (12 hours ago)
Next Sync: 2026-05-12 01:00:00 UTC (12 hours)
```
```

### 5.2 수동 동기화 트리거

```bash
# 즉시 sync-images 실행
npx ts-node cruisedot/automation/scripts/trigger-cron.mjs sync-images

# 또는 curl 사용
curl -X POST https://your-app.vercel.app/api/cron/sync-images \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 6. 배치 작업 실행 (10분)

### 6.1 이미지 배치 작업

**상황**: 새로운 1,000개 이미지를 DB에 등록하고 싶음

```bash
# Step 1: Batch-1 (등록)
curl -X POST "https://your-app.vercel.app/api/batch-1-images-sync?startIndex=0&chunkSize=100" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 응답:
{
  "processed": 100,
  "failed": 1,
  "remaining": 900,
  "eta": "45 min",
  "nextStartIndex": 100
}

# Step 2: 진행률 체크 (몇 분 후)
curl -X GET "https://your-app.vercel.app/api/batch-1-images-sync?startIndex=100" \
  ...

# Step 3: 모두 완료될 때까지 반복
# (또는 자동화: 매 5분마다 nextStartIndex로 호출)
```

### 6.2 Google Sheets 동기화

```bash
# product 테이블 → Google Sheets
curl -X POST "https://your-app.vercel.app/api/batch/google-sheets/sync-to-google?table=product" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 응답:
{
  "table": "product",
  "rows": 5234,
  "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/...",
  "duration": 125,
  "success": true
}
```

---

## 7. 결제 웹훅 테스트 (5분)

### 7.1 PayApp 샌드박스에서 테스트

```bash
# PayApp Test Dashboard
# 1. https://test.payapp.kr/ 접속
# 2. 테스트 결제 진행
# 3. 웹훅이 정상 수신되는지 확인

# 로그 확인
tail -f logs/payment-webhooks.log
```

### 7.2 큐 상태 확인

```bash
# PENDING 웹훅 항목 수 확인
npx prisma db execute --stdin << EOF
SELECT COUNT(*) as pending_count 
FROM apis_sync_queue 
WHERE status = 'PENDING';
EOF

# 응답:
pending_count
──────────────
15

# 수동 처리
curl -X POST https://your-app.vercel.app/api/cron/process-payment-webhooks \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 8. 모니터링 설정 (5분)

### 8.1 Slack 알림 설정

```bash
# Slack Workspace에서 Incoming Webhook 생성
# 1. https://api.slack.com/apps/ 접속
# 2. Create New App → From scratch
# 3. Name: "CruisedotAutomation"
# 4. Workspace 선택
# 5. Incoming Webhooks 활성화
# 6. Add New Webhook to Workspace
# 7. 채널 선택: #automation-alerts
# 8. URL 복사 → .env.automation에 붙여넣기

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### 8.2 로그 모니터링

```bash
# 실시간 CRON 로그
tail -f logs/cron.log | grep -E "ERROR|WARN"

# 또는 스크립트 사용
bash cruisedot/automation/scripts/monitor-image-sync.sh
```

---

## 9. 일일 체크리스트

**매일 아침 체크**:

```bash
# 1. CRON 실행 확인
npx ts-node cruisedot/automation/scripts/check-cron-status.ts

# 2. 웹훅 큐 상태
npx ts-node cruisedot/automation/scripts/check-queue-status.ts

# 3. 이미지 동기화 진행
npx ts-node cruisedot/automation/scripts/check-image-sync-progress.ts

# 4. 에러 확인
tail -f logs/error.log | head -20
```

---

## 10. 일반적인 문제 해결

### Q1: CRON이 실행되지 않음

```bash
# 확인 사항:
# 1. Vercel Dashboard에서 CRON 로그 확인
vercel logs --follow

# 2. CRON_SECRET 확인
echo $CRON_SECRET

# 3. 수동 트리거로 테스트
curl -X POST https://your-app.vercel.app/api/cron/sync-images \
  -H "Authorization: Bearer $CRON_SECRET" \
  -v  # verbose 모드로 응답 상세 확인

# 응답 코드가 401이면: CRON_SECRET 불일치
# 응답 코드가 500이면: 서버 에러 (로그 확인)
```

### Q2: 웹훅이 처리되지 않음

```bash
# 확인 사항:
# 1. 웹훅 수신 확인
SELECT * FROM apis_sync_queue 
WHERE status IN ('PENDING', 'FAILED') 
ORDER BY created_at DESC LIMIT 10;

# 2. 에러 메시지 확인
SELECT payload, error FROM apis_sync_queue 
WHERE status = 'FAILED' LIMIT 1;

# 3. 수동 처리
curl -X POST https://your-app.vercel.app/api/cron/process-payment-webhooks \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Q3: 이미지 동기화가 느림

```bash
# 확인 사항:
# 1. Google Drive API 할당량
# → Google Cloud Console → APIs & Services → Quotas

# 2. 네트워크 속도
ping -c 10 www.googleapis.com | grep avg

# 3. 데이터베이스 성능
EXPLAIN ANALYZE 
SELECT * FROM product_image 
WHERE drive_id IS NULL 
LIMIT 100;
```

### Q4: 메모리 부족 (OOM)

```bash
# 배치 청크 크기 감소
# .env.automation에서:
BATCH_CHUNK_SIZE=50  # 100에서 50으로 감소

# 또는 동시 처리 수 감소
MAX_CONCURRENT_TASKS=2  # 4에서 2로 감소

# 재시작
npm run dev
```

---

## 11. 프로덕션 배포 체크리스트

배포 전 반드시 확인:

```
[배포 전]
- [ ] 모든 환경 변수 설정 완료
- [ ] DATABASE_URL이 production DB 가리킴
- [ ] CRON_SECRET이 Vercel에 설정됨
- [ ] WEBHOOK 엔드포인트 HTTPS 활성화
- [ ] 모든 외부 API 키 (PayApp, Google Drive 등) 유효함
- [ ] 로그 레벨이 INFO로 설정됨
- [ ] Slack 알림 채널이 올바름

[배포 후]
- [ ] 첫 CRON 실행 모니터링 (Slack 알림)
- [ ] 결제 샌드박스에서 웹훅 테스트
- [ ] 이미지 동기화 진행 확인 (check-image-sync-progress)
- [ ] 데이터 일관성 검증 (SELECT COUNT(*) 비교)
- [ ] 1시간 동안 로그 모니터링 (에러 확인)
```

---

## 12. 자주 사용하는 명령어

```bash
# CRON 상태 확인
curl https://your-app.vercel.app/api/cron/sync-images \
  -H "Authorization: Bearer $CRON_SECRET" \
  -X POST

# 웹훅 큐 처리
curl https://your-app.vercel.app/api/cron/process-payment-webhooks \
  -H "Authorization: Bearer $CRON_SECRET" \
  -X POST

# 이미지 동기화 진행률
npx ts-node cruisedot/automation/scripts/check-image-sync-progress.ts

# Google Drive 액세스 테스트
npx ts-node cruisedot/automation/scripts/check-drive-access.ts

# 배치 작업 실행
curl -X POST "https://your-app.vercel.app/api/batch-1-images-sync?startIndex=0&chunkSize=100"

# 로그 확인
tail -f logs/automation.log

# DB 백업
npx ts-node cruisedot/automation/scripts/sync-drive-to-db.ts
```

---

## 13. 다음 단계

1. **Stage 5 검증**: `cruisedot/automation/lib/` 라이브러리 테스트
2. **Stage 6 배포**: Vercel에 배포 및 프로덕션 모니터링
3. **성능 최적화**: 실제 트래픽 기반 CRON 스케줄 조정
4. **알림 고도화**: 에러 분류별 Slack 채널 분리

---

## 지원 문서

- 📖 **완전 가이드**: `README.md`
- 🏗️ **아키텍처**: `ARCHITECTURE.md`
- 📊 **배치 매트릭스**: `BATCH_MATRIX.md`
- 📝 **환경 변수**: `.env.automation.example`
- 🔧 **라이브러리 API**: `lib/README.md` (추후)

---

**더 도움이 필요한가?**

- 🐛 버그 리포트: GitHub Issues
- 💬 질문: Slack #automation-support
- 📚 문서: Notion Wiki

Happy automation! 🚀
