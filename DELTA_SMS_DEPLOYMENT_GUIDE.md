# Delta SMS Cron 배포 가이드

**Menu #38 Phase 4 Track 1: 렌탈 고객 3일 SMS 자동 발송**

---

## Step 1: 로컬 테스트 (개발 환경)

### 1.1 기본 환경 설정

`.env.local` 파일에 다음 추가:

```env
# Cron 인증
CRON_SECRET=test_delta_sms_secret_key_12345

# Aligo SMS (이미 설정되어 있을 것)
ALIGO_API_KEY=your_existing_key
ALIGO_USER_ID=your_existing_user_id
ALIGO_SENDER_PHONE=1234567890

# Redis (이미 설정되어 있을 것)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### 1.2 테스트 캠페인 생성

데이터베이스에서 테스트 캠페인 생성:

```sql
INSERT INTO "CrmMarketingCampaign" (
  id, organizationId, groupId, title, status, 
  sendSms, smsBody, sendAt, createdAt, updatedAt
) VALUES (
  'test_rental_delta_sms',
  'your_test_org_id',
  'your_test_group_id',
  '렌탈 고객 3일 SMS 시퀀스',  -- "렌탈" 포함 필수
  'ACTIVE',
  true,
  '[자동 발송]',
  NOW(),
  NOW(),
  NOW()
);
```

### 1.3 테스트 SendingHistory 생성

렌탈 구매 고객 시뮬레이션:

```sql
-- Day 0: 0일 경과 (오늘 구매)
INSERT INTO "SendingHistory" (
  id, organizationId, sendingType, campaignId, contactId, phone, 
  channel, body, status, scheduledAt, createdAt, updatedAt, metadata
) VALUES (
  'test_day0_contact1', 'your_test_org_id', 'CAMPAIGN', 
  'test_rental_delta_sms', 'contact1', '01012345671',
  'SMS', '[테스트]', 'SENT', NOW(), NOW(), NOW(),
  '{"purchaseDate":"' || TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '", "isRentalPurchase":true}'
);

