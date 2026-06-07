import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
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

    // Mock data에서 스크립트 조회
    const categoryData = CALL_SCRIPTS_DATA[category];
    if (!categoryData) {
      return NextResponse.json(
        { ok: false, error: "Category not found" },
        { status: 404 }
      );
    }

    const segmentData = categoryData[decodedSegment];
    if (!segmentData) {
      return NextResponse.json(
        { ok: false, error: "Segment not found" },
        { status: 404 }
      );
    }

    const script = segmentData[parseInt(phase)];
    if (!script) {
      return NextResponse.json(
        { ok: false, error: "Phase not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      script,
    });
  } catch (error) {
    logger.error("[GET /api/call-scripts]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
