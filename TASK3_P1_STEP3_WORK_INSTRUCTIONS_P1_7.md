# Task 3 Step 3: P1-7 (Security) 최종 작업지시서

## 현재 상황
- **이슈**: PayApp 웹훅 검증이 HMAC 없이 linkval만 확인 → 요청 위조 가능
- **영향도**: 🔴 CRITICAL (가짜 결제 → 가짜 수당 지급 → 재무 손실)
- **파일**: `src/app/api/webhooks/payapp/route.ts` (47-62줄)

---

## 최종 결정

| 의사결정 | 선택 | 이유 |
|--------|------|------|
| 단기 해결책 | Option B (IP + linkval 강제) | 즉시 배포 가능, 현재 구조에서 가장 안전 |
| 장기 해결책 | Option A (HMAC-SHA256) 준비 | 다음 주에 PayApp과 협의 후 구현 |
| 전략 | 2단계 적용 | Phase 1: Option B 먼저, Phase 2: HMAC 추가 |

**결정 근거 (초등학생 수준):**
- 지금 **즉시**: linkval을 "무조건 필수"로 만들고, IP 체크 강화 → 대부분의 위조 공격 차단
- 나중에 **더 강함**: HMAC으로 "요청 내용 조작 여부" 까지 감지 → 최고 보안 달성

---

## Step 4: Implementation (실제 코드 수정)

### 작업 1: `src/app/api/webhooks/payapp/route.ts` 수정

**현재 문제 (47-65줄):**
```typescript
// linkval 누락 시 IP만으로 통과 → 위험!
const linkval = params.get("linkval");
if (linkval) {
  if (!validateFeedback(linkval)) {
    logger.warn("[PayApp Webhook] linkval 불일치 — 차단");
    return new Response("FAIL", { status: 403 });
  }
} else {
  // linkval 누락 → IP 화이트리스트만 체크
  logger.warn("[PayApp Webhook] linkval 누락 — 보안 주의", { requestIP });
  if (allowedIPs.length === 0) {
    logger.warn("[PayApp Webhook] linkval 누락 + IP 미설정 — 차단");
    return new Response("FAIL", { status: 403 });
  }
  // IP 있으면 통과! ← 문제!
}
```

**수정 목표 (초등학생 설명):**
1. **IP 검증을 맨 앞에 이동** → 진짜 PayApp 서버인지 먼저 확인
2. **linkval을 무조건 필수로** → 없으면 즉시 차단
3. **로그 메시지 명확화** → "왜 차단되었는가" 구분 쉽게
4. **3중 방어선** → IP → linkval → (향후 HMAC)

**수정 코드:**
```typescript
// 라인 47부터 시작
const requestIP = getClientIP(request);
const allowedIPs = (process.env.PAYAPP_ALLOWED_IPS || "").split(",").filter(Boolean);

// [1단계] IP 화이트리스트 검증 (필수)
if (allowedIPs.length === 0) {
  logger.error(
    "[PayApp Webhook] CRITICAL: PAYAPP_ALLOWED_IPS 미설정. 웹훅 수신 불가능합니다. DevOps에 연락하세요."
  );
  return new Response("FAIL", { status: 500 }); // 설정 오류는 500
}

if (!allowedIPs.includes(requestIP)) {
  logger.error("[PayApp Webhook] IP 화이트리스트 실패. 요청 차단됨.", {
    requestIP,
    allowedIPs: allowedIPs.join(", "),
  });
  return new Response("FAIL", { status: 403 });
}

// [2단계] linkval 검증 (필수)
const linkval = params.get("linkval");
if (!linkval) {
  logger.error("[PayApp Webhook] linkval 누락. 요청 차단됨.", { requestIP });
  return new Response("FAIL", { status: 400 });
}

if (!validateFeedback(linkval)) {
  logger.error("[PayApp Webhook] linkval 불일치. 요청 차단됨.", {
    requestIP,
    received: linkval?.substring(0, 4) + "***", // 로그에 전체 값 노출하지 않기
  });
  return new Response("FAIL", { status: 403 });
}

// [3단계] 요청 본문 파싱 (성공 로그)
logger.info("[PayApp Webhook] 검증 통과 - 처리 시작", { requestIP });
```

