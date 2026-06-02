---
title: Refund Webhook 스펙 명시 요청 - 상세 버전
date: 2026-06-02
to: CRM 팀
deadline: 2026-06-03
status: 대기 중
version: 상세 버전 (22개 질문)
usage: 보관/참고용 문서
simple_version: REFUND_WEBHOOK_SPEC_REQUEST_SIMPLE.md (CRM팀 이메일용)
---

# Refund Webhook 스펙 명시 요청

**발송일**: 2026-06-02  
**마감일**: 2026-06-03 (Wave 3 개발 시작 전)  
**프로젝트**: 크루즈닷몰 × CRM 통합 — Refund Webhook Phase

---

## 📋 개요

크루즈닷몰에서 CRM의 Refund Webhook을 받기 위해 다음 항목들을 **정확하게** 명시해주시면 감사하겠습니다.

Settlement Webhook 스펙은 이미 받았으므로, Refund Webhook이 동일한 방식인지 다른지도 명시해주세요.

---

## 1️⃣ Webhook 페이로드 구조

### Q1. Refund Webhook 페이로드의 전체 필드 목록
필수 정보:
- 모든 필드명 리스트업
- 예: eventId, bookingRef, refundAmount, refundReason, status, timestamp 등
- 문서 또는 **JSON 예제** 필수

### Q2. 각 필드의 데이터 타입과 필수 여부
형식:
```
- fieldName: Type (필수/선택) - 설명
  - eventId: String (필수) - UUID 형식?
  - refundAmount: Number (필수) - 정수(원)인지 소수인지?
  - status: String (필수) - 가능한 값들은?
  - ...
```

### Q3. 예약 식별자 정보
질문:
- 예약을 식별하는 필드명은? (bookingRef? orderId? customerId?)
- 여러 개면 모두 리스트업
- 크루즈닷 Payment 테이블의 orderId와의 관계는?

---

## 2️⃣ 인증 & 서명 방식

### Q4. Webhook 인증 방식
질문:
- Settlement Webhook과 동일한가? (Bearer Token + HMAC-SHA256)
- 아니면 다른 방식?
- 헤더명은? ("Authorization"? "x-api-key"? "x-signature"?)

**Settlement 기준** (참고):
```
Authorization: Bearer <TOKEN>
x-signature: HMAC-SHA256(body, WEBHOOK_SECRET)
```

### Q5. HMAC-SHA256 서명 규칙 (있는 경우)
명시 필요:
- Request body 전체를 서명하나? 특정 필드만?
- 필드 정렬 순서 (알파벳 순? 원래 순서?)
- 예: `HMAC-SHA256(JSON.stringify(body), WEBHOOK_SECRET)` = `x-signature` 헤더?

### Q6. WEBHOOK_SECRET
질문:
- WEBHOOK_SECRET 값은 어디서 받나?
- 환경변수명: `CRUISEDOT_WEBHOOK_SECRET_REFUND`?
- Settlement과 동일한 SECRET을 재사용?

---

## 3️⃣ 상태 & 비즈니스 로직

### Q7. Refund 상태 종류와 정의
명시 필요:
- 가능한 모든 상태값 (예: PENDING, APPROVED, COMPLETED, REJECTED, CANCELLED 등)
- 각 상태의 정확한 정의

**예시**:
```json
{
  "PENDING": "환불 요청됨, 승인 대기 중",
  "APPROVED": "환불 승인됨, 처리 대기 중",
  "COMPLETED": "환불 완료",
  "REJECTED": "환불 거절됨",
  "CANCELLED": "환불 취소됨"
}
```

### Q8. 상태 전이 규칙
상태 다이어그램 필수:
```
예:
PENDING → APPROVED → COMPLETED
PENDING → REJECTED (불가)
APPROVED → PENDING (역행 가능?)
```

### Q9. 환불 정책 정보
질문:
- 크루즈닷이 환불정책 계산해서 넘기나? 아니면 CRM에서?
- 출발일(departureDate) 정보 포함?
- 환불정책 근거 정보(법정/상품별) 포함?

### Q10. 부분 환불 (Partial Refund)
질문:
- 같은 bookingRef에 대해 여러 번 부분 환불 가능?
  - 예: 100만원 중 50만원 → 나머지 50만원 (2회 가능?)
- 부분 환불 시 paymentId가 여러 개? 하나?

---

