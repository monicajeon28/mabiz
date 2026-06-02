---
title: Refund Webhook vs Purchase Webhook 비교 체크리스트
date: 2026-06-02
to: CRM 팀
deadline: 2026-06-03
status: 대기 중
---

# Refund Webhook vs Purchase Webhook 비교

**핵심**: CRM팀에 "둘이 동일한가 다른가?"만 물으면 됨

---

## 📊 현재 상태

| Webhook | URL | 인증 | 페이로드 | 구현 |
|---------|-----|------|---------|------|
| **Purchase** | `/api/webhooks/purchase` | ✅ Bearer Token | ✅ 정의됨 | ✅ 완료 |
| **Refund** | `/api/webhooks/refund` | ❓ Bearer Token? | ❓ 미정의 | ❌ 미구현 |

---

## 🔍 Purchase Webhook 스펙 (이미 있는 것)

```
엔드포인트: POST /api/webhooks/purchase
인증: Authorization: Bearer {MABIZ_PURCHASE_WEBHOOK_SECRET}

페이로드 필드:
- phone (필수) — 고객 전화번호
- name (필수) — 고객명
- saleAmount (필수) — 판매가
- orderId (필수) — 주문번호 (merchant_uid)
- affiliateCode (필수) — 어필리에이트 코드
- productName (권장) — 상품명
- eventId (권장) — 이벤트 ID (UUID)
- departureDate (선택) — 출발일
- customerEmail (선택) — 고객 이메일
- commissionRate (선택) — 수수료율
- commissionAmount (선택) — 수수료
- productCode (선택) — 상품코드
- headcount (선택) — 인원수
```

---

## ❓ Refund Webhook 스펙 (CRM팀에서 확인 필요)

```
엔드포인트: POST /api/webhooks/refund
인증: ??? (Purchase와 동일한 Bearer Token?)

페이로드 필드:
- ??? (Purchase와 비슷한가?)
  - refundAmount?
  - refundReason?
  - status? (PENDING/APPROVED/COMPLETED/REJECTED?)
  - bookingRef? orderId?
  - ...
```

---

## 📧 CRM팀에 보낼 메일

**제목**: Refund Webhook 스펙 확인 (Purchase와 동일한가?)

```
안녕하세요,

Refund Webhook을 구현하려고 합니다.

Refund Webhook이 Purchase Webhook과 스펙이 동일한가요?

【Purchase Webhook 스펙 (이미 구현 완료)】
- URL: POST /api/webhooks/purchase
- 인증: Authorization: Bearer {MABIZ_PURCHASE_WEBHOOK_SECRET}
- 필드: phone, name, saleAmount, orderId, affiliateCode, 
        productName, eventId, departureDate, customerEmail ...

【Refund Webhook은?】
- URL: /api/webhooks/refund는 맞나요?
- 인증도 Bearer Token?
- WEBHOOK_SECRET은 동일한가요?
- 페이로드 필드는? (JSON 예제 필수)
- 상태 종류는? (PENDING→APPROVED→COMPLETED?)

감사합니다!
```

---

## ✅ 받아야 할 것 (최소)

- [ ] Refund 페이로드 구조 (JSON 예제)
- [ ] 인증 방식 확인 (Bearer Token 맞나?)
- [ ] WEBHOOK_SECRET 값
- [ ] Refund 상태 종류 (PENDING/APPROVED/COMPLETED/REJECTED?)

---

## 🎯 CRM팀 답변 후 진행

**답변 1**: "Refund도 Purchase와 동일"
```
→ Purchase 코드 복사 + 필드만 수정 → 30분 완료
```

**답변 2**: "Refund는 Purchase와 다름"
```
→ CRM팀이 제시한 페이로드 기반 새로 구현 → 2시간
```

---

**마감**: 2026-06-03 09:00
