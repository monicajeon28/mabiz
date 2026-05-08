export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sha256Hash, getWelcomePayConfig, getTimestamp } from '@/lib/welcomepay';
import { processRefund } from '@/lib/affiliate/refund';
import { logger } from '@/lib/logger';
import { validateCsrfToken } from '@/lib/csrf';

// ─── Zod 스키마 (v4: .issues, z.number().int().positive() 형식) ────────────

/** POST body 검증 */
const adminRefundPostSchema = z.object({
  paymentId: z.number().int().positive('결제 ID는 양의 정수여야 합니다.'),
  reason: z.string().max(500).optional(),
});

/** GET query 검증 (searchParam은 문자열이므로 z.coerce 사용) */
const adminRefundGetSchema = z.object({
  paymentId: z.coerce.number().int().positive('결제 ID는 양의 정수여야 합니다.'),
});

/** WelcomePayments PG 취소 응답 스키마 — 외부 응답을 Zod로 파싱해 타입 안전성 확보 */
const pgCancelResultSchema = z.object({
  resultCode: z.string(),
  resultMsg: z.string().optional(),
  resultMessage: z.string().optional(),
});
type PgCancelResult = z.infer<typeof pgCancelResultSchema>;

// ─── 응답 타입 정의 ────────────────────────────────────────────────────────

interface RefundSuccessResponse {
  ok: true;
  message: string;
  refundedAt: string;
  amount: number;
  pgResultCode: string;
}

interface RefundErrorResponse {
  ok: false;
  error: string;
  pgResultCode?: string;
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────

/** 관리자 권한 확인 */
async function verifyAdmin() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, name: true, role: true },
  });

  if (!user || !['admin', 'superadmin'].includes(user.role ?? '')) {
    return null;
  }

  return user;
}

// WelcomePayments PAYAPI 취소/환불 URL
const WELCOMEPAY_CANCEL_URL = 'https://payapi.paywelcome.co.kr/cancel/cancel';

/**
 * 웰컴페이먼츠 취소 API Signature 생성
 * 형식: SHA256(mid + mkey + timestamp),  mkey = SHA256(signKey)
 */
function generateCancelSignature(
  mid: string,
  signKey: string,
  timestamp: string,
): { signature: string; mkey: string } {
  const mkey = sha256Hash(signKey);
  const signature = sha256Hash(mid + mkey + timestamp);
  return { signature, mkey };
}

const STATUS_LABELS: Record<string, string> = {
  paid: '결제완료',
  completed: '결제완료',
  pending: '대기중',
  cancelled: '환불완료',
  failed: '결제실패',
};
const getStatusLabel = (s: string) => STATUS_LABELS[s] ?? s;

// ─── POST /api/admin/refund ───────────────────────────────────────────────

