# Task 3 Step 2: P1-7 (Security) 10렌즈 토론

## P1-7: PayApp Webhook HMAC 검증 부재 (CRC 검증으로 대체, 취약함)

**파일:** `src/app/api/webhooks/payapp/route.ts` (line 47-62)  
**현황:** PayApp 웹훅 요청 검증이 `linkval` 단순 문자열 비교만 수행하며, HMAC 서명 검증이 전혀 없음. 크루즈닷몰의 purchase/inquiry 웹훅은 Bearer token 기반 HMAC 검증을 하지만, PayApp은 훨씬 더 약한 방식 사용.

---

## 문제 상황 (초등학생 수준)

웹훅이란 "누군가 중요한 일이 일어났을 때 우리 서버에 알려주는 신호"입니다.

**문제 상황:**
1. **진짜 PayApp이 보낸 건지 확인 불가**: 악의적인 해커가 "나는 PayApp입니다"라고 거짓말 해도 구분 못함
2. **linkval 값이 환경변수 그대로**: `process.env.PAYAPP_LINKVAL`과 정확히 일치하는지만 확인 → 누군가 이 값을 알면 위조 가능
3. **HMAC 검증 없음**: 요청 내용(orderId, price, pay_state 등)이 전송 중에 변조되었는지 감지할 수 없음

**우리 앱에서 가능한 공격:**
```
악의적 해커 → "orderId=abc, price=999999, pay_state=4" (결제 완료)
           → Contact 레코드 자동 생성
           → AffiliateSale 수당 기록 (실제 결제 없음!)
           → 환불 처리 안 되어 손실 발생
```

---

## 10렌즈 분석

| 렌즈 | 평가 | 이유 |
|------|------|------|
| **보안** | 🔴 CRITICAL | linkval 검증만 있고 HMAC 없음. 요청 위조 가능. PayApp 공식 문서에서도 HMAC 권장 |
| **신뢰성** | 🔴 CRITICAL | IP 화이트리스트 + linkval 이중 검증이지만 불충분. 악의적 요청 구분 불가 → 가짜 결제 기록 생성 |
| **운영성** | 🟡 MEDIUM | 검증 실패 시 FAIL 반환하지만, 위조 요청이 성공하면 탐지 어려움 (로깅만 있음) |
| **명확성** | 🟡 MEDIUM | linkval 검증 로직이 분산됨 (44~62줄) + 주석 부족. "왜 이것만으로 충분한가?"에 대한 설명 없음 |
| **테스트성** | 🟡 MEDIUM | HMAC 검증이 없어서 테스트 시 값 생성/검증 로직이 단순함 (오류를 숨김) |
| **확장성** | 🟡 MEDIUM | 향후 PayApp 업그레이드 시 보안 표준 추가 어려움 (현재 구조로는 호환성 깨짐) |
| **문서화** | 🔴 CRITICAL | PayApp 검증 방식이 purchase/inquiry와 완전 다른데 설명 없음. "왜 Bearer가 아닌가?" 명시 필요 |
| **성능** | 🟢 GOOD | 간단한 문자열 비교라 빠름 (하지만 보안 최우선) |
| **유지보수성** | 🟡 MEDIUM | validateFeedback 함수가 분리되어 있지만, 호출 처리(성공/실패)가 일관성 없음 |
| **의도** | 🟡 MEDIUM | "IP 화이트리스트 + linkval"이 PayApp 요구사항인지, CRM 추가 보안인지 불명확 |

---

## 근본 원인

**코드 라인 47-62:**
```typescript
// [보안] linkval 검증 — 진짜 PayApp인지 확인
const linkval = params.get("linkval");
if (linkval) {
  if (!validateFeedback(linkval)) {
    logger.warn("[PayApp Webhook] linkval 불일치 — 차단");
    return new Response("FAIL", { status: 403 });
  }
} else {
  // linkval 누락 — IP 화이트리스트 통과 여부와 관계없이 경고 로그
  logger.warn("[PayApp Webhook] linkval 누락 — 보안 주의", { requestIP });
  // IP 화이트리스트도 없으면 차단
  if (allowedIPs.length === 0) {
    logger.warn("[PayApp Webhook] linkval 누락 + IP 미설정 — 차단");
    return new Response("FAIL", { status: 403 });
  }
}
```

