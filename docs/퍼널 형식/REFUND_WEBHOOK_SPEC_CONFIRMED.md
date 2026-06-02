---
title: Refund Webhook 스펙 확정 (CRM팀 → 개발팀)
date: 2026-06-02
from: CRM팀
to: 개발팀
status: 확정
---

# Refund Webhook 스펙 확정

**발송일**: 2026-06-02  
**마감일**: 2026-06-03  
**상태**: ✅ 확정  

---

## 📋 답변 요약

**Q. Refund Webhook이 Purchase Webhook과 동일한가?**

**A. 부분적으로 동일하며, 차이점이 있습니다.**

---

## 1️⃣ 공통점 (Purchase와 동일)

| 항목 | 내용 |
|------|------|
| **엔드포인트** | POST /api/webhooks/refund |
| **인증** | Bearer Token + HMAC-SHA256 |
| **Secret** | CRUISEDOT_WEBHOOK_SECRET (재사용) |
| **헤더** | `Authorization: Bearer {SECRET}` |
| **서명** | `x-signature: HMAC-SHA256(body, SECRET)` |

---

## 2️⃣ 차이점 (Refund 고유)

### **Refund 필수 필드**

```json
{
  "eventId": "evt_refund_20260602_001",
  "eventType": "refund.requested",
  "timestamp": "2026-06-02T10:30:00Z",
  "bookingRef": "CZ-2026-001",
  "refundAmount": 1000000,
  "refundReason": "고객_요청",
  "status": "PENDING"
}
```

### **Refund 선택 필드**

```json
{
  "customerPhone": "01012345678",
  "customerEmail": "customer@example.com",
  "customerName": "홍길동",
  "departureDate": "2026-06-15",
  "organizationId": "org_xxx",
  "metadata": {
    "refundMethod": "카드",
    "bankName": "신한은행",
    "bankAccount": "110-123-456789"
  }
}
```

---

## 3️⃣ Refund 상태 (PENDING → COMPLETED)

```
상태 종류:
├─ PENDING (환불 요청됨, 승인 대기 중)
├─ APPROVED (환불 승인됨, 처리 중)
├─ COMPLETED (환불 완료)
└─ REJECTED (환불 거절)

상태 전이:
PENDING → APPROVED → COMPLETED
PENDING → REJECTED (불가)
APPROVED → COMPLETED 필수
REJECTED는 최종 상태 (역행 불가)
```

---

## 4️⃣ 정상/거절/중복 JSON 예제

### **정상 환불 (PENDING)**

```json
{
  "eventId": "evt_ref_20260602_001",
  "eventType": "refund.requested",
  "timestamp": "2026-06-02T10:30:00Z",
  "bookingRef": "CZ-2026-001",
  "refundAmount": 1000000,
  "refundReason": "고객_요청",
  "status": "PENDING",
  "customerPhone": "01012345678",
  "customerName": "홍길동",
  "departureDate": "2026-06-15"
}
```

### **상태 업데이트 (PENDING → APPROVED)**

```json
{
  "eventId": "evt_ref_20260602_001",
  "eventType": "refund.approved",
  "timestamp": "2026-06-02T11:00:00Z",
  "bookingRef": "CZ-2026-001",
  "refundAmount": 1000000,
  "refundReason": "고객_요청",
  "status": "APPROVED",
  "customerPhone": "01012345678",
  "customerName": "홍길동",
  "departureDate": "2026-06-15"
}
```

### **최종 완료 (APPROVED → COMPLETED)**

```json
{
  "eventId": "evt_ref_20260602_001",
  "eventType": "refund.completed",
  "timestamp": "2026-06-02T12:00:00Z",
  "bookingRef": "CZ-2026-001",
  "refundAmount": 1000000,
  "refundReason": "고객_요청",
  "status": "COMPLETED",
  "customerPhone": "01012345678",
  "customerName": "홍길동",
  "departureDate": "2026-06-15",
  "metadata": {
    "refundMethod": "카드",
    "processedAt": "2026-06-02T12:00:00Z"
  }
}
```

### **환불 거절 (PENDING → REJECTED)**