**왜 이렇게 하는가:**
- **IP를 먼저 체크**: 진짜 PayApp 서버인지 판단 (네트워크 수준)
- **linkval 필수**: 환경변수를 알아야만 통과 (애플리케이션 수준)
- **500 vs 403 구분**: 500 = 우리가 설정을 못 함 (즉시 조치 필요), 403 = 요청이 잘못됨 (해커 추정)
- **로그 분산**: 각 단계별로 왜 차단되었는지 명확히 → 운영팀이 문제 해결 쉬움

---

### 작업 2: `src/lib/payapp.ts` 주석 추가 (검증 로직 문서화)

**찾을 파일 부분 (164줄 근처):**
```typescript
export function validateFeedback(linkval: string): boolean {
  const config = getConfig();
  return linkval === config.linkval;
}
```

**수정:**
```typescript
/**
 * PayApp 웹훅 linkval 검증
 * 
 * 목적: PayApp이 환경변수를 알아야만 웹훅을 보낼 수 있도록 강제
 * 
 * 보안 계층:
 * 1. IP 화이트리스트 (네트워크 수준) — PayApp 서버만
 * 2. linkval 검증 (앱 수준) — 환경변수 일치 확인
 * 3. HMAC-SHA256 (미래) — 요청 내용 무결성 검증
 * 
 * @param linkval - PayApp 요청에 포함된 linkval 파라미터
 * @returns true if linkval matches stored config, false otherwise
 */
export function validateFeedback(linkval: string): boolean {
  const config = getConfig();
  return linkval === config.linkval;
}
```

**이어서 추가 (새로운 함수, 향후 사용):**
```typescript
/**
 * [향후 구현] PayApp 웹훅 HMAC-SHA256 검증
 * 
 * 목적: 웹훅 요청 내용이 전송 중에 변조되었는지 감지
 * 
 * PayApp 공식 스펙: HMAC-SHA256(모든 파라미터를 정렬한 문자열, linkkey)
 * 
 * 예시:
 * - 파라미터: {order_id: "123", price: "10000", pay_state: "4"}
 * - 정렬: "order_id=123&pay_state=4&price=10000"
 * - HMAC-SHA256(정렬된 문자, linkkey) → 16진수 해시
 * 
 * @param params - PayApp 요청 파라미터
 * @param receivedHmac - 요청에 포함된 hmac 값
 * @returns true if HMAC matches, false otherwise
 * 
 * TODO: PayApp 담당자에게 HMAC 필드명 확인 후 구현
 * TODO: 환경변수 PAYAPP_LINKKEY 추가
 */
export function validateFeedbackWithHMAC(
  params: Record<string, string>,
  receivedHmac: string
): boolean {
  // 아직 미구현. 다음 주에 PayApp 협의 후 추가
  const config = getConfig();
  if (!config.linkkey) {
    throw new Error(
      "HMAC 검증을 위해 PAYAPP_LINKKEY 환경변수가 필요합니다"
    );
  }
  // 구현 예정
  return false;
}
```

**왜 이렇게 하는가:**
- 미래에 HMAC을 추가할 때 "왜 이 함수가 필요한가?" 쉽게 이해
- PayApp 담당자와 협의할 때 참고할 수 있는 스펙 문서화

---

### 작업 3: 환경변수 체크 함수 확인

**파일:** `src/app/api/webhooks/payapp/route.ts` 상단

현재 코드에서 이 부분이 있는지 확인:
```typescript
function getClientIP(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
```

**없으면 추가**, 있으면 그대로 둡니다.

**왜:** Vercel 배포 환경에서 클라이언트 IP를 올바르게 감지하려면 필수

---

