# 크루즈닷 API 연동 공식 요청서

**작성자:** 마비즈 개발팀  
**작성일:** 2026-06-23  
**서비스:** 마비즈 CRM (B2B 파트너 관리 시스템)  
**목표:** 크루즈닷 상품, 예약, 재고, 정산 데이터의 실시간 통합 및 자동화

---

## 📋 1. 요청 개요

마비즈 CRM은 크루즈닷의 상품, 고객, 예약, 정산 데이터를 실시간으로 받아 B2B 파트너(대리점/판매원)에게 제공하기 위해 다음을 요청합니다:

1. **Webhook 시크릿 키** (환경변수)
2. **API 엔드포인트 문서** (요청/응답 스키마)
3. **Rate Limit 정책**
4. **에러 처리 및 재시도 정책**
5. **SLA 보장 사항**

---

## 🔐 2. 현재 적용된 Webhook 수신 (CRM 측)

### 2-1. 공통 보안 기준

| 항목 | 스펙 |
|-----|------|
| **HTTP 메서드** | POST |
| **URL** | `https://[CRM도메인]/api/webhooks/cruisedot-*` |
| **Content-Type** | `application/json` |
| **인증 방식** | Bearer Token + HMAC-SHA256 |
| **타임아웃** | 30초 권장 (CRM은 3초 기본값) |

### 2-2. Bearer Token 검증

**요청 예시:**
```http
POST /api/webhooks/cruisedot-payment HTTP/1.1
Authorization: Bearer sk_prod_xxxxx
x-signature: a1b2c3d4e5f6... (HMAC-SHA256)
Content-Type: application/json

{
  "eventId": "evt_...",
  "eventType": "payment.created",
  ...
}
```

**토큰 검증 로직 (CRM 구현):**
```typescript
const token = authHeader.slice(7); // "Bearer " 제거
const tokenBuf = Buffer.from(token, 'utf8');
const secretBuf = Buffer.from(secret, 'utf8');

if (!timingSafeEqual(tokenBuf, secretBuf)) {
  return 401 Unauthorized;
}
```

**⚠️ 크루즈닷 요청사항:**
- 프로덕션 Bearer Token 값: `sk_prod_xxxxx`
- 스테이징 Bearer Token 값: `sk_staging_xxxxx`
- 토큰 만료/로테이션 정책: ?

### 2-3. HMAC-SHA256 서명 검증

**서명 계산 방식:**
```typescript
const signature = createHmac('sha256', secret)
  .update(body)  // raw body string
  .digest('hex');
```

**CRM이 검증하는 헤더:**
```
x-signature: [위의 서명값]
```

**⚠️ 크루즈닷 확인사항:**
- 헤더 이름: `x-signature`인가? 다른 이름?
- 서명 포맷: hex string인가? base64?
- Raw body 사용하는가? 파싱된 JSON 사용?

---

## 📡 3. 현재 운영 중인 Webhook 5가지

### 3-1. Inventory Webhook (재고 동기화)

**목적:** 판매/환불로 인한 객실 재고 변동

**엔드포인트:** `POST /api/webhooks/cruisedot-inventory`

**환경변수:** `CRUISEDOT_INVENTORY_WEBHOOK_SECRET`

**요청 스키마 (CRM이 수신):**
```json
{
  "eventId": "evt_inv_20260623_001",
  "eventType": "inventory.decrement",  // or "inventory.increment"
  "productCode": "JP001",
  "cabinType": "발코니",
  "quantity": 1,
  "action": "decrement",
  "organizationId": "org_xxx",
  "inventorySnapshot": {
    "인사이드": { "total": 100, "booked": 45, "remaining": 55 },
    "오션뷰": { "total": 80, "booked": 30, "remaining": 50 },
    "발코니": { "total": 50, "booked": 25, "remaining": 25 },
    "스위트": { "total": 20, "booked": 10, "remaining": 10 }
  }
}
```

**응답 (CRM이 반환):**
```json
{
  "ok": true,
  "productCode": "JP001",
  "cabinType": "발코니",
  "status": "AVAILABLE"  // or "SOLD_OUT"
}
```

**호출 빈도:** 매일 10-50회

