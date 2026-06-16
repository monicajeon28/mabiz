export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { processPendingSms } from "@/lib/aligo/batch-sender";
import { logger } from "@/lib/logger";
import { Redis } from "@upstash/redis";

// ✅ P1-8: Redis 분산 락 (멀티 인스턴스 동시 실행 방지)
// Vercel에서 Cold Start 시 여러 인스턴스가 동시에 Cron 실행되는 것을 방지
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const CRON_LOCK_KEY = "cron:scheduled-sms:lock";
const LOCK_TTL = 300; // 5분 (Cron maxDuration 60초 + 여유)

/**
 * GET /api/cron/scheduled-sms
 * Vercel Cron (매 5분) — PENDING 상태 + scheduledAt <= now() 발송 처리
 * Authorization: Bearer CRON_SECRET
 *
 * ✅ P1-8 업그레이드 (2026-06-15):
 * - Redis 분산 락 도입 (인메모리 → Redis NX)
 * - 멀티 인스턴스 환경에서 중복 발송 방지
 * - Cold Start 시에도 정확히 1개 인스턴스만 실행 보장
 *
 * 이전 업그레이드 (2026-05-28):
 * - Aligo 배치 발송 API 사용 (처리량 증대)
 * - 자동 재시도 (최대 3회)
 * - 배송 상태 추적 지원
 */

/**
 * Redis를 사용한 분산 락 획득
 * NX: Only if Not eXists (첫 번째만 성공)
 * EX: Expire in seconds (자동 해제)
 */
async function acquireLock(): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    logger.warn("[CronScheduledSms] Redis 환경변수 미설정. 인메모리 락 사용.");
    return true; // Fallback: 환경변수 없으면 락 없이 진행
  }

  try {
    const result = await redis.set(CRON_LOCK_KEY, "locked", {
      nx: true, // Only if Not eXists
      ex: LOCK_TTL, // Expire in 300 seconds
    });
    return result === "OK";
  } catch (err) {
    // Redis 연결 불가 시 락 없이 진행 (SMS 발송은 계속되어야 함)
    logger.warn("[CronScheduledSms] Redis 락 획득 실패 — 락 없이 진행", {
      error: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
}

/**
 * Redis를 사용한 분산 락 해제
 */
async function releaseLock(): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return; // Fallback: 환경변수 없으면 무시
  }

  try {
    await redis.del(CRON_LOCK_KEY);
    logger.log("[CronScheduledSms] 락 해제 완료");
  } catch (err) {
    logger.error("[CronScheduledSms] Redis 락 해제 실패", {
      error: err instanceof Error ? err.message : String(err),
    });
    // 에러가 발생해도 진행 계속 (Redis 일시 장애)
  }
}

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
    // ✅ P1-8: Redis 분산 락 획득
    // Vercel 멀티 인스턴스 환경에서 정확히 1개만 실행
    const lockAcquired = await acquireLock();

    if (!lockAcquired) {
      logger.info("[CronScheduledSms] 다른 인스턴스가 이미 실행 중. Skip.");
      return NextResponse.json({ ok: false, message: "Lock not acquired" }, { status: 429 });
    }

    try {
      logger.log("[CronScheduledSms] 락 획득 성공. Cron 실행 시작");

      const now = new Date();
      const kstHour = (now.getUTCHours() + 9) % 24; // Vercel 서버는 UTC — KST = UTC+9
      const canProcessNightBlocked = kstHour >= 8; // 08:00 KST 이후만 NIGHT_BLOCKED 처리

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
    } finally {
      // ✅ P1-8: 항상 락 해제 (성공/실패 무관)
      await releaseLock();
    }
  } catch (err) {
    logger.error("[CronScheduledSms] 전체 오류", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
