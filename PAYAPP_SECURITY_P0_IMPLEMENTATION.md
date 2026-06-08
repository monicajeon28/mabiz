# PayApp 보안 강화 - 3단계 검증 구현 (P0-P1 종합)

**작성자**: 거장 작업지시자  
**우선순위**: P0 6개 + P1 10개 버그  
**예상 시간**: 4-6시간 (병렬 구현 기준)  
**최종 검증**: TSC --noEmit 통과 + 3단계 E2E 테스트

---

## 📋 작업 개요

PayApp 결제 흐름의 **3단계 검증 체인** 강화:
1. **서버 요청 검증** (Webhook 수신) — 페이로드 크기, 유형, 포맷
2. **결제 요청 검증** (클라이언트 → PayApp) — returnUrl 도메인, 리다이렉트 보안
3. **클라이언트 리다이렉트 검증** (PayApp → 완료페이지) — 도메인 화이트리스트, orderId 검증

---

## 🔴 P0 버그 6개 (즉시 수정)

### P0-1: Content-Length DoS 방어 (Webhook)
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 41-63 (POST 함수 시작)
- **문제**: 1GB 이상 페이로드 → 메모리 고갈 공격 가능
- **수정 코드**:
```typescript
// Line 41-63 추가 (body 파싱 직전)
export async function POST(req: Request) {
  let params: URLSearchParams | null = null;

  try {
    // ── [P0-1] Content-Length DoS 방어
    const contentLength = parseInt(req.headers.get('content-length') ?? '0');
    const MAX_PAYLOAD = 1024 * 1024; // 1MB 제한
    if (contentLength > MAX_PAYLOAD) {
      logger.warn('[PayApp Webhook] Content-Length 초과 — 요청 차단', {
        requestIP: 'unknown',
        contentLength,
        maxAllowed: MAX_PAYLOAD,
      });
      return new Response('FAIL', { status: 413 }); // Payload Too Large
    }

    // 기존 코드 계속...
    const trustedProxy = process.env.PAYAPP_TRUSTED_PROXY?.toLowerCase() ?? '';
    // ...
```
- **검증 방법**: 
  - `curl -X POST ... -H "Content-Length: 2000000000"` → 413 응답 확인
  - 로그에 "Content-Length 초과" 메시지 확인

---

### P0-2: HMAC 필수화 (Webhook)
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 138-161 (HMAC 검증 로직)
- **문제**: `PAYAPP_LINKKEY` 설정 시 hmac 파라미터 누락 → 403 응답하지만, 모든 쿼리 파라미터 로깅 후 DLQ 저장됨
- **수정 코드**: 
```typescript
// Line 138-161 변경
// ── [3단계] HMAC 검증 — PAYAPP_LINKKEY 설정 시 hmac 파라미터 필수 ──
const hmacLinkkey = process.env.PAYAPP_LINKKEY;
const hmacValue = params.get('hmac');
if (hmacLinkkey) {
  // PAYAPP_LINKKEY가 설정된 경우 hmac 파라미터는 반드시 있어야 함
  if (!hmacValue) {
    logger.error('[PayApp Webhook] HMAC 파라미터 누락 — 요청 차단', { requestIP });
    return new Response('FAIL', { status: 401 }); // ← 403 대신 401 사용 (미인증)
  }
  const paramsObj = Object.fromEntries(params.entries());
  if (!validateFeedbackWithHMAC(paramsObj, String(hmacValue))) {
    logger.error('[PayApp Webhook] HMAC 검증 실패', { requestIP });
    return new Response('FAIL', { status: 403 }); // 이건 403 (금지)
  }
  logger.info('[PayApp Webhook] HMAC 검증 통과', { requestIP });
} else if (hmacValue) {
  // PAYAPP_LINKKEY 미설정이지만 hmac 파라미터가 있는 경우: 검증 시도
  const paramsObj = Object.fromEntries(params.entries());
  if (!validateFeedbackWithHMAC(paramsObj, String(hmacValue))) {
    logger.error('[PayApp Webhook] HMAC 검증 실패', { requestIP });
    return new Response('FAIL', { status: 403 });
  }
  logger.info('[PayApp Webhook] HMAC 검증 통과', { requestIP });
}
```
- **검증 방법**: 
  - `PAYAPP_LINKKEY=test123` 설정 → hmac 파라미터 없이 요청 → 401 응답 확인
  - 로그에 "HMAC 파라미터 누락" 메시지 확인