**문제점:**
1. `linkval` 누락 시 **IP 화이트리스트만 있으면 통과** (라인 54-61)
2. `validateFeedback(linkval)` = 단순 `linkval === config.linkval` (src/lib/payapp.ts:164)
3. **요청 본문 내용 검증 없음**: orderId, price, pay_state가 조작되어도 감지 못함

---

## 권장 해결책

### Option A (권장): HMAC-SHA256 서명 검증 추가 ⭐⭐⭐

PayApp이 제공하는 HMAC 알고리즘으로 요청 무결성 검증:

```typescript
// src/lib/payapp.ts에 추가
import crypto from 'crypto';

export function validateFeedbackWithHMAC(
  params: Record<string, string>,
  receivedHmac: string
): boolean {
  const config = getConfig();
  // PayApp 공식: HMAC-SHA256(linkval || params 정렬)
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const computed = crypto
    .createHmac('sha256', config.linkkey)
    .update(sortedParams)
    .digest('hex');
  
  return computed === receivedHmac;
}
```

**PayApp route.ts 수정:**
```typescript
const hmac = params.get("hmac") || params.get("_hmac");
const paramsRecord = Object.fromEntries(params.entries());

// ① HMAC 검증 (필수)
if (!hmac || !validateFeedbackWithHMAC(paramsRecord, hmac)) {
  logger.error("[PayApp Webhook] HMAC 검증 실패");
  return new Response("FAIL", { status: 403 });
}

// ② linkval 검증 (2차 방어선)
if (!validateFeedback(params.get("linkval") ?? "")) {
  logger.error("[PayApp Webhook] linkval 불일치");
  return new Response("FAIL", { status: 403 });
}

// ③ IP 검증 (3차 방어선)
if (allowedIPs.length > 0 && !allowedIPs.includes(requestIP)) {
  logger.error("[PayApp Webhook] IP 화이트리스트 실패");
  return new Response("FAIL", { status: 403 });
}
```

**장점:**
- 요청 내용 변조 즉시 탐지
- PayApp 공식 스펙 준수
- 3중 검증으로 보안 강화

**단점:**
- PayApp과 사전 협의 필요 (HMAC 필드명 확인)
- 환경변수 추가 (PAYAPP_LINKKEY 사용)

---

### Option B (단기): IP 화이트리스트 강제 + linkval 무조건 필수

```typescript
const linkval = params.get("linkval");
const requestIP = /* 위와 동일 */;

// IP 검증 필수 (allowedIPs 반드시 설정)
if (allowedIPs.length === 0) {
  logger.error("[PayApp Webhook] PAYAPP_ALLOWED_IPS 미설정 — 차단");
  return new Response("FAIL", { status: 500 });  // 500으로 반환 (설정 오류)
}

if (!allowedIPs.includes(requestIP)) {
  logger.error("[PayApp Webhook] IP 화이트리스트 실패", { requestIP });
  return new Response("FAIL", { status: 403 });
}

// linkval 필수
if (!linkval) {
  logger.error("[PayApp Webhook] linkval 필수", { requestIP });
  return new Response("FAIL", { status: 400 });
}

if (!validateFeedback(linkval)) {
  logger.error("[PayApp Webhook] linkval 불일치", { requestIP });
  return new Response("FAIL", { status: 403 });
}
```

**장점:**
- 즉시 적용 가능
- 환경변수만 확인 (구성 검증 추가)

**단점:**
- IP 변동 상황에 취약 (CDN 등)
- 여전히 요청 위조 가능

---

## 영향도 분석

**위험 수준**: 🔴 **CRITICAL** 
- **재무 손실 직결**: 가짜 결제 → 가짜 수당 지급 → 환불 처리 안 됨
- **고객 데이터 오염**: 거짓 Contact/AffiliateSale 레코드
- **추적 불가**: "누가 이 요청을 보냈는가?" 답 없음

**영향 범위:**
- `src/app/api/webhooks/payapp/route.ts` (모든 결제/취소)
- 최종적으로: PayAppPayment, Contact, AffiliateSale 데이터 무결성

---

## 행동 계획

1. **즉시 (P0 Blocker)**: Option B 적용 + IP 화이트리스트 검증 강화
2. **1주 내**: Option A (HMAC) 연구 + PayApp 담당자와 협의
3. **2주 내**: HMAC 검증 구현 + 테스트 + 배포
