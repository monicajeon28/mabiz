# 크루즈닷몰 Webhook 통합 요청

**발송 대상**: 크루즈닷몰 기술팀  
**발송 일시**: 2026-05-29  
**목적**: mabiz CRM 연동을 위한 Webhook 엔드포인트 통합

---

## 📋 요청 내용

mabiz CRM에서 크루즈닷몰 데이터를 실시간으로 수신하고 자동으로 처리하기 위해 다음 2개 Webhook 엔드포인트를 통합 요청합니다.

### 1️⃣ Payment Confirmed Webhook
**목적**: 결제 완료 → Contact 자동생성 → Day 0 SMS 발송 자동화

```
POST https://mabiz.co.kr/api/webhook/crm/customer-created
Authorization: Bearer {WEBHOOK_SECRET}
X-Webhook-Signature: {HMAC-SHA256(body, WEBHOOK_SECRET)}

{
  "event": "payment_confirmed",
  "orderNo": "ORD-20260529-001",
  "customerId": "cus-12345",
  "customerName": "김철수",
  "customerPhone": "01012345678",
  "customerEmail": "kim@example.com",
  "tourPackage": "크루즈 일본 5박 6일",
  "tourDate": "2026-07-15",
  "ticketAmount": 3500000,
  "affiliateId": "aff-001",  // 파트너 ID (있으면)
  "timestamp": "2026-05-29T10:30:00Z"
}
```

**응답**: 
```json
{
  "ok": true,
  "contactId": "con-xyz789",
  "smsScheduled": true,
  "day0SmsSent": true
}
```

---

### 2️⃣ Settlement Updated Webhook
**목적**: 정산 데이터 → Commission 자동계산 → Partner 알림

```
POST https://mabiz.co.kr/api/webhook/crm/settlement-updated
Authorization: Bearer {WEBHOOK_SECRET}
X-Webhook-Signature: {HMAC-SHA256(body, WEBHOOK_SECRET)}

{
  "event": "settlement_updated",
  "settlementId": "SET-20260529-001",
  "affiliateId": "aff-001",
  "periodStart": "2026-05-01",
  "periodEnd": "2026-05-31",
  "tourCount": 12,
  "totalRevenue": 42000000,
  "commission": 6300000,  // 15% 수수료
  "status": "CONFIRMED",
  "timestamp": "2026-05-29T09:00:00Z"
}
```

**응답**:
```json
{
  "ok": true,
  "commissionId": "comm-abc123",
  "partnerNotified": true
}
```

---

## 🔐 보안 요구사항

### Bearer Token 인증
```
Authorization: Bearer {WEBHOOK_SECRET}
```
- WEBHOOK_SECRET은 32자 이상의 secure random string
- 예: `{32자 이상 무작위 문자열}`

### HMAC-SHA256 서명 검증
```
X-Webhook-Signature: {HMAC-SHA256(JSON_BODY, WEBHOOK_SECRET, 'hex')}
```
- 요청 본문 전체를 WEBHOOK_SECRET으로 서명
- 최소 16자 이상의 hex 문자열
- mabiz에서 자동 검증

---

## 📊 예상 효과

| 지표 | 현재 | 목표 | 증대 |
|------|------|------|------|
| **자동화율** | 0% | 95% | +95% |
| **수동 작업** | 월 480시간 | 월 24시간 | -95% |
| **Contact 생성 시간** | 24시간 | <30초 | **2,880배 단축** |
| **오류율** | 월 3-5건 | 0건 | 100% 감소 |
| **월 매출 효과** | - | +$76K-152K | **한화 1-2억 원** |

---

## 🚀 배포 일정

- **2026-05-29**: 요청 전달
- **2026-06-01**: Webhook 스팩 최종 확인
- **2026-06-05**: 테스트 환경 연동
- **2026-06-12**: 운영 환경 배포

---

## 📞 기술 담당자

**mabiz CRM 팀**
- 이메일: tech@mabiz.co.kr
- 카톡: mabiz CRM 기술팀
- 긴급: 010-0000-0000

---

## 참고

### Webhook 테스트 엔드포인트
```bash
# Bearer token 검증 테스트
curl -X GET "https://mabiz.co.kr/api/webhooks/stats" \
  -H "Authorization: Bearer {WEBHOOK_SECRET}"

# 응답: { "ok": true, "totalWebhooks": 1234, "lastSync": "2026-05-29T10:30:00Z" }
```

### Retry 정책
- 실패 시 5분 후 자동 재시도
- 최대 3회 재시도 (총 15분)
- 재시도 실패 시 관리자 알림

### 로그 보존
- 모든 Webhook 요청/응답 30일 보존
- 관리자 대시보드에서 실시간 모니터링 가능

---

**문서 생성**: 2026-05-29  
**상태**: 발송 준비 완료 ✅