---

### P0-3: orderId 형식 검증 강화
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 180-189
- **문제**: 형식 검증은 있지만, 실패 시 "FAIL" 반환 후 catch문에서 DLQ 저장 → 중복 로깅
- **수정 코드**: 현재 코드는 정상이나, DLQ 저장 시 orderId 마스킹 추가
```typescript
// Line 597-600 (DLQ 저장 부분)
if (params) {
  const payloadObj = Object.fromEntries(params);
  // orderId/mulNo 마스킹
  if (payloadObj.var1) payloadObj.var1 = payloadObj.var1.substring(0, 4) + '***';
  if (payloadObj.mul_no) payloadObj.mul_no = payloadObj.mul_no.substring(0, 4) + '***';
  await enqueueDLQ("payapp", payloadObj, err instanceof Error ? err.message : String(err), "form-data").catch(() => {});
}
```
- **검증 방법**:
  - 잘못된 orderId (특수문자 포함) → 400 응답 + DLQ 저장 확인
  - DLQ 데이터에서 orderId 마스킹 확인 (`***` 표시)

---

### P0-4: Bearer Token 길이 검증 (이미 구현됨 ✅)
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 81-85
- **상태**: ✅ 이미 구현됨 (최소 32자 검증)
- **검증 방법**: 
  - Token 31자 이상 → 403 응답 확인
  - 로그에 "Bearer token 길이 부족" 메시지 확인

---

### P0-5: returnUrl 도메인 화이트리스트 (결제 요청)
- **파일**: `src/app/api/public/payapp/request/route.ts`
- **라인**: 114 (returnurl 설정)
- **문제**: returnurl을 `${baseUrl}/p/${slug}/payment/complete?orderId=${orderId}` 로 자동 생성하지만, 환경변수 `NEXT_PUBLIC_BASE_URL` 검증 없음
- **수정 코드**:
```typescript
// Line 1-20 (상단 import/상수 추가)
import { URL } from 'url';

// 허용된 도메인 목록
const ALLOWED_RETURN_DOMAINS = [
  'mabizcruisedot.com',
  'www.mabizcruisedot.com',
  'localhost:3000', // 개발용
];

function validateReturnUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    // 도메인 + 포트 검증
    const host = url.host.toLowerCase();
    // 정확한 도메인 또는 서브도메인 매칭 (*.mabizcruisedot.com 등)
    return ALLOWED_RETURN_DOMAINS.some(domain => 
      host === domain || host.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

// Line 50-52 변경
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mabizcruisedot.com';

// returnUrl 검증 추가
if (!validateReturnUrl(`${baseUrl}/p/${landingPage.slug}/payment/complete?orderId=${orderId}`)) {
  logger.warn('[Public/PayApp] 잘못된 returnUrl 도메인', {
    baseUrl,
    allowedDomains: ALLOWED_RETURN_DOMAINS,
  });
  return NextResponse.json(
    { ok: false, message: 'BASE_URL 설정이 올바르지 않습니다.' },
    { status: 400 }
  );
}

const feedbackurl = `${baseUrl}/api/webhooks/payapp`;

// Line 114 변경 (returnurl 자동 생성 유지, 하지만 이미 검증됨)
returnurl: `${baseUrl}/p/${landingPage.slug}/payment/complete?orderId=${orderId}`,
```
- **검증 방법**:
  - `NEXT_PUBLIC_BASE_URL=https://evil.com` 설정 → 400 응답 확인
  - 로그에 "잘못된 returnUrl 도메인" 메시지 확인

---

