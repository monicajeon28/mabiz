---
title: Refund Webhook 스펙 요청 (간단 버전)
date: 2026-06-02
to: CRM 팀 담당자
deadline: 2026-06-03
status: 대기 중
---

# 📞 Refund Webhook 스펙 요청 (간단 버전)

**발송 대상**: CRM 팀 담당자  
**마감**: 2026-06-03  
**프로젝트**: 크루즈닷몰 Refund Webhook 구현  

---

## 🎯 물어볼 핵심 5가지

### 1️⃣ Webhook 페이로드는 뭘 보내나?

**받아올 것**: 실제 JSON 예제

예상 형식:
```json
{
  "eventId": "abc123",
  "bookingRef": "CZ-2026-001",
  "refundAmount": 1000000,
  "refundReason": "고객 요청",
  "status": "PENDING",
  "timestamp": "2026-06-02T10:30:00Z",
  ...
}
```

**질문**:
- 이 구조가 맞나?
- 추가 필드가 있나? (customerPhone, customerEmail, organizationId 등)
- 환불 금액은 `정수(원)`인가 `소수(원.센트)`인가?

---

### 2️⃣ 인증은 어떻게?

**받아올 것**: 인증 방식 명시

**질문**:
- Settlement Webhook과 동일한가? (Bearer Token + HMAC-SHA256?)
- 아니면 다른 방식?
- Webhook Secret 값은?
- 헤더명은? (`Authorization`, `x-signature`, 등)

**예상 답변 형식**:
```
인증 방식: Bearer Token + HMAC-SHA256
WEBHOOK_SECRET: (값 알려줄 것)
Bearer Token: (값 알려줄 것)
서명 헤더: x-signature
서명 방식: HMAC-SHA256(body, WEBHOOK_SECRET)
```

---

### 3️⃣ Refund 상태는 몇 가지?

**받아올 것**: 상태 종류 + 상태 변이 다이어그램

**질문**:
- PENDING? APPROVED? COMPLETED? REJECTED? 등
- 상태는 어떤 순서로 변하나?

**예상 답변 형식**:
```
상태 종류:
- PENDING: 환불 요청됨
- APPROVED: 환불 승인됨
- COMPLETED: 환불 완료
- REJECTED: 환불 거절

상태 순서:
PENDING → APPROVED → COMPLETED
PENDING → REJECTED (막다른 길)
```

---

### 4️⃣ 예약은 어떻게 찾나?

**받아올 것**: 예약 식별 방법

**질문**:
- 어떤 필드로 예약을 찾나? (bookingRef? orderId? customerId?)
- 크루즈닷 Payment 테이블의 `orderId`와 연결되나?
- 고객 정보는? (phone, email, name)

**예상 답변 형식**:
```
예약 식별 필드: bookingRef (또는 orderId)
CRM의 Contact는 어떻게 찾나: 
  - customerPhone으로?
  - customerEmail으로?
  - 또 다른 필드?

고객 필드 필수 여부:
  - customerPhone: (필수/선택)
  - customerEmail: (필수/선택)
  - customerName: (필수/선택)

조직 정보:
  - organizationId 포함? (필수?)
  - partnerId/affiliateId 포함?
```

---

### 5️⃣ 테스트는?

**받아올 것**: 테스트용 정보 + 예제

**질문**:
- 테스트 Secret은?
- 정상/거절/중복 상황의 JSON 예제 3개

**예상 답변 형식**:
```
테스트 환경:
  - 테스트 Secret: (값)
  - Webhook URL: (URL)
  - Staging/Production 구분?

예제 1. 정상 환불
{
  "eventId": "evt-test-001",
  "status": "PENDING",
  ...
}

예제 2. 거절된 환불
{
  "eventId": "evt-test-002",
  "status": "REJECTED",
  ...
}

예제 3. 중복 요청 (같은 eventId)
{
  "eventId": "evt-test-001",  // 같음
  ...
}
```

---

## ✅ 받아야 할 것 체크리스트

- [ ] 정상 환불 JSON 예제
- [ ] 거절된 환불 JSON 예제
- [ ] 중복 요청 JSON 예제
- [ ] 인증 방식 (Bearer Token? HMAC-SHA256?)
- [ ] WEBHOOK_SECRET 값
- [ ] 상태 종류 (PENDING, APPROVED, COMPLETED, REJECTED, ...)
- [ ] 상태 순서 (상태 전이 다이어그램)
- [ ] 예약 식별 필드명 (bookingRef? orderId?)
- [ ] 고객 매핑 방법 (phone? email?)
- [ ] 조직 정보 (organizationId 포함?)

---

## 📧 CRM팀에 보낼 메일 본문

```
제목: [긴급] Refund Webhook 스펙 요청 — 2026-06-03까지

안녕하세요,

크루즈닷몰에서 Refund Webhook을 구현하려고 합니다.
다음 정보를 2026-06-03까지 주실 수 있을까요?

📋 필수 정보:

1. Webhook 페이로드 JSON 예제
   - 정상 상황 1개
   - 거절 상황 1개
   - 중복 요청 상황 1개

2. 인증 방식
   - Settlement과 동일한가? (Bearer Token + HMAC-SHA256?)
   - WEBHOOK_SECRET 값은?
   - 헤더명은?

3. Refund 상태
   - 가능한 상태 종류는? (PENDING, APPROVED, COMPLETED, REJECTED, ...)
   - 상태 순서는? (어떻게 변하는가?)

4. 예약 매핑
   - 어떤 필드로 예약을 찾나? (bookingRef? orderId?)
   - 고객 정보 필드 (phone? email? name?) — 어떤 필드는 필수?
   - organizationId 포함?

5. 기타
   - 환불 금액은 정수(원)? 소수?
   - 부분 환불(여러 번) 가능?
   - 고객이 없으면 어떻게 처리? (Contact 자동 생성?)

감사합니다!
크루즈닷몰 개발팀
```

---

## 🔗 참고

- **상세 버전**: `REFUND_WEBHOOK_SPEC_REQUEST.md` (22개 질문)
- **마감**: 2026-06-03 09:00
- **구현 계획**: Wave 3 Phase A (2026-06-03~04)

---

**주의**: 답변이 없으면 Settlement Webhook 스펙 기반으로 임시 구현을 시작합니다.
