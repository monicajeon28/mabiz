import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createHmac, timingSafeEqual } from "crypto";

interface WebhookPayload {
  eventId: string;
  timestamp: string;
  customer: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    affiliateCode?: string;
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
      logger.warn("[Webhook] 서명 검증 실패");
      return NextResponse.json(
        { ok: false, message: "Invalid signature" },
        { status: 403 }
      );
    }

    const data: WebhookPayload = JSON.parse(payload);

    // Contact 생성 또는 업데이트
    const contact = await prisma.contact.upsert({
      where: { externalCustomerId: data.customer.id },
      create: {
        externalCustomerId: data.customer.id,
        name: data.customer.name,
        email: data.customer.email || null,
        phone: data.customer.phone || null,
        organizationId: "default-org-id", // webhook에서 orgId 결정 필요
        sourceType: "WEBHOOK",
        sourceId: data.customer.affiliateCode || "CRUISEDOT",
        createdAt: new Date(data.timestamp),
      },
      update: {
        name: data.customer.name,
        email: data.customer.email || null,
        phone: data.customer.phone || null,
        updatedAt: new Date(),
      },
    });

    logger.log("[Webhook] 고객 생성/업데이트", {
      contactId: contact.id,
      externalId: data.customer.id,
      eventId: data.eventId,
    });

    return NextResponse.json({
      ok: true,
      message: "Customer processed",
      contactId: contact.id,
    });
  } catch (err) {
    logger.error("[Webhook] 고객 생성 실패", { err });
    // 재시도 가능하도록 5xx 반환
    return NextResponse.json(
      { ok: false, message: "Processing failed" },
      { status: 500 }
    );
  }
}
