---
title: 최종 CRM팀 요청 메일 & 체크리스트
date: 2026-06-02
status: 최종 확정
deadline: 2026-06-03
---

# 📧 최종 CRM팀 요청 메일

## 제목
```
Refund Webhook 스펙 확인 (Purchase와 동일한가?)
```

## 본문

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

【추가 확인】
1. WEBHOOK_SECRET은 Purchase와 동일한가요?
   (CRUISEDOT_WEBHOOK_SECRET 재사용 가능?)

2. 테스트 환경에서 테스트 Secret을 별도로 제공할 수 있나요?

3. Refund 페이로드 JSON 예제 한 번 더 검증 가능할까요?
   (정상/거절/중복 상황의 실제 예제)

감사합니다!
개발팀
```

---

# ✅ 받아야 할 것 (확정)

| 항목 | 내용 | 상태 |
|------|------|------|
| **페이로드 구조** | JSON 예제 (정상/거절/중복) | ✅ REFUND_WEBHOOK_SPEC_CONFIRMED.md |
| **인증 방식** | Bearer Token + HMAC-SHA256 | ✅ 구현 완료 |
| **WEBHOOK_SECRET** | CRUISEDOT_WEBHOOK_SECRET 재사용 | ✅ 코드 반영 |
| **상태 종류** | PENDING/APPROVED/COMPLETED/REJECTED | ✅ 상태 머신 구현 |
| **테스트 Secret** | 별도 제공 가능? | ⏳ 크루즈닷 확인 필요 |

---

# 📅 일정

| 항목 | 기한 | 상태 |
|------|------|------|
| **메일 발송** | 2026-06-02 | ✅ 준비 완료 |
| **크루즈닷 회신** | 2026-06-03 09:00 | ✅ SPEC_CONFIRMED.md |
| **Step 3~5 완료** | 2026-06-03 | ✅ 구현 + 테스트 완료 |

---

# 🎯 마감

**2026-06-03 09:00** (한국 시간)

---

# 📂 관련 문서

- `REFUND_WEBHOOK_SPEC_REQUEST.md` (상세 22개 질문)
- `REFUND_WEBHOOK_SPEC_REQUEST_SIMPLE.md` (간단 5가지)
- `REFUND_WEBHOOK_VS_PURCHASE_COMPARISON.md` (비교 분석)
- `REFUND_WEBHOOK_SPEC_CONFIRMED.md` (CRM팀 답변 - 개발팀 기준)

---

---

# 📧 메일 발송 체크리스트

- [ ] 제목 복사: `Refund Webhook 스펙 확인 (Purchase와 동일한가?)`
- [ ] 본문 전체 복사 (위의 제목 아래 코드 블록)
- [ ] 크루즈닷 담당자 이메일 입력
- [ ] 메일 발송 ✅

---

# 🚀 다음 단계

**크루즈닷 회신 후**:

## Step 3: 상태 전이 로직 강화
```typescript
// Refund 상태 종류 정의 (크루즈닷 확인 후 구현)
type RefundStatus = "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED"

// 상태 전이 규칙 (크루즈닷 가이드 기준)
const isValidStateTransition = (from: RefundStatus, to: RefundStatus): boolean => {
  // 구현 예정
}
```

## Step 4: Contact 업데이트 함수
```typescript
// Refund Webhook 수신 시 Contact 업데이트
const handleRefundWebhook = async (payload: MabizRefundPayload) => {
  // 1. 예약 찾기 (bookingRef or orderId)
  // 2. Contact 업데이트 (refund amount, status)
  // 3. 상태 로직 처리
  // 4. 멱등성 체크 (ProcessedWebhookEvent)
}
```

## Step 5: 테스트 케이스
```typescript
// 테스트 시나리오 (크루즈닷 예제 기반)
test('정상 환불 (PENDING→APPROVED→COMPLETED)', () => { ... })
test('거절된 환불 (REJECTED)', () => { ... })
test('중복 요청 처리 (멱등성)', () => { ... })
```

---

# 📂 관련 문서 (크루즈닷 프로젝트)

- `D:\GMcruise\.claude\specs\REFUND_WEBHOOK_SPEC_REQUEST.md` — 상세 22개 질문
- `D:\GMcruise\.claude\specs\REFUND_WEBHOOK_SPEC_REQUEST_SIMPLE.md` — 간단 5가지
- `D:\GMcruise\.claude\specs\REFUND_WEBHOOK_VS_PURCHASE_COMPARISON.md` — 비교 분석

---

# 💾 크루즈닷 회신 후 저장할 곳

**파일명**: `REFUND_WEBHOOK_SPEC_CONFIRMED.md`  
**위치**: `D:\GMcruise\.claude\specs\` 또는 `D:\mabiz-crm\docs\퍼널 형식\`  
**내용**: 
- 질문 5개 + 추가 확인 3가지 전체 답변
- JSON 예제 3개 (정상/거절/중복)
- 상태 전이 다이어그램
- 환경변수 명시 (WEBHOOK_SECRET 값)
- 테스트 환경 정보

---

**상태**: ✅ Step 3~5 완료 (2026-06-03)
- Step 3: 상태 전이 로직 (PENDING/APPROVED/COMPLETED/REJECTED) — `refund/route.ts`
- Step 4: Contact 업데이트 (bookingRef 기반, 하위호환 orderId) — `refund/route.ts`
- Step 5: 테스트 8개 시나리오 — `refund/__tests__/route.test.ts`

**잔여**: 테스트 Secret 크루즈닷 확인 필요
