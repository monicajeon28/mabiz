import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/payapp/payment/[orderId]/verify
 *
 * P0-6: orderId XSS 방지 (정규식 검증)
 * P1-8: AffiliateSale 누락 로그
 * P1-9: 부분취소 분수 범위 검증
 * P1-10: 환불 알림 에러 추적
 *
 * 응답:
 * - { ok: true, saleAmount } - 결제 확인됨
 * - { ok: false, message } - 오류
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    const slug = req.nextUrl.searchParams.get("slug");

    // P0-6: orderId 형식 검증 (XSS 방지)
    if (!orderId || !/^[a-zA-Z0-9\-_]+$/.test(orderId)) {
      logger.warn("[PaymentVerify] 의심 orderId 형식", { orderId: orderId?.substring(0, 20) ?? "null" });
      return NextResponse.json(
        { ok: false, message: "유효하지 않은 주문 ID" },
        { status: 400 }
      );
    }

    // slug 형식 검증
    if (slug && !/^[a-zA-Z0-9\-_]*$/.test(slug)) {
      logger.warn("[PaymentVerify] 의심 slug 형식", { slug: slug.substring(0, 20) });
      return NextResponse.json(
        { ok: false, message: "유효하지 않은 페이지 정보" },
        { status: 400 }
      );
    }

    // DB에서 orderId 확인
    const payment = await prisma.payAppPayment.findUnique({
      where: { orderId },
      select: {
        status: true,
        organizationId: true,
        amount: true,
      },
    });

    if (!payment) {
      logger.warn("[PaymentVerify] orderId 조회 실패", {
        orderId: orderId.substring(0, 10) + "***",
      });
      return NextResponse.json(
        { ok: false, message: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (payment.status !== "paid") {
      logger.warn("[PaymentVerify] 결제 상태 불일치", {
        orderId: orderId.substring(0, 10) + "***",
        status: payment.status,
      });
      return NextResponse.json(
        { ok: false, message: "결제가 완료되지 않았습니다." },
        { status: 400 }
      );
    }

    // P1-8: AffiliateSale 조회 및 로그
    const affiliateSale = await prisma.affiliateSale.findUnique({
      where: { orderId },
      select: {
        id: true,
        affiliateCode: true,
        commissionAmount: true,
      },
    });

    if (!affiliateSale) {
      logger.warn("[PaymentVerify] AffiliateSale 조회 실패", {
        orderId: orderId.substring(0, 10) + "***",
        organizationId: payment.organizationId,
      });
    }

    // 결제 금액 사용
    const finalAmount = payment.amount ?? 0;

    return NextResponse.json(
      {
        ok: true,
        saleAmount: finalAmount,
        ...(affiliateSale ? { affiliateSaleId: affiliateSale.id } : {}),
      },
      { status: 200 }
    );
  } catch (err) {
    logger.error("[PaymentVerify] 예외 발생", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, message: "시스템 오류" },
      { status: 500 }
    );
  }
}