### P0-6: 클라이언트 완료페이지 orderId 검증
- **파일**: `src/app/p/[slug]/page.tsx` (또는 payment/complete 페이지)
- **라인**: (새로 생성할 부분)
- **문제**: 클라이언트가 PayApp에서 리다이렉트될 때 `?orderId=xxx` 파라미터 검증 없음 → XSS/토큰 공격 가능
- **수정 코드**: 
```typescript
// src/app/p/[slug]/payment/complete/page.tsx (새 파일)
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const SAFE_ID_REGEX = /^[a-zA-Z0-9_\-]{1,50}$/;

export default function PaymentCompletePage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // P0-6: orderId 형식 검증
    if (!orderId) {
      setError('orderId가 누락되었습니다.');
      return;
    }

    if (!SAFE_ID_REGEX.test(orderId)) {
      setError('유효하지 않은 orderId 형식입니다.');
      return;
    }

    // 서버에서 orderId 존재 여부 확인 (선택)
    fetch(`/api/payapp/payment/${orderId}/verify`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => {
        if (res.ok) {
          setIsValid(true);
        } else {
          setError('결제 정보를 찾을 수 없습니다.');
        }
      })
      .catch(err => {
        setError('검증 중 오류가 발생했습니다.');
      });
  }, [orderId]);

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        오류: {error}
      </div>
    );
  }

  if (!isValid) {
    return <div style={{ padding: '20px' }}>검증 중...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>결제 완료</h1>
      <p>orderId: {orderId}</p>
    </div>
  );
}
```

**검증용 API 추가** (선택사항):
```typescript
// src/app/api/payapp/payment/[orderId]/verify/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;

  // orderId 형식 검증
  const SAFE_ID_REGEX = /^[a-zA-Z0-9_\-]{1,50}$/;
  if (!SAFE_ID_REGEX.test(orderId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // DB에서 orderId 존재 여부 확인
  const payment = await prisma.payAppPayment.findUnique({
    where: { orderId },
    select: { id: true, status: true },
  });

  if (!payment) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json({ ok: true, status: payment.status });
}
```

- **검증 방법**:
  - `/p/slug/payment/complete?orderId=pay_abc_123` → 성공 페이지 표시
  - `/p/slug/payment/complete?orderId=<script>alert('xss')</script>` → 오류 메시지 표시
  - `/p/slug/payment/complete?orderId=invalid!!!` → 오류 메시지 표시

---

## 🟡 P1 버그 10개 (우선 수정)

### P1-1: linkval 부분 노출 로깅
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 132
- **문제**: `linkval.substring(0, 4) + "***"` → 처음 4자 노출 → 엔트로피 저하
- **수정 코드**:
```typescript
// Line 132 변경
received: `${linkval.substring(0, 2)}...${linkval.substring(linkval.length - 2)}` // 첫 2자 + 마지막 2자만
```

---

### P1-2: User-Agent 길이 제한
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 102-112 (이미 구현됨 ✅)
- **상태**: ✅ 500자 제한 이미 적용됨

---

### P1-3: Phone 정규화 전 길이 확인
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 170 (phone 파라미터 수신)
- **문제**: Phone이 4000자 이상이면 정규화 함수에서 의도하지 않은 동작 가능
- **수정 코드**:
```typescript
// Line 170 변경
const phone = (params.get("recvphone") ?? "").substring(0, 20); // 최대 20자
const normalizedPhone = phone ? normalizePhone(phone) : "";
```

---

### P1-4: Price 음수값 검증
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 172
- **문제**: `parseInt("999999999999")` 가능 → 오버플로우
- **수정 코드**:
```typescript
// Line 172 변경
const price = Math.max(0, Math.min(100_000_000, parseInt(params.get("price") ?? "0")));
```

---

### P1-5: landingSlug SQL Injection 방지
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 229-235
- **문제**: `params.get("var2")` → slug로 사용되는데 형식 검증 없음
- **수정 코드**:
```typescript
// Line 229-235 변경
const SAFE_SLUG_REGEX = /^[a-z0-9_\-]{1,100}$/i;
let orgId: string | null = null;
if (landingSlug && SAFE_SLUG_REGEX.test(landingSlug)) {
  const lp = await prisma.crmLandingPage.findFirst({
    where: { slug: landingSlug },
    select: { organizationId: true },
  });
  orgId = lp?.organizationId ?? null;
} else if (landingSlug) {
  logger.warn('[PayApp Webhook] 잘못된 slug 형식', { landingSlug: landingSlug.substring(0, 10) + '***' });
}
```

