---
name: cruisedot-implementation-plan
description: 크루즈닷몰 팀의 웹훅 구현 계획 (CRM팀에 공유할 스펙 포함)
metadata: 
  node_type: memory
  type: project
  date: 2026-05-21
  originSessionId: 92ed4dce-c779-46f7-8054-6f71d034f48b
---

# 크루즈닷몰: 결제상태 동기화 웹훅 구현 계획

**팀:** 크루즈닷몰 개발팀  
**목표:** Reservation 결제상태 변경 → CRM PNR 페이지 실시간 표시  
**방식:** 웹훅 (10렌즈 분석으로 만장일치 추천)  
**기간:** 1주일 (Phase 1-3)

---

## 🎯 우리(크루즈닷몰)가 만든 것

### 10렌즈 분석 결과
```
🔒 보안 → 웹훅 추천 (접근 제어 최소화)
🐛 버그 → 웹훅 추천 (멱등성 처리 가능)
📊 성능 → 웹훅 추천 (DB 부하 최소)
💻 코드 → 웹훅 추천 (mabiz 패턴 재사용)
🎨 UX → 웹훅 추천 (즉시 반영)
⚙️ 아키텍처 → 웹훅 추천 (느슨한 결합)
🏗️ 확장성 → 웹훅 추천 (향후 이벤트 추가 용이)
📈 비즈니스 → 웹훅 추천 (SLA 1시간 가능)
🧪 테스트 → 웹훅 추천 (시뮬레이션 간단)
📚 문서 → 웹훅 추천 (API 스펙 단순)

결론: 만장일치 웹훅 선택 ✅
```

---

## 📋 CRM팀에 공유할 웹훅 스펙

### 1. 우리가 보낼 것 (크루즈닷몰 → CRM)

#### 엔드포인트
```
POST https://crm.example.com/api/webhooks/cruisedot-payment
```

#### 인증 방식
```
Authorization: Bearer {CRUISEDOT_WEBHOOK_SECRET}
X-Signature: HMAC-SHA256(payload, secret)
Content-Type: application/json
```

#### 이벤트 타입
- `payment.created` — 결제 완료
- `payment.updated` — 상태 변경 (승인/취소)
- `payment.refunded` — 환불 완료

#### 페이로드 포맷

```json
{
  "eventId": "evt_a1b2c3d4e5f6",
  "eventType": "payment.refunded",
  "timestamp": "2026-05-21T14:30:00Z",
  
  "bookingRef": "CZ-2026-05-00123",
  "status": "REFUNDED",
  "refundAmount": 1500000,
  "reason": "여행 일정 변경",
  
  "refundPolicy": {
    "daysBeforeDeparture": 7,
    "penaltyRate": 25
  }
}
```

#### 필드 정의

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `eventId` | string | ✅ | 웹훅 고유 ID (중복 방지) |
| `eventType` | enum | ✅ | payment.created / payment.updated / payment.refunded |
| `timestamp` | ISO8601 | ✅ | 이벤트 발생 시간 (UTC) |
| `bookingRef` | string | ✅ | Reservation.affiliateSaleId 매핑 (CZ-YYYY-MM-NNNNN 형식) |
| `status` | enum | ✅ | PENDING / CONFIRMED / CANCELLED / REFUNDED |
| `refundAmount` | integer | ❌ | 환불액 (원 단위) |
| `reason` | string | ❌ | 취소/환불 이유 (최대 500자) |
| `refundPolicy` | object | ❌ | 환불 규정 정보 |

#### 재시도 정책 (우리가 할 것)

```
CRM 응답 코드별:

2xx (200-299)
  → 성공, 재시도 안 함

4xx (400-499)
  → 클라이언트 에러, 재시도 안 함
  → 모니터링 팀 알림

5xx (500-599)
  → 서버 에러, 자동 재시도
  → 지수백오프: 30s → 60s → 120s
  → 최대 3회 재시도
  → 최종 실패 시 모니터링 팀 알림

타임아웃 (>30초)
  → 재시도 취급 (지수백오프 적용)
```

---

## 🛠️ 우리(크루즈닷몰)가 해야 할 것

### Phase 1: 웹훅 발송 코드 구현

**파일:** `src/services/webhookService.ts` (신규)

**해야 할 것:**
```typescript
1. HMAC-SHA256 서명 생성
   const signature = crypto
     .createHmac('sha256', CRUISEDOT_WEBHOOK_SECRET)
     .update(JSON.stringify(payload))
     .digest('hex');

2. 웹훅 발송 (결제 완료 시)
   POST to CRM_WEBHOOK_URL
   Headers: 
     - Authorization: Bearer {CRUISEDOT_WEBHOOK_SECRET}
     - X-Signature: {signature}

3. 웹훅 발송 (환불 완료 시)
   status: REFUNDED로 변경 후 웹훅 발송

4. 재시도 로직
   실패 시 지수백오프로 3회 재시도
```

### Phase 2: Reservation 데이터 수정

**해야 할 것:**
```typescript
1. Reservation 모델에 필드 추가 (선택)
   - refundAmount: 환불액 저장
   - refundReason: 취소 이유 저장
   - lastWebhookSyncAt: 마지막 웹훅 발송 시간

2. 결제 완료 시 웹훅 발송
   Reservation.status = "CONFIRMED"
   POST /webhooks/cruisedot-payment
   payload: {
     eventType: "payment.created",
     status: "CONFIRMED",
     ...
   }

3. 환불 승인 시 웹훅 발송
   Reservation.status = "REFUNDED"
   Reservation.refundAmount = 환불액
   POST /webhooks/cruisedot-payment
   payload: {
     eventType: "payment.refunded",
     status: "REFUNDED",
     refundAmount: 1500000,
     reason: "고객 요청"
   }
```

