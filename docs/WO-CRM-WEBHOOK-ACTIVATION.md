# 작업지시서: mabiz CRM 웹훅 3개 활성화

**발행일:** 2026-05-11  
**발행처:** 크루즈닷몰 개발팀  
**수신처:** mabiz CRM 개발팀  
**우선순위:** Medium (코드 완성 — 환경변수만 필요)

---

## 배경

크루즈닷몰(`lib/mabiz-sync.ts`)에는 아래 3개 웹훅 함수가 이미 완전히 구현되어 있습니다.  
**CRM 쪽 수신 엔드포인트 URL + Secret을 제공해 주시면, 크루즈닷몰 Vercel 환경변수에 추가하는 것만으로 즉시 활성화**됩니다.

현재 상태: 환경변수가 없어 `logger.warn` 후 skip (오류 없이 조용히 건너뜀).

---

## 요청 사항 3건

### ① 리드 상태 변경 알림 (LeadStatus)

**트리거 조건:**  
관리자가 어드민 패널에서 리드 상태를 변경할 때  
(`IN_PROGRESS` / `CLOSED` / `TEST_GUIDE` 상태만 전송 — `PURCHASED` / `REFUNDED`는 기존 purchase/refund 웹훅으로 별도 처리)

**발송 시점 코드:**
```
app/api/admin/affiliate/leads/[leadId]/status/route.ts:184
```

**크루즈닷몰 → CRM으로 전송되는 Payload:**
```json
{
  "leadId": 123,
  "status": "IN_PROGRESS",
  "previousStatus": "NEW",
  "customerName": "홍길동",
  "affiliateCode": "AB01",
  "changedAt": "2026-05-11T10:00:00.000Z",
  "eventId": "uuid-v4-중복방지용"
}
```

**필요한 환경변수 (크루즈닷몰 Vercel에 추가할 값):**
```
MABIZ_LEAD_STATUS_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/gmcruise/lead-status
MABIZ_LEAD_STATUS_WEBHOOK_SECRET=CRM팀이_발급하는_시크릿값
```

---

### ② 여권 확인 완료 알림 (PassportApproved)

**트리거 조건:**  
관리자가 여권 확인을 완료(COMPLETED) 처리할 때

**발송 시점 코드:**
```
app/api/admin/affiliate/sales-confirmation/passport/route.ts:137
```

**크루즈닷몰 → CRM으로 전송되는 Payload:**
```json
{
  "reservationId": 456,
  "affiliateCode": "AB01",
  "completedAt": "2026-05-11T10:00:00.000Z",
  "eventId": "uuid-v4-중복방지용"
}
```

**필요한 환경변수:**
```
MABIZ_PASSPORT_APPROVED_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/gmcruise/passport-approved
MABIZ_PASSPORT_APPROVED_WEBHOOK_SECRET=CRM팀이_발급하는_시크릿값
```

---

### ③ 결제 실패 알림 (PaymentFailure)

**트리거 조건:**  
PG(웰컴페이먼츠) 결제 실패 콜백 수신 시

**발송 시점 코드:**
```
app/api/payment/webhook/route.ts:104
```

**크루즈닷몰 → CRM으로 전송되는 Payload:**
```json
{
  "orderId": "ORDER-20260511-001",
  "amount": 3500000,
  "reason": "잔액 부족",
  "customerName": "홍길동",
  "customerPhone": "010-****-5678",
  "affiliateCode": "AB01",
  "failedAt": "2026-05-11T10:00:00.000Z",
  "eventId": "uuid-v4-중복방지용"
}
```

> ⚠️ `customerPhone`은 개인정보 보호를 위해 `010-****-XXXX` 형식으로 마스킹되어 전송됩니다.

**필요한 환경변수:**
```
MABIZ_PAYMENT_FAILURE_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/gmcruise/payment-failure
MABIZ_PAYMENT_FAILURE_WEBHOOK_SECRET=CRM팀이_발급하는_시크릿값
```

---

## 인증 방식 (기존 웹훅과 동일)

```
POST {웹훅URL}
Content-Type: application/json
Authorization: Bearer {SECRET값}
```

- 기존 purchase / refund / inquiry 웹훅과 **완전히 동일한 방식**
- `eventId` (UUID v4) 필드가 포함되어 있어 CRM 측에서 중복 수신 방지 가능

---

## 재시도 & 장애 처리 (크루즈닷몰 구현 완료)

| 항목 | 내용 |
|------|------|
| 타임아웃 | 5초 |
| 재시도 | 최초 1회 시도, 실패 시 DLQ 적재 |
| DLQ 복구 | `MabizSyncDLQ` 테이블 → 5분 후 자동 재시도 크론 |
| 실패 영향 | fire-and-forget — 크루즈닷몰 메인 플로우에 영향 없음 |

---

## CRM 팀 체크리스트

- [ ] ① 리드 상태 웹훅 수신 엔드포인트 생성 + URL / Secret 전달
- [ ] ② 여권 완료 웹훅 수신 엔드포인트 생성 + URL / Secret 전달
- [ ] ③ 결제 실패 웹훅 수신 엔드포인트 생성 + URL / Secret 전달
- [ ] URL은 반드시 `https://mabizcruisedot.com` 도메인이어야 함 (다른 도메인은 보안 차단)

---

## 크루즈닷몰 팀 체크리스트 (CRM에서 값 받은 후)

- [ ] Vercel 대시보드 → Settings → Environment Variables에 6개 값 추가
- [ ] Vercel 재배포 (자동 트리거)
- [ ] 관리자 패널에서 리드 상태 변경 → CRM 수신 확인

---

*문의: 크루즈닷몰 개발팀*
