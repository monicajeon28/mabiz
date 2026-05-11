import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { enqueueDLQ } from "@/lib/mabiz-dlq";
import { NextResponse } from "next/server";
import { triggerGroupFunnel } from "@/lib/funnel-trigger";
import { validateFeedback, parsePayState, parsePayType, issueCashReceipt } from "@/lib/payapp";
import { normalizePhone } from "@/lib/phone-normalize";

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
  try {
    // [보안] IP 화이트리스트 검증
    const allowedIPs =
      process.env.PAYAPP_ALLOWED_IPS?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
    const requestIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (allowedIPs.length === 0) {
      logger.warn("[PayApp Webhook] PAYAPP_ALLOWED_IPS 미설정 — IP 검증 생략", { requestIP });
    } else if (!allowedIPs.includes(requestIP)) {
      logger.warn("[PayApp Webhook] 허용되지 않은 IP", { requestIP });
      return new Response("FAIL", { status: 403 });
    }

    const body = await req.text();
    const params = new URLSearchParams(body);

    // [보안] linkval 검증 — 진짜 PayApp인지 확인
    const linkval = params.get("linkval");
    if (linkval && !validateFeedback(linkval)) {
      logger.warn("[PayApp Webhook] linkval 불일치 — 위조 요청 차단");
      return new Response("FAIL", { status: 403 });
    }

    const payState    = params.get("pay_state") ?? "";
    const mulNo       = params.get("mul_no") ?? "";
    const orderId     = params.get("var1") ?? "";
    const landingSlug = params.get("var2") ?? "";
    const phone       = params.get("recvphone") ?? "";
    const name        = params.get("goodname") ?? "";
    const price       = parseInt(params.get("price") ?? "0");
    const payTypeCode = params.get("pay_type") ?? "";
    const cardName    = params.get("card_name") ?? "";
    const cstUrl      = params.get("csturl") ?? "";
    const customerName = params.get("pay_memo")
      ? params.get("pay_memo")!
      : (params.get("recvphone") ? "" : "");

    // pay_state별 상태 변환
    const status = parsePayState(payState);
    const payType = parsePayType(payTypeCode);
    const normalizedPhone = phone ? normalizePhone(phone) : "";

    logger.log("[PayApp Webhook] 수신", {
      payState, status, mulNo, orderId,
      phone: normalizedPhone.slice(0, 4) + "***",
    });

    // ─── 결제 완료 (pay_state=4) ─────────────────────────────
    if (status === "paid") {
      if (!orderId && !mulNo) {
        logger.warn("[PayApp Webhook] orderId/mulNo 없음 — 무시");
        return new Response("SUCCESS");
      }

      // 중복 방지: mulNo 또는 orderId로 기처리 확인
      if (orderId) {
        const existing = await prisma.payAppPayment.findUnique({
          where: { orderId },
          select: { id: true, status: true },
        });
        if (existing?.status === "paid") {
          logger.log("[PayApp Webhook] 이미 처리됨", { orderId });
          return new Response("SUCCESS");
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

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // PayAppPayment 업데이트
        await tx.payAppPayment.upsert({
          where: { orderId: orderId || `mul_${mulNo}` },
          create: {
            orderId: orderId || `mul_${mulNo}`,
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
            },
            update: { type: "CUSTOMER" },
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

      // 현금영수증 자동 발행 (카드 결제 제외, non-blocking)
      if (payType !== "card" && normalizedPhone && price > 0) {
        issueCashReceipt({
          goodName: name || "크루즈 상품",
          buyerName: name || "미확인",
          buyerPhone: normalizedPhone,
          amount: price,
        }).then((r) => {
          if (r.ok) {
            // 현금영수증 정보를 metadata에 저장
            prisma.payAppPayment.update({
              where: { orderId: orderId || `mul_${mulNo}` },
              data: {
                metadata: {
                  cashReceipt: { cashstno: r.cashstno, cashsturl: r.cashsturl, issuedAt: new Date().toISOString() },
                },
              },
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
      const canceldate = params.get("canceldate") ?? "";
      const cancelmemo = params.get("cancelmemo") ?? "";

      if (orderId) {
        await prisma.payAppPayment.updateMany({
          where: { orderId, status: { not: "cancelled" } },
          data: {
            status: "cancelled",
            refundedAt: canceldate ? new Date(canceldate) : new Date(),
            refundReason: cancelmemo || "PayApp 취소",
          },
        });
      } else if (mulNo) {
        await prisma.payAppPayment.updateMany({
          where: { mulNo, status: { not: "cancelled" } },
          data: {
            status: "cancelled",
            refundedAt: canceldate ? new Date(canceldate) : new Date(),
            refundReason: cancelmemo || "PayApp 취소",
          },
        });
      }

      logger.log("[PayApp Webhook] 취소 처리", { orderId, mulNo, cancelmemo });
      return new Response("SUCCESS");
    }

    // ─── 부분취소 (pay_state=70,71) ──────────────────────────
    if (status === "partial_refunded") {
      const origMulNo = params.get("orig_mul_no") ?? "";
      const origPrice = parseInt(params.get("orig_price") ?? "0");
      const canceldate = params.get("canceldate") ?? "";

      // 원거래 찾기
      const lookupKey = orderId || origMulNo;
      if (lookupKey) {
        const original = await prisma.payAppPayment.findFirst({
          where: orderId ? { orderId } : { mulNo: origMulNo },
        });

        if (original) {
          const partialAmount = origPrice - price; // 원금 - 현재금 = 환불액
          await prisma.payAppPayment.update({
            where: { id: original.id },
            data: {
              status: "partial_refunded",
              refundAmount: (original.refundAmount ?? 0) + (partialAmount > 0 ? partialAmount : 0),
              refundedAt: canceldate ? new Date(canceldate) : new Date(),
              mulNo: mulNo || original.mulNo, // 부분취소 시 mul_no 변경됨
            },
          });
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
        await prisma.payAppPayment.updateMany({
          where: { orderId },
          data: {
            status: "waiting",
            metadata: { vbank, vbankno },
          },
        });
      }

      logger.log("[PayApp Webhook] 가상계좌 대기", { orderId, vbank, vbankno });
      return new Response("SUCCESS");
    }

    // 기타 상태는 로그만 남기고 SUCCESS 반환
    logger.log("[PayApp Webhook] 미처리 상태", { payState, status });
    return new Response("SUCCESS");
  } catch (err) {
    logger.error("[PayApp Webhook] 처리 실패", { err });
    await enqueueDLQ("payapp", { body: "form-data" }, err instanceof Error ? err.message : String(err)).catch(() => {});
    return new Response("FAIL", { status: 500 });
  }
}