-- Day 1: 1일 경과 (어제 구매)
INSERT INTO "SendingHistory" (
  id, organizationId, sendingType, campaignId, contactId, phone, 
  channel, body, status, scheduledAt, createdAt, updatedAt, metadata
) VALUES (
  'test_day1_contact2', 'your_test_org_id', 'CAMPAIGN', 
  'test_rental_delta_sms', 'contact2', '01012345672',
  'SMS', '[테스트]', 'SENT', NOW(), NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
  '{"purchaseDate":"' || TO_CHAR(NOW() - INTERVAL '1 day', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '", "isRentalPurchase":true}'
);

-- Day 2: 2일 경과
INSERT INTO "SendingHistory" (
  id, organizationId, sendingType, campaignId, contactId, phone, 
  channel, body, status, scheduledAt, createdAt, updatedAt, metadata
) VALUES (
  'test_day2_contact3', 'your_test_org_id', 'CAMPAIGN', 
  'test_rental_delta_sms', 'contact3', '01012345673',
  'SMS', '[테스트]', 'SENT', NOW(), NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
  '{"purchaseDate":"' || TO_CHAR(NOW() - INTERVAL '2 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '", "isRentalPurchase":true}'
);

-- Day 3: 3일 경과
INSERT INTO "SendingHistory" (
  id, organizationId, sendingType, campaignId, contactId, phone, 
  channel, body, status, scheduledAt, createdAt, updatedAt, metadata
) VALUES (
  'test_day3_contact4', 'your_test_org_id', 'CAMPAIGN', 
  'test_rental_delta_sms', 'contact4', '01012345674',
  'SMS', '[테스트]', 'SENT', NOW(), NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days',
  '{"purchaseDate":"' || TO_CHAR(NOW() - INTERVAL '3 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '", "isRentalPurchase":true}'
);
```

### 1.4 개발 서버 시작

```bash
npm run dev
```

### 1.5 수동 API 테스트 (POST)

```bash
# PowerShell (Windows)
$body = @{ schedule = "morning" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/cron/delta-sms" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

```bash
# Bash/Mac
curl -X POST http://localhost:3000/api/cron/delta-sms \
  -H "Content-Type: application/json" \
  -d '{"schedule":"morning"}'
```

**예상 응답:**
```json
{
  "ok": true,
  "timestamp": "2026-05-19T10:00:00.000Z",
  "schedule": "morning",
  "campaignsProcessed": 1,
  "totalSent": 4,
  "totalFailed": 0,
  "totalSkipped": 0,
  "duration": "2.34s",
  "campaigns": [
    {
      "campaignId": "test_rental_delta_sms",
      "sent": 4,
      "failed": 0,
      "skipped": 0
    }
  ]
}
```

### 1.6 SMS 수신 확인

테스트 폰(01012345671 등)에서 메시지 수신 확인:

**Day 0 메시지 예:**
```
[크루즈 렌탈]
모니카님, 반가워요! 신민형입니다.

💡 너무 복잡하게 생각하지 마세요.
정말 간단해요:

📱 앱에서 신청 (2분)
📦 집에서 받기 (3일)
✅ 사용 시작 (바로)

"이렇게 간단할 줄 몰랐어요" - 이00님

지금 첫 달 무료로 시작해보세요!
```

### 1.7 SendingHistory 검증

```sql
-- 새로 생성된 레코드 확인
SELECT id, contactId, variantKey, body, status, metadata
FROM "SendingHistory"
WHERE campaignId = 'test_rental_delta_sms'
  AND createdAt > NOW() - INTERVAL '10 minutes'
ORDER BY createdAt DESC;
```

**예상 출력:**
```
id                          | contactId | variantKey | body      | status | metadata
test_day0_contact1_out_1    | contact1  | A          | [크루즈...| SENT   | {"deltaDay":0,...}
test_day1_contact2_out_1    | contact2  | B          | [크루즈...| SENT   | {"deltaDay":1,...}
test_day2_contact3_out_1    | contact3  | C          | [크루즈...| SENT   | {"deltaDay":2,...}
test_day3_contact4_out_1    | contact4  | A          | [크루즈...| SENT   | {"deltaDay":3,...}
```

---

## Step 2: GET 요청 테스트 (인증 포함)

### 2.1 CRON_SECRET 인증 테스트

```bash
# PowerShell
$headers = @{ "Authorization" = "Bearer test_delta_sms_secret_key_12345" }
Invoke-RestMethod -Uri "http://localhost:3000/api/cron/delta-sms?schedule=afternoon" `
  -Headers $headers
```

```bash
# Bash
curl -H "Authorization: Bearer test_delta_sms_secret_key_12345" \
  "http://localhost:3000/api/cron/delta-sms?schedule=afternoon"
```

### 2.2 잘못된 인증 테스트

```bash
curl -H "Authorization: Bearer wrong_secret" \
  "http://localhost:3000/api/cron/delta-sms?schedule=morning"
# 예상: 401 Unauthorized
```

### 2.3 잘못된 schedule 파라미터 테스트

```bash
curl -H "Authorization: Bearer test_delta_sms_secret_key_12345" \
  "http://localhost:3000/api/cron/delta-sms?schedule=invalid"
# 예상: 400 Bad Request
```

---

## Step 3: Vercel 배포 전 준비

### 3.1 환경변수 설정

**Vercel 대시보드 → Settings → Environment Variables**

```
CRON_SECRET = your_production_secret_key_very_long_and_random
ALIGO_API_KEY = (이미 설정)
ALIGO_USER_ID = (이미 설정)
ALIGO_SENDER_PHONE = (이미 설정)
UPSTASH_REDIS_REST_URL = (이미 설정)
UPSTASH_REDIS_REST_TOKEN = (이미 설정)
```

**Production 환경만 선택:**
- Environment: Production
- Environments that can access this Variable: Production

### 3.2 vercel.json 설정

프로젝트 루트에 `vercel.json` 생성 (또는 기존 파일 수정):

```json
{
  "crons": [
    {
      "path": "/api/cron/delta-sms?schedule=morning",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/delta-sms?schedule=afternoon",
      "schedule": "0 5 * * *"
    },
    {
      "path": "/api/cron/delta-sms?schedule=evening",
      "schedule": "0 10 * * *"
    }
  ]
}
```

**시간대 설명 (KST 기준):**
- Morning: 09:00 KST = UTC 00:00 → `0 0 * * *`
- Afternoon: 14:00 KST = UTC 05:00 → `0 5 * * *`
- Evening: 19:00 KST = UTC 10:00 → `0 10 * * *`

### 3.3 Git 커밋

```bash
git add src/lib/delta-sms.ts \
        src/lib/cron/delta-sms-schedule.ts \
        src/app/api/cron/delta-sms/route.ts \
        vercel.json \
        DELTA_SMS_IMPLEMENTATION_SUMMARY.md \
        DELTA_SMS_DEPLOYMENT_GUIDE.md

git commit -m "feat(menu38-phase4): Delta SMS Cron 구현 + Vercel 스케줄 설정"
```

---

## Step 4: Vercel 배포

### 4.1 배포 실행

```bash
git push origin main
# Vercel 자동 배포 시작
```

Vercel 대시보드에서 배포 진행 상황 확인:
- Building → Ready → Production ✓

### 4.2 배포 후 Cron 설정 활성화

**Vercel 대시보드 → Settings → Cron Jobs**

"Add New Cron Job" 클릭 후:

```
Schedule: 0 0 * * *
Path: /api/cron/delta-sms?schedule=morning

Schedule: 0 5 * * *
Path: /api/cron/delta-sms?schedule=afternoon

Schedule: 0 10 * * *
Path: /api/cron/delta-sms?schedule=evening
```

또는 `vercel.json`에 정의하면 자동 활성화됨.

### 4.3 테스트 실행

**Vercel 대시보드 → Functions → Cron Jobs**

각 Cron 옆 "Test" 버튼 클릭:

```
Run Test:
✓ /api/cron/delta-sms?schedule=morning
✓ /api/cron/delta-sms?schedule=afternoon  
✓ /api/cron/delta-sms?schedule=evening
```

---

## Step 5: 모니터링

### 5.1 Vercel 로그 확인

**Vercel 대시보드 → Functions → Runtime Logs**

각 Cron 실행 후 로그 확인:
```
[DeltaSmsCron] 시작
[DeltaSmsCron] 캠페인 조회 완료
[DeltaSms] 렌탈 고객 조회 완료
[DeltaSms] 완료
[Cron/DeltaSms] 완료
```

### 5.2 SendingHistory 모니터링

프로덕션 데이터베이스에서 매일 확인:

```sql
-- 어제 발송된 메시지 수
SELECT 
  DATE(createdAt) as date,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
FROM "SendingHistory"
WHERE campaignId IN (
  SELECT id FROM "CrmMarketingCampaign" 
  WHERE title LIKE '%렌탈%' AND status = 'ACTIVE'
)
  AND createdAt > NOW() - INTERVAL '1 day'
GROUP BY DATE(createdAt)
ORDER BY date DESC;
```

### 5.3 성능 메트릭

```sql
-- 발송율 (Delivery Rate)
SELECT 
  SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END)::float / COUNT(*) as delivery_rate
FROM "SendingHistory"
WHERE campaignId IN (
  SELECT id FROM "CrmMarketingCampaign" 
  WHERE title LIKE '%렌탈%' AND status = 'ACTIVE'
)
  AND createdAt > NOW() - INTERVAL '7 days';

-- 변형별 분포 (Variant Distribution)
SELECT 
  variantKey,
  COUNT(*) as count,
  ROUND(COUNT(*)::float / (SELECT COUNT(*) FROM "SendingHistory" 
    WHERE campaignId IN (SELECT id FROM "CrmMarketingCampaign" WHERE title LIKE '%렌탈%')
      AND createdAt > NOW() - INTERVAL '7 days') * 100, 2) as percentage
FROM "SendingHistory"
WHERE campaignId IN (
  SELECT id FROM "CrmMarketingCampaign" 
  WHERE title LIKE '%렌탈%' AND status = 'ACTIVE'
)
  AND createdAt > NOW() - INTERVAL '7 days'
GROUP BY variantKey;
```

---

## Step 6: 문제 해결 (Troubleshooting)

### Issue 1: "Cron secret not configured"

**원인:** CRON_SECRET 미설정  
**해결:** Vercel Settings → Environment Variables → CRON_SECRET 추가

### Issue 2: SMS 미수신

**원인:**
1. Aligo SMS 설정 미완료
2. 수신번호 차단 (opt-out)
3. 야간 발송 차단 (21:00~08:00 KST)

**해결:**
```sql
-- 차단된 번호 확인
SELECT * FROM "SmsOptOut" WHERE phone LIKE '%123%';

-- 캠페인 상태 확인
SELECT id, status, title FROM "CrmMarketingCampaign" WHERE title LIKE '%렌탈%';

-- 최근 발송 로그 확인
SELECT organizationId, contactId, status, failureReason, createdAt
FROM "SendingHistory"
WHERE campaignId LIKE 'test_rental%'
ORDER BY createdAt DESC
LIMIT 10;
```

### Issue 3: "Campaign not found"

**원인:** 캠페인 미생성 또는 ACTIVE가 아님  
**해결:**
```sql
-- 활성 렌탈 캠페인 생성
INSERT INTO "CrmMarketingCampaign" (...)
  VALUES (... status = 'ACTIVE', title = '렌탈 3일 시퀀스' ...);
```

### Issue 4: Vercel Cron 미실행

**원인:**
1. vercel.json 문법 오류
2. API 경로 오류
3. Cron 설정 미활성화

**해결:**
```bash
# 1. vercel.json 검증
npm install -g vercel
vercel env list  # 환경변수 확인

# 2. Vercel 대시보드에서 수동 테스트
# Settings → Cron Jobs → Test

# 3. 로그 확인
vercel logs /api/cron/delta-sms
```

---

## 체크리스트

### 개발 환경 ✅
- [ ] npm run dev 정상 실행
- [ ] POST 수동 테스트 성공
- [ ] GET + 인증 테스트 성공
- [ ] SendingHistory 레코드 생성 확인
- [ ] SMS 수신 확인

### 스테이징 / 프로덕션 ✅
- [ ] CRON_SECRET 설정
- [ ] vercel.json 추가
- [ ] git commit & push
- [ ] Vercel 배포 성공
- [ ] Cron Jobs 활성화
- [ ] 첫 번째 스케줄 실행 대기
- [ ] Vercel 로그 확인
- [ ] SendingHistory 데이터 확인

### 모니터링 ✅
- [ ] 일일 발송 통계 조회
- [ ] 에러율 모니터링 (< 5%)
- [ ] 변형별 분포 확인 (A/B/C 균등)
- [ ] 1주일 데이터 누적 후 성과 분석

---

## 예상 성과

### 발송 메트릭 (목표)
| 메트릭 | 목표 | 실제 |
|--------|------|------|
| Delivery Rate | 95% | _ |
| Click Rate (Day 0) | 35% | _ |
| Final Subscription | 18% | _ |
| Error Rate | <5% | _ |

### ROI 추정
- **일일 렌탈 신청자**: 100명
- **Day 3 구독율**: 18% → 18명
- **월간 신규 구독**: 540명
- **렌탈 월 수익**: 540명 × 4만원 = 21,600,000원

---

## 다음 단계

- **Phase 4 Track 2:** 20렌즈 페르소나 마케팅 (완료)
- **Phase 4 Track 3:** 비용 추적 시스템 (CampaignCost 최적화)
- **Phase 4 Step 5-2:** 성능 최적화 (배치 크기, 재시도 로직)

