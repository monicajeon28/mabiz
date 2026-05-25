import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

// Track B 스크립트 데이터 로드 (프로젝트 루트의 JSON 파일)
function loadTrackBScripts() {
  try {
    const dataPath = path.join(process.cwd(), "PHASE3_TRACK_B_CALL_SCRIPT_SEGMENTS.json");
    const fileContents = fs.readFileSync(dataPath, "utf8");
    return JSON.parse(fileContents);
  } catch (error) {
    logger.error("[Track B API] Failed to load PHASE3_TRACK_B_CALL_SCRIPT_SEGMENTS.json", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

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

    const data = loadTrackBScripts();
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Track B 스크립트 데이터 로드 실패" },
        { status: 500 }
      );
    }

    // segment A, B, C, D에 해당하는 version 찾기
    const version = data.callScriptVersions.find((v: any) => v.segment === segment);
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
        objectives: scriptPhase.objectives,
        keyMessages: scriptPhase.keyMessages,
        silencePoints: scriptPhase.silencePoints,
        customerEngagement: scriptPhase.customerEngagement,
        tips: scriptPhase.tips || [],
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
