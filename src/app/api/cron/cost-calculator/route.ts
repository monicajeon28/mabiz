/**
 * Menu #38 Phase 4 Track 1: Cron API - 캠페인 비용 계산
 *
 * Endpoint: POST /api/cron/cost-calculator
 *
 * 파라미터:
 * - type: "realtime" | "hourly"
 *   - realtime: 5분마다 SENDING 캠페인 실시간 계산
 *   - hourly: 시간마다 SENDING/SENT 캠페인 월별 집계
 *
 * 인증:
 * - CRON_SECRET (environment variable)
 * - Authorization: Bearer {CRON_SECRET}
 *
 * 반환:
 * ```json
 * {
 *   "ok": true,
 *   "type": "realtime" | "hourly",
 *   "timestamp": "2026-05-19T15:30:00.000Z",
 *   "result": {
 *     "total": 5,
 *     "success": 5,
 *     "failed": 0,
 *     "errors": []
 *   }
 * }
 * ```
 */

export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import {
  scheduleCostCalculationRealtime,
  scheduleCostCalculationHourly,
} from "@/lib/cron/cost-calculator-schedule";

export async function POST(req: NextRequest) {
  try {
    // Step 1: CRON_SECRET 검증
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization") ?? "";

    if (process.env.NODE_ENV === "production") {
      if (!secret) {
        logger.warn("[Cron/CostCalculator] CRON_SECRET 미설정");
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 500 }
        );
      }

      const expected = `Bearer ${secret}`;
      if (
        auth.length !== expected.length ||
        !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
      ) {
        logger.warn("[Cron/CostCalculator] 인증 실패");
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
    } else {
      // 개발 환경: 선택적 인증
      if (secret) {
        const expected = `Bearer ${secret}`;
        if (
          auth.length !== expected.length ||
          !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
        ) {
          logger.warn("[Cron/CostCalculator] 인증 실패");
          return NextResponse.json(
            { ok: false, error: "Unauthorized" },
            { status: 401 }
          );
        }
      }
    }

    // Step 2: 요청 본문 파싱
    let body;
    try {
      body = await req.json();
    } catch {
      // GET 요청이거나 빈 본문
      body = {};
    }

    const type = body.type || req.nextUrl.searchParams.get("type") || "realtime";

    if (!["realtime", "hourly"].includes(type)) {
      return NextResponse.json(
        { ok: false, error: "Invalid type parameter" },
        { status: 400 }
      );
    }

    logger.info("[Cron/CostCalculator] 시작", { type, timestamp: new Date().toISOString() });

    // Step 3: 스케줄러 실행
    let result;
    if (type === "realtime") {
      result = await scheduleCostCalculationRealtime();
    } else {
      result = await scheduleCostCalculationHourly();
    }

    logger.info("[Cron/CostCalculator] 완료", {
      type,
      result,
    });

    // Step 4: 응답
    return NextResponse.json(
      {
        ok: true,
        type,
        timestamp: new Date().toISOString(),
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error("[Cron/CostCalculator] 오류", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Internal Server Error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET 요청 지원 (cURL/브라우저 테스트용)
 * GET /api/cron/cost-calculator?type=realtime
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
