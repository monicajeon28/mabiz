# Settlement Webhook 테스트 가이드

## 1. 단위 테스트 (Jest)

### Tier 계산 테스트

```bash
npm test -- settlement-handler.test.ts --testNamePattern="calculateTier"
```

**예상 결과:**

```
✓ should calculate Bronze tier for $0-$10K
✓ should calculate Silver tier for $10K-$50K
✓ should calculate Gold tier for $50K-$150K
✓ should calculate Platinum tier for $150K+
✓ should handle boundary values correctly
```

### Tier 경계값 테스트

```typescript
// Bronze/Silver 경계 ($10K)
calculateTier(999999)  // $9,999.99 → "Bronze"
calculateTier(1000000) // $10,000.00 → "Bronze" (inclusive)
calculateTier(1000001) // $10,000.01 → "Silver"

// Silver/Gold 경계 ($50K)
calculateTier(5000000)  // $50,000.00 → "Silver"
calculateTier(5000001)  // $50,000.01 → "Gold"

// Gold/Platinum 경계 ($150K)
calculateTier(15000000) // $150,000.00 → "Gold"
calculateTier(15000001) // $150,000.01 → "Platinum"
```

---

## 2. 통합 테스트 (cURL + Database)

### 테스트 시나리오 A: 정상 정산 처리

**요청:**

```bash
curl -X POST http://localhost:3000/api/webhook/crm/settlement-updated \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $(echo -n 'payload_body' | openssl dgst -sha256 -hmac 'test-secret' -binary | xxd -p -c 256)" \
  -H "X-Webhook-Timestamp: $(date +%s)" \
  -d '{
    "eventId": "evt_test_001",
    "eventType": "settlement.paid",
    "timestamp": "2026-05-28T10:30:00Z",
    "settlementId": "sett_20260528_12345",
    "period": "2026-05",
    "status": "PAID",
    "totalCommission": 1500000,
    "totalWithholding": 150000,
    "profileId": 12345
  }'
```

**예상 응답 (200 OK):**

```json
{
  "partnerId": "12345",
  "totalEarnings": 1350000,
  "tier": "Silver",
  "churnDetected": false,
  "status": "processed"
}
```

**DB 검증:**

```sql
-- Partner 업데이트 확인
SELECT id, tier, totalEarnings, lastSettlementAt, churnRiskFlag
FROM "Partner"
WHERE id = '12345';
-- Expected: tier='Silver', totalEarnings=1350000, lastSettlementAt=NOW(), churnRiskFlag=false

-- SettlementLedger 저장 확인
SELECT * FROM "SettlementLedger"
WHERE partnerId = '12345' AND period = '2026-05';
-- Expected: status='PAID', netAmount=1350000, churnDetected=false
```

---

### 테스트 시나리오 B: Tier 업그레이드

**조건:**
- 기존 Partner: Tier='Bronze', totalEarnings=$5K
- 신규 정산: $12K

**요청:**

```bash
curl -X POST http://localhost:3000/api/webhook/crm/settlement-updated \
  -d '{
    "eventId": "evt_test_002",
    "eventType": "settlement.paid",
    "timestamp": "2026-05-28T11:00:00Z",
    "settlementId": "sett_20260528_67890",
    "period": "2026-05",
    "status": "PAID",
    "totalCommission": 1200000,
    "totalWithholding": 0,
    "profileId": 67890
  }'
```

**예상 응답:**

```json
{
  "partnerId": "67890",
  "totalEarnings": 1700000,
  "tier": "Silver",
  "churnDetected": false,
  "status": "processed"
}
```

**DB 검증:**

```sql
SELECT tier FROM "Partner" WHERE id = '67890';
-- Expected: tier='Silver' (upgraded from 'Bronze')
```

---

### 테스트 시나리오 C: Churn 신호 감지

**조건:**
- Partner는 3개월 동안 매달 $20K 정산
- 이번달 정산: $16K (20% 감소)

**설정:**

