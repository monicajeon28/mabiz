/**
 * PayApp REST API 클라이언트 (B2B 결제 전용)
 *
 * API URL: https://api.payapp.kr/oapi/apiLoad.html
 * 방식: FORM POST (UTF-8)
 * 응답: KEY=VALUE query string
 *
 * ⚠️ 크루즈닷몰(웰컴페이먼츠/B2C)과 완전 분리
 *    이 모듈은 CRM 자체 PayAppPayment/PayAppSubscription만 사용
 */

import { logger } from '@/lib/logger';

const PAYAPP_API_URL = 'https://api.payapp.kr/oapi/apiLoad.html';

interface PayAppConfig {
  userid: string;
  linkkey: string;
  linkval: string;
}

interface PayAppResponse {
  state: string;
  errorMessage?: string;
  [key: string]: string | undefined;
}

function getConfig(): PayAppConfig {
  const userid = process.env.PAYAPP_USERID;
  const linkkey = process.env.PAYAPP_LINKKEY;
  const linkval = process.env.PAYAPP_LINKVAL;

  if (!userid || !linkkey || !linkval) {
    throw new Error('PayApp 환경변수 미설정: PAYAPP_USERID, PAYAPP_LINKKEY, PAYAPP_LINKVAL 필수');
  }

  return { userid, linkkey, linkval };
}

/**
 * PayApp REST API 호출 (FORM POST)
 */
async function payappApiPost(params: Record<string, string>): Promise<PayAppResponse> {
  const body = new URLSearchParams(params);

  const res = await fetch(PAYAPP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString(),
  });

  const text = await res.text();
  const parsed = Object.fromEntries(new URLSearchParams(text));

  return parsed as PayAppResponse;
}

// ─── 일반 결제 ────────────────────────────────────────────────

interface RequestPaymentParams {
  goodname: string;
  price: number;
  recvphone: string;
  feedbackurl: string;
  var1?: string;      // orderId
  var2?: string;      // landingPageSlug 등
  returnurl?: string;
  recvemail?: string;
  openpaytype?: string; // card,phone,kakaopay 등
  smsuse?: string;      // n: SMS 안 보냄
}

export async function requestPayment(params: RequestPaymentParams): Promise<{
  ok: boolean;
  mulNo?: string;
  payUrl?: string;
  error?: string;
}> {
  const config = getConfig();

  const result = await payappApiPost({
    cmd: 'payrequest',
    userid: config.userid,
    goodname: params.goodname,
    price: String(params.price),
    recvphone: params.recvphone.replace(/[^0-9]/g, ''),
    feedbackurl: params.feedbackurl,
    ...(params.var1 ? { var1: params.var1 } : {}),
    ...(params.var2 ? { var2: params.var2 } : {}),
    ...(params.returnurl ? { returnurl: params.returnurl } : {}),
    ...(params.recvemail ? { recvemail: params.recvemail } : {}),
    ...(params.openpaytype ? { openpaytype: params.openpaytype } : {}),
    ...(params.smsuse ? { smsuse: params.smsuse } : {}),
    checkretry: 'y',
    skip_cstpage: 'y',
  });

  if (result.state === '1') {
    return { ok: true, mulNo: result.mul_no, payUrl: result.payurl };
  }
  logger.error('[PayApp] 결제 요청 실패', { error: result.errorMessage });
  return { ok: false, error: result.errorMessage ?? '결제 요청 실패' };
}

// ─── 결제 취소 ────────────────────────────────────────────────

interface CancelPaymentParams {
  mulNo: string;
  cancelmemo: string;
  partcancel?: boolean;
  cancelprice?: number;
}

export async function cancelPayment(params: CancelPaymentParams): Promise<{
  ok: boolean;
  error?: string;
}> {
  const config = getConfig();

  const result = await payappApiPost({
    cmd: 'paycancel',
    userid: config.userid,
    linkkey: config.linkkey,
    mul_no: params.mulNo,
    cancelmemo: params.cancelmemo,
    ...(params.partcancel ? { partcancel: '1', cancelprice: String(params.cancelprice ?? 0) } : { partcancel: '0' }),
  });

  if (result.state === '1') return { ok: true };
  logger.error('[PayApp] 결제 취소 실패', { error: result.errorMessage, mulNo: params.mulNo });
  return { ok: false, error: result.errorMessage ?? '결제 취소 실패' };
}

/**
 * D+5 경과 또는 정산 완료 건 취소 요청
 */
