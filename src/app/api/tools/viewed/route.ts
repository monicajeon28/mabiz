import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// POST /api/tools/viewed
// 도구 조회 기록 (분석용)
export async function POST(req: Request) {
  try {
    const context = await getAuthContext();
    const userId = context.userId;
    const { toolId } = await req.json();

    if (!toolId) {
      return NextResponse.json(
        { ok: false, message: "toolId 필수" },
        { status: 400 }
      );
    }

    // 향후 DB에 기록
    // await prisma.toolViewLog.create({
    //   data: {
    //     userId,
    //     toolId,
    //     viewedAt: new Date(),
    //   },
    // });

    logger.info(`Tool viewed: ${toolId} by user ${userId}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Error tracking tool view:", error as object);
    return NextResponse.json(
      { ok: false, message: "추적 실패" },
      { status: 500 }
    );
  }
}