**⚠️ 크루즈닷 확인사항:**
- `inventorySnapshot` 필드는 매 이벤트마다 제공하는가? (모든 객실타입)
- 정규화된 cabinType 값: "inside", "oceanview", "balcony", "suite"인가?
- 일 1회 전체 snapshot 제공 시간: ?

---

### 3-2. Payment Webhook (결제 처리)

**목적:** 고객 결제 생성/확인/환불, Contact 등록, Day 0 SMS 발송

**엔드포인트:** `POST /api/webhooks/cruisedot-payment`

**환경변수:** `CRUISEDOT_WEBHOOK_SECRET`

**요청 스키마 (CRM이 수신):**
```json
{
  "eventId": "evt_pay_20260623_12345",
  "eventType": "payment.created",  // "payment.updated", "payment.refunded"
  "timestamp": "2026-06-23T14:30:00Z",
  "bookingRef": "BK2406001234",
  "affiliateCode": "AFF_PARTNER_001",  // null이면 HQ 직접구매
  "saleAmount": 1590000,
  "status": "CONFIRMED",  // "PENDING", "CANCELLED"
  "refundAmount": 0,
  "reason": null
}
```

**응답 (CRM이 반환):**
```json
{
  "ok": true,
  "contactId": "contact_xxx",
  "orderId": "BK2406001234",
  "affiliateType": "AFFILIATE",  // or "DIRECT"
  "day0SmsSent": true
}
```

**호출 빈도:** 매일 50-100회

**CRM이 수행하는 작업:**
1. Contact UPSERT (bookingRef 기준)
2. Day 0 SMS 자동 발송 (PASONA P-A 단계)
3. 수당 계산용 조회 (affiliateCode → Partner tier)
4. FormSubmission 기록 (A/B 테스트 추적)

**⚠️ 크루즈닷 확인사항:**
- `affiliateCode`가 null인 경우 처리 (HQ 직접구매로 취급)?
- `payment.refunded` 이벤트는 별도 필드 `refundAmount`, `reason` 제공?
- 재시도 정책: 실패 응답 시 몇 초 후 재시도?
- Timeout 후 동작: 재발송? 중단?

---

### 3-3. Settlement Webhook (수당 정산)

**목적:** 크루즈닷 정산 → CRM Payslip 자동 생성/업데이트

**엔드포인트:** `POST /api/webhooks/cruisedot-settlement`

**환경변수:** `MABIZ_SETTLEMENT_WEBHOOK_SECRET` (또는 `CRUISEDOT_WEBHOOK_SECRET`)

**요청 스키마 (CRM이 수신):**

#### 3-3-1. 일반 정산 이벤트 (settlement.created ~ settlement.paid)

```json
{
  "eventId": "evt_settle_20260623_001",
  "eventType": "settlement.created",  // "approved", "locked", "paid"
  "timestamp": "2026-06-23T18:00:00Z",
  "settlementId": "ST202606001",
  "partnerId": "12345",  // 크루즈닷 내부 user/agent ID (정수)
  "period": "2026-06",
  "status": "DRAFT",  // "APPROVED", "LOCKED", "PAID"
  "amount": 1000000,  // 총 정산액
  "netAmount": 950000,  // 수수료 차감 후
  "commissionRate": 5,  // %
  "paymentDate": "2026-07-05"
}
```

#### 3-3-2. 계산 완료 이벤트 (settlement.calculated) ⭐

크루즈닷이 월말 정산을 완료했을 때만 발송:

```json
{
  "eventId": "evt_settle_calc_20260630_001",
  "eventType": "settlement.calculated",
  "timestamp": "2026-06-30T23:59:59Z",
  "settlementId": "ST202606001",
  "partnerId": "12345",  // 메인 파트너 (참고용)
  "period": "2026-06",
  "status": "APPROVED",
  "amount": 5000000,  // 전체 정산액
  "totalNetPayment": 4750000,  // 전체 순정산액
  "netAmount": 4750000,
  "profiles": [
    {
      "partnerId": "12345",
      "period": "2026-06",
      "netPayment": 950000
    },
    {
      "partnerId": "12346",
      "period": "2026-06",
      "netPayment": 1100000
    },
    {
      "partnerId": "12347",
      "period": "2026-06",
      "netPayment": 875000
    }
  ],
  "paymentDate": "2026-07-05"
}
```