export async function requestCancelAfterSettlement(params: {
  mulNo: string;
  cancelmemo: string;
  dpname?: string;
  partcancel?: boolean;
  cancelprice?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const config = getConfig();

  const result = await payappApiPost({
    cmd: 'paycancelreq',
    userid: config.userid,
    linkkey: config.linkkey,
    mul_no: params.mulNo,
    cancelmemo: params.cancelmemo,
    ...(params.dpname ? { dpname: params.dpname } : {}),
    ...(params.partcancel ? { partcancel: '1', cancelprice: String(params.cancelprice ?? 0) } : { partcancel: '0' }),
  });

  if (result.state === '1') return { ok: true };
  return { ok: false, error: result.errorMessage ?? '취소 요청 실패' };
}

// ─── FeedbackURL 검증 ─────────────────────────────────────────

export function validateFeedback(linkval: string): boolean {
  const config = getConfig();
  return linkval === config.linkval;
}

/**
 * pay_state 코드 → 상태 문자열 변환
 */
export function parsePayState(payState: string): string {
  switch (payState) {
    case '1': return 'requested';
    case '4': return 'paid';
    case '8': case '16': case '32': return 'cancelled';
    case '9': case '64': return 'cancelled';
    case '10': return 'waiting';    // 가상계좌 대기
    case '70': case '71': return 'partial_refunded';
    default: return 'unknown';
  }
}

/**
 * pay_type 코드 → 결제수단 문자열
 */
export function parsePayType(payType: string): string {
  const map: Record<string, string> = {
    '1': 'card', '2': 'phone', '4': 'face', '6': 'bank_transfer',
    '7': 'virtual_account', '15': 'kakaopay', '16': 'naverpay',
    '17': 'bill', '21': 'smilepay', '23': 'applepay',
  };
  return map[payType] ?? 'unknown';
}

// ─── 정기결제 ────────────────────────────────────────────────

interface SubscriptionParams {
  goodname: string;
  goodprice: number;
  recvphone: string;
  cycleDay: number;         // 매월 결제일 (1~31, 90=말일)
  expireDate: string;       // yyyy-mm-dd
  feedbackurl?: string;
  var1?: string;
  var2?: string;
  recvemail?: string;
  returnurl?: string;
}

export async function requestSubscription(params: SubscriptionParams): Promise<{
  ok: boolean;
  rebillNo?: string;
  payUrl?: string;
  error?: string;
}> {
  const config = getConfig();

  const result = await payappApiPost({
    cmd: 'rebillRegist',
    userid: config.userid,
    goodname: params.goodname,
    goodprice: String(params.goodprice),
    recvphone: params.recvphone.replace(/[^0-9]/g, ''),
    rebillCycleType: 'Month',
    rebillCycleMonth: String(params.cycleDay),
    rebillExpire: params.expireDate,
    ...(params.feedbackurl ? { feedbackurl: params.feedbackurl } : {}),
    ...(params.var1 ? { var1: params.var1 } : {}),
    ...(params.var2 ? { var2: params.var2 } : {}),
    ...(params.recvemail ? { recvemail: params.recvemail } : {}),
    ...(params.returnurl ? { returnurl: params.returnurl } : {}),
    openpaytype: 'card,phone',
  });

  if (result.state === '1') {
    return { ok: true, rebillNo: result.rebill_no, payUrl: result.payurl };
  }
  logger.error('[PayApp] 정기결제 등록 실패', { error: result.errorMessage });
  return { ok: false, error: result.errorMessage ?? '정기결제 등록 실패' };
}

export async function cancelSubscription(rebillNo: string): Promise<{ ok: boolean; error?: string }> {
  const config = getConfig();
  const result = await payappApiPost({
    cmd: 'rebillCancel',
    userid: config.userid,
    rebill_no: rebillNo,
    linkkey: config.linkkey,
  });
  if (result.state === '1') return { ok: true };
  return { ok: false, error: result.errorMessage ?? '정기결제 해지 실패' };
}

export async function pauseSubscription(rebillNo: string): Promise<{ ok: boolean; error?: string }> {
  const config = getConfig();
  const result = await payappApiPost({
    cmd: 'rebillStop',
    userid: config.userid,
    rebill_no: rebillNo,
    linkkey: config.linkkey,
  });
  if (result.state === '1') return { ok: true };
  return { ok: false, error: result.errorMessage ?? '정기결제 일시정지 실패' };
}

export async function resumeSubscription(rebillNo: string): Promise<{ ok: boolean; error?: string }> {
  const config = getConfig();
  const result = await payappApiPost({
    cmd: 'rebillStart',
    userid: config.userid,
    rebill_no: rebillNo,
    linkkey: config.linkkey,
  });
  if (result.state === '1') return { ok: true };
  return { ok: false, error: result.errorMessage ?? '정기결제 재시작 실패' };
}

// ─── 현금영수증 ──────────────────────────────────────────────

interface CashReceiptParams {
  goodName: string;
  buyerName: string;
  buyerPhone: string;
  amount: number;
  tradTime?: string;       // 원거래시각 (yyyyMMddHHmmss)
  trCode?: '0' | '1';     // 0=소득공제, 1=지출증빙
}

export async function issueCashReceipt(params: CashReceiptParams): Promise<{
  ok: boolean;
  cashstno?: string;
  cashsturl?: string;
  error?: string;
}> {
  const config = getConfig();
  const now = params.tradTime ?? new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const taxable = Math.round(params.amount / 1.1);
  const vat = params.amount - taxable;

  const result = await payappApiPost({
    cmd: 'cashStRegist',
    userid: config.userid,
    linkkey: config.linkkey,
    good_name: params.goodName,
    buyr_name: params.buyerName,
    buyr_tel1: params.buyerPhone.replace(/[^0-9]/g, ''),
    id_info: params.buyerPhone.replace(/[^0-9]/g, ''),
    trad_time: now,
    tr_code: params.trCode ?? '0',
    amt_tot: String(params.amount),
    amt_sup: String(taxable),
    amt_svc: '0',
    amt_tax: String(vat),
    corp_tax_type: 'TG01',
  });

  if (result.state === '1') {
    return { ok: true, cashstno: result.cashstno, cashsturl: result.cashsturl };
  }
  logger.error('[PayApp] 현금영수증 발행 실패', { error: result.errorMessage });
  return { ok: false, error: result.errorMessage ?? '현금영수증 발행 실패' };
}

export async function cancelCashReceipt(cashstno: string): Promise<{ ok: boolean; error?: string }> {
  const config = getConfig();
  const result = await payappApiPost({
    cmd: 'cashStCancel',
    userid: config.userid,
    linkkey: config.linkkey,
    cashstno,
  });
  if (result.state === '1') return { ok: true };
  return { ok: false, error: result.errorMessage ?? '현금영수증 취소 실패' };
}
