/**
 * POST /api/cron/send-scheduled-messages
 * Day 0-3 SMS/Email 자동 발송 배치 처리 Cron Job
 *
 * 쿼리 파라미터:
 * - day: 0-3 (발송 일차)
 * - type: "sms" | "email" (채널 타입)
 * - orgId: (선택) 특정 조직만 처리
 *
 * 예시:
 * POST /api/cron/send-scheduled-messages?day=0&type=sms
 * POST /api/cron/send-scheduled-messages?day=0&type=email
 *
 * Cron 스케줄:
 * 00:00 → SMS Day 0
 * 00:05 → Email Day 0 (SMS 5분 뒤, SMTP 부하 분산)
 * 10:00 → SMS Day 1
 * 10:05 → Email Day 1
 * 22:00 → SMS Day 2
 * 22:05 → Email Day 2
 * 다음날 10:00 → SMS Day 3
 * 다음날 10:05 → Email Day 3
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import { sendScheduledMessages } from "@/lib/batch-processing/send-scheduled-messages";
import { prisma } from "@/lib/prisma";

/**
 * Cron 요청 검증
 */
function validateCronRequest(req: NextRequest): {
  valid: boolean;
  error?: string;
  day?: number;
  type?: "sms" | "email";
  orgId?: string;
} {
  // 1. Authorization 헤더 확인 (Vercel Cron 또는 내부 요청)
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return { valid: false, error: "Unauthorized: CRON_SECRET not configured" };
  }
  const expectedAuth = `Bearer ${cronSecret}`;
  if (
    authHeader.length !== expectedAuth.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth))
  ) {
    return { valid: false, error: "Unauthorized: Invalid CRON_SECRET" };
  }

  // 2. 쿼리 파라미터 검증
  const url = new URL(req.url);
  const dayStr = url.searchParams.get("day");
  const type = url.searchParams.get("type") as "sms" | "email" | null;
  const orgId = url.searchParams.get("orgId");

  if (!dayStr || !type) {
    return {
      valid: false,
      error: "Missing required params: day, type",
    };
  }

  const day = parseInt(dayStr, 10);
  if (isNaN(day) || day < 0 || day > 3) {
    return {
      valid: false,
      error: "Invalid day: must be 0-3",
    };
  }

  if (type !== "sms" && type !== "email") {
    return {
      valid: false,
      error: "Invalid type: must be 'sms' or 'email'",
    };
  }

  return { valid: true, day, type, orgId: orgId || undefined };
}

/**
 * POST /api/cron/send-scheduled-messages
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. 요청 검증
    const validation = validateCronRequest(req);
    if (!validation.valid) {
      logger.warn("[Cron] 요청 검증 실패: " + validation.error);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { day, type, orgId } = validation;

    logger.info("[Cron] 발송 배치 시작", {
      day,
      type,
      orgId: orgId || "ALL",
      timestamp: new Date().toISOString(),
    });

    // 2. 조직 목록 조회
    let organizations: Array<{ id: string }>;
    if (orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true },
      });
      organizations = org ? [org] : [];
    } else {
      organizations = await prisma.organization.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
    }

    logger.info(`[Cron] ${organizations.length}개 조직 대상 처리`);

    // 3. 각 조직별 배치 처리
    const results = [];
    for (const org of organizations) {
      try {
        const result = await sendScheduledMessages(org.id, day!, type!);
        results.push({
          organizationId: org.id,
          ...result,
        });
      } catch (error) {
        logger.error(`[Cron] 조직 처리 실패:`, {
          organizationId: org.id,
          error: error instanceof Error ? error.message : String(error),
        });
        results.push({
          organizationId: org.id,
          successCount: 0,
          failCount: 0,
          duration: 0,
          batchExecutionId: "",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 4. 집계 결과
    const totalDuration = Date.now() - startTime;
    const summary = {
      day,
      type,
      organizationCount: organizations.length,
      totalSuccessCount: results.reduce((sum, r) => sum + (r.successCount || 0), 0),
      totalFailCount: results.reduce((sum, r) => sum + (r.failCount || 0), 0),
      totalDuration,
      results,
    };

    logger.info("[Cron] 배치 처리 완료", summary);

    return NextResponse.json(
      {
        success: true,
        message: `${type!.toUpperCase()} Day ${day} 발송 완료`,
        ...summary,
      },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("[Cron] 예상치 못한 오류:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/send-scheduled-messages
 * Vercel Cron은 GET 요청만 보내므로 day+type 파라미터가 있으면 배치 실행
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // Vercel Cron 호출 경로: day + type 있으면 배치 실행
  if (url.searchParams.get("day") && url.searchParams.get("type")) {
    return POST(req);
  }

  // 배치 실행 로그 조회 (인증 필수)
  if (action === "status") {
    const cronSecret2 = process.env.CRON_SECRET;
    const authHdr = req.headers.get("authorization") ?? "";
    if (!cronSecret2) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const exp2 = `Bearer ${cronSecret2}`;
    if (authHdr.length !== exp2.length || !timingSafeEqual(Buffer.from(authHdr), Buffer.from(exp2))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const logs = await prisma.batchExecutionLog.findMany({
        where: {},
        orderBy: { startedAt: "desc" },
        take: 10,
        select: {
          id: true,
          batchType: true,
          totalCount: true,
          successCount: true,
          failCount: true,
          duration: true,
          errorRate: true,
          startedAt: true,
          completedAt: true,
        },
      });

      return NextResponse.json(
        {
          success: true,
          logs,
        },
        { status: 200 }
      );
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  }

  // 도움말
  return NextResponse.json(
    {
      message: "Cron API for Day 0-3 SMS/Email batch processing",
      usage: {
        post: "POST /api/cron/send-scheduled-messages?day=0&type=sms",
        get: "GET /api/cron/send-scheduled-messages?action=status",
      },
      examples: [
        "POST /api/cron/send-scheduled-messages?day=0&type=sms",
        "POST /api/cron/send-scheduled-messages?day=0&type=email",
        "GET /api/cron/send-scheduled-messages?action=status",
      ],
    },
    { status: 200 }
  );
}
