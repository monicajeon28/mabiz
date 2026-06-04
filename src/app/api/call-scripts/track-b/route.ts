import { NextRequest, NextResponse } from "next/server";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import trackBData from "./track-b-scripts.json";

export async function GET(req: NextRequest) {
  try {
    // 인증 확인
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const segment = searchParams.get("segment")?.toUpperCase(); // A, B, C, D
    const phase = searchParams.get("phase"); // 0-6 (or 1-7 if 1-indexed)

    if (!segment || !phase) {
      return NextResponse.json(
        { ok: false, error: "segment과 phase 파라미터 필수" },
        { status: 400 }
      );
    }

    // segment A, B, C, D에 해당하는 version 찾기
    const version = trackBData.callScriptVersions.find((v: { segment: string }) => v.segment === segment);
    if (!version) {
      return NextResponse.json(
        { ok: false, error: `Segment ${segment} not found` },
        { status: 404 }
      );
    }

    // phase 인덱스 (0-based)
    const phaseIndex = parseInt(phase);
    if (isNaN(phaseIndex) || phaseIndex < 0 || phaseIndex >= version.phases.length) {
      return NextResponse.json(
        { ok: false, error: `Phase ${phase} out of range (0-${version.phases.length - 1})` },
        { status: 404 }
      );
    }

    const scriptPhase = version.phases[phaseIndex];

    return NextResponse.json({
      ok: true,
      script: {
        segment,
        phase: phaseIndex,
        versionId: version.id,
        versionName: version.name,
        targetDuration: version.targetDuration,
        phaseName: scriptPhase.name,
        phaseDuration: scriptPhase.duration,
        pasona: scriptPhase.pasona,
        spin: scriptPhase.spin,
        psychologyLenses: scriptPhase.psychologyLenses,
        script: scriptPhase.script,
        objectives: (scriptPhase as Record<string, unknown>).objectives ?? [],
        keyMessages: (scriptPhase as Record<string, unknown>).keyMessages ?? [],
        silencePoints: (scriptPhase as Record<string, unknown>).silencePoints ?? [],
        customerEngagement: (scriptPhase as Record<string, unknown>).customerEngagement ?? '',
        tips: (scriptPhase as Record<string, unknown>).tips ?? [],
      },
    });
  } catch (error) {
    logger.error("[Track B API] Error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