## 4️⃣ 예약 & 고객 매핑

### Q11. 예약 식별 방법
질문:
- bookingRef는 크루즈닷에서 제공했나? CRM에서 생성했나?
- Payment의 orderId와 bookingRef의 관계는?
- 하나의 예약 → 여러 Payment 가능? (항공/크루즈 등 분리 결제)

### Q12. 고객 정보
질문:
- Webhook 페이로드에 포함된 고객 필드:
  - customerPhone (필수?)
  - customerEmail (필수?)
  - customerName (필수?)
- 고객을 찾을 수 없으면? (Contact 없는 Payment 환불)
  - CRM에서 자동 생성? 스킵? 에러?

### Q13. 조직 정보 (organizationId)
질문:
- Webhook 페이로드에 organizationId 포함?
- partnerId? affiliateId?
- 크루즈닷의 어느 조직(대리점)에 대한 환불인지 명시?

---

## 5️⃣ 중복 처리 & 재시도

### Q14. 멱등성 (Idempotence)
질문:
- eventId가 고유한가? (한 번의 Webhook = 하나의 eventId)
- 같은 eventId가 재도착하면?
  - 상태 업데이트 가능? (PENDING → APPROVED)
  - 스킵? 에러?
- 멱등성 Key는?

### Q15. 재시도 정책
질문:
- CRM이 Webhook을 보냈는데 크루즈닷 응답이 없으면?
  - 몇 번 재시도?
  - 재시도 간격은? (1초? 1분? 지수 백오프?)
  - 최대 재시도 횟수는?

---

## 6️⃣ 테스트 & 배포

### Q16. 테스트 환경
질문:
- Staging/Production 분리?
- 테스트용 Webhook Secret 별도 제공?
- 테스트 Webhook URL은?
- 테스트 환경에서 가짜 eventId? 실제 예약?

### Q17. 예제 페이로드
정확한 JSON 예제 필수:

**시나리오 1: 정상 환불 (PENDING → APPROVED → COMPLETED)**
```json
{
  "eventType": "refund.created",
  "eventId": "evt_xxxx",
  "status": "PENDING",
  ...
}
```

**시나리오 2: 환불 거절 (REJECTED)**
```json
{
  ...
}
```

**시나리오 3: 중복 요청**
```json
{
  ...
}
```

각각 실제 JSON 형식 제공 필수.

### Q18. 배포 프로세스
질문:
- CRM이 Webhook 엔드포인트 변경 시 크루즈닷에 통보?
- Staging → Production 배포 순서?
- Go-live 전 실제 Webhook 테스트 필수? (테스트 주문으로?)

---

## 7️⃣ 기타

### Q19. 환불 금액 성격
질문:
- refundAmount는 **확정된 금액**인가? (정책 적용 후)
- 아니면 **요청금액**인가? (CRM에서 검증/조정 가능?)

### Q20. 메타데이터
질문:
- 추가 필드 필요? (refundReason, memo, bankInfo 등)
- 문자 제한? (max length)

### Q21. 타이밍
질문:
- 결제 후 언제쯤 환불 Webhook이 올까?
- 고객 요청 → 승인 → 완료까지 예상 시간?

### Q22. SLA (Service Level Agreement)
질문:
- Webhook 도달 보장 수준?
- 장애 시 대체 방법은? (Polling API? 배치 조회?)

---

## 📋 회신 형식

다음 양식으로 답변해주세요:

```markdown
# CRM → 크루즈닷 Refund Webhook 스펙 (2026-06-02)

## 1️⃣ Webhook 페이로드 구조
### Q1. 전체 필드 목록
[답변]

### Q2. 데이터 타입 & 필수 여부
[답변]

... (이하 동일)
```

---

## 🔗 참고 문서

- Settlement Webhook 스펙: `PAYAPI_CANCEL_REFUND_COMPLETE_ANALYSIS.md`
- mabiz Webhook 스펙: `PROJECT_MABIZ_WEBHOOK_SPECS.md`

---

## ✉️ 회신 대상

- **이메일**: [CRM 팀 이메일]
- **슬랙**: [CRM 팀 채널]
- **마감**: 2026-06-03 09:00

---

**주의**: 이 문서는 Wave 3 개발 시작 전에 답변이 필수입니다. 2026-06-03까지 답변이 없으면 Settlement 스펙 기반으로 임시 구현을 시작하겠습니다.
