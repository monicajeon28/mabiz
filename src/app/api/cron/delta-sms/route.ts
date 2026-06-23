export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse, NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import {
  deltaSmsScheduleMorning,
  deltaSmsScheduleAfternoon,
  deltaSmsScheduleEvening,
} from "@/lib/cron/delta-sms-schedule";

/**
 * GET /api/cron/delta-sms
 *
 * Menu #38 Phase 4 Track 1: 렌탈 고객 3일 SMS 자동 발송 Cron
 *
 * Query Parameters:
 * - schedule: "morning" (09:00) | "afternoon" (14:00) | "evening" (19:00)
 *
 * 실행 방식:
 * - Vercel Cron 또는 외부 스케줄러
 * - 인증: Authorization: Bearer CRON_SECRET
 *
 * 처리:
 * 1. 활성 렌탈 캠페인 조회
 * 2. 각 캠페인별 Delta SMS 발송
 * 3. 결과 집계 및 로깅
 *
 * 응답 예시:
 * {
 *   "ok": true,
 *   "timestamp": "2026-05-19T10:00:00Z",
 *   "schedule": "morning",
 *   "campaignsProcessed": 2,
 *   "totalSent": 450,
 *   "totalFailed": 12,
 *   "totalSkipped": 38,
 *   "duration": "23.45s",
 *   "campaigns": [
 *     { "campaignId": "camp_001", "sent": 250, "failed": 5, "skipped": 25 },
 *     { "campaignId": "camp_002", "sent": 200, "failed": 7, "skipped": 13 }
 *   ]
 * }
 */
export async function GET(req: NextRequest) {
  // Cron 인증
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  // P0 #3: CRON_SECRET 환경변수 절대 로그 출력 금지
  // P0 #4: 상태코드 401로 통일 (500은 웹훅 재시도 유발)

  if (!secret) {
    logger.warn("[Cron/DeltaSms] CRON_SECRET 환경변수 미설정. 프로덕션에서는 필수입니다.");
    return NextResponse.json({ ok: false, error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  }

  // Bearer 토큰 검증 (timing-safe 비교)
  const expected = `Bearer ${secret}`;
  if (
    auth.length !== expected.length ||
    !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  ) {
    logger.warn("[Cron/DeltaSms] 인증 실패");
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    // schedule 파라미터 조회 (없으면 현재 KST 시간 기반 자동 감지)
    let schedule = req.nextUrl.searchParams.get("schedule") as
      | "morning"
      | "afternoon"
      | "evening"
      | null;

    // 파라미터가 없으면 현재 시간 기반 자동 결정 (Vercel Cron은 query param 미지원)
    if (!schedule) {
      const now = new Date();
      const kstHour = (now.getUTCHours() + 9) % 24;
      if (kstHour === 9) {
        schedule = "morning";
      } else if (kstHour === 14) {
        schedule = "afternoon";
      } else if (kstHour === 19) {
        schedule = "evening";
      } else {
        logger.warn("[Cron/DeltaSms] 예약된 시간 외 실행", { kstHour });
        return NextResponse.json(
          {
            ok: false,
            error: "Scheduled outside of execution hours (09:00, 14:00, 19:00 KST)",
          },
          { status: 400 }
        );
      }
    }

    if (!["morning", "afternoon", "evening"].includes(schedule)) {
      logger.warn("[Cron/DeltaSms] 유효하지 않은 schedule 파라미터", {
        schedule,
      });
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid schedule parameter. Use "morning", "afternoon", or "evening".',
        },
        { status: 400 }
      );
    }

    logger.info("[Cron/DeltaSms] 시작", {
      schedule,
      timestamp: new Date().toISOString(),
    });

    // 시간대별 함수 호출
    let result;
    switch (schedule) {
      case "morning":
        result = await deltaSmsScheduleMorning();
        break;
      case "afternoon":
        result = await deltaSmsScheduleAfternoon();
        break;
      case "evening":
        result = await deltaSmsScheduleEvening();
        break;
    }

    logger.info("[Cron/DeltaSms] 완료", result);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    logger.error("[Cron/DeltaSms] 오류", { err });
    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/delta-sms
 *
 * 수동 테스트용 엔드포인트 (개발 환경에서만 활성화)
 *
 * Body:
 * {
 *   "schedule": "morning" | "afternoon" | "evening"
 * }
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Not allowed in production" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { schedule } = body as { schedule?: string };

    if (!schedule || !["morning", "afternoon", "evening"].includes(schedule)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid schedule. Use "morning", "afternoon", or "evening".',
        },
        { status: 400 }
      );
    }

    logger.info("[Cron/DeltaSms] 수동 실행 시작", { schedule });

    // 시간대별 함수 호출
    let result;
    switch (schedule) {
      case "morning":
        result = await deltaSmsScheduleMorning();
        break;
      case "afternoon":
        result = await deltaSmsScheduleAfternoon();
        break;
      case "evening":
        result = await deltaSmsScheduleEvening();
        break;
    }

    logger.info("[Cron/DeltaSms] 수동 실행 완료", result);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    logger.error("[Cron/DeltaSms] 수동 실행 오류", { err });
    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
