/**
 * GET /api/cron/verify-execution-log
 *
 * Phase 3-δ: ExecutionLog ↔ SendingHistory 자동 검증 크론잡
 * 실행 시간: 매일 06:00 KST (Vercel Cron)
 *
 * 동작:
 * 1. 자동 검증 실행 (4가지 항목)
 * 2. 문제 감지 시 즉시 롤백 (< 1분)
 * 3. Slack 알림 (매일 07:00)
 * 4. 로깅 및 모니터링
 */

export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import { cronVerifyExecutionLog } from "@/lib/cron/verify-execution-log";

export async function GET(req: NextRequest) {
  // P0-7: 토큰 검증 개선 (형식 + 길이 + 값 검증)
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  // Step 1: Bearer 스킴 형식 검증
  if (!auth || !auth.startsWith("Bearer ")) {
    logger.warn("[Cron/VerifyExecutionLog] 토큰 형식 오류", {
      received: auth ? `${auth.substring(0, 20)}...` : "empty",
    });
    return NextResponse.json(
      { ok: false, error: "Invalid token format" },
      { status: 401 }
    );
  }

  // Step 2: Bearer 다음 토큰 추출
  const token = auth.substring(7); // "Bearer " 길이 = 7

  // Step 3: 토큰 길이 검증 (너무 짧음 = 잘못된 형식)
  if (!token || token.length < 20) {
    logger.warn("[Cron/VerifyExecutionLog] 토큰 길이 부족", {
      length: token.length,
    });
    return NextResponse.json(
      { ok: false, error: "Invalid token format" },
      { status: 401 }
    );
  }

  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      logger.warn("[Cron/VerifyExecutionLog] CRON_SECRET 미설정");
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 500 }
      );
    }

    // Step 4: 토큰 값 검증 (timing-safe 비교)
    if (
      token.length !== secret.length ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
    ) {
      logger.warn("[Cron/VerifyExecutionLog] 토큰 값 불일치");
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
  } else {
    // 개발 환경에서는 선택적 인증
    if (secret) {
      if (
        token.length !== secret.length ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(secret))
      ) {
        logger.warn("[Cron/VerifyExecutionLog] 토큰 값 불일치");
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
    }
  }

  try {
    logger.info("[Cron/VerifyExecutionLog] 시작", {
      timestamp: new Date().toISOString(),
    });

    const result = await cronVerifyExecutionLog();

    logger.info("[Cron/VerifyExecutionLog] 완료", { result: result ?? undefined });

    return NextResponse.json({
      ok: true,
      message: "ExecutionLog verification completed",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[Cron/VerifyExecutionLog] 오류", { err });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/verify-execution-log
 * 수동 테스트용 엔드포인트 (개발 환경에서만 활성화)
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Not allowed in production" },
      { status: 403 }
    );
  }

  try {
    logger.info("[Cron/VerifyExecutionLog] 수동 실행 시작");

    const result = await cronVerifyExecutionLog();

    logger.info("[Cron/VerifyExecutionLog] 수동 실행 완료", { result: result ?? undefined });

    return NextResponse.json({
      ok: true,
      message: "ExecutionLog verification completed",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[Cron/VerifyExecutionLog] 수동 실행 오류", { err });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
