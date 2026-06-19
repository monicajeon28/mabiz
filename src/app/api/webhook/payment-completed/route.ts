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
  const hashBuf = createHmac("sha256", secret).update(payload).digest();
  try {
    const sigBuf = Buffer.from(signature, "hex");
    if (hashBuf.length !== sigBuf.length) return false;
    return timingSafeEqual(hashBuf, sigBuf);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;
    if (!secret) {
      logger.error("[Webhook] CRUISEDOT_WEBHOOK_SECRET 환경변수가 설정되지 않았습니다");
      return NextResponse.json(
        { ok: false, message: "Server misconfiguration" },
        { status: 500 }
      );
    }
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
    const organizationId = process.env.MABIZ_ORGANIZATION_ID || "default-org-id";

    // Contact 조회 (customerId로 매칭)
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId,
        sourceId: data.payment.customerId
      },
      select: { id: true, organizationId: true },
      take: 1,
    });

    const contact = contacts[0];

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
          lastPaymentStatus: "COMPLETED"
        },
      });
    }

    // 활동 로그 생성 (userId는 webhook에서 받지 않으므로 기본값 사용)
    const systemUserId = "webhook-system"; // TODO: 시스템 사용자 ID 설정

    await prisma.callLog.create({
      data: {
        contactId: contact.id,
        userId: systemUserId,
        content: `Payment ${data.payment.status}: ${data.payment.amount} ${data.payment.currency}`,
      },
    }).catch(() => {
      // CallLog 생성 실패는 무시
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
