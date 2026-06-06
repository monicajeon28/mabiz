import { Prisma } from "@prisma/client";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { enqueueDLQ } from "@/lib/mabiz-dlq";
import { NextResponse } from "next/server";
import { triggerGroupFunnel } from "@/lib/funnel-trigger";
import { validateFeedback, validateFeedbackWithHMAC, parsePayState, parsePayType, issueCashReceipt } from "@/lib/payapp";
import { normalizePhone } from "@/lib/phone-normalize";
import { createRefundNotifications } from "@/lib/notification-service";

// ─── P1-6: 민감정보 마스킹 헬퍼 ───
function maskPhone(phone: string | null): string {
  if (!phone || phone.length < 4) return 'none';
  return `${phone.slice(0, 2)}***${phone.slice(-2)}`;
}

function maskOrderId(orderId: string | null): string {
  if (!orderId || orderId.length < 6) return 'none';
  return `${orderId.slice(0, 3)}***${orderId.slice(-3)}`;
}

/**
 * PayApp 날짜 형식: YYYYMMDDHHMMSS (14자리, 구분자 없음)
 * 잘못된 문자열은 현재 시각으로 폴백
 */
const parseCancelDate = (raw: string | null): Date => {
  if (!raw) return new Date();
  // YYYYMMDDHHMMSS → YYYY-MM-DDTHH:MM:SSZ
  const iso = raw.replace(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/,
    '$1-$2-$3T$4:$5:$6Z'
  );
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date() : d;
};

/**
 * POST /api/webhooks/payapp
 * PayApp FeedbackURL — 결제/취소/부분취소 통합 웹훅
 *
 * ⚠️ B2B 전용 (CRM PayAppPayment 테이블만 사용)
 *    크루즈닷몰 공유 테이블 절대 수정 금지
 *
 * pay_state:
 *   1=요청, 4=결제완료, 8/16/32=요청취소, 9/64=승인취소,
 *   10=결제대기(가상계좌), 70/71=부분취소
 *
 * 응답: 'SUCCESS' 텍스트 반환 시 PayApp이 성공 처리
 *       아닌 경우 checkretry=y면 최대 10회 재시도
 */
