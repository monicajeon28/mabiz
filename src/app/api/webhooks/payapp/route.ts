import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const payState = params.get("pay_state");
    const orderId = params.get("var1");
    const customerPhone = params.get("phone") ?? params.get("buyer_tel");
    const customerName = params.get("name") ?? params.get("buyer_name");
    const amount = parseInt(params.get("price") ?? params.get("amount") ?? "0");
    const landingPageSlug = params.get("var2");

    // 결제 완료(4) 아니면 무시
    if (payState !== "4") {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!orderId || !customerPhone) {
      logger.warn("[PayApp Webhook] 필수 파라미터 누락", { payState });
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // TOCTOU 방지: 중복 처리 방어
    const existing = await prisma.payAppPayment.findUnique({
      where: { orderId },
      select: { id: true, status: true },
    });
    if (existing?.status === "paid") {
      logger.log("[PayApp Webhook] 이미 처리된 주문", { orderId });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // 어느 조직(파트너)의 랜딩페이지인지 찾기
    let orgId: string | null = null;
    if (landingPageSlug) {
      const lp = await prisma.landingPage.findFirst({
        where: { slug: landingPageSlug },
        select: { organizationId: true, id: true },
      });
      orgId = lp?.organizationId ?? null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      // 1. PayApp 결제 기록
      await tx.payAppPayment.upsert({
        where: { orderId },
        create: {
          orderId,
          amount,
          customerPhone,
          customerName: customerName ?? "미확인",
          status: "paid",
          paidAt: new Date(),
          landingPageId: landingPageSlug ?? undefined,
        },
        update: {
          status: "paid",
          paidAt: new Date(),
        },
      });

      // 2. 파트너 특정 가능 시 → 구매고객으로 등록
      if (orgId) {
        await tx.contact.upsert({
          where: {
            phone_organizationId: {
              phone: customerPhone,
              organizationId: orgId,
            },
          },
          create: {
            organizationId: orgId,
            name: customerName ?? "미확인",
            phone: customerPhone,
            type: "CUSTOMER",
            purchasedAt: new Date(),
          },
          update: {
            type: "CUSTOMER",
            purchasedAt: new Date(),
          },
        });
      }
    });

    logger.log("[PayApp Webhook] 결제 완료 처리 성공", {
      orderId,
      phone: customerPhone.substring(0, 4) + "***",
      orgId: orgId ?? "미확인",
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    logger.error("[PayApp Webhook] 처리 실패", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