---

### P1-6: Transaction 롤백 시 DLQ 처리
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 243-288 (tx.contact.upsert)
- **문제**: Transaction이 실패해도 params가 이미 파싱됨 → DLQ 저장 시 전체 파라미터 노출
- **수정 코드**: 현재는 catch에서 params 체크하므로 정상. 단, DLQ 저장 전 민감정보 마스킹:
```typescript
// Line 597-603 변경
if (params) {
  const payloadObj = Object.fromEntries(params);
  // 민감정보 마스킹
  const masked = { ...payloadObj };
  if (masked.recvphone) masked.recvphone = masked.recvphone.substring(0, 4) + '***';
  if (masked.var1) masked.var1 = masked.var1.substring(0, 4) + '***';
  if (masked.pay_memo) masked.pay_memo = masked.pay_memo.substring(0, 10) + '***';
  await enqueueDLQ("payapp", masked, err instanceof Error ? err.message : String(err), "form-data").catch(() => {});
}
```

---

### P1-7: 취소 웹훅 시 금액 재검증
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 342-471
- **문제**: 취소 웹훅에서는 금액 검증이 없음 → 부분취소 시 원금 초과 환불 가능
- **수정 코드**:
```typescript
// Line 342-471 변경 (취소 처리 부분)
if (status === "cancelled") {
  const canceldate = params.get("canceldate") ?? null;
  const cancelmemo = params.get("cancelmemo") ?? "";

  if (orderId) {
    // ★ NEW: 원래 금액 검증
    const original = await prisma.payAppPayment.findUnique({
      where: { orderId },
      select: { amount: true, refundedAmount: true, status: true },
    });

    if (original && original.status === "paid" && price > original.amount) {
      logger.warn('[PayApp Webhook] 환불액 > 원금 — 위조 의심', {
        orderId,
        originalAmount: original.amount,
        refundAmount: price,
      });
      return new Response('FAIL', { status: 400 });
    }

    // 기존 취소 처리 코드 계속...
```

---

### P1-8: AffiliateSale 없을 때 로그 레벨
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 389-410
- **문제**: commission > 0 체크하지만, sale이 없으면 알림도 없음 → 수당 누락 감지 어려움
- **수정 코드**:
```typescript
// Line 389-410 변경
if (affiliateSale && affiliateSale.commissionAmount > 0) {
  // 기존 코드 (알림 생성)
  // ...
} else if (orderId && !affiliateSale) {
  // ★ NEW: 수당 정보 없을 때 경고
  logger.warn('[PayApp Webhook] 취소 처리: AffiliateSale 없음 (수당 추적 불가)', { orderId });
}
```

---

### P1-9: 부분취소 분수 검증
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 522 (refundRatio 계산)
- **문제**: `partialAmount / sale.saleAmount` → 0 < ratio <= 1.0 검증 필요
- **수정 코드**:
```typescript
// Line 522 변경
const refundRatio = Math.min(1.0, Math.max(0, partialAmount / sale.saleAmount)); // 0-1.0 범위 강제
const deduction = Math.floor(sale.commissionAmount * refundRatio);
```

---

### P1-10: 환불 알림 async 에러 추적
- **파일**: `src/app/api/webhooks/payapp/route.ts`
- **라인**: 389-410, 537-551
- **문제**: `createRefundNotifications(...).catch(() => {})` → 에러 무시 → 알림 누락 감지 불가
- **수정 코드**:
```typescript
// Line 396-403 변경
await createRefundNotifications({
  organizationId: affiliateSale.organizationId,
  orderId,
  customerName: contact?.name || '고객',
  refundAmount: affiliateSale.saleAmount,
  refundReason: cancelmemo || '결제 취소',
  type: 'payment_cancelled',
}).catch((err) => {
  logger.warn('[PayApp Webhook] 환불 알림 생성 실패 (비차단)', {
    orderId,
    error: err instanceof Error ? err.message : String(err),
  });
});
```

