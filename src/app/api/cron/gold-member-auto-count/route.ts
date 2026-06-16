export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Vercel Cron: 매일 자정(UTC 00:00 = 한국 09:00) 실행
// vercel.json: { "path": "/api/cron/gold-member-auto-count", "schedule": "0 0 * * *" }

const MAX_DURATION_MS = 50_000;

/** 해당 년/월의 마지막 날 반환 (JS Date 롤오버 방지용) */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** 30일 달에 31일 납부일이면 → 30일로 클램핑 */
function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, lastDayOfMonth(year, month));
}

/**
 * startDate부터 today까지 paymentDay가 몇 번 지났는지 계산.
 * paymentDay가 해당 달 최대일을 초과하면 마지막 날로 클램핑.
 *
 * - startDate 당일 <= paymentDay: 그 달 paymentDay부터 카운트
 * - startDate 당일  > paymentDay: 다음 달 paymentDay부터 카운트
 */
function calcExpectedPayments(startDate: Date, paymentDay: number, today: Date): number {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let firstYear = start.getFullYear();
  let firstMonth = start.getMonth();
  if (start.getDate() > paymentDay) {
    firstMonth += 1;
    if (firstMonth > 11) { firstMonth = 0; firstYear += 1; }
  }
  // 클램핑: 2월에 31일 → 2월 28/29일로 처리
  const firstDay = clampDay(firstYear, firstMonth, paymentDay);
  const firstPayment = new Date(firstYear, firstMonth, firstDay);
  if (firstPayment > todayNorm) return 0;

  let lastYear = todayNorm.getFullYear();
  let lastMonth = todayNorm.getMonth();
  const thisMonthDay = clampDay(lastYear, lastMonth, paymentDay);
  if (todayNorm.getDate() < thisMonthDay) {
    lastMonth -= 1;
    if (lastMonth < 0) { lastMonth = 11; lastYear -= 1; }
  }
  const lastDay = clampDay(lastYear, lastMonth, paymentDay);
  const lastPayment = new Date(lastYear, lastMonth, lastDay);
  if (lastPayment < firstPayment) return 0;

  return (lastYear - firstYear) * 12 + (lastMonth - firstMonth) + 1;
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET 환경변수 미설정" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const startTime = Date.now();
  const today = new Date();
  logger.log("[Cron/gold-member-auto-count] 시작", { time: today.toISOString() });

  const members = await prisma.goldMember.findMany({
    where: { status: "ACTIVE", paymentDay: { not: null } },
    select: {
      id: true,
      paymentDay: true,
      paidCount: true,
      totalPayments: true,
      maxPaymentCount: true,
      startDate: true,
      joinDate: true,
    },
  });

  // 타임아웃 조기 체크
  if (Date.now() - startTime > MAX_DURATION_MS) {
    logger.log("[Cron/gold-member-auto-count] 조기 종료 (쿼리 시간 초과)", { total: members.length });
    return NextResponse.json({ ok: false, error: "시간 초과" }, { status: 504 });
  }

  // 갱신 대상만 추려 일괄 트랜잭션 — N+1 방지
  const toUpdate: { id: string; newCount: number }[] = [];
  let skippedCount = 0;
  let errorCount = 0;

  for (const m of members) {
    try {
      const baseDate = m.startDate ?? m.joinDate;
      const expected = calcExpectedPayments(baseDate, m.paymentDay!, today);

      // 상한: maxPaymentCount > 0 → 그 값 우선, 아니면 totalPayments > 0 → 그 값
      const limit = (m.maxPaymentCount ?? 0) > 0
        ? m.maxPaymentCount!
        : m.totalPayments > 0 ? m.totalPayments : Infinity;
      const capped = Math.min(expected, isFinite(limit) ? limit : expected);

      if (capped > m.paidCount) {
        toUpdate.push({ id: m.id, newCount: capped });
      } else {
        skippedCount++;
      }
    } catch (err) {
      errorCount++;
      logger.error("[Cron/gold-member-auto-count] 계산 오류", { id: m.id, err });
    }
  }

  let updatedCount = 0;
  if (toUpdate.length > 0) {
    try {
      await prisma.$transaction(
        toUpdate.map(u =>
          prisma.goldMember.update({ where: { id: u.id }, data: { paidCount: u.newCount } })
        )
      );
      updatedCount = toUpdate.length;
      logger.log("[Cron/gold-member-auto-count] 일괄 업데이트", {
        ids: toUpdate.map(u => u.id),
        counts: toUpdate.map(u => u.newCount),
      });
    } catch (err) {
      logger.error("[Cron/gold-member-auto-count] 트랜잭션 실패", { err });
      return NextResponse.json({ ok: false, error: "DB 업데이트 실패" }, { status: 500 });
    }
  }

  const elapsed = Date.now() - startTime;
  logger.log("[Cron/gold-member-auto-count] 완료", {
    updatedCount, skippedCount, errorCount, total: members.length, elapsedMs: elapsed,
  });
  return NextResponse.json({ ok: true, updatedCount, skippedCount, errorCount, total: members.length, elapsedMs: elapsed });
}