```sql
-- 이전 3개월 정산 데이터 생성
INSERT INTO "SettlementLedger" (id, partnerId, period, settlementId, status, totalCommission, totalWithholding, netAmount, createdAt, updatedAt)
VALUES 
  (cuid(), '99999', '2026-03', 'sett_20260301_99999', 'PAID', 2000000, 0, 2000000, NOW(), NOW()),
  (cuid(), '99999', '2026-04', 'sett_20260401_99999', 'PAID', 2000000, 0, 2000000, NOW(), NOW()),
  (cuid(), '99999', '2026-05', 'sett_20260501_99999', 'PAID', 2000000, 0, 2000000, NOW(), NOW());

-- Partner 생성
INSERT INTO "Partner" (id, organizationId, name, status, totalEarnings, createdAt, updatedAt)
VALUES ('99999', 'org_test', 'Churn Test Partner', 'ACTIVE', 6000000, NOW(), NOW());
```

**요청:**

```bash
curl -X POST http://localhost:3000/api/webhook/crm/settlement-updated \
  -d '{
    "eventId": "evt_test_003",
    "eventType": "settlement.paid",
    "timestamp": "2026-05-28T12:00:00Z",
    "settlementId": "sett_20260528_99999",
    "period": "2026-06",
    "status": "PAID",
    "totalCommission": 1600000,
    "totalWithholding": 0,
    "profileId": 99999
  }'
```

**예상 응답:**

```json
{
  "partnerId": "99999",
  "totalEarnings": 7600000,
  "tier": "Gold",
  "churnDetected": true,
  "status": "processed"
}
```

**DB 검증:**

```sql
SELECT churnRiskFlag, churnRiskDetectedAt FROM "Partner" WHERE id = '99999';
-- Expected: churnRiskFlag=true, churnRiskDetectedAt=NOW()

SELECT churnDetected FROM "SettlementLedger"
WHERE partnerId = '99999' AND period = '2026-06';
-- Expected: churnDetected=true
```

---

### 테스트 시나리오 D: 신규 Partner 자동 생성

**조건:**
- Organization 존재: externalAffiliateProfileId=54321
- Partner 없음: 첫 정산

**요청:**

```bash
curl -X POST http://localhost:3000/api/webhook/crm/settlement-updated \
  -d '{
    "eventId": "evt_test_004",
    "eventType": "settlement.created",
    "timestamp": "2026-05-28T13:00:00Z",
    "settlementId": "sett_20260528_54321",
    "period": "2026-05",
    "status": "DRAFT",
    "totalCommission": 500000,
    "totalWithholding": 50000,
    "profileId": 54321
  }'
```

**예상 응답:**

```json
{
  "partnerId": "54321",
  "totalEarnings": 450000,
  "tier": "Bronze",
  "churnDetected": false,
  "status": "processed"
}
```

**DB 검증:**

```sql
SELECT id, name, tier, totalEarnings FROM "Partner" WHERE id = '54321';
-- Expected: 신규 Partner 생성됨, name='Partner 54321', tier='Bronze'
```

---

### 테스트 시나리오 E: 필수 필드 누락

**요청 (period 누락):**

```bash
curl -X POST http://localhost:3000/api/webhook/crm/settlement-updated \
  -d '{
    "eventId": "evt_test_005",
    "eventType": "settlement.paid",
    "timestamp": "2026-05-28T14:00:00Z",
    "settlementId": "sett_20260528_11111",
    "status": "PAID",
    "totalCommission": 1000000,
    "totalWithholding": 0,
    "profileId": 11111
  }'
```

**예상 응답 (400 Bad Request):**

```json
{
  "error": "Missing required fields"
}
```

---

## 3. 성능 테스트

### 단위 정산 처리 시간

```bash
time npm run build 2>&1 | grep "next build"
```

**목표:** <30초 빌드 시간

### Webhook 응답 시간

```bash
time curl -X POST http://localhost:3000/api/webhook/crm/settlement-updated \
  -H "Content-Type: application/json" \
  -d '{...settlement payload...}'
```

**목표:** <500ms 응답 시간

### 대량 정산 처리 (부하 테스트)

```bash
# 100개의 동시 요청
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/webhook/crm/settlement-updated \
    -H "Content-Type: application/json" \
    -d "{
      \"settlementId\": \"sett_load_$i\",
      \"profileId\": $((12345 + i)),
      \"period\": \"2026-05\",
      \"status\": \"PAID\",
      \"totalCommission\": $((i * 100000)),
      \"totalWithholding\": 0,
      \"eventId\": \"evt_load_$i\",
      \"eventType\": \"settlement.paid\",
      \"timestamp\": \"2026-05-28T15:00:00Z\"
    }" &
done
wait
```