export async function POST(req: Request) {
  let params: URLSearchParams | null = null;

  try {
    // ── [1단계] 요청 IP 로깅 (PayApp은 서버 IP를 공개하지 않으므로 화이트리스트 대신 HMAC으로 검증)
    const trustedProxy = process.env.PAYAPP_TRUSTED_PROXY?.toLowerCase() ?? '';
    let requestIP = 'unknown';
    if (trustedProxy === 'vercel') {
      requestIP = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    } else if (trustedProxy === 'cloudflare') {
      requestIP = req.headers.get('cf-connecting-ip') || 'unknown';
    } else {
      requestIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    }

    // PAYAPP_ALLOWED_IPS 설정 시 추가 IP 필터링 (선택적)
    const allowedIPs = process.env.PAYAPP_ALLOWED_IPS?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
    if (allowedIPs.length > 0 && !allowedIPs.includes(requestIP)) {
      logger.error('[PayApp Webhook] IP 화이트리스트 차단', { requestIP, allowedIPs });
      return new Response('FAIL', { status: 403 });
    }

    // P0-1: Content-Length DoS 방어
    const contentLength = parseInt(req.headers.get('content-length') ?? '0');
    const MAX_PAYLOAD = 1024 * 1024; // 1MB
    if (contentLength > MAX_PAYLOAD) {
      logger.warn('[PayApp Webhook] Content-Length 초과', { contentLength, ip: requestIP });
      return new Response('FAIL', { status: 413 });
    }

    logger.log('[PayApp Webhook] 요청 수신', { requestIP });

    // [P0-SEC-201] Bearer Token 검증 — PAYAPP_WEBHOOK_TOKEN 설정 시 필수
    const payappToken = process.env.PAYAPP_WEBHOOK_TOKEN;
    const authHeader = req.headers.get("authorization") ?? "";
    if (payappToken) {
      // env가 설정된 경우 Authorization 헤더는 반드시 있어야 함
      if (!authHeader) {
        logger.warn("[PayApp Webhook] Authorization 헤더 누락 — 요청 차단", { requestIP });
        return new Response("FAIL", { status: 401 });
      }
      if (!authHeader.startsWith("Bearer ")) {
        logger.warn("[PayApp Webhook] 잘못된 Bearer format — 요청 차단", { requestIP });
        return new Response("FAIL", { status: 401 });
      }

      const token = authHeader.slice(7);

      // [P0-4] Bearer Token 길이 검증: 최소 32자 이상 (강력한 토큰 필수)
      if (token.length < 32) {
        logger.warn("[PayApp Webhook] Bearer token 길이 부족 (최소 32자 필요) — 요청 차단", { requestIP, tokenLength: token.length });
        return new Response("FAIL", { status: 403 });
      }

      if (token.length !== payappToken.length || !timingSafeEqual(Buffer.from(token), Buffer.from(payappToken))) {
        logger.warn("[PayApp Webhook] Bearer token 불일치 — 인증 실패", { requestIP });
        return new Response("FAIL", { status: 401 });
      }
    } else if (authHeader) {
      // env 미설정이지만 헤더가 있는 경우: 형식만 검증
      if (!authHeader.startsWith("Bearer ")) {
        logger.warn("[PayApp Webhook] 잘못된 Bearer format — 요청 차단", { requestIP });
        return new Response("FAIL", { status: 401 });
      }
    }

    const body = await req.text();
    params = new URLSearchParams(body);

    // [P0-SEC-202] User-Agent 길이 제한 (DDoS/메모리 공격 방지)
    const userAgent = req.headers.get("user-agent") ?? "";
    const MAX_USER_AGENT_LENGTH = 500; // 표준 UA는 150-300자
    if (userAgent.length > MAX_USER_AGENT_LENGTH) {
      logger.warn("[PayApp Webhook] User-Agent 길이 초과 — 요청 차단", {
        requestIP,
        length: userAgent.length,
        max: MAX_USER_AGENT_LENGTH,
      });
      return new Response("FAIL", { status: 400 });
    }

    // ── [2단계] linkval 검증 (필수) ────────────────────────────
    const linkval = params.get("linkval");
    const maskedLinkval = linkval ? `${linkval.slice(0, 2)}***${linkval.slice(-2)}` : 'none';

    // linkval 누락 — 필수값
    if (!linkval) {
      logger.error(
        "[PayApp Webhook] linkval 누락. 요청 차단됨.",
        { requestIP }
      );
      return new Response("FAIL", { status: 400 }); // 필수값 누락은 400
    }

    // linkval 불일치 — 검증 실패
    if (!validateFeedback(linkval)) {
      logger.error(
        "[PayApp Webhook] linkval 불일치. 요청 차단됨.",
        {
          requestIP,
          received: maskedLinkval, // P1-1: 마스킹된 값 로깅
        }
      );
      return new Response("FAIL", { status: 403 });
    }

    // ── [3단계] HMAC 검증 — 필수화 ──
    const hmacLinkkey = process.env.PAYAPP_LINKKEY;
    if (!hmacLinkkey) {
      logger.error('[PayApp Webhook] PAYAPP_LINKKEY 미설정 — HMAC 검증 불가', { requestIP });
      return new Response('FAIL', { status: 503 });
    }

    const hmacValue = params.get('hmac');
    if (!hmacValue) {
      logger.warn('[PayApp Webhook] HMAC 파라미터 누락', { requestIP });
      return new Response('FAIL', { status: 400 });
    }

    const paramsObj = Object.fromEntries(params.entries());
    if (!validateFeedbackWithHMAC(paramsObj, String(hmacValue))) {
      logger.warn('[PayApp Webhook] HMAC 검증 실패', { requestIP });
      return new Response('FAIL', { status: 403 });
    }

    logger.info('[PayApp Webhook] HMAC 검증 통과', { requestIP });

    // ── [4단계] 요청 본문 파싱 (성공 로그) ──────────────────────
    logger.info("[PayApp Webhook] 검증 통과 - 처리 시작", { requestIP });

    const payState    = params.get("pay_state") ?? "";
    const mulNo       = params.get("mul_no") ?? "";
    const orderId     = params.get("var1") ?? "";
    const landingSlug = params.get("var2") ?? "";
    const phone       = params.get("recvphone")?.slice(0, 20) ?? ""; // P1-3: 길이 제한
    const name        = params.get("goodname") ?? "";
    const price       = parseInt(params.get("price") ?? "0");
    const payTypeCode = params.get("pay_type") ?? "";
    const cardName    = params.get("card_name") ?? "";
    const cstUrl      = params.get("csturl") ?? "";
    const customerName = params.get("pay_memo")
      ? params.get("pay_memo")!
      : (params.get("recvphone") ? "" : "");

    // P1-4: price 범위 검증
    if (price < 0 || price > 100_000_000) {
      logger.warn('[PayApp] 결제액 범위 초과', { amount: price });
      return new Response('FAIL', { status: 400 });
    }

    // P1-5: slug SQL Injection 방지
    if (!/^[a-zA-Z0-9\-_]*$/.test(landingSlug)) {
      logger.warn('[PayApp] 의심 slug 패턴', { slug: landingSlug });
      return new Response('FAIL', { status: 400 });
    }

    // [P0-8] orderId/mulNo 형식 검증: 안전한 문자만 허용
    const SAFE_ID_REGEX = /^[a-zA-Z0-9_\-]{1,50}$/;
    if (orderId && !SAFE_ID_REGEX.test(orderId)) {
      logger.warn("[PayApp Webhook] orderId 형식 위반 — 요청 차단", { requestIP, orderId: orderId.substring(0, 10) + "***" });
      return new Response("FAIL", { status: 400 });
    }
    if (mulNo && !SAFE_ID_REGEX.test(mulNo)) {
      logger.warn("[PayApp Webhook] mulNo 형식 위반 — 요청 차단", { requestIP, mulNo: mulNo.substring(0, 10) + "***" });
      return new Response("FAIL", { status: 400 });
    }

    // pay_state별 상태 변환
    const status = parsePayState(payState);
    const payType = parsePayType(payTypeCode);
    const normalizedPhone = phone ? normalizePhone(phone) : "";

    logger.log("[PayApp Webhook] 수신", {
      payState, status, mulNo, orderId,
      phone: maskPhone(normalizedPhone), // P1-6: 마스킹 적용
    });

    // ─── 결제 완료 (pay_state=4) ─────────────────────────────
    if (status === "paid") {
      if (!orderId && !mulNo) {
        logger.warn("[PayApp Webhook] orderId/mulNo 없음 — 무시");
        return new Response("SUCCESS");
      }

      // 중복 방지 + 금액 검증
      if (orderId) {
        const existing = await prisma.payAppPayment.findUnique({
          where: { orderId },
          select: { id: true, status: true, amount: true },
        });
        if (existing?.status === "paid") {
          logger.log("[PayApp Webhook] 이미 처리됨", { orderId });
          return new Response("SUCCESS");
        }
        // 금액 검증: 요청 금액과 웹훅 전달 금액 대조
        if (existing && price > 0 && existing.amount !== price) {
          logger.warn("[PayApp Webhook] 금액 불일치 — 위조 의심", {
            orderId, expected: existing.amount, received: price,
          });
          return new Response("FAIL", { status: 400 });
        }
      }

      // 조직 확인
      let orgId: string | null = null;
      if (landingSlug) {
        const lp = await prisma.crmLandingPage.findFirst({
          where: { slug: landingSlug },
          select: { organizationId: true },
        });
        orgId = lp?.organizationId ?? null;
      }

      // GmUser 조회 (phone 기반)
      const gmUser = normalizedPhone ? await prisma.gmUser.findFirst({
        where: { phone: normalizedPhone },
        select: { id: true },
      }) : null;

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // PayAppPayment 업데이트
        await tx.payAppPayment.upsert({
          where: { orderId: orderId || `mul_${mulNo}` },
          create: {
            orderId: orderId || `mul_${mulNo}`,
            organizationId: orgId ?? null,
            amount: price,
            customerPhone: normalizedPhone,
            customerName: name || "미확인",
            productName: name || null,
            mulNo: mulNo || null,
            payType: payType,
            cardName: cardName || null,
            cstUrl: cstUrl || null,
            status: "paid",
            paidAt: new Date(),
            landingPageId: landingSlug || null,
          },
          update: {
            status: "paid",
            paidAt: new Date(),
            mulNo: mulNo || undefined,
            payType: payType || undefined,
            cardName: cardName || undefined,
            cstUrl: cstUrl || undefined,
          },
        });

        // Contact 자동 생성/업데이트
        if (orgId && normalizedPhone) {
          await tx.contact.upsert({
            where: { phone_organizationId: { phone: normalizedPhone, organizationId: orgId } },
            create: {
              organizationId: orgId,
              name: name || "미확인",
              phone: normalizedPhone,
              type: "CUSTOMER",
              purchasedAt: new Date(),
              channel: "b2b",
              userId: gmUser?.id ?? null,
            },
            update: { type: "CUSTOMER", channel: "b2b", ...(gmUser ? { userId: gmUser.id } : {}) },
          });
        }
      });

      // 퍼널 자동 트리거 (non-blocking)
      if (orgId && landingSlug) {
        try {
          const lp = await prisma.crmLandingPage.findFirst({
            where: { slug: landingSlug },
            select: { groupId: true },
          });
          if (lp?.groupId && normalizedPhone) {
            const contact = await prisma.contact.findUnique({
              where: { phone_organizationId: { phone: normalizedPhone, organizationId: orgId } },
              select: { id: true },
            });
            if (contact) {
              await triggerGroupFunnel({ contactId: contact.id, groupId: lp.groupId, organizationId: orgId });
            }
          }
        } catch (e) {
          logger.warn("[PayApp Webhook] 퍼널 트리거 실패", { err: e instanceof Error ? e.message : String(e) });
        }
      }

      // 현금영수증 자동 발행 — 현금성 결제만 (카드/간편결제 제외)
      const cashPayTypes = ["bank_transfer", "virtual_account", "phone"];
      if (cashPayTypes.includes(payType) && normalizedPhone && price > 0) {
        issueCashReceipt({
          goodName: name || "크루즈 상품",
          buyerName: name || "미확인",
          buyerPhone: normalizedPhone,
          amount: price,
        }).then((r) => {
          if (r.ok) {
            // 현금영수증 정보를 metadata에 병합 저장 (기존 데이터 보존)
            prisma.payAppPayment.findUnique({ where: { orderId: orderId || `mul_${mulNo}` } }).then((p) => {
              const existing = (p?.metadata ?? {}) as Record<string, unknown>;
              prisma.payAppPayment.update({
                where: { orderId: orderId || `mul_${mulNo}` },
                data: {
                  metadata: { ...existing, cashReceipt: { cashstno: r.cashstno, cashsturl: r.cashsturl, issuedAt: new Date().toISOString() } },
                },
              }).catch(() => {});
            }).catch(() => {});
            logger.log("[PayApp Webhook] 현금영수증 자동 발행 성공", { cashstno: r.cashstno });
          } else {
            logger.warn("[PayApp Webhook] 현금영수증 발행 실패", { error: r.error });
          }
        }).catch(() => {});
      }

      return new Response("SUCCESS");
    }

    // ─── 취소 (pay_state=8,9,16,32,64) ───────────────────────
    if (status === "cancelled") {
      const canceldate = params.get("canceldate") ?? null;
      const cancelmemo = params.get("cancelmemo") ?? "";

      if (orderId) {
        // PayAppPayment + AffiliateSale 원자적 취소
        const { cancelResult, affiliateSale } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const cancelResult = await tx.payAppPayment.updateMany({
            where: { orderId, status: { not: "cancelled" } },
            data: {
              status: "cancelled",
              refundedAt: parseCancelDate(canceldate),
              refundReason: cancelmemo || "PayApp 취소",
            },
          });

          const sale = await tx.affiliateSale.findUnique({
            where: { orderId },
            select: {
              id: true,
              saleAmount: true,
              commissionAmount: true,
              commissionRate: true,
              organizationId: true,
            },
          });

          if (sale && sale.commissionAmount > 0) {
            await tx.affiliateSale.update({
              where: { id: sale.id },
              data: {
                refundedAmount: sale.saleAmount,
                refundedAt: parseCancelDate(canceldate),
                commissionAmount: 0, // ★ 100% 완전 취소
                status: "REFUNDED",
                cancelReason: "PAYMENT_CANCELLED_PAYAPP",
              },
            });
          } else if (!sale) {
            // P1-8: AffiliateSale 조회 실패 로깅
            logger.warn("[PayApp Webhook] AffiliateSale 조회 실패 (취소 처리)", {
              orderId: maskOrderId(orderId),
            });
          }

          return { cancelResult, affiliateSale: sale };
        });

        if (cancelResult.count === 0) {
          logger.warn("[PayApp Webhook] 취소 대상 없음 — orderId 미존재 또는 이미 취소됨", { orderId });
        }

        // ★ P2: 환불 알림 생성 (트랜잭션 밖 — 롤백 영향 없도록)
        if (affiliateSale && affiliateSale.commissionAmount > 0) {
          const contact = await prisma.contact.findFirst({
            where: { bookingRef: orderId },
            select: { name: true },
          });

          // P1-10: 환불 알림 에러 추적
          try {
            await createRefundNotifications({
              organizationId: affiliateSale.organizationId,
              orderId,
              customerName: contact?.name || '고객',
              refundAmount: affiliateSale.saleAmount,
              refundReason: cancelmemo || '결제 취소',
              type: 'payment_cancelled',
            });
          } catch (err) {
            logger.warn("[PayApp Webhook] 환불 알림 발송 실패", {
              orderId: maskOrderId(orderId),
              error: err instanceof Error ? err.message : "Unknown error",
              type: "payment_cancelled",
            });
            // 계속 진행 (DB는 업데이트됨)
          }

          logger.log("[PayApp Webhook] AffiliateSale 수당 취소", {
            affiliateSaleId: affiliateSale.id,
            originalCommission: affiliateSale.commissionAmount,
            saleAmount: affiliateSale.saleAmount,
          });
        }
      } else if (mulNo) {
        // mulNo 경로도 orderId 경로와 동일하게 AffiliateSale 수당 원자적 취소
        const { cancelByMulResult, affiliateSaleByMul } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const cancelByMulResult = await tx.payAppPayment.updateMany({
            where: { mulNo, status: { not: "cancelled" } },
            data: {
              status: "cancelled",
              refundedAt: parseCancelDate(canceldate),
              refundReason: cancelmemo || "PayApp 취소",
            },
          });

          // mulNo로 연결된 AffiliateSale 수당 취소
          const payment = await tx.payAppPayment.findFirst({
            where: { mulNo },
            select: { orderId: true },
          });

          let affiliateSaleByMul = null;
          if (payment?.orderId) {
            const sale = await tx.affiliateSale.findUnique({
              where: { orderId: payment.orderId },
              select: {
                id: true,
                saleAmount: true,
                commissionAmount: true,
                organizationId: true,
              },
            });
            if (sale && sale.commissionAmount > 0) {
              await tx.affiliateSale.update({
                where: { id: sale.id },
                data: {
                  refundedAmount: sale.saleAmount,
                  refundedAt: parseCancelDate(canceldate),
                  commissionAmount: 0,
                  status: "REFUNDED",
                  cancelReason: "PAYMENT_CANCELLED_PAYAPP",
                },
              });
              affiliateSaleByMul = sale;
            } else if (!sale) {
              // P1-8: AffiliateSale 조회 실패 로깅 (mulNo 경로)
              logger.warn("[PayApp Webhook] AffiliateSale 조회 실패 (mulNo 취소)", {
                mulNo,
                orderId: payment?.orderId ? maskOrderId(payment.orderId) : "null",
              });
            }
          }

          return { cancelByMulResult, affiliateSaleByMul };
        });

        if (cancelByMulResult.count === 0) {
          logger.warn("[PayApp Webhook] 취소 대상 없음 — mulNo 미존재 또는 이미 취소됨", { mulNo });
        }
        if (affiliateSaleByMul) {
          logger.log("[PayApp Webhook] mulNo 경로 AffiliateSale 수당 취소", {
            mulNo,
            originalCommission: affiliateSaleByMul.commissionAmount,
          });
        }
      }

      logger.log("[PayApp Webhook] 취소 처리", { orderId, mulNo, cancelmemo });
      return new Response("SUCCESS");
    }

    // ─── 부분취소 (pay_state=70,71) ──────────────────────────
    if (status === "partial_refunded") {
      const origMulNo = params.get("orig_mul_no") ?? "";
      const origPrice = parseInt(params.get("orig_price") ?? "0");
      const canceldate = params.get("canceldate") ?? null;

      // 원거래 찾기
      const lookupKey = orderId || origMulNo;
      if (lookupKey) {
        const original = await prisma.payAppPayment.findFirst({
          where: orderId ? { orderId } : { mulNo: origMulNo },
        });

        if (original) {
          const partialAmount = origPrice - price; // 원금 - 현재금 = 환불액

          // P1-7: 환불액 검증 — 환불액이 원금을 초과하면 거절
          if (partialAmount < 0) {
            logger.warn('[PayApp Webhook] 부분취소 환불액 < 0', {
              orderId: maskOrderId(orderId),
              origPrice,
              currentPrice: price,
              partialAmount,
            });
            return new Response('FAIL', { status: 400 });
          }

          if (partialAmount > original.amount) {
            logger.warn('[PayApp Webhook] 부분취소 환불액 > 원금', {
              orderId: maskOrderId(orderId),
              originalAmount: original.amount,
              partialAmount,
            });
            return new Response('FAIL', { status: 400 });
          }

          // PayAppPayment + AffiliateSale 원자적 부분취소
          const { affiliateSale, commissionDeduction } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.payAppPayment.update({
              where: { id: original.id },
              data: {
                status: "partial_refunded",
                refundAmount: (original.refundAmount ?? 0) + (partialAmount > 0 ? partialAmount : 0),
                refundedAt: parseCancelDate(canceldate),
                mulNo: mulNo || original.mulNo, // 부분취소 시 mul_no 변경됨
              },
            });

            // ★ NEW: AffiliateSale 수당 비례 감액 (P0 요구사항)
            if (!orderId || partialAmount <= 0) {
              return { affiliateSale: null, commissionDeduction: 0 };
            }

            const sale = await tx.affiliateSale.findUnique({
              where: { orderId },
              select: {
                id: true,
                saleAmount: true,
                commissionAmount: true,
                commissionRate: true,
                organizationId: true,
              },
            });

            if (!sale || sale.commissionAmount <= 0) {
              return { affiliateSale: sale, commissionDeduction: 0 };
            }

            // P1-9: 부분취소 분수 범위 검증
            const refundRatio = partialAmount / sale.saleAmount;
            if (refundRatio < 0 || refundRatio > 1.0) {
              logger.warn('[PayApp Webhook] 부분취소 비율 범위 초과', {
                orderId: maskOrderId(orderId),
                refundRatio,
                partialAmount,
                originalAmount: sale.saleAmount,
              });
              return { affiliateSale: sale, commissionDeduction: 0 };
            }

            // 환불액 비율만큼 수당 감액
            const deduction = Math.floor(sale.commissionAmount * refundRatio);

            await tx.affiliateSale.update({
              where: { id: sale.id },
              data: {
                refundedAmount: { increment: partialAmount },
                commissionAmount: { decrement: deduction },
                status: "PARTIAL_REFUNDED",
              },
            });

            return { affiliateSale: sale, commissionDeduction: deduction };
          });

          // ★ P2: 부분취소 알림 생성 (트랜잭션 밖 — 롤백 영향 없도록)
          if (affiliateSale && affiliateSale.commissionAmount > 0 && commissionDeduction > 0) {
            const contact = await prisma.contact.findFirst({
              where: { bookingRef: orderId },
              select: { name: true },
            });

            // P1-10: 부분취소 알림 에러 추적
            try {
              await createRefundNotifications({
                organizationId: affiliateSale.organizationId,
                orderId,
                customerName: contact?.name || '고객',
                refundAmount: partialAmount,
                refundReason: `부분취소: ${partialAmount.toLocaleString()}원`,
                type: 'partial_refund',
              });
            } catch (err) {
              logger.warn("[PayApp Webhook] 부분취소 알림 발송 실패", {
                orderId: maskOrderId(orderId),
                error: err instanceof Error ? err.message : "Unknown error",
                type: "partial_refund",
              });
              // 계속 진행 (DB는 업데이트됨)
            }

            logger.log("[PayApp Webhook] AffiliateSale 수당 부분감액", {
              affiliateSaleId: affiliateSale.id,
              refundAmount: partialAmount,
              originalCommission: affiliateSale.commissionAmount,
              commissionDeduction,
              newCommission: affiliateSale.commissionAmount - commissionDeduction,
            });
          }
        }
      }

      logger.log("[PayApp Webhook] 부분취소 처리", { orderId, origMulNo, price });
      return new Response("SUCCESS");
    }

    // ─── 가상계좌 대기 (pay_state=10) ────────────────────────
    if (status === "waiting") {
      const vbank = params.get("vbank") ?? "";
      const vbankno = params.get("vbankno") ?? "";

      if (orderId) {
        const waitResult = await prisma.payAppPayment.updateMany({
          where: { orderId },
          data: {
            status: "waiting",
            metadata: { vbank, vbankno },
          },
        });
        if (waitResult.count === 0) {
          logger.warn("[PayApp Webhook] 가상계좌 대기 대상 없음 — orderId 미존재 (선(先)웹훅 가능성)", { orderId, vbank });
        }
      }

      logger.log("[PayApp Webhook] 가상계좌 대기", { orderId, vbank, vbankno });
      return new Response("SUCCESS");
    }

    // 기타 상태는 로그만 남기고 SUCCESS 반환
    logger.log("[PayApp Webhook] 미처리 상태", { payState, status });
    return new Response("SUCCESS");
  } catch (err) {
    logger.error("[PayApp Webhook] 처리 실패", { err });

    // params가 초기화된 경우에만 DLQ에 저장
    if (params) {
      const payloadObj = Object.fromEntries(params);

      // P1-6: DLQ 저장 시 민감정보 마스킹
      const maskedPayload = {
        ...payloadObj,
        recvphone: maskPhone(payloadObj.recvphone as string | null),
        var1: maskOrderId(payloadObj.var1 as string | null), // orderId
      };

      await enqueueDLQ("payapp", maskedPayload, err instanceof Error ? err.message : String(err), "form-data").catch(() => {});
    }

    return new Response("FAIL", { status: 500 });
  }
}
