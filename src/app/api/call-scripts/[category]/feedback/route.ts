import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const session = await getMabizSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { category } = await params;
    const body = await req.json();
    const { phase, segment, effectiveness, difficulties, improvements, callDuration, callOutcome } = body;

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId ?? undefined,
        userId: session.userId,
        action: "SCRIPT_FEEDBACK",
        resourceType: "CallScript",
        resourceId: category,
        status: "SUCCESS",
        purpose: phase ?? undefined,
        reasonDescription: JSON.stringify({
          segment,
          effectiveness,
          difficulties,
          improvements,
          callDuration,
          callOutcome,
        }),
        durationMs: typeof callDuration === "number" ? callDuration : undefined,
      },
    });

    logger.log("[CallScriptFeedback] saved", {
      userId: session.userId,
      category,
      phase,
      segment,
      effectiveness,
      callOutcome,
    });

    return NextResponse.json({ ok: true, message: "Feedback submitted successfully" });
  } catch (error) {
    logger.error("[POST /api/call-scripts/feedback]", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