**응답 (CRM이 반환):**
```json
{
  "ok": true,
  "settlementId": "ST202606001",
  "partnerId": "12345",
  "status": "processed",
  "upserted": 3,  // settlement.calculated일 때
  "skipped": 0
}
```

**호출 빈도:** 월 1회 (월말) 또는 월 1-3회 (상태별)

**CRM이 수행하는 작업:**
1. AffiliatePayslip UPSERT (agentId_yearMonth 기준)
2. SMS 알림 발송 (status=PAID일 때)
3. Saga 패턴으로 3단계 원자적 처리

**⚠️ 크루즈닷 확인사항:**
- `partnerId`는 정수(int)인가? 아니면 문자열?
- `profiles` 배열은 `settlement.calculated` 이벤트에서만 제공?
- 각 파트너별 `netPayment` 계산 로직: 수수료를 크루즈닷이 빼는가? 아니면 CRM이 빼는가?
- **SSoT (Single Source of Truth) 확인:** CRM은 크루즈닷의 정산액을 신뢰하고 저장만 하는가?

---

### 3-4. Member Webhook (회원 동기화)

**목적:** 크루즈닷 회원 생성/변경 → GmUser + Contact 동기화

**엔드포인트:** `POST /api/webhooks/cruisedot-member`

**환경변수:** `CRUISEDOT_WEBHOOK_SECRET`

**요청 스키마 (CRM이 수신):**
```json
{
  "eventId": "evt_mem_20260623_001",
  "eventType": "member.created",  // "updated", "deleted"
  "timestamp": "2026-06-23T10:15:00Z",
  "member": {
    "id": "12345",  // 크루즈닷 내부 user ID
    "name": "김철수",
    "phone": "010-1234-5678",
    "email": "kim@example.com",
    "provider": "kakao",  // "naver", "google", "direct"
    "mallUserId": "kakao_9876543210",
    "mallNickname": "Kim_Travel_2026",
    "profileImg": "https://example.com/img/xxx.jpg"
  }
}
```

**응답 (CRM이 반환):**
```json
{
  "ok": true,
  "eventType": "member.created",
  "externalId": "12345"
}
```

**호출 빈도:** 매일 1-10회

**CRM이 수행하는 작업:**
1. GmUser UPSERT (externalId 기준, 크루즈닷 user ID)
2. Contact UPSERT (phone_organizationId 기준, 영업 목록용)
3. 직원 번호 필터링 (staff phone 제거)

**⚠️ 크루즈닷 확인사항:**
- `member.id`는 정수(int)인가? 문자열?
- `mallUserId` 형식: 소셜 로그인별 일관된 형식?
- `member.deleted` 이벤트는 어떤 필드만 제공?
- 개인정보 보호: 폰과 이메일은 평문으로 전송?

---

### 3-5. Refund Webhook (환불 처리)

**목적:** 크루즈닷 환불 요청 → CRM PaymentRefund + Contact 상태 업데이트

**엔드포인트:** `POST /api/webhooks/cruisedot-refund`

**환경변수:** `CRUISEDOT_WEBHOOK_SECRET`

**요청 스키마 (CRM이 수신):**
```json
{
  "eventId": "evt_refund_20260623_001",
  "eventType": "refund.requested",  // "approved", "rejected", "completed"
  "timestamp": "2026-06-23T09:00:00Z",
  "bookingRef": "BK2406001234",
  "refundAmount": 500000,
  "refundReason": "고객 요청 취소",
  "status": "PENDING",  // "APPROVED", "REJECTED", "COMPLETED"
  "customerPhone": "010-1234-5678",
  "customerEmail": "customer@example.com",
  "customerName": "이순신",
  "departureDate": "2026-07-15",
  "organizationId": "org_xxx",
  "metadata": {
    "cancellationPolicy": "7일 이내 100% 환불"
  }
}
```

**응답 (CRM이 반환):**
```json
{
  "ok": true,
  "refundId": "refund_xxx",
  "status": "PENDING",
  "refundAmount": 500000
}
```

**호출 빈도:** 주 1-5회

**CRM이 수행하는 작업:**
1. PaymentRefund 생성/업데이트 (eventId 기준, 멱등성)
2. Contact 상태 업데이트 (status=COMPLETED일 때)
3. Contact 메모 기록

