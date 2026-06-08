import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CALL_SCRIPTS_DATA } from "../../../data";
import { logger } from "@/lib/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ category: string; segment: string; phase: string }> }
) {
  try {
    const session = await getMabizSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { category, segment, phase } = await params;
    const decodedSegment = decodeURIComponent(segment);
    const phaseNum = parseInt(phase, 10);

    // 1) SalesPlaybook DB 우선 조회
    const dbScript = await prisma.salesPlaybook.findFirst({
      where: {
        type: category,
        customerSegment: decodedSegment,
        phase: String(phaseNum),
        isActive: true,
      },
      select: {
        id: true,
        type: true,
        customerSegment: true,
        phase: true,
        title: true,
        content: true,
        pasonaStage: true,
        psychology: true,
        notes: true,
        effectivenessScore: true,
      },
    }).catch(() => null);

    if (dbScript) {
      let psychologyPrinciples: string[] = [];
      let tips: string[] = [];
      try { psychologyPrinciples = JSON.parse(dbScript.psychology ?? "[]"); } catch {}
      try { tips = JSON.parse(dbScript.notes ?? "[]"); } catch {}

      return NextResponse.json({
        ok: true,
        script: {
          id: dbScript.id,
          category: dbScript.type,
          segment: dbScript.customerSegment ?? decodedSegment,
          phase: dbScript.phase ?? phase,
          phaseName: dbScript.title,
          content: dbScript.content,
          pasonaPhase: dbScript.pasonaStage ?? null,
          psychologyPrinciples,
          tips,
          source: "db",
        },
      });
    }

    // 2) 정적 데이터 fallback
    const categoryData = CALL_SCRIPTS_DATA[category];
    if (!categoryData) {
      return NextResponse.json({ ok: false, error: "Category not found" }, { status: 404 });
    }

    const segmentData = categoryData[decodedSegment];
    if (!segmentData) {
      return NextResponse.json({ ok: false, error: "Segment not found" }, { status: 404 });
    }

    const script = segmentData[phaseNum];
    if (!script) {
      return NextResponse.json({ ok: false, error: "Phase not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, script: { ...script, source: "static" } });

  } catch (error) {
    logger.error("[GET /api/call-scripts]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