```json
{
  "eventId": "evt_ref_20260602_002",
  "eventType": "refund.rejected",
  "timestamp": "2026-06-02T10:45:00Z",
  "bookingRef": "CZ-2026-002",
  "refundAmount": 500000,
  "refundReason": "정책_위반",
  "status": "REJECTED",
  "customerPhone": "01098765432",
  "customerName": "김철수",
  "metadata": {
    "rejectionReason": "출발 1일 전 취소 불가",
    "rejectedAt": "2026-06-02T10:45:00Z"
  }
}
```

### **중복 요청 (같은 eventId 재도착)**

```json
{
  "eventId": "evt_ref_20260602_001",
  "eventType": "refund.requested",
  "timestamp": "2026-06-02T10:30:00Z",
  "bookingRef": "CZ-2026-001",
  "refundAmount": 1000000,
  "refundReason": "고객_요청",
  "status": "PENDING",
  "customerPhone": "01012345678",
  "customerName": "홍길동",
  "departureDate": "2026-06-15"
}
// 같은 eventId가 재도착 → CRM에서 중복 처리
```

---

## 5️⃣ 멱등성 & 타이밍

| 항목 | 내용 |
|------|------|
| **eventId** | 고유 (재도착 시 중복 처리) |
| **중복 처리** | eventId 중복 감지 → 상태 업데이트만 수행 |
| **재시도** | 최대 5회 (지수 백오프: 1s, 2s, 4s, 8s, 16s) |
| **타이밍** | 요청 후 1-2시간 내 첫 번째 webhook 도착 |
| **상태 완료까지** | 요청 → 승인 → 완료: 2-3시간 소요 |

---

## 6️⃣ 환불 금액 & 정책

| 항목 | 내용 |
|------|------|
| **refundAmount** | 확정된 금액 (CRM에서 재계산 불필요) |
| **환불 정책** | 크루즈닷에서 계산해서 전송 (법정 기준 적용) |
| **부분 환불** | 같은 bookingRef에 여러 번 가능 |
| **예**: 100만원 중 50만원 → 나머지 50만원 | 2개 eventId (evt_xxx_001, evt_xxx_002) |

---

## 7️⃣ 고객 정보 필드

| 필드 | 필수 | 설명 |
|------|------|------|
| **customerPhone** | ✅ | Contact 식별용 |
| **customerEmail** | ⭐ | 선택 (있으면 더 정확) |
| **customerName** | ⭐ | 선택 (확인용) |
| **organizationId** | ❌ | 선택 (테넌트 구분용) |

**주의**: customerPhone이 없으면 Contact를 찾을 수 없음. 이 경우 Payment 레벨에서만 처리.

---

## 8️⃣ 테스트 환경

| 환경 | Secret | URL | 상태 |
|------|--------|-----|------|
| **Staging** | CRUISEDOT_WEBHOOK_SECRET_STAGING | /api/webhooks/cruisedot-refund | ✅ |
| **Production** | CRUISEDOT_WEBHOOK_SECRET | /api/webhooks/cruisedot-refund | ✅ |

테스트 시: Staging Secret으로 가짜 이벤트 발송 가능.

---

## ✅ CRM팀 확인사항

- [x] Bearer Token + HMAC-SHA256 (Purchase와 동일)
- [x] WEBHOOK_SECRET 재사용 가능
- [x] eventId 멱등성 필수
- [x] 상태 전이: PENDING → APPROVED → COMPLETED
- [x] REJECTED는 최종 상태
- [x] customerPhone 필수 (Contact 매핑용)
- [x] 부분 환불 가능
- [x] 환불액은 확정금액 (CRM 재계산 불필요)

---

## 🚀 개발팀 다음 단계

```
1. Webhook 엔드포인트 완성 (✅ 이미 작성)
2. 상태 전이 로직 구현
3. Contact 자동 업데이트
4. 멱등성 테스트
5. Staging에서 실제 Webhook 테스트
```

---

**마감**: 2026-06-03 09:00  
**구현 예상**: 2026-06-03~04 (1-2일)  
**배포**: 2026-06-05

