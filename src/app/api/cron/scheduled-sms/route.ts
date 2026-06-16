export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { processPendingSms } from "@/lib/aligo/batch-sender";
import { logger } from "@/lib/logger";

// 인메모리 락 — Vercel Cron은 단일 인스턴스 실행을 보장하므로 충분
let isRunning = false;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (!secret) {
    logger.error("[CronScheduledSms] CRON_SECRET 환경변수 미설정");
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const expected = `Bearer ${secret}`;
  let authValid = false;
  try {
    authValid = auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    authValid = false;
  }

  if (!authValid) {
    logger.warn("[CronScheduledSms] 인증 실패", { ip: req.headers.get("x-forwarded-for") });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (isRunning) {
    logger.info("[CronScheduledSms] 이미 실행 중. Skip.");
    return NextResponse.json({ ok: false, message: "Already running" }, { status: 429 });
  }

  isRunning = true;
  try {
    const now = new Date();
    const kstHour = (now.getUTCHours() + 9) % 24;
    const canProcessNightBlocked = kstHour >= 8;

    const organizationsWithSms = await prisma.scheduledSms.findMany({
      where: {
        status: canProcessNightBlocked ? { in: ["PENDING", "NIGHT_BLOCKED"] } : "PENDING",
        scheduledAt: { lte: now },
      },
      select: { organizationId: true },
      distinct: ["organizationId"],
      take: 10,
    });

    if (organizationsWithSms.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, errors: 0 });
    }

    let totalProcessed = 0;
    let totalErrors = 0;

    for (const org of organizationsWithSms) {
      try {
        const result = await processPendingSms(org.organizationId, 50);
        totalProcessed += result.processed;
        totalErrors += result.errors;
        logger.log("[CronScheduledSms] 조직 처리 완료", { organizationId: org.organizationId, ...result });
      } catch (err) {
        logger.error("[CronScheduledSms] 조직 처리 실패", {
          organizationId: org.organizationId,
          error: err instanceof Error ? err.message : String(err),
        });
        totalErrors++;
      }
    }

    return NextResponse.json({ ok: true, processed: totalProcessed, errors: totalErrors });
  } catch (err) {
    logger.error("[CronScheduledSms] 전체 오류", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  } finally {
    isRunning = false;
  }
}
