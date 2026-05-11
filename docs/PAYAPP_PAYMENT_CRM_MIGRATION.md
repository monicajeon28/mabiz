# PayApp 결제 시스템 — CRM 이전 가이드

> **작성일:** 2026-05-11  
> **작성자:** 크루즈닷몰 개발팀  
> **목적:** 크루즈닷몰(GMcruise)의 PayApp 결제·랜딩페이지 관리 기능을 mabiz-crm으로 이전하기 위한 완전 가이드

---

## 목차

1. [이전 범위 요약](#1-이전-범위-요약)
2. [환경변수](#2-환경변수)
3. [PayApp API 라이브러리 (복사 가능한 코드)](#3-payapp-api-라이브러리)
4. [API 엔드포인트 — 계약서 결제](#4-api-계약서-결제)
5. [API 엔드포인트 — 랜딩페이지 결제](#5-api-랜딩페이지-결제)
6. [결제 페이지 설정 관리 (관리자)](#6-결제-페이지-설정-관리)
7. [랜딩 페이지 UI](#7-랜딩-페이지-ui)
8. [DB 모델](#8-db-모델)
9. [결제 플로우 다이어그램](#9-결제-플로우-다이어그램)
10. [구현 시 주의사항](#10-구현-시-주의사항)
11. [계약서 타입 코드표](#11-계약서-타입-코드표)
12. [PayApp 상태 코드표](#12-payapp-상태-코드표)

---

## 1. 이전 범위 요약

크루즈닷몰에 구현된 아래 기능들을 CRM으로 이전합니다.

| 기능 | 크루즈닷몰 경로 | CRM에서 할 일 |
|------|--------------|-------------|
| 계약서 결제 링크 생성 | `POST /api/payapp/request` | CRM에서 재구현 |
| 계약서 결제 완료 콜백 | `POST /api/payapp/feedback` | CRM webhook URL로 교체 |
| 랜딩페이지 결제 요청 | `POST /api/payapp/landing/request` | CRM에서 재구현 |
| 랜딩페이지 결제 콜백 | `POST /api/payapp/landing/webhook` | CRM webhook URL로 교체 |
| 관리자 결제페이지 설정 | `GET/POST /api/admin/affiliate/payment-pages` | CRM 어드민에 UI 추가 |
| 이미지 업로드 | `POST /api/admin/affiliate/payment-pages/upload` | CRM에서 처리 |
| 랜딩 결제 페이지 UI | `/affiliate/payment/[contractType]` | CRM 또는 외부 페이지 |

**공유 DB 사용:** 크루즈닷몰과 CRM은 같은 Neon PostgreSQL을 씁니다. 테이블(`AffiliateContract`, `PayAppPayment`, `AffiliateSale` 등)은 이미 공유됩니다.

---

## 2. 환경변수

CRM `.env`에 아래 변수를 추가하세요.

```env
# PayApp 계정 정보 (크루즈닷몰과 동일한 값 사용)
PAYAPP_USERID=hyeseon28
PAYAPP_LINKKEY=CPe1Qyvoll6bPRHfd5pTZO1DPJnCCRVaOgT+oqg6zaM=
PAYAPP_LINKVAL=CPe1Qyvoll6bPRHfd5pTZJKhziNbvfVO9tbzpmrIe6s=

# CRM 도메인 (webhook feedbackurl에 사용)
NEXT_PUBLIC_BASE_URL=https://crm.mabizschool.com  # 실제 CRM 도메인으로 교체
```

> **보안 주의:** `PAYAPP_LINKKEY`와 `PAYAPP_LINKVAL`은 PayApp webhook 검증에 사용됩니다. 절대 클라이언트에 노출하지 마세요. `NEXT_PUBLIC_` 접두사 없이 서버에서만 읽어야 합니다.

---

## 3. PayApp API 라이브러리

`lib/payapp.ts` 파일을 CRM 프로젝트에 그대로 복사하세요.

```typescript
// lib/payapp.ts
// PayApp API 연동 라이브러리

const PAYAPP_API_URL = 'https://api.payapp.kr/oapi/apiLoad.html';

// ============================================
// 타입 정의
// ============================================

export interface PayAppRequestParams {
  cmd: string;
  userid: string;
  goodname: string;
  price: number;
  recvphone: string;
  memo?: string;
  reqaddr?: number;
  feedbackurl?: string;
  var1?: string;
  var2?: string;
  smsuse?: string;
  returnurl?: string;
  openpaytype?: string;
  checkretry?: string;
  skip_cstpage?: string;
  linkkey?: string;   // 결제취소 시에만 필요
  mul_no?: string;    // 결제취소 시에만 필요
  cancelmode?: string;
  partcancel?: string;
  cancelprice?: number;
}

export interface PayAppResponse {
  state: string;
  errorMessage?: string;
  errno?: string;
  mul_no?: string;
  payurl?: string;
  qrurl?: string;
}

export interface PayAppFeedbackData {
  userid: string;
  linkkey: string;
  linkval: string;
  goodname: string;
  price: string;
  recvphone: string;
  pay_state?: string;
  var1?: string;
  var2?: string;
  mul_no?: string;
  pay_date?: string;
  pay_type?: string;
  csturl?: string;
  card_name?: string;
  canceldate?: string;
  cancelprice?: string;
  vbank?: string;
  vbankno?: string;
}

export interface LandingPaymentParams {
  goodname: string;
  price: number;
  recvphone: string;
  memo?: string;
  var1?: string;
  var2?: string;
  feedbackurl: string;
  returnurl?: string;
  smsuse?: 'y' | 'n';
  openpaytype?: string;
}

// pay_state 코드
export const PAY_STATE = {
  REQUESTED: '1',           // 결제요청
  PAID: '4',                // 결제완료
  CANCELLED_REQUEST: '8',   // 요청취소
  CANCELLED_APPROVAL: '9',  // 승인취소 (환불)
  WAITING: '10',            // 결제대기 (가상계좌)
  CANCELLED_REQUEST_2: '32',
  CANCELLED_APPROVAL_2: '64',
  PARTIAL_CANCELLED: '70',  // 부분취소
  PARTIAL_CANCELLED_2: '71',
} as const;

// pay_type 코드
export const PAY_TYPE = {
  CARD: '1',            // 신용카드
  PHONE: '2',           // 휴대전화
  FACE_TO_FACE: '4',    // 대면결제
  BANK_TRANSFER: '6',   // 계좌이체
  VIRTUAL_ACCOUNT: '7', // 가상계좌
  KAKAOPAY: '15',       // 카카오페이
  NAVERPAY: '16',       // 네이버페이
  REGISTERED: '17',     // 등록결제
  SMILEPAY: '21',       // 스마일페이
  WECHATPAY: '22',      // 위챗페이
  APPLEPAY: '23',       // 애플페이
  MYACCOUNT: '24',      // 내통장결제
} as const;

// 환경변수에서 PayApp 설정 읽기 (서버 전용)
const getPayAppConfig = () => ({
  userid: process.env.PAYAPP_USERID || '',
  linkkey: process.env.PAYAPP_LINKKEY || '',
  linkval: process.env.PAYAPP_LINKVAL || '',
});

// ============================================
// 핵심 함수
// ============================================

/**
 * PayApp REST API 호출 (서버 전용)
 * 타임아웃: 15초
 */
export async function payappApiPost(params: PayAppRequestParams): Promise<PayAppResponse> {
  const PAYAPP_TIMEOUT_MS = 15000;

  try {
    const postData = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        postData.append(key, String(value));
      }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYAPP_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(PAYAPP_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: postData.toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`PayApp API 호출 실패: ${response.status}`);
    }

    const responseText = await response.text();

    // PayApp 응답은 URL-encoded 형식
    // indexOf('=') 사용 이유: value에 '='이 포함될 수 있어 split('=')[0]은 부정확
    const parseData: Record<string, string> = {};
    responseText.split('&').forEach((pair) => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) return;
      const key = pair.slice(0, eqIdx);
      const value = pair.slice(eqIdx + 1);
      if (key) parseData[key] = decodeURIComponent(value);
    });

    return parseData as unknown as PayAppResponse;
  } catch (error: unknown) {
    console.error('[PayApp] API 호출 오류:', error);
    return {
      state: '0',
      errorMessage: error instanceof Error ? error.message : 'PayApp API 호출 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 랜딩페이지 결제 요청
 */
export async function requestLandingPayment(params: LandingPaymentParams): Promise<PayAppResponse> {
  const config = getPayAppConfig();

  const requestParams: PayAppRequestParams = {
    cmd: 'payrequest',
    userid: config.userid,
    goodname: params.goodname,
    price: params.price,
    recvphone: params.recvphone,
    feedbackurl: params.feedbackurl,
    checkretry: 'y',
    smsuse: params.smsuse || 'n',
  };

  if (params.memo) requestParams.memo = params.memo;
  if (params.var1) requestParams.var1 = params.var1;
  if (params.var2) requestParams.var2 = params.var2;
  if (params.returnurl) requestParams.returnurl = params.returnurl;
  if (params.openpaytype) requestParams.openpaytype = params.openpaytype;

  return payappApiPost(requestParams);
}

/**
 * 결제 취소 (전체 또는 부분)
 * - 전체취소: partcancel='0'
 * - 부분취소: partcancel='1', cancelprice=취소금액
 */
export async function cancelLandingPayment(params: {
  mul_no: string;
  cancelmode?: 'ready';
  partcancel?: '0' | '1';
  cancelprice?: number;
}): Promise<PayAppResponse> {
  const config = getPayAppConfig();

  const requestParams: any = {
    cmd: 'paycancel',
    userid: config.userid,
    linkkey: config.linkkey,
    mul_no: params.mul_no,
  };

  if (params.cancelmode) requestParams.cancelmode = params.cancelmode;
  if (params.partcancel) requestParams.partcancel = params.partcancel;
  if (params.cancelprice != null) requestParams.cancelprice = params.cancelprice;

  return payappApiPost(requestParams);
}

/**
 * PayApp Webhook 보안 검증
 * webhook에서 받은 userid/linkkey/linkval을 환경변수와 비교
 */
export function validatePayAppFeedback(data: Partial<PayAppFeedbackData>): boolean {
  const config = getPayAppConfig();

  const isValidUserId = data.userid === config.userid;
  const isValidLinkKey = data.linkkey === config.linkkey;
  const isValidLinkVal = data.linkval === config.linkval;

  if (!isValidUserId || !isValidLinkKey || !isValidLinkVal) {
    console.error('[PayApp] Webhook 검증 실패');
    return false;
  }

  return true;
}

/**
 * pay_state 코드 → 상태 문자열 변환
 */
export function getPaymentStatus(payState: string): string {
  switch (payState) {
    case PAY_STATE.PAID: return 'paid';
    case PAY_STATE.CANCELLED_REQUEST:
    case PAY_STATE.CANCELLED_REQUEST_2: return 'cancelled';
    case PAY_STATE.CANCELLED_APPROVAL:
    case PAY_STATE.CANCELLED_APPROVAL_2: return 'refunded';
    case PAY_STATE.PARTIAL_CANCELLED:
    case PAY_STATE.PARTIAL_CANCELLED_2: return 'partial_refunded';
    case PAY_STATE.WAITING: return 'waiting';
    case PAY_STATE.REQUESTED: return 'requested';
    default: return 'unknown';
  }
}

/**
 * 계약서 타입별 결제 금액
 */
export function getContractPrice(contractType: string): number {
  const prices: Record<string, number> = {
    SALES_AGENT: 3300000,      // 판매원: 330만원
    BRANCH_MANAGER: 7500000,   // 대리점장: 750만원
    CRUISE_STAFF: 5400000,     // 크루즈스탭: 540만원
    PRIMARKETER: 1000000,      // 프리마케터: 100만원
    SUBSCRIPTION_AGENT: 100000, // 정액제: 10만원/월
  };
  return prices[contractType] ?? 0;
}

/**
 * 계약서 타입별 상품명
 */
export function getContractGoodName(contractType: string): string {
  const names: Record<string, string> = {
    SALES_AGENT: '판매원 계약서',
    BRANCH_MANAGER: '대리점장 계약서',
    CRUISE_STAFF: '크루즈스탭 계약서',
    PRIMARKETER: '프리마케터 계약서',
    SUBSCRIPTION_AGENT: '정액제 판매원 1개월 구독',
  };
  return names[contractType] ?? '계약서';
}
```

---

## 4. API — 계약서 결제

### 4-1. 결제 링크 생성 `POST /api/payapp/request`

CRM에서 계약서 결제 링크를 생성할 때 호출합니다.

**요청 Body:**
```json
{
  "contractId": 123,
  "contractType": "SALES_AGENT",
  "phone": "01012345678",
  "name": "홍길동"
}
```

**구현 로직:**
```typescript
// app/api/payapp/request/route.ts (CRM)
import { NextResponse } from 'next/server';
import { payappApiPost, getContractPrice, getContractGoodName } from '@/lib/payapp';
import { checkAdminAuth } from '@/lib/auth'; // CRM 인증

export async function POST(req: Request) {
  // 1. 관리자 인증 필수
  const { isAdmin } = await checkAdminAuth();
  if (!isAdmin) {
    return NextResponse.json({ ok: false, message: '관리자만 접근 가능합니다.' }, { status: 401 });
  }

  const body = await req.json();
  const { contractId, contractType, phone, name } = body;

  // 2. 필수값 검증
  if (!contractId || !contractType || !phone) {
    return NextResponse.json({ ok: false, message: '필수 파라메터 누락' }, { status: 400 });
  }

  // 3. 전화번호 정제 (숫자만)
  const cleanPhone = String(phone).replace(/[^0-9]/g, '');
  if (!/^01[0-9]{8,9}$/.test(cleanPhone)) {
    return NextResponse.json({ ok: false, message: '올바른 휴대폰 번호 형식이 아닙니다.' }, { status: 400 });
  }

  const price = getContractPrice(contractType);
  if (price === 0) {
    return NextResponse.json({ ok: false, message: '유효하지 않은 계약서 타입' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || '';

  // 4. PayApp 결제 요청
  const result = await payappApiPost({
    cmd: 'payrequest',
    userid: process.env.PAYAPP_USERID!,
    goodname: `${getContractGoodName(contractType)} - ${name || '고객'}`,
    price,
    recvphone: cleanPhone,
    memo: `${getContractGoodName(contractType)} 계약서 결제`,
    feedbackurl: `${baseUrl}/api/payapp/feedback`,     // CRM의 webhook URL
    returnurl: `${baseUrl}/affiliate/contract/success?contractId=${contractId}`,
    var1: String(contractId),   // DB contractId
    var2: contractType,         // 계약서 타입 구분용
    smsuse: 'n',
    openpaytype: 'card',
    checkretry: 'y',
    skip_cstpage: 'y',
  });

  if (result.state === '1') {
    return NextResponse.json({ ok: true, payurl: result.payurl, mul_no: result.mul_no });
  } else {
    return NextResponse.json(
      { ok: false, message: result.errorMessage || '결제 요청 실패' },
      { status: 400 }
    );
  }
}
```

---

### 4-2. 계약서 결제 완료 Webhook `POST /api/payapp/feedback`

PayApp이 결제 완료/취소 시 서버에 직접 호출하는 URL입니다.

**중요:** 반드시 `SUCCESS` 문자열을 200으로 응답해야 합니다. 실패하면 PayApp이 재시도합니다.

```typescript
// app/api/payapp/feedback/route.ts (CRM)
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validatePayAppFeedback, PAY_STATE } from '@/lib/payapp';

export async function POST(req: Request) {
  try {
    // 1. Content-Type에 따라 body 파싱 (PayApp은 form-urlencoded 전송)
    let body: Record<string, string> = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      formData.forEach((value, key) => { body[key] = value.toString(); });
    } else {
      body = await req.json();
    }

    // 2. 보안 검증 (linkkey/linkval 일치 확인)
    if (!validatePayAppFeedback(body as any)) {
      return new NextResponse('FAIL', { status: 400 });
    }

    const { pay_state, mul_no, var1, var2, price, pay_date, pay_type } = body;

    // 3. var2로 랜딩페이지/계약서 구분
    if (var2?.startsWith('LP_')) {
      // 랜딩페이지 결제 → 별도 webhook URL 사용 권장 (4-4 참고)
      // 여기서는 생략
    } else {
      // 계약서 결제 처리
      const contractId = parseInt(var1 || '0');
      if (!contractId) return new NextResponse('FAIL', { status: 400 });

      const contract = await prisma.affiliateContract.findUnique({ where: { id: contractId } });
      if (!contract) return new NextResponse('FAIL', { status: 404 });

      if (pay_state === PAY_STATE.PAID) {
        // 결제 완료 처리
        const metadata = (contract.metadata as any) || {};
        metadata.payment = { mul_no, price: parseInt(price || '0'), pay_date, pay_type, pay_state: 'completed' };

        if (var2 === 'SUBSCRIPTION_AGENT') {
          // 정액제 특별 처리 → 아래 4-3 섹션 참고
          await handleSubscriptionPayment(contract, metadata, mul_no, price, pay_date, pay_type);
        } else {
          await prisma.affiliateContract.update({
            where: { id: contractId },
            data: { metadata },
          });
        }
      } else if (pay_state === PAY_STATE.CANCELLED_APPROVAL || pay_state === PAY_STATE.CANCELLED_APPROVAL_2) {
        // 환불 처리
        const metadata = (contract.metadata as any) || {};
        metadata.payment = { ...metadata.payment, pay_state: 'cancelled', cancel_date: new Date().toISOString() };
        await prisma.affiliateContract.update({ where: { id: contractId }, data: { metadata } });
      }
    }

    // 4. 반드시 SUCCESS 반환
    return new NextResponse('SUCCESS', { status: 200 });
  } catch (error) {
    console.error('[PayApp Feedback]', error);
    // 오류 시에도 SUCCESS 반환 (재시도 방지)
    return new NextResponse('SUCCESS', { status: 200 });
  }
}
```

---

### 4-3. 정액제(SUBSCRIPTION_AGENT) 결제 특별 처리

계약서 타입이 `SUBSCRIPTION_AGENT`일 때 추가 로직이 필요합니다.

**로직 순서:**
```
1. 무료 체험 중인지 확인 (metadata.isTrial === true)
   → YES: 무료 체험 종료일 + 1개월 = 새 구독 만료일
   → NO + 현재 구독 유효: 기존 만료일 + 1개월 = 새 구독 만료일
   → NO + 구독 만료: 오늘 + 1개월 = 새 구독 만료일

2. gest 계정 자동 생성 (trial_ 계정이거나 mallUserId 없는 경우)
   → 다음 gest 번호 조회: SELECT MAX(mallUserId) WHERE mallUserId LIKE 'gest%'
   → mallUserId = "gest{N}", 랜덤 8자리 비밀번호 생성
   → User 업데이트 + AffiliateProfile 업데이트 (landingSlug = mallUserId)

3. 계약서 업데이트:
   - status = 'completed'
   - contractEndDate = 새 구독 만료일
   - metadata.isTrial = false
   - metadata.nextBillingDate = 새 구독 만료일
   - metadata.accountInfo = { mallUserId, password, createdAt }
```

```typescript
async function handleSubscriptionPayment(
  contract: any,
  metadata: any,
  mul_no: string | undefined,
  price: string | undefined,
  pay_date: string | undefined,
  pay_type: string | undefined,
) {
  const now = new Date();
  const isCurrentlyTrial = metadata.isTrial === true;
  const currentTrialEndDate = metadata.trialEndDate ? new Date(metadata.trialEndDate) : null;
  const currentContractEndDate = contract.contractEndDate ? new Date(contract.contractEndDate) : null;

  let newContractEndDate: Date;

  if (isCurrentlyTrial && currentTrialEndDate) {
    // 무료 체험 중 결제 → 체험 종료 후 1개월
    newContractEndDate = new Date(currentTrialEndDate);
    newContractEndDate.setMonth(newContractEndDate.getMonth() + 1);
  } else if (currentContractEndDate && now < currentContractEndDate) {
    // 구독 중 미리 결제 → 만료일 + 1개월
    newContractEndDate = new Date(currentContractEndDate);
    newContractEndDate.setMonth(newContractEndDate.getMonth() + 1);
  } else {
    // 만료 후 재결제 → 오늘 + 1개월
    newContractEndDate = new Date(now);
    newContractEndDate.setMonth(newContractEndDate.getMonth() + 1);
  }

  metadata.payment = { mul_no, price: parseInt(price || '0'), pay_date, pay_type, pay_state: 'completed' };
  if (isCurrentlyTrial) {
    metadata.isTrial = false;
    metadata.trialEndDate = null;
    metadata.subscriptionStartDate = now.toISOString();
  }
  metadata.lastPaymentDate = pay_date || now.toISOString();
  metadata.nextBillingDate = newContractEndDate.toISOString();

  // gest 계정 자동 생성
  const user = await prisma.user.findUnique({ where: { id: contract.userId } });
  if (user && (!user.mallUserId || user.mallUserId.startsWith('trial_'))) {
    const existingGest = await prisma.user.findMany({
      where: { mallUserId: { startsWith: 'gest' } },
      orderBy: { mallUserId: 'desc' },
      take: 1,
    });

    let nextNumber = 1;
    if (existingGest.length > 0) {
      const match = existingGest[0].mallUserId?.match(/gest(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }

    const mallUserId = `gest${nextNumber}`;
    const password = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mallUserId,
        password, // 평문 저장 (기존 시스템 방식 유지)
        name: metadata.userInfo?.name || contract.name,
        phone: metadata.userInfo?.phone || contract.phone,
      },
    });

    // AffiliateProfile 생성 또는 업데이트
    const existingProfile = await prisma.affiliateProfile.findFirst({ where: { userId: user.id } });
    if (existingProfile) {
      await prisma.affiliateProfile.update({
        where: { id: existingProfile.id },
        data: { displayName: user.name || '', nickname: user.name || '', landingSlug: mallUserId, updatedAt: now },
      });
    } else {
      const affiliateCode = `GEST${nextNumber}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      await prisma.affiliateProfile.create({
        data: {
          userId: user.id,
          affiliateCode,
          type: 'SALES_AGENT',
          status: 'ACTIVE',
          displayName: user.name || '',
          nickname: user.name || '',
          landingSlug: mallUserId,
          updatedAt: now,
        },
      });
    }

    metadata.accountInfo = { mallUserId, password, createdAt: now.toISOString() };
  }

  await prisma.affiliateContract.update({
    where: { id: contract.id },
    data: {
      status: 'completed',
      metadata,
      contractEndDate: newContractEndDate,
      updatedAt: now,
    },
  });
}
```

---

## 5. API — 랜딩페이지 결제

### 5-1. 결제 요청 `POST /api/payapp/landing/request`

```typescript
// app/api/payapp/landing/request/route.ts (CRM)
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requestLandingPayment } from '@/lib/payapp';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { landingPageId, productName, amount, customerName, customerPhone, customerEmail, returnUrl, payType } = body;

    // 어필리에이트 추적: 쿠키에서 읽기
    const cookies = req.cookies;
    const affiliateCode = cookies.get('affiliate_code')?.value || null;
    const affiliateMallUserId = cookies.get('affiliate_mall_user_id')?.value || null;

    // 필수값 검증
    if (!landingPageId || !productName || !amount || !customerName || !customerPhone) {
      return NextResponse.json({ ok: false, error: '필수 정보 누락' }, { status: 400 });
    }
    if (amount < 1000) {
      return NextResponse.json({ ok: false, error: '결제 금액은 1,000원 이상' }, { status: 400 });
    }

    // 랜딩페이지 존재 확인
    const landingPage = await prisma.landingPage.findUnique({ where: { id: landingPageId } });
    if (!landingPage) {
      return NextResponse.json({ ok: false, error: '랜딩페이지 없음' }, { status: 404 });
    }

    const orderId = `LP${landingPageId}-${Date.now()}-${nanoid(6)}`;
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');

    // affiliate 정보 metadata에 저장
    const affiliateMetadata: Record<string, string> = {};
    if (affiliateCode) affiliateMetadata.affiliateCode = affiliateCode;
    if (affiliateMallUserId) affiliateMetadata.affiliateMallUserId = affiliateMallUserId;

    // DB에 결제 레코드 생성 (pending)
    const payment = await prisma.payAppPayment.create({
      data: {
        orderId,
        landingPageId,
        productName,
        amount,
        customerName,
        customerPhone: cleanPhone,
        customerEmail: customerEmail || null,
        status: 'pending',
        var1: orderId,
        var2: landingPageId.toString(),
        metadata: Object.keys(affiliateMetadata).length > 0 ? affiliateMetadata : undefined,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || '';

    // PayApp 결제 요청
    const result = await requestLandingPayment({
      goodname: productName,
      price: amount,
      recvphone: cleanPhone,
      memo: `랜딩페이지: ${landingPage.title}`,
      var1: orderId,
      var2: landingPageId.toString(),
      feedbackurl: `${baseUrl}/api/payapp/landing/webhook`,
      returnurl: returnUrl || `${baseUrl}/landing/${landingPage.slug}/payment/complete?orderId=${orderId}`,
      smsuse: 'n',
      openpaytype: payType || undefined,
    });

    if (result.state !== '1') {
      await prisma.payAppPayment.update({
        where: { id: payment.id },
        data: { status: 'failed', metadata: { error: result.errorMessage } },
      });
      return NextResponse.json({ ok: false, error: result.errorMessage || '결제 요청 실패' }, { status: 400 });
    }

    // mul_no, payUrl 저장
    await prisma.payAppPayment.update({
      where: { id: payment.id },
      data: { mulNo: result.mul_no, payUrl: result.payurl, status: 'requested' },
    });

    return NextResponse.json({ ok: true, orderId, paymentId: payment.id, mulNo: result.mul_no, payUrl: result.payurl });
  } catch (error) {
    console.error('[PayApp Landing Request]', error);
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
```

---

### 5-2. 랜딩페이지 결제 Webhook `POST /api/payapp/landing/webhook`

```typescript
// app/api/payapp/landing/webhook/route.ts (CRM)
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validatePayAppFeedback, PAY_STATE } from '@/lib/payapp';

export async function POST(req: Request) {
  try {
    let body: Record<string, string> = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      formData.forEach((value, key) => { body[key] = value.toString(); });
    } else {
      const text = await req.text();
      new URLSearchParams(text).forEach((value, key) => { body[key] = value; });
    }

    if (!validatePayAppFeedback(body as any)) {
      return new NextResponse('FAIL', { status: 400 });
    }

    const { pay_state, mul_no, price, pay_date, pay_type, csturl, card_name, canceldate, var1: orderId } = body;

    if (!orderId) return new NextResponse('FAIL', { status: 400 });

    const payment = await prisma.payAppPayment.findUnique({
      where: { orderId },
      include: { LandingPage: { select: { id: true, title: true, slug: true } } },
    });

    if (!payment) return new NextResponse('FAIL', { status: 404 });

    const existingMeta = (payment.metadata as Record<string, any>) || {};

    switch (pay_state) {
      case PAY_STATE.PAID: {
        const paidAmount = parseInt(price || '0');
        await prisma.payAppPayment.update({
          where: { id: payment.id },
          data: {
            status: 'paid',
            mulNo: mul_no || payment.mulNo,
            payType: pay_type,
            cstUrl: csturl,
            cardName: card_name,
            paidAt: new Date(),
            metadata: { ...existingMeta, pay_date, pay_state: 'paid' },
          },
        });

        // 어필리에이트 판매 기록 생성
        const metaAffiliateCode: string | null = existingMeta.affiliateCode || null;
        const metaAffiliateMallUserId: string | null = existingMeta.affiliateMallUserId || null;

        if (metaAffiliateCode || metaAffiliateMallUserId) {
          const profileWhere: any = { status: 'ACTIVE' };
          if (metaAffiliateCode) profileWhere.affiliateCode = metaAffiliateCode;
          else if (metaAffiliateMallUserId) profileWhere.User = { mallUserId: metaAffiliateMallUserId };

          const profile = await prisma.affiliateProfile.findFirst({ where: profileWhere, select: { id: true, type: true } });

          if (profile) {
            let managerId: number | null = null;
            let agentId: number | null = null;

            if (profile.type === 'BRANCH_MANAGER') {
              managerId = profile.id;
            } else if (profile.type === 'SALES_AGENT') {
              agentId = profile.id;
              const relation = await prisma.affiliateRelation.findFirst({
                where: { agentId: profile.id, status: 'ACTIVE' }, select: { managerId: true },
              });
              if (relation) managerId = relation.managerId;
            }

            const existingSale = await prisma.affiliateSale.findFirst({ where: { externalOrderCode: orderId } });
            if (!existingSale) {
              await prisma.affiliateSale.create({
                data: {
                  externalOrderCode: orderId,
                  managerId,
                  agentId,
                  saleAmount: paidAmount,
                  status: 'PENDING',
                  saleDate: new Date(),
                  updatedAt: new Date(),
                  metadata: {
                    source: 'payapp_landing',
                    landingPageId: payment.landingPageId,
                    productName: payment.productName,
                    affiliateCode: metaAffiliateCode,
                  },
                },
              });
            }
          }
        }
        break;
      }

      case PAY_STATE.CANCELLED_REQUEST:
      case PAY_STATE.CANCELLED_REQUEST_2:
        await prisma.payAppPayment.update({
          where: { id: payment.id },
          data: {
            status: 'cancelled', cancelledAt: new Date(),
            metadata: { ...existingMeta, pay_state: 'cancelled', cancel_date: canceldate },
          },
        });
        break;

      case PAY_STATE.CANCELLED_APPROVAL:
      case PAY_STATE.CANCELLED_APPROVAL_2:
        await prisma.payAppPayment.update({
          where: { id: payment.id },
          data: {
            status: 'refunded', refundedAt: new Date(), refundAmount: payment.amount,
            metadata: { ...existingMeta, pay_state: 'refunded', cancel_date: canceldate },
          },
        });
        break;

      case PAY_STATE.PARTIAL_CANCELLED:
      case PAY_STATE.PARTIAL_CANCELLED_2: {
        const cancelPrice = parseInt(body.cancelprice || '0');
        await prisma.payAppPayment.update({
          where: { id: payment.id },
          data: {
            status: 'partial_refunded', refundedAt: new Date(),
            refundAmount: (payment.refundAmount || 0) + cancelPrice,
            metadata: { ...existingMeta, pay_state: 'partial_refunded', partial_cancel_price: cancelPrice },
          },
        });
        break;
      }

      case PAY_STATE.WAITING:
        await prisma.payAppPayment.update({
          where: { id: payment.id },
          data: {
            status: 'waiting',
            metadata: { ...existingMeta, pay_state: 'waiting', vbank: body.vbank, vbankno: body.vbankno },
          },
        });
        break;
    }

    return new NextResponse('SUCCESS', { status: 200 });
  } catch (error) {
    console.error('[PayApp Landing Webhook]', error);
    return new NextResponse('SUCCESS', { status: 200 }); // 오류여도 SUCCESS 반환
  }
}
```

---

## 6. 결제 페이지 설정 관리

관리자가 계약서 타입별 결제 링크, 이미지를 관리하는 기능입니다.

### 설정 파일 위치

크루즈닷몰은 `data/affiliate-payment-pages.json` 파일로 설정을 저장합니다.  
CRM은 DB에 저장하거나 동일하게 파일로 관리할 수 있습니다.

```json
{
  "configs": [
    {
      "contractType": "SALES_AGENT",
      "label": "판매원 계약서",
      "price": 3300000,
      "paymentLink": "http://leadz.kr/yej",
      "cruiseDotPaymentLink": null,
      "imageUrl": "/payment-pages/payment-page-SALES_AGENT-1763431700628.png"
    },
    {
      "contractType": "BRANCH_MANAGER",
      "label": "대리점장 계약서",
      "price": 7500000,
      "paymentLink": "http://leadz.kr/xWG",
      "cruiseDotPaymentLink": null,
      "imageUrl": null
    },
    {
      "contractType": "CRUISE_STAFF",
      "label": "크루즈스탭 계약서",
      "price": 5400000,
      "paymentLink": "http://leadz.kr/yek",
      "cruiseDotPaymentLink": null,
      "imageUrl": null
    },
    {
      "contractType": "PRIMARKETER",
      "label": "프리마케터 계약서",
      "price": 1000000,
      "paymentLink": "http://leadz.kr/ymF",
      "cruiseDotPaymentLink": null,
      "imageUrl": null
    }
  ]
}
```

### 설정 조회 API `GET /api/admin/affiliate/payment-pages`

```typescript
// 인증 없이 공개 (랜딩페이지에서도 읽어야 함)
// 또는 공개 GET + 관리자 POST로 분리
export async function GET() {
  const settings = await readSettingsFile(); // 파일 또는 DB 읽기
  return NextResponse.json({ ok: true, configs: settings.configs });
}
```

### 설정 저장 API `POST /api/admin/affiliate/payment-pages`

```typescript
// 관리자 인증 필수
export async function POST(req: Request) {
  const { isAdmin } = await checkAdminAuth();
  if (!isAdmin) return NextResponse.json({ ok: false }, { status: 401 });

  const { configs } = await req.json();
  await writeSettingsFile({ configs });
  return NextResponse.json({ ok: true });
}
```

---

## 7. 랜딩 페이지 UI

계약서 타입별 결제 페이지 (`/affiliate/payment/[contractType]`)

**핵심 동작:**
1. URL 쿼리 파라미터에서 `contractId`, `phone`, `name` 읽기
2. 설정에서 해당 타입 이미지/링크 불러오기
3. 결제 버튼 2개 표시:
   - "리드젠 결제" → 리드젠 링크로 리다이렉트
   - "크루즈닷 페이앱 결제" → `/api/payapp/request` 호출 후 payurl로 리다이렉트

**URL 진입 예시:**
```
/affiliate/payment/SALES_AGENT?contractId=123&phone=01012345678&name=홍길동
```

**주의:** `contractId`, `phone`, `name`이 없으면 결제 불가 처리해야 합니다.

---

## 8. DB 모델

공유 DB에 이미 존재하는 테이블입니다. CRM에서 prisma.schema에 추가하여 사용하세요.

### PayAppPayment

```prisma
model PayAppPayment {
  id          String    @id @default(cuid())
  orderId     String    @unique
  landingPageId Int
  productName String
  amount      Int
  customerName String
  customerPhone String
  customerEmail String?
  status      String    // pending, requested, paid, cancelled, refunded, partial_refunded, waiting, failed
  mulNo       String?   // PayApp 결제번호
  payUrl      String?   // 결제페이지 URL
  payType     String?   // 결제수단 코드
  cstUrl      String?   // 매출전표 URL
  cardName    String?   // 카드사명
  paidAt      DateTime?
  cancelledAt DateTime?
  refundedAt  DateTime?
  refundAmount Int      @default(0)
  var1        String?   // orderId (PayApp 임의변수1)
  var2        String?   // landingPageId (PayApp 임의변수2)
  metadata    Json?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  LandingPage LandingPage @relation(fields: [landingPageId], references: [id])
}
```

### AffiliateContract (기존 테이블, 관련 필드)

```prisma
model AffiliateContract {
  id              Int       @id @default(autoincrement())
  userId          Int
  contractType    String    // SALES_AGENT, BRANCH_MANAGER, CRUISE_STAFF, PRIMARKETER, SUBSCRIPTION_AGENT
  name            String
  phone           String
  status          String    // pending, completed, cancelled
  contractEndDate DateTime?
  metadata        Json?     // payment{mul_no, price, pay_date, pay_type}, isTrial, accountInfo 등
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

---

## 9. 결제 플로우 다이어그램

### 9-1. 계약서 결제

```
CRM 어드민 (관리자)
  → "계약서 ID 123, 010-1234-5678" 입력 후 결제 링크 생성 클릭
  → POST /api/payapp/request { contractId:123, contractType:"SALES_AGENT", phone, name }
  → PayApp API 호출 → payurl 반환
  → 관리자가 payurl을 고객에게 전달 (카카오톡, SMS 등)

고객
  → payurl 클릭 → PayApp 결제 페이지에서 카드 결제
  → PayApp → POST /api/payapp/feedback { pay_state:"4", mul_no, var1:contractId }
  → AffiliateContract.metadata.payment 업데이트
  → (SUBSCRIPTION_AGENT이면) gest 계정 자동 생성 + contractEndDate 업데이트
```

### 9-2. 랜딩페이지 결제

```
방문자
  → 랜딩페이지 방문 (쿠키에 affiliate_code 저장됨)
  → 결제 폼 입력 (이름, 전화번호, 이메일)
  → POST /api/payapp/landing/request { landingPageId, productName, amount, ... }
  → PayAppPayment 생성 (pending)
  → PayApp API 호출 → payUrl 반환
  → 방문자 → payUrl로 이동 → 결제

PayApp
  → POST /api/payapp/landing/webhook { pay_state:"4", var1:orderId }
  → PayAppPayment.status = 'paid'
  → AffiliateSale 생성 (쿠키 affiliateCode 기준)
```

---

## 10. 구현 시 주의사항

### 10-1. 반드시 지켜야 할 것

| 항목 | 설명 |
|------|------|
| Webhook은 항상 SUCCESS | PayApp이 FAIL 받으면 재시도. 에러가 나도 `return new NextResponse('SUCCESS')` |
| linkkey/linkval 검증 필수 | 검증 없으면 가짜 webhook으로 결제 위조 가능 |
| 중복 AffiliateSale 방지 | `externalOrderCode`로 이미 존재하는지 체크 후 생성 |
| 전화번호 정제 | `replace(/[^0-9]/g, '')` 로 숫자만 추출 후 PayApp에 전달 |
| 타임아웃 15초 | PayApp API 호출 시 AbortController로 15초 타임아웃 설정 |
| PAYAPP_LINKKEY 서버 전용 | 절대 클라이언트 컴포넌트나 NEXT_PUBLIC_ 에 노출 금지 |

### 10-2. var1, var2 사용 규칙

| 결제 종류 | var1 | var2 |
|---------|------|------|
| 계약서 결제 | contractId (숫자 문자열) | contractType ("SALES_AGENT" 등) |
| 랜딩페이지 결제 | orderId ("LP123-...") | landingPageId (숫자 문자열) |

> **구분 방법:** `var2.startsWith('LP_')` 이면 랜딩페이지 결제 (기존 크루즈닷몰 코드는 `var2`에 랜딩 ID를 직접 저장했으나, feedback/route.ts에서는 `var2.startsWith('LP_')`로 구분함)

### 10-3. gest 계정 번호 채번 시 race condition 주의

동시에 여러 SUBSCRIPTION_AGENT 결제가 완료되면 같은 gest 번호가 발급될 수 있습니다.  
DB 트랜잭션 또는 `FOR UPDATE` 락을 사용하는 것을 권장합니다.

```typescript
// 안전한 채번 방법 (Prisma 트랜잭션)
await prisma.$transaction(async (tx) => {
  const existingGest = await tx.user.findMany({
    where: { mallUserId: { startsWith: 'gest' } },
    orderBy: { mallUserId: 'desc' },
    take: 1,
  });
  // ... 채번 및 생성
});
```

### 10-4. feedbackurl 설정

PayApp에 등록하는 feedbackurl은 PayApp 어드민에서도 설정해야 합니다.  
- 계약서: `https://[CRM 도메인]/api/payapp/feedback`
- 랜딩페이지: `https://[CRM 도메인]/api/payapp/landing/webhook`

---

## 11. 계약서 타입 코드표

| contractType | 한국어 명칭 | 결제 금액 | 리드젠 링크 |
|-------------|-----------|---------|-----------|
| `SALES_AGENT` | 판매원 계약서 | 3,300,000원 | `http://leadz.kr/yej` |
| `BRANCH_MANAGER` | 대리점장 계약서 | 7,500,000원 | `http://leadz.kr/xWG` |
| `CRUISE_STAFF` | 크루즈스탭 계약서 | 5,400,000원 | `http://leadz.kr/yek` |
| `PRIMARKETER` | 프리마케터 계약서 | 1,000,000원 | `http://leadz.kr/ymF` |
| `SUBSCRIPTION_AGENT` | 정액제 판매원 | 100,000원/월 | — |

---

## 12. PayApp 상태 코드표

### pay_state

| 코드 | 의미 | 처리 |
|------|------|------|
| `1` | 결제요청 | 로그만 |
| `4` | 결제완료 | DB 업데이트, AffiliateSale 생성 |
| `8`, `32` | 요청취소 | status = 'cancelled' |
| `9`, `64` | 승인취소(환불) | status = 'refunded' |
| `10` | 결제대기(가상계좌) | status = 'waiting', vbank/vbankno 저장 |
| `70`, `71` | 부분취소 | status = 'partial_refunded', refundAmount += cancelprice |

### pay_type

| 코드 | 결제수단 |
|------|--------|
| `1` | 신용카드 |
| `2` | 휴대전화 |
| `4` | 대면결제 |
| `6` | 계좌이체 |
| `7` | 가상계좌 |
| `15` | 카카오페이 |
| `16` | 네이버페이 |
| `23` | 애플페이 |

---

*이 문서의 모든 코드는 크루즈닷몰(GMcruise) 현재 production 코드에서 추출했습니다.*  
*공유 DB 테이블(AffiliateContract, PayAppPayment, AffiliateSale)은 크루즈닷몰 스키마를 기준으로 합니다.*
