import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createHmac, timingSafeEqual } from "crypto";
import { generateErrorId, logSafeError } from "@/lib/pii-masker";

interface PaymentWebhookPayload {
  eventId: string;
  timestamp: string;
  payment: {
    id: string;
    customerId: string;
    amount: number;
    currency: string;
    status: "COMPLETED" | "FAILED" | "REFUNDED";
    paymentMethod?: string;
    description?: string;
    metadata?: Record<string, any>;
  };
}

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hash = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(signature)
  );
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRUISEDOT_WEBHOOK_SECRET || "dev-secret";
    const signature = request.headers.get("x-webhook-signature") || "";
    const payload = await request.text();

    // 서명 검증
    if (!verifyWebhookSignature(payload, signature, secret)) {
      logger.warn("[Webhook] 서명 검증 실패 (payment-completed)");
      return NextResponse.json(
        { ok: false, message: "Invalid signature" },
        { status: 403 }
      );
    }

    const data: PaymentWebhookPayload = JSON.parse(payload);

    // Contact 업데이트 (외부 결제 ID로 매칭)
    const contact = await prisma.contact.findFirst({
      where: { externalCustomerId: data.payment.customerId },
      select: { id: true, organizationId: true },
    });

    if (!contact) {
      logger.warn("[Webhook] Contact not found", {
        customerId: data.payment.customerId,
      });
      return NextResponse.json(
        { ok: false, message: "Contact not found" },
        { status: 404 }
      );
    }

    // 지불 정보 추가 (필드가 있다면)
    if (data.payment.status === "COMPLETED") {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          purchasedAt: new Date(data.timestamp),
          // 추가 필드들
        },
      });
    }

    // 활동 로그 생성
    await prisma.callLog.create({
      data: {
        contactId: contact.id,
        organizationId: contact.organizationId,
        content: `Payment ${data.payment.status}: ${data.payment.amount} ${data.payment.currency}`,
        callType: "PAYMENT",
        createdAt: new Date(data.timestamp),
      },
    });

    logger.log("[Webhook] 결제 처리", {
      contactId: contact.id,
      paymentId: data.payment.id,
      amount: data.payment.amount,
      status: data.payment.status,
      eventId: data.eventId,
    });

    return NextResponse.json({
      ok: true,
      message: "Payment processed",
      contactId: contact.id,
    });
  } catch (err) {
    const errorId = generateErrorId();
    logSafeError(logger, err, "[Webhook] 결제 처리 실패");
    return NextResponse.json(
      {
        ok: false,
        message: "결제를 처리할 수 없습니다",
        errorId,
        contactSupport: true,
      },
      { status: 500 }
    );
  }
}
