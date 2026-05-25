import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const session = await getMabizSession();
    if (!session?.userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { category } = await params;
    const body = await req.json();
    const {
      phase,
      segment,
      effectiveness,
      difficulties,
      improvements,
      callDuration,
      callOutcome,
    } = body;

    // TODO: DB에 피드백 저장
    // await db.callScriptFeedback.create({
    //   organizationId: session.user.organizationId,
    //   userId: session.user.id,
    //   category,
    //   scriptPhase: phase,
    //   segment,
    //   effectiveness,
    //   difficulties: JSON.stringify(difficulties),
    //   improvements,
    //   callDuration,
    //   callOutcome,
    // });

    // 현재는 로그만 기록
    logger.info("[CallScriptFeedback]", {
      userId: session.userId,
      category,
      phase,
      segment,
      effectiveness,
      callOutcome,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: "Feedback submitted successfully",
    });
  } catch (error) {
    logger.error("[POST /api/call-scripts/feedback]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
