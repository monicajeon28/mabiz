import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createHmac, timingSafeEqual } from "crypto";

interface SettlementWebhookPayload {
  eventId: string;
  timestamp: string;
  settlement: {
    id: number;
    period: string; // YYYY-MM
    status: "DRAFT" | "APPROVED" | "PAID";
    totalAmount: number;
    itemCount: number;
    changes?: Array<{ field: string; oldValue: any; newValue: any }>;
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
      logger.warn("[Webhook] 서명 검증 실패 (settlement-updated)");
      return NextResponse.json(
        { ok: false, message: "Invalid signature" },
        { status: 403 }
      );
    }

    const data: SettlementWebhookPayload = JSON.parse(payload);

    // Settlement 상태 업데이트
    const [year, month] = data.settlement.period.split("-");
    const periodStart = new Date(`${year}-${month}-01`);
    const periodEnd = new Date(parseInt(year), parseInt(month), 0);

    const settlement = await prisma.monthlySettlement.upsert({
      where: {
        id: data.settlement.id,
      },
      create: {
        id: data.settlement.id,
        periodStart,
        periodEnd,
        status: data.settlement.status,
        summary: {
          totalAmount: data.settlement.totalAmount,
          itemCount: data.settlement.itemCount,
        } as any,
      },
      update: {
        status: data.settlement.status,
        summary: {
          totalAmount: data.settlement.totalAmount,
          itemCount: data.settlement.itemCount,
        } as any,
        updatedAt: new Date(),
      },
    });

    // Settlement Event 로깅
    await prisma.settlementEvent.create({
      data: {
        settlementId: settlement.id,
        eventType: "STATUS_CHANGED",
        description: `Status changed to ${data.settlement.status}`,
        metadata: {
          oldAmount: (settlement.summary as any)?.previousAmount,
          newAmount: data.settlement.totalAmount,
          changes: data.settlement.changes,
        } as any,
      },
    });

    logger.log("[Webhook] 정산 업데이트", {
      settlementId: settlement.id,
      period: data.settlement.period,
      status: data.settlement.status,
      eventId: data.eventId,
    });

    return NextResponse.json({
      ok: true,
      message: "Settlement processed",
      settlementId: settlement.id,
    });
  } catch (err) {
    logger.error("[Webhook] 정산 업데이트 실패", { err });
    return NextResponse.json(
      { ok: false, message: "Processing failed" },
      { status: 500 }
    );
  }
}
