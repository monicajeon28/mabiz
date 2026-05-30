export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";

// 구현 예정 cron — 현재 no-op 스텁
export async function GET(req: Request) {
  // Cron 인증 — Vercel Cron Bearer token
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (!secret) {
    logger.error("[CronDailyReport] 인증 실패", { reason: "CRON_SECRET 환경변수 미설정" });
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
    logger.warn("[CronDailyReport] 인증 실패", { ip: req.headers.get("x-forwarded-for") });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  logger.log(`[cron] daily-report stub called`);
  return new NextResponse(null, { status: 204 });
}
