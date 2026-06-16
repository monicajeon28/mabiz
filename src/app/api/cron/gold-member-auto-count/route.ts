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

  try {
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

    // 갱신 대상만 추려 개별 update — 한 명 실패해도 나머지 계속 처리
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const m of members) {
      try {
        const baseDate = m.startDate ?? m.joinDate;
        const expected = calcExpectedPayments(baseDate, m.paymentDay!, today);

        // 상한: maxPaymentCount > 0 → 그 값 우선, 아니면 totalPayments > 0 → 그 값, 없으면 상한 없음
        const limit = (m.maxPaymentCount != null && m.maxPaymentCount > 0)
          ? m.maxPaymentCount
          : m.totalPayments > 0 ? m.totalPayments : null;
        const capped = limit != null ? Math.min(expected, limit) : expected;

        if (capped > m.paidCount) {
          await prisma.goldMember.update({
            where: { id: m.id },
            data: { paidCount: capped },
          });
          updatedCount++;
          logger.log("[Cron/gold-member-auto-count] 업데이트", { id: m.id, from: m.paidCount, to: capped });
        } else {
          skippedCount++;
        }
      } catch (memberErr) {
        errorCount++;
        logger.error("[Cron/gold-member-auto-count] 회원 처리 실패", { id: m.id, err: memberErr });
        // 한 명 실패해도 다음 회원 계속 처리
      }
    }

    const elapsed = Date.now() - startTime;
    logger.log("[Cron/gold-member-auto-count] 완료", {
      updatedCount, skippedCount, errorCount, total: members.length, elapsedMs: elapsed,
    });
    return NextResponse.json({ ok: true, updatedCount, skippedCount, errorCount, total: members.length, elapsedMs: elapsed });

  } catch (err) {
    logger.error("[Cron/gold-member-auto-count] 치명적 오류", { err });
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}
