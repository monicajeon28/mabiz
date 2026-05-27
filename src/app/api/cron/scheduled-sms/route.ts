export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { processPendingSms } from "@/lib/aligo/batch-sender";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/scheduled-sms
 * Vercel Cron (매 5분) — PENDING 상태 + scheduledAt <= now() 발송 처리
 * Authorization: Bearer CRON_SECRET
 *
 * 업그레이드 (2026-05-28):
 * - Aligo 배치 발송 API 사용 (처리량 증대)
 * - 자동 재시도 (최대 3회)
 * - 배송 상태 추적 지원
 */
export async function GET(req: Request) {
  // Cron 인증 — Vercel Cron Bearer token
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (!secret) {
    const msg = "CRON_SECRET 환경변수 미설정";
    logger.error("[CronScheduledSms] 인증 실패", { reason: msg });
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

  try {
    const now = new Date();
    const hour = now.getHours();
    const canProcessNightBlocked = hour >= 8; // 08:00 이후만 NIGHT_BLOCKED 처리 가능

    // 처리할 조직 목록 조회 (PENDING 또는 NIGHT_BLOCKED SMS가 있는 조직만)
    const organizationsWithSms = await prisma.scheduledSms.findMany({
      where: {
        status: canProcessNightBlocked ? { in: ["PENDING", "NIGHT_BLOCKED"] } : "PENDING",
        scheduledAt: { lte: now },
      },
      select: { organizationId: true },
      distinct: ["organizationId"],
      take: 10, // 한 번에 최대 10개 조직 처리
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

        logger.log("[CronScheduledSms] 조직 처리 완료", {
          organizationId: org.organizationId,
          ...result,
        });
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
  }
}