**목표:**
- 동시성: 100개 요청 처리
- 응답 시간: 95% <500ms
- 에러율: <1%

---

## 4. 로그 검증

### 정상 정산 로그

```
[settlement-updated] Partner 누적 수익 업데이트
  partnerId: 12345
  netAmount: 1350000
  totalEarnings: 1350000

[settlement-updated] SettlementLedger 저장
  partnerId: 12345
  period: 2026-05
  status: PAID
  netAmount: 1350000
```

### Tier 업그레이드 로그

```
[settlement-handler] Partner Tier 업데이트
  partnerId: 67890
  oldTier: Bronze
  newTier: Silver
```

### Churn 감지 로그

```
[settlement-updated] Churn 신호 감지
  partnerId: 99999
  currentMonth: 16000
  previousMonth: 20000
  decreasePercent: 20.0%

[settlement-handler] Churn 알림 SMS 발송
  partnerId: 99999
  phone: 010****0000
  decreasePercent: 20.0%
```

---

## 5. 배포 후 Smoke Test

### 프로덕션 배포 체크리스트

- [ ] Migration 실행 완료: `prisma migrate deploy`
- [ ] Partner 테이블에 새 컬럼 추가 확인
  - [ ] `tier` (default='Bronze')
  - [ ] `churnRiskFlag` (default=false)
  - [ ] `lastSettlementAt` (nullable)
  - [ ] `totalEarnings` (default=0)
- [ ] SettlementLedger 테이블 생성 확인
- [ ] Webhook Secret 환경변수 설정 완료: `CRUISEDOT_WEBHOOK_SECRET`
- [ ] SMS Config 설정 확인: `OrgSmsConfig`
- [ ] 첫 정산 Webhook 수신 (PAID 상태) 성공
- [ ] Partner Tier 자동 계산 확인
- [ ] SMS 알림 발송 확인 (수신자 휴대폰)

---

## 6. 모니터링 쿼리

### 일일 정산 통계

```sql
SELECT 
  DATE_TRUNC('day', "createdAt") as date,
  COUNT(*) as settlement_count,
  COUNT(CASE WHEN status='PAID' THEN 1 END) as paid_count,
  COUNT(CASE WHEN churnDetected=true THEN 1 END) as churn_alerts,
  SUM(netAmount)/100 as total_usd
FROM "SettlementLedger"
WHERE "createdAt" >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', "createdAt")
ORDER BY date DESC;
```

### Partner Tier 분포

```sql
SELECT tier, COUNT(*) as partner_count, ROUND(AVG(totalEarnings)/100) as avg_earnings_usd
FROM "Partner"
WHERE status='ACTIVE'
GROUP BY tier
ORDER BY tier;
```

### Churn Risk 모니터링

```sql
SELECT id, name, churnRiskFlag, churnRiskDetectedAt, totalEarnings/100 as earnings_usd
FROM "Partner"
WHERE churnRiskFlag=true
ORDER BY churnRiskDetectedAt DESC;
```

---

## 7. 트러블슈팅

### 문제: Webhook이 도착하지 않음

**해결:**
1. CRUISEDOT_WEBHOOK_SECRET 확인
2. 크루즈닷몰 Webhook URL 설정 확인: `https://yourdomain.com/api/webhook/crm/settlement-updated`
3. 서버 로그 확인: `tail -f .next/server.log | grep settlement-updated`

### 문제: Partner 생성 안됨

**해결:**
```sql
-- Organization이 externalAffiliateProfileId와 매칭되는지 확인
SELECT id, externalAffiliateProfileId FROM "Organization" WHERE externalAffiliateProfileId = 12345;
```

### 문제: SMS 발송 안됨

**해결:**
```sql
-- SMS Config 확인
SELECT id, organizationId, isActive FROM "OrgSmsConfig" WHERE organizationId = 'org_test';
```

---

**테스트 작성일:** 2026-05-28  
**상태:** ✅ 완성  
**담당자:** Settlement Webhook Phase 6
