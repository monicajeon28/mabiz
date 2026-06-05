import { NextRequest, NextResponse } from "next/server";
import { backupCallScriptToGoogleDrive } from "@/lib/google-drive";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { segment, phase, phaseName, content, psychologyPrinciples, pasonaPhase, tips } = body;

    if (!segment || !phase || !phaseName || !content) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await backupCallScriptToGoogleDrive({
      segment,
      phase,
      phaseName,
      content,
      psychologyPrinciples: psychologyPrinciples || [],
      pasonaPhase: pasonaPhase || "",
      tips: tips || [],
    });

    logger.info(`Call script backed up to Google Drive: ${segment} > Phase ${phase}`, {
      fileId: result.fileId,
      viewUrl: result.viewUrl,
    });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    logger.error("Error backing up call script to Google Drive:", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
