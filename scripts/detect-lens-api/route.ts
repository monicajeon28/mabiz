/**
 * POST /api/contacts/detect-lens
 * 렌즈 감지 실행 및 저장
 * @date 2026-05-27
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { getRedisClient } from "@/lib/redis";
import { LensDetectionEngine } from "@/lib/services/lens-detection-engine";
import { logger } from "@/lib/logger";

interface DetectLensRequest {
  contactId: string;
  organizationId: string;
  force?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let ctx;
    try {
      ctx = await getAuthContext();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid session" },
        { status: 401 }
      );
    }

    if (!ctx.organizationId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Organization required" },
        { status: 403 }
      );
    }

    let body: DetectLensRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON" },
        { status: 400 }
      );
    }

    const { contactId, organizationId, force } = body;

    if (!contactId || !organizationId) {
      return NextResponse.json(
        { success: false, error: "Missing contactId or organizationId" },
        { status: 400 }
      );
    }

    if (organizationId !== ctx.organizationId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Organization mismatch" },
        { status: 403 }
      );
    }

    let redis;
    try {
      redis = getRedisClient();
    } catch (error) {
      logger.warn("[DetectLens] Redis not available, continuing without cache");
    }

    const engine = new LensDetectionEngine(prisma, redis);
    const result = await engine.detectLens(contactId, organizationId, force || false);

    await engine.saveClassification(contactId, organizationId, result);

    return NextResponse.json({
      success: true,
      data: {
        lens: result,
        classification: {
          id: contactId,
          lensType: result.primaryLens,
          lensLabel: getLensLabel(result.primaryLens),
          confidenceScore: result.confidenceScore,
          identifiedAt: result.metadata.lastUpdated,
          tags: Object.entries(result.detectedSignals)
            .flatMap(([_, signals]) => signals)
            .slice(0, 20),
        },
      },
    });
  } catch (error) {
    logger.error(`[DetectLens] Error: ${error}`);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getLensLabel(lens: string): string {
  const labels: Record<string, string> = {
    L0: "부재중 재활성화",
    L1: "가격이의",
    L2: "준비복잡",
    L3: "경쟁사언급",
    L4: "세그먼트",
    L5: "자기투영",
    L6: "타이밍/손실회피",
    L7: "동반자설득",
    L8: "재구매/습관화",
    L9: "건강신뢰",
    L10: "즉시구매",
  };
  return labels[lens] || lens;
}