**⚠️ 크루즈닷 확인사항:**
- 환불 구간별 webhook: 각 status 변경마다 발송?
- `customerPhone/Email/Name`은 bookingRef로 조회 가능?
- 환불 정책 문의: 일부 환불 지원?

---

## 🚀 4. CRM이 호출하는 Webhook (역방향)

### 4-1. Passport SMS 발송 완료 알림

**목적:** APIS 여권 데이터 전송 완료 → 크루즈닷에 SMS 완료 보고

**엔드포인트:** `POST https://www.cruisedot.co.kr/api/webhooks/crm/passport-sent`

**환경변수:** `INTERNAL_WEBHOOK_SECRET`

**요청 (CRM이 발송):**
```json
{
  "batchId": "batch_uuid_from_cruisedot",
  "sentCount": 45,
  "failureCount": 2,
  "timestamp": "2026-06-23T14:30:00Z"
}
```

**서명 계산:**
```typescript
const signature = createHmac('sha256', INTERNAL_WEBHOOK_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');

// 헤더: x-signature: [hex string]
```

**응답 (크루즈닷이 반환):**
```json
{
  "ok": true,
  "batchId": "batch_uuid_from_cruisedot",
  "received": true
}
```

**호출 빈도:** 매일 1-5회

---

### 4-2. PNR SMS 발송 완료 알림

**목적:** 예약(PNR) SMS 발송 완료 → 크루즈닷에 완료 보고

**엔드포인트:** `POST https://www.cruisedot.co.kr/api/webhooks/crm/pnr-sent`

**환경변수:** `INTERNAL_WEBHOOK_SECRET` (동일)

**호출 빈도:** 매일 1-10회

---

## ⚙️ 5. Rate Limit 및 확장성 요구사항

### 5-1. Webhook 수신 (크루즈닷 → CRM)

| 엔드포인트 | 초당 최대 | 시간당 최대 | Peak 시간 |
|----------|---------|----------|---------|
| `/api/webhooks/cruisedot-payment` | ? | ? | 아침 8-10시 (구매 몰림) |
| `/api/webhooks/cruisedot-inventory` | ? | ? | 실시간 |
| `/api/webhooks/cruisedot-settlement` | ? | ? | 월말 |
| `/api/webhooks/cruisedot-member` | ? | ? | 상시 |
| `/api/webhooks/cruisedot-refund` | ? | ? | 평일 오후 |

**⚠️ 크루즈닷 요청:**
- 각 엔드포인트별 Rate Limit 수치
- Retry 정책 (429/503 시 재시도 간격)
- Timeout 정책 (응답 없을 시 재시도 여부)
- Max Retries (최대 재시도 횟수)

---

### 5-2. 에러 처리 및 DLQ (Dead Letter Queue)

**CRM이 제공하는 응답 코드:**

| HTTP | 의미 | 크루즈닷 재시도 필요? |
|-----|------|------------------|
| 200, 201 | 성공 | ❌ 불필요 |
| 400, 422 | 데이터 오류 (DLQ) | ❌ 불필요 (수동 개입 필요) |
| 401, 403 | 인증 실패 | ❌ 키 재발급 필요 |
| 500, 503 | 서버 오류 (재시도 권장) | ✅ 필요 (지수백오프) |

**⚠️ 크루즈닷 확인사항:**
- DLQ 메시지 저장 기한: ?
- 실패 이벤트 재전송 방법: ?

---

## 📊 6. 모니터링 및 SLA 요구사항

### 6-1. SLA 보장

| 항목 | 요구사항 |
|-----|--------|
| **Webhook 가용성** | ?% (예: 99.9%) |
| **이벤트 전달 보장** | At-least-once? Exactly-once? |
| **지연도** | 평균 ? 초 (P95: ?) |
| **에러 율** | 월 최대 ?% |
| **점검 시간** | 월 ? 시간 (사전 공지) |

---

### 6-2. 모니터링 연락처

**크루즈닷 팀:**
- 기술 담당자 이름: ?
- 이메일: ?
- 휴대전화: ?
- Slack: ?
- 장애 신고: ?

**CRM 팀 연락처 (크루즈닷이 알아두기):**
- 개발팀: dev@mabiz.com
- DevOps: devops@mabiz.com
- 긴급: +82-10-xxxx-xxxx