---

## 🔧 병렬 구현 그룹

### Group A: Webhook 입력 검증 (독립적)
- **담당**: Team-A
- **파일**: `src/app/api/webhooks/payapp/route.ts` (라인 41-200)
- **작업**:
  - P0-1: Content-Length DoS
  - P0-2: HMAC 필수화
  - P1-1: linkval 로깅 마스킹
  - P1-3: Phone 길이 제한
  - P1-4: Price 범위 검증
  - P1-5: landingSlug 형식 검증
- **완료 기준**: TSC --noEmit 통과, 로깅 테스트

### Group B: 결제 요청/취소 검증 (Webhook 로직과 의존성 없음)
- **담당**: Team-B
- **파일**: 
  - `src/app/api/public/payapp/request/route.ts` (P0-5)
  - `src/app/api/payapp/request/route.ts` (동일한 returnUrl 검증 추가)
- **작업**:
  - P0-5: returnUrl 도메인 화이트리스트
  - P1-6: DLQ 민감정보 마스킹
  - P1-7: 취소 시 금액 재검증
- **완료 기준**: TSC --noEmit 통과, E2E 테스트 (returnurl 리다이렉트)

### Group C: 클라이언트 검증 + 완료페이지 (신규)
- **담당**: Team-C
- **파일**:
  - `src/app/p/[slug]/payment/complete/page.tsx` (신규)
  - `src/app/api/payapp/payment/[orderId]/verify/route.ts` (신규)
- **작업**:
  - P0-6: orderId 형식 검증
  - P1-8: AffiliateSale 로그 추가
  - P1-9: 부분취소 분수 범위 검증
  - P1-10: 환불 알림 에러 추적
- **완료 기준**: TSC --noEmit 통과, 완료페이지 UI 검증

---

## ✅ 최종 검증 체크리스트

### Phase 1: 각 팀 검증 (병렬)
- [ ] Team-A: `npx tsc --noEmit` 통과
  - [ ] P0-1 테스트: Content-Length 1MB 초과 → 413 응답
  - [ ] P1-3 테스트: phone 4000자 → 20자로 단축
  - [ ] P1-4 테스트: price -100 → 0, price 999999999999 → 100,000,000
  - [ ] P1-5 테스트: slug에 `<script>` 포함 → 로그 경고, 쿼리 미실행

- [ ] Team-B: `npx tsc --noEmit` 통과
  - [ ] P0-5 테스트: `NEXT_PUBLIC_BASE_URL=https://evil.com` → 400 응답
  - [ ] P1-7 테스트: 취소 시 원금보다 큰 금액 요청 → 400 응답
  - [ ] P1-6 테스트: DLQ 저장된 데이터에서 민감정보 마스킹 확인

- [ ] Team-C: `npx tsc --noEmit` 통과
  - [ ] P0-6 테스트: `/payment/complete?orderId=pay_abc_123` → 성공
  - [ ] P0-6 테스트: `/payment/complete?orderId=<script>alert(1)</script>` → 오류
  - [ ] P1-9 테스트: 부분취소 시 수당 비율 0-1.0 범위 강제

### Phase 2: 병렬 팀 병합 (순차)
- [ ] 모든 파일 병합 (충돌 없음 확인)
- [ ] `npx tsc --noEmit` 재실행 (전체 프로젝트)
- [ ] `npx prisma generate` 실행

### Phase 3: E2E 통합 테스트
- [ ] Webhook 시뮬레이션: 결제 요청 → 웹훅 수신 → 완료페이지
  ```bash
  # 1단계: 결제 요청
  curl -X POST http://localhost:3000/api/public/payapp/request \
    -H "Content-Type: application/json" \
    -d '{"type":"onetime","goodname":"테스트","price":10000,"customerName":"김길동","customerPhone":"01012345678","landingPageId":"landing-123"}'
  
  # 응답: {"ok":true,"type":"onetime","orderId":"pay_abc_123","payUrl":"https://..."}
  
  # 2단계: 웹훅 시뮬레이션 (Postman/curl)
  curl -X POST http://localhost:3000/api/webhooks/payapp \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -H "Authorization: Bearer ${PAYAPP_WEBHOOK_TOKEN}" \
    -d "var1=pay_abc_123&pay_state=4&price=10000&linkval=${PAYAPP_LINKVAL}&..."
  
  # 응답: SUCCESS
  
  # 3단계: 완료페이지 접속
  curl http://localhost:3000/p/landing-slug/payment/complete?orderId=pay_abc_123
  
  # 응답: HTML 완료페이지 (상태: 결제 완료)
  ```

