export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs"; // P0-1: timingSafeEqual은 Edge에서 사용 불가

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto"; // P0-1: 타이밍 공격 방지
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

  // P0-1: 타이밍 공격 방지 — timingSafeEqual 사용
  const incoming = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  const isValid =
    incoming.length === expected.length &&
    timingSafeEqual(Buffer.from(incoming, "utf8"), Buffer.from(expected, "utf8"));
  if (!isValid) return NextResponse.json({ ok: false }, { status: 401 });

  const startTime = Date.now();
  const today = new Date();
  logger.info("[Cron/gold-member-auto-count] 시작", { time: today.toISOString() }); // P2-3

  try {
    const members = await prisma.goldMember.findMany({
      where: { status: "ACTIVE", paymentDay: { not: null }, deletedAt: null },
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
      logger.info("[Cron/gold-member-auto-count] 조기 종료 (쿼리 시간 초과)", { total: members.length }); // P2-3
      return NextResponse.json({ ok: false, error: "시간 초과" }, { status: 504 });
    }

    // 갱신 대상만 추려 개별 update — 한 명 실패해도 나머지 계속 처리
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const m of members) {
      // P0-3: 루프 내 타임아웃 체크
      if (Date.now() - startTime > MAX_DURATION_MS) {
        logger.warn("[Cron/gold-member-auto-count] 루프 중 조기 종료", { processed: updatedCount + skippedCount + errorCount });
        break;
      }

      try {
        // P0-2: baseDate null 가드
        const baseDate = m.startDate ?? m.joinDate;
        if (!baseDate) {
          logger.warn("[Cron/gold-member-auto-count] baseDate 없음, 스킵", { id: m.id });
          skippedCount++;
          continue;
        }

        // P2-2: paymentDay 범위 검증
        if (m.paymentDay! < 1 || m.paymentDay! > 31) {
          logger.warn("[Cron/gold-member-auto-count] paymentDay 범위 오류, 스킵", { id: m.id, paymentDay: m.paymentDay });
          skippedCount++;
          continue;
        }

        const expectedPayments = calcExpectedPayments(baseDate, m.paymentDay!, today);

        // 상한: maxPaymentCount > 0 → 그 값 우선, 아니면 totalPayments > 0 → 그 값, 없으면 상한 없음
        const limit = (m.maxPaymentCount != null && m.maxPaymentCount > 0)
          ? m.maxPaymentCount
          : m.totalPayments > 0 ? m.totalPayments : null;
        const capped = limit != null ? Math.min(expectedPayments, limit) : expectedPayments;

        if (capped > m.paidCount) {
          await prisma.goldMember.update({
            where: { id: m.id },
            data: { paidCount: capped },
          });
          updatedCount++;
          logger.info("[Cron/gold-member-auto-count] 업데이트", { id: m.id, from: m.paidCount, to: capped }); // P2-3
        } else if (capped < m.paidCount) {
          // P1-2: 역방향 감지 — warn 로그 후 skip
          logger.warn("[Cron/gold-member-auto-count] paidCount 역방향 감지, 스킵", { id: m.id, paidCount: m.paidCount, capped });
          skippedCount++;
        } else {
          // capped === m.paidCount: 변경 없음, 조용히 skip
          skippedCount++;
        }
      } catch (memberErr) {
        errorCount++;
        logger.error("[Cron/gold-member-auto-count] 회원 처리 실패", { id: m.id, err: memberErr });
        // 한 명 실패해도 다음 회원 계속 처리
      }
    }

    const elapsed = Date.now() - startTime;
    logger.info("[Cron/gold-member-auto-count] 완료", { // P2-3
      updatedCount, skippedCount, errorCount, total: members.length, elapsedMs: elapsed,
    });
    return NextResponse.json({ ok: true, updatedCount, skippedCount, errorCount, total: members.length, elapsedMs: elapsed });

  } catch (err) {
    logger.error("[Cron/gold-member-auto-count] 치명적 오류", { err });
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}