/**
 * 환불 처리 API
 *
 * 처리 흐름:
 * 1. 관리자 인증 (role: admin | superadmin)
 * 2. CSRF 토큰 검증 (상태 변경 요청 보호)
 * 3. Zod 입력 검증 (paymentId, reason)
 * 4. Payment 상태 사전 검증
 * 5. WelcomePayments PG 취소 API 호출 (트랜잭션 외부)
 * 6. DB 업데이트 — prisma.$transaction 원자성 보장
 *    - Payment status → 'cancelled'
 *    - User customerStatus → 'refunded'
 * 7. AffiliateSale 역분개 — processRefund() 호출
 *    - AffiliateSale.status → REFUNDED
 *    - CommissionLedger 역분개 엔트리(entryType: 'REFUND', 음수) 생성
 *    - AffiliateLead.status → REFUNDED
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 관리자 인증
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 401 },
      );
    }

    // 2. CSRF 토큰 검증 (상태 변경 요청)
    const csrfHeader = req.headers.get('x-csrf-token');
    const cookieStore = await cookies();
    const csrfCookie = cookieStore.get('csrf-token')?.value;
    if (!validateCsrfToken(csrfCookie, csrfHeader)) {
      logger.warn('[Admin Refund] CSRF 검증 실패', { adminId: admin.id });
      return NextResponse.json(
        { ok: false, error: 'CSRF 토큰이 유효하지 않습니다.' },
        { status: 403 },
      );
    }

    // 3. Zod 입력 검증
    const parseResult = adminRefundPostSchema.safeParse(await req.json().catch(() => ({})));
    if (!parseResult.success) {
      const message = parseResult.error.issues[0]?.message ?? '입력 검증 실패';
      logger.warn('[Admin Refund] 입력 검증 실패', { adminId: admin.id, error: message });
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
    const { paymentId, reason } = parseResult.data;
    const refundReason = reason ?? '관리자 환불 처리';

    // 4. Payment 조회 및 상태 검증 (PG 호출 전)
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        orderId: true,
        amount: true,
        status: true,
        cancelledAt: true,
        pgTransactionId: true,
        buyerEmail: true,
        buyerTel: true,
        saleId: true,
        metadata: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { ok: false, error: '결제 정보를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    if (payment.status === 'cancelled' || payment.cancelledAt) {
      return NextResponse.json(
        { ok: false, error: '이미 취소된 결제입니다.' },
        { status: 400 },
      );
    }

    if (payment.status !== 'paid' && payment.status !== 'completed') {
      return NextResponse.json(
        { ok: false, error: `결제 상태가 '${payment.status}'이므로 취소할 수 없습니다.` },
        { status: 400 },
      );
    }

    if (!payment.pgTransactionId) {
      return NextResponse.json(
        { ok: false, error: 'PG 거래번호(TID)가 없어 취소할 수 없습니다.' },
        { status: 400 },
      );
    }

    // 5. WelcomePayments PG 취소 API 호출 (외부 I/O → 트랜잭션 외부)
    const config = getWelcomePayConfig();
    const timestamp = getTimestamp();
    const { signature, mkey } = generateCancelSignature(config.mid, config.signKey, timestamp);

    logger.log('[Admin Refund] PG 취소 요청', {
      adminId: admin.id,
      paymentId,
      orderId: payment.orderId,
      amount: payment.amount,
    });

    const cancelResponse = await fetch(WELCOMEPAY_CANCEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        payType: 'card',
        mid: config.mid,
        tid: payment.pgTransactionId,
        price: payment.amount.toString(),
        currency: 'WON',
        timestamp,
        signature,
        mkey,
      }).toString(),
    });

    const cancelResult: Record<string, unknown> = await cancelResponse.json();
    const isSuccess =
      cancelResult['resultCode'] === '00' || cancelResult['resultCode'] === '0000';

    if (!isSuccess) {
      logger.warn('[Admin Refund] PG 취소 실패', {
        adminId: admin.id,
        paymentId,
        resultCode: cancelResult['resultCode'],
        resultMsg: cancelResult['resultMsg'] ?? cancelResult['resultMessage'],
      });
      // PG 원시 응답 전체를 클라이언트에 노출하지 않음 (민감 정보 마스킹)
      return NextResponse.json({
        ok: false,
        error: `환불 실패: ${cancelResult['resultMsg'] ?? cancelResult['resultMessage'] ?? '알 수 없는 오류'}`,
        pgResultCode: cancelResult['resultCode'],
      });
    }

    // 6. DB 업데이트 — Payment + User를 하나의 트랜잭션으로 원자성 보장
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // 6-1. Payment → cancelled
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          metadata: {
            ...(payment.metadata as object ?? {}),
            cancelReason: refundReason,
            cancelledBy: admin.id,
            cancelledByName: admin.name,
            cancelResponse: cancelResult,
          },
        },
      });

      // 6-2. 구매자 User.customerStatus → 'refunded'
      // 주의: Payment.buyerEmail / buyerTel 은 AES-256-GCM 암호화 값이므로
      // User 테이블의 평문 email / phone 과 직접 매칭되지 않습니다.
      // saleId → AffiliateSale → agentId 경로로 연결되는 경우
      // AffiliateSale.processRefund() 가 별도로 처리합니다.
      // affiliateMallUserId 가 있는 경우 User 조회 시도
      if (payment.affiliateMallUserId) {
        const buyer = await tx.user.findFirst({
          where: { id: Number(payment.affiliateMallUserId) },
          select: { id: true },
        });
        if (buyer) {
          await tx.user.update({
            where: { id: buyer.id },
            data: { customerStatus: 'refunded' },
          });
        }
      }
    });

    // 7. AffiliateSale 역분개 (saleId 있을 때만)
    //    processRefund 내부에서 자체 transaction으로 원자성 보장:
    //    - AffiliateSale.status → REFUNDED
    //    - CommissionLedger REFUND 역분개 엔트리 (음수 금액) 생성
    //    - AffiliateLead.status → REFUNDED
    if (payment.saleId) {
      await processRefund(payment.saleId, refundReason, admin.id);
    }

    logger.log('[Admin Refund] 환불 처리 완료', {
      adminId: admin.id,
      paymentId,
      orderId: payment.orderId,
      amount: payment.amount,
      saleId: payment.saleId,
    });

    // PG 원시 응답 전체를 클라이언트에 노출하지 않음 (민감 정보 마스킹)
    return NextResponse.json({
      ok: true,
      message: '환불이 성공적으로 처리되었습니다.',
      refundedAt: now.toISOString(),
      amount: payment.amount,
      pgResultCode: cancelResult['resultCode'],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[Admin Refund] 처리 중 오류', {
      error: process.env.NODE_ENV === 'development' ? msg : 'Internal server error',
    });
    return NextResponse.json(
      { ok: false, error: '환불 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

// ─── GET /api/admin/refund?paymentId=123 ─────────────────────────────────

/**
 * 환불 가능 여부 조회
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다.' },
        { status: 401 },
      );
    }

    // Zod로 query param 검증 (z.coerce: 문자열 → 숫자 변환)
    const { searchParams } = new URL(req.url);
    const parseResult = adminRefundGetSchema.safeParse({
      paymentId: searchParams.get('paymentId'),
    });
    if (!parseResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parseResult.error.issues[0]?.message ?? '유효한 결제 ID가 필요합니다.',
        },
        { status: 400 },
      );
    }
    const { paymentId } = parseResult.data;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        orderId: true,
        amount: true,
        status: true,
        buyerName: true,
        buyerTel: true,
        productName: true,
        paidAt: true,
        cancelledAt: true,
        pgTransactionId: true,
        AffiliateSale: {
          select: {
            id: true,
            status: true,
            saleAmount: true,
            refundedAt: true,
            AffiliateProfile_agentIdToAffiliateProfile: {
              select: { displayName: true },
            },
            AffiliateProfile_managerIdToAffiliateProfile: {
              select: { displayName: true },
            },
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { ok: false, error: '결제 정보를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const canRefund =
      (payment.status === 'paid' || payment.status === 'completed') &&
      !payment.cancelledAt &&
      !!payment.pgTransactionId;

    return NextResponse.json({
      ok: true,
      payment: {
        id: payment.id,
        orderId: payment.orderId,
        amount: payment.amount,
        status: payment.status,
        statusLabel: getStatusLabel(payment.status),
        buyerName: payment.buyerName,
        buyerTel: payment.buyerTel,
        productName: payment.productName,
        paidAt: payment.paidAt,
        cancelledAt: payment.cancelledAt,
        pgTransactionId: payment.pgTransactionId,
      },
      sale: payment.AffiliateSale
        ? {
            id: payment.AffiliateSale.id,
            status: payment.AffiliateSale.status,
            saleAmount: payment.AffiliateSale.saleAmount,
            refundedAt: payment.AffiliateSale.refundedAt,
            agentName:
              payment.AffiliateSale.AffiliateProfile_agentIdToAffiliateProfile?.displayName,
            managerName:
              payment.AffiliateSale.AffiliateProfile_managerIdToAffiliateProfile?.displayName,
          }
        : null,
      canRefund,
      refundDisabledReason: canRefund
        ? null
        : payment.cancelledAt
          ? '이미 환불된 결제입니다.'
          : payment.status !== 'paid' && payment.status !== 'completed'
            ? `결제 상태가 '${getStatusLabel(payment.status)}'입니다.`
            : 'PG 거래번호가 없습니다.',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[Admin Refund] GET 처리 중 오류', {
      error: process.env.NODE_ENV === 'development' ? msg : 'Internal server error',
    });
    return NextResponse.json(
      { ok: false, error: '환불 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
