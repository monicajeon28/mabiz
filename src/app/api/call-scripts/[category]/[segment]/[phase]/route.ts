import { NextRequest, NextResponse } from "next/server";
import { CALL_SCRIPTS_DATA } from "../../../data";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ category: string; segment: string; phase: string }> }
) {
  try {
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
    console.error("Error fetching script:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
