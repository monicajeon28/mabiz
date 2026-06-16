export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Vercel Cron: 매일 자정 실행 — 납부일이 지난 골드회원 paidCount 자동 증가
// vercel.json: { "path": "/api/cron/gold-member-auto-count", "schedule": "0 0 * * *" }

/**
 * startDate부터 today까지 paymentDay가 몇 번 지났는지 계산.
 * - startDate 당일 날짜 <= paymentDay: 그 달 paymentDay부터 카운트
 * - startDate 당일 날짜  > paymentDay: 다음 달 paymentDay부터 카운트
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
  const firstPayment = new Date(firstYear, firstMonth, paymentDay);
  if (firstPayment > todayNorm) return 0;

  let lastYear = todayNorm.getFullYear();
  let lastMonth = todayNorm.getMonth();
  if (todayNorm.getDate() < paymentDay) {
    lastMonth -= 1;
    if (lastMonth < 0) { lastMonth = 11; lastYear -= 1; }
  }
  const lastPayment = new Date(lastYear, lastMonth, paymentDay);
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

  const today = new Date();
  logger.log("[Cron/gold-member-auto-count] 시작", { time: today.toISOString() });

  let updatedCount = 0;
  let skippedCount = 0;

  const members = await prisma.goldMember.findMany({
    where: { status: "ACTIVE", paymentDay: { not: null } },
    select: {
      id: true,
      paymentDay: true,
      paidCount: true,
      totalPayments: true,
      startDate: true,
      joinDate: true,
    },
  });

  for (const m of members) {
    const baseDate = m.startDate ?? m.joinDate;
    const expected = calcExpectedPayments(baseDate, m.paymentDay!, today);
    const capped = m.totalPayments > 0 ? Math.min(expected, m.totalPayments) : expected;

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
  }

  logger.log("[Cron/gold-member-auto-count] 완료", { updatedCount, skippedCount, total: members.length });
  return NextResponse.json({ ok: true, updatedCount, skippedCount, total: members.length });
}
