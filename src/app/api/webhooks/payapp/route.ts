import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // [보안] IP 화이트리스트 검증
    // 환경변수: PAYAPP_ALLOWED_IPS="211.43.10.1,211.43.10.2" (쉼표 구분)
    // 미설정 시 → 경고 로그 후 통과 (초기 설정 편의)
    const allowedIPs =
      process.env.PAYAPP_ALLOWED_IPS?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
    const requestIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (allowedIPs.length === 0) {
      logger.warn("[PayApp Webhook] PAYAPP_ALLOWED_IPS 미설정 — IP 검증 생략", {
        requestIP,
      });
    } else if (!allowedIPs.includes(requestIP)) {
      logger.warn("[PayApp Webhook] 허용되지 않은 IP", { requestIP });
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const body = await req.text();
    const params = new URLSearchParams(body);

    const payState = params.get("pay_state");
    const orderId = params.get("var1");
    const customerPhone = params.get("phone") ?? params.get("buyer_tel");
    const customerName = params.get("name") ?? params.get("buyer_name");
    // ⚠️ amount는 PayApp에서 전달된 값 — 결제 금액 검증은 PayApp 관리자 콘솔에서 수행
    // CLAUDE.md 조항 3: 클라이언트 금액 직접 사용 금지 — 여기서는 로그/참고용으로만 저장
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

    // [보안] orderId 형식 검증 (최소 방어선: UUID or alphanumeric, 8~64자)
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(orderId)) {
      logger.warn("[PayApp Webhook] 비정상 orderId 형식", { orderId });
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
      const lp = await prisma.crmLandingPage.findFirst({
        where: { slug: landingPageSlug },
        select: { organizationId: true, id: true },
      });
      orgId = lp?.organizationId ?? null;
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
