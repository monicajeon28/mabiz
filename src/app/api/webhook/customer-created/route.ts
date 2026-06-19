import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createHmac, timingSafeEqual } from "crypto";
import { generateErrorId, logSafeError } from "@/lib/pii-masker";

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
      logger.warn("[Webhook] 서명 검증 실패");
      return NextResponse.json(
        { ok: false, message: "Invalid signature" },
        { status: 403 }
      );
    }

    const data: WebhookPayload = JSON.parse(payload);

    // organizationId 결정
    const organizationId = process.env.MABIZ_ORGANIZATION_ID || "default-org-id";
    const email = data.customer.email || "";
    const phone = data.customer.phone || "";

    // Contact 생성 또는 업데이트
    const contact = await prisma.contact.upsert({
      where: {
        email_organizationId: {
          email: email || "unknown@example.com",
          organizationId
        }
      },
      create: {
        name: data.customer.name,
        email: email || "",
        phone: phone || "",
        organizationId,
        sourceType: "WEBHOOK",
        sourceId: data.customer.affiliateCode || "CRUISEDOT",
        type: "PROSPECT"
      },
      update: {
        name: data.customer.name,
        email: email || undefined,
        phone: phone || undefined,
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
    const errorId = generateErrorId();
    logSafeError(logger, err, "[Webhook] 고객 생성 실패");
    // 재시도 가능하도록 5xx 반환
    return NextResponse.json(
      {
        ok: false,
        message: "고객을 처리할 수 없습니다",
        errorId,
        contactSupport: true,
      },
      { status: 500 }
    );
  }
}