### Phase 3: 테스트

**해야 할 것:**
```
1. 로컬 테스트
   mock CRM webhook endpoint 구성
   웹훅 발송 → 서명 검증 → 데이터 확인

2. 스테이징 테스트
   CRM 스테이징 환경과 연동
   실제 웹훅 발송 테스트

3. 통합 테스트
   CRM팀과 함께 스테이징에서 테스트
   결제 → 환불 전체 플로우 검증
```

---

## 🔐 우리가 준수할 보안 사항

- [ ] HMAC-SHA256 서명 생성 및 검증 (X-Signature 헤더)
- [ ] eventId 생성 (각 웹훅마다 고유한 값)
- [ ] 환불액 검증 (환불액 > 결제액 방지)
- [ ] 민감정보 제외 (고객 전화번호, 이메일 포함 X)
- [ ] 재시도 안전성 (재시도 시에도 동일한 eventId 사용)

---

## 📅 구현 일정

### Phase 1: 웹훅 발송 코드 (2-3일)
```
Day 1:
  • 웹훅 서비스 구현 (HMAC + HTTP 요청)
  • 로컬 테스트 환경 구성

Day 2:
  • 결제 완료 시 웹훅 발송 코드 추가
  • 환불 시 웹훅 발송 코드 추가
  • 재시도 로직 구현

Day 3:
  • 로컬 테스트 (mock endpoint)
  • 코드 리뷰
```

### Phase 2: 스테이징 배포 및 테스트 (1-2일)
```
Day 4:
  • 스테이징 배포
  • CRM팀에 "준비됨" 공지

Day 5:
  • CRM팀과 통합 테스트
  • 문제 해결
```

### Phase 3: 프로덕션 배포 (1일)
```
Day 6:
  • 최종 검증
  • 프로덕션 배포
  • 모니터링
```

**전체 기간:** 5-7일

---

## 🚀 CRM팀에 전달할 메시지

```
안녕하세요, CRM팀!

크루즈닷몰 개발팀입니다.
여행자 결제상태를 PNR 페이지에 실시간으로 표시하기 위해
웹훅 연동을 진행하려고 합니다.

10렌즈 기술 토론 결과, 웹훅 방식으로 결정했습니다.

---

📋 우리(크루즈닷몰)가 보낼 것

1️⃣ 웹훅 엔드포인트
   POST https://crm.example.com/api/webhooks/cruisedot-payment

2️⃣ 인증
   Authorization: Bearer {CRUISEDOT_WEBHOOK_SECRET}
   X-Signature: HMAC-SHA256(body, secret)

3️⃣ 이벤트 타입
   • payment.created (결제 완료)
   • payment.updated (상태 변경)
   • payment.refunded (환불 완료)

4️⃣ 웹훅 페이로드
{
  "eventId": "evt_a1b2c3d4",
  "eventType": "payment.refunded",
  "timestamp": "2026-05-21T14:30:00Z",
  "bookingRef": "CZ-2026-05-00123",
  "status": "REFUNDED",
  "refundAmount": 1500000,
  "reason": "여행 일정 변경",
  "refundPolicy": {
    "daysBeforeDeparture": 7,
    "penaltyRate": 25
  }
}

5️⃣ 재시도 정책
   • CRM 응답 5xx 시 자동 재시도
   • 지수백오프: 30s → 60s → 120s
   • 최대 3회

---

📋 CRM팀이 해야 할 것

1. 웹훅 엔드포인트 구현
   • HMAC-SHA256 서명 검증
   • eventId 중복 필터링
   • Reservation 상태 업데이트

2. PNR 페이지 UI
   • 실시간 상태 배지 표시 (결제됨/취소됨/환불됨)
   • 마지막 동기화 타임스탬프

---

🚀 진행 일정

Week 1 (2026-05-21 ~ 2026-05-28)
• Day 1-3: 크루즈닷몰 웹훅 발송 코드 구현
• Day 4-5: 스테이징 배포 + 통합 테스트
• Day 6-7: 프로덕션 배포

---

필요한 것:
1. CRUISEDOT_WEBHOOK_SECRET (시크릿 토큰)
2. 스테이징 웹훅 URL 확인
3. 통합 테스트 일정 조율

상세 스펙은 첨부 문서 참고.
감사합니다!
```

---

## ✅ 체크리스트 (우리가 할 것)

### 구현
- [ ] HMAC-SHA256 서명 생성 함수 작성
- [ ] 웹훅 발송 서비스 구현
- [ ] 결제 완료 시 웹훅 발송 코드 추가
- [ ] 환불 시 웹훅 발송 코드 추가
- [ ] 재시도 로직 구현 (지수백오프)
- [ ] 웹훅 발송 로그 기록

### 테스트
- [ ] 로컬 테스트 (mock CRM endpoint)
- [ ] 서명 검증 테스트
- [ ] 재시도 테스트
- [ ] 페이로드 포맷 검증

### 배포
- [ ] 스테이징 배포
- [ ] CRM팀과 통합 테스트
- [ ] 문제 해결
- [ ] 프로덕션 배포

---

## 📊 요약

| 항목 | 상태 | 내용 |
|------|------|------|
| **분석** | ✅ 완료 | 10렌즈 분석 → 웹훅 방식 결정 |
| **스펙** | ✅ 완료 | CRM팀에 전달할 스펙 정의 |
| **구현 계획** | ✅ 완료 | 3단계 Phase 계획 수립 |
| **CRM 전달** | ⏳ 준비 | 메시지 작성 완료, 전달 대기 |
| **실제 구현** | ⏹️ 미시작 | 스펙 확정 후 시작 |

---

**준비됐습니다! CRM팀에 위 메시지를 전달하시겠습니까?** 🚀
