import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/landing-pages/[id]/l6-config
// L6 렌즈 설정 조회 (공개 엔드포인트)
export async function GET(req: Request, { params }: Params) {
  try {
    const { id: landingPageId } = await params;

    const landingPage = await prisma.crmLandingPage.findFirst({
      where: { id: landingPageId, isActive: true },
      select: {
        id: true,
        l6Enabled: true,
        l6PriceAnchors: true,
        l6StockCurrent: true,
        l6StockTotal: true,
        l6WeeklyBurnRate: true,
        l6CountdownEnd: true,
      },
    });

    if (!landingPage) {
      return NextResponse.json(
        { ok: false, message: "페이지를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (!landingPage.l6Enabled) {
      return NextResponse.json({
        ok: true,
        l6Config: { enabled: false },
      });
    }

    // L6 설정 조립
    const priceAnchors = landingPage.l6PriceAnchors
      ? Array.isArray(landingPage.l6PriceAnchors)
        ? landingPage.l6PriceAnchors
        : JSON.parse(String(landingPage.l6PriceAnchors))
      : [];

    const countdownTarget = landingPage.l6CountdownEnd
      ? new Date(landingPage.l6CountdownEnd)
      : new Date(Date.now() + 48 * 60 * 60 * 1000);

    const hoursUntilIncrease = Math.max(
      1,
      Math.floor((countdownTarget.getTime() - Date.now()) / (60 * 60 * 1000))
    );

    const weeksToZero = landingPage.l6StockTotal > 0
      ? Math.ceil(landingPage.l6StockCurrent / (landingPage.l6WeeklyBurnRate || 5))
      : 0;

    return NextResponse.json({
      ok: true,
      l6Config: {
        enabled: true,
        priceAnchors,
        stockConfig: {
          currentStock: landingPage.l6StockCurrent,
          totalStock: landingPage.l6StockTotal,
          weeklyBurnRate: landingPage.l6WeeklyBurnRate,
          weeksToZero,
          countdownTarget: countdownTarget.toISOString(),
        },
        hoursUntilIncrease,
      },
    });
  } catch (err) {
    logger.error("[LandingL6Config] 에러", { err });
    return NextResponse.json(
      { ok: false, message: "요청 처리에 실패했습니다." },
      { status: 500 }
    );
  }
}