### Phase 4: 최종 배포
- [ ] 모든 체크리스트 항목 완료
- [ ] PR 작성 (P0 6개 + P1 10개 수정사항 명시)
- [ ] Code Review 통과
- [ ] Git commit: `fix(payapp): 3단계 검증 강화 (P0-6+P1-10)`

---

## 🚀 실행 순서

### 개발자별 역할

**Team-A (Webhook 검증)**
```bash
cd /d/mabiz-crm
# 1. P0-1, P0-2, P1-1/3/4/5 구현
# 2. TSC 검증
npx tsc --noEmit
# 3. 로깅 테스트 (콘솔 확인)
npm run dev
# → Postman에서 `/api/webhooks/payapp` 요청 (여러 시나리오)
```

**Team-B (결제 요청 검증)**
```bash
cd /d/mabiz-crm
# 1. P0-5, P1-6/7 구현
# 2. returnUrl 도메인 검증 로직 추가
# 3. TSC 검증
npx tsc --noEmit
# 4. E2E 테스트 (결제 요청 → 리다이렉트)
npm run dev
```

**Team-C (클라이언트 검증)**
```bash
cd /d/mabiz-crm
# 1. 새 파일 생성: src/app/p/[slug]/payment/complete/page.tsx
# 2. 새 API 생성: src/app/api/payapp/payment/[orderId]/verify/route.ts
# 3. P1-8/9/10 로그 추가
# 4. TSC 검증
npx tsc --noEmit
# 5. UI 테스트 (완료페이지 렌더링)
npm run dev
```

---

## 📝 커밋 메시지 템플릿

```
fix(payapp): 3단계 검증 강화 - 16개 보안 버그 수정

P0 (즉시) - 6개:
- [P0-1] Content-Length DoS 방어 (1MB 제한, 413 응답)
- [P0-2] HMAC 필수화 (env 설정 시 401 응답)
- [P0-3] orderId 형식 검증 강화 (DLQ 마스킹 추가)
- [P0-4] Bearer Token 길이 검증 (최소 32자)
- [P0-5] returnUrl 도메인 화이트리스트
- [P0-6] 클라이언트 orderId XSS 방지

P1 (우선) - 10개:
- [P1-1] linkval 로깅 마스킹 (첫 2자+마지막 2자만)
- [P1-3] Phone 길이 제한 (20자)
- [P1-4] Price 오버플로우 방지 (0-100M)
- [P1-5] landingSlug SQL Injection 방지
- [P1-6] DLQ 민감정보 마스킹
- [P1-7] 취소 웹훅 금액 재검증
- [P1-8] AffiliateSale 누락 로그 추가
- [P1-9] 부분취소 분수 범위 검증 (0-1.0)
- [P1-10] 환불 알림 에러 추적

검증:
- TSC --noEmit ✓
- Webhook 단위테스트 ✓
- E2E 결제 흐름 ✓
- 완료페이지 XSS 방지 ✓
```

---

## 🔗 참고 자료

- PayApp API: `src/lib/payapp.ts`
- Webhook 라우트: `src/app/api/webhooks/payapp/route.ts`
- 결제 요청: `src/app/api/public/payapp/request/route.ts`
- 환경변수: `.env.local` (PAYAPP_LINKKEY, PAYAPP_WEBHOOK_TOKEN 등)
- 보안 자료: `docs/contract_esign_webhook_security_2026_0603.md`

---

**마지막 업데이트**: 2026-06-07  
**예상 완료**: 4-6시간 (병렬 구현)  
**최종 검증**: Phase 4 체크리스트 100% 완료 후 배포