---

## 🔑 7. 환경변수 수령 체크리스트

**프로덕션 배포 전 필수 확보:**

```
[ ] CRUISEDOT_WEBHOOK_SECRET = sk_prod_xxxxx
[ ] CRUISEDOT_INVENTORY_WEBHOOK_SECRET = sk_inv_prod_xxxxx
[ ] MABIZ_SETTLEMENT_WEBHOOK_SECRET = sk_settle_prod_xxxxx
[ ] INTERNAL_WEBHOOK_SECRET = sk_internal_prod_xxxxx
[ ] CRUISEDOT_WEBHOOK_ORG_ID = org_cruisedot_prod
[ ] DEFAULT_ORGANIZATION_ID = org_hq_prod
[ ] NEXT_PUBLIC_CRUISEDOT_PHONE = 02-xxxx-xxxx
[ ] NEXT_PUBLIC_CRUISEDOT_KAKAO = @cruisedot_official
[ ] SUPABASE_BACKUP_URL = postgresql://...
```

---

## 📞 8. 다음 단계

### 8-1. 크루즈닷이 제공할 사항

1. **API 명세 문서**
   - [ ] 각 이벤트 타입의 전체 필드 정의
   - [ ] 필수 vs 선택 필드 구분
   - [ ] 필드 데이터 타입 및 제약조건
   - [ ] 예시 JSON payload

2. **인증 정보**
   - [ ] 프로덕션 Bearer Token
   - [ ] 스테이징 Bearer Token
   - [ ] HMAC-SHA256 Secret
   - [ ] 토큰 로테이션 일정

3. **SLA 문서**
   - [ ] Rate Limit 정책
   - [ ] Retry 정책
   - [ ] Timeout 정책
   - [ ] 가용성 보장 수준

4. **운영 정보**
   - [ ] 장애 신고 연락처
   - [ ] 점검 예정 일정
   - [ ] 배포 일정 공지

### 8-2. CRM이 제공할 사항

- Webhook 수신 URL (프로덕션): `https://[CRM도메인]/api/webhooks/cruisedot-*`
- 테스트 URL (스테이징): `https://[staging도메인]/api/webhooks/cruisedot-*`
- Webhook 응답 로그 (주 1회)
- 에러 발생 시 알림 연락처

---

## ✅ 9. 통합 테스트 계획

### Phase 1: 스테이징 테스트 (2-3주)

```bash
# 1. 환경변수 설정
CRUISEDOT_WEBHOOK_SECRET=sk_staging_xxxxx
CRUISEDOT_INVENTORY_WEBHOOK_SECRET=sk_inv_staging_xxxxx
...

# 2. 각 webhook 테스트 (5가지)
curl -X POST https://[staging]/api/webhooks/cruisedot-payment \
  -H "Authorization: Bearer sk_staging_xxxxx" \
  -H "x-signature: $(echo -n '{"eventId":"test"...}' | openssl dgst -sha256 -hex -mac HMAC -macopt key:sk_staging_xxxxx | cut -d' ' -f2)" \
  -d '{"eventId":"test","eventType":"payment.created",...}'

# 3. 모니터링
- Webhook 수신 로그 확인
- DB에 데이터 저장 확인
- SMS 발송 확인
- 에러 율 모니터링

# 4. 부하 테스트
- 초당 100 이벤트 처리 테스트
- Peak time 시뮬레이션
```

### Phase 2: 프로덕션 배포 (1주)

```
1. 환경변수 변경 (staging → production)
2. 24시간 모니터링
3. 일일 리포트 (수신/처리/에러)
4. 이슈 대응 체계 구축
```

---

## 📝 10. 문서 체크리스트

**마비즈가 보유해야 할 문서:**

- [ ] 크루즈닷 공식 API 명세서 (PDF/Confluence)
- [ ] Webhook 이벤트 타입 정의 (최소 5가지)
- [ ] 필드 데이터 딕셔너리
- [ ] 에러 코드 매핑
- [ ] Rate Limit 및 SLA 정책
- [ ] 통합 테스트 결과 보고서
- [ ] 프로덕션 배포 체크리스트

---

**작성 완료: 2026-06-23**  
**최종 검토: 개발팀**  
**배포 예상일: 2026-07-07** (API 명세 수령 후 2주)