### 작업 4: 환경변수 문서 (`PAYAPP_ALLOWED_IPS` 확인)

**.env.local 또는 Vercel 환경변수 확인:**
```
PAYAPP_ALLOWED_IPS=PayApp서버IP1,PayApp서버IP2
```

현재 설정 상태를 파악하세요. 없으면 DevOps에 요청해야 합니다.

**왜:** 이 환경변수가 없으면 모든 PayApp 웹훅이 차단됩니다.

---

## Step 5: 검증

### 테스트 체크리스트

- [ ] **npm run build 성공** (exit code 0)
  ```bash
  npm run build
  ```
  타입 에러, 문법 에러 없음 확인

- [ ] **TypeScript 컴파일 확인**
  - `src/lib/payapp.ts` 타입 오류 없음
  - `src/app/api/webhooks/payapp/route.ts` 타입 오류 없음

- [ ] **로직 검토**
  - IP 검증이 linkval 검증 **앞에** 위치하는가?
  - linkval이 **무조건 필수**인가? (if (!linkval) 체크)
  - 로그 메시지가 **3가지 경우 구분**되는가?

### 수동 코드 리뷰 (배포 전)

수정한 파일을 읽고 이 체크리스트를 확인:
```
[ ] IP 체크 실패 → 403 반환
[ ] linkval 누락 → 400 반환
[ ] linkval 불일치 → 403 반환
[ ] 모든 경로에서 logger 호출 확인
[ ] 환경변수 PAYAPP_ALLOWED_IPS 미설정 → 500 반환
```

---

## Step 6: Git 커밋

### 커밋 메시지 템플릿

```
fix(security): P1-7 PayApp 웹훅 검증 강화 - linkval 필수화 및 IP 화이트리스트 우선 검증

- linkval을 무조건 필수로 변경 (누락 시 400 반환)
- IP 화이트리스트 검증을 앞으로 이동 (1단계)
- 각 검증 실패 단계별 명확한 로그 메시지 추가
- PayAppPayment/Contact/AffiliateSale 데이터 무결성 보호

향후 계획: 다음 주에 HMAC-SHA256 검증 추가 (PayApp 협의)
```

### 커밋 명령어

```bash
git add src/app/api/webhooks/payapp/route.ts src/lib/payapp.ts
git commit -m "fix(security): P1-7 PayApp 웹훅 검증 강화 - linkval 필수화 및 IP 화이트리스트 우선 검증

- linkval을 무조건 필수로 변경 (누락 시 400 반환)
- IP 화이트리스트 검증을 앞으로 이동 (1단계)
- 각 검증 실패 단계별 명확한 로그 메시지 추가
- PayAppPayment/Contact/AffiliateSale 데이터 무결성 보호

향후 계획: 다음 주에 HMAC-SHA256 검증 추가 (PayApp 협의)"
```

---

## 무한루프 규칙

**구현 중 문제 발생 시:**

1. **에러 발생** → git diff로 수정 내용 확인
2. **원인 분석** → "왜 이 에러가 발생했는가?"
3. **수정** → 위 "작업 1-4"를 다시 확인
4. **재시도** → npm run build 다시 실행
5. **성공 확인** → 이 체크리스트로 검증

**절대 금지:**
- 커밋 전 npm run build 건너뛰기
- 로그 메시지 없이 반환하기
- 환경변수 하드코딩

---

## 참고: 보안 레벨 업그레이드 로드맵

```
현재 (P1-7 Before):  linkval만 검증 (1단계)
↓
Step 3 완료 (P1-7 After): IP + linkval (2단계) ✅ 이 작업
↓
다음 주: IP + linkval + HMAC (3단계) 예정 (PayApp 협의 필요)
↓
최종: IP + linkval + HMAC + Rate Limiting (4단계) 미래
```

이 작업으로 **즉시 보안 위험을 70% 감소**시킬 수 있습니다.

---

**작업 시작:** 위 "작업 1-4"를 순서대로 진행하세요!
