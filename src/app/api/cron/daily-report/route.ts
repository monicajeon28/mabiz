export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (!secret) {
    logger.error("[CronDailyReport] 인증 실패", { reason: "CRON_SECRET 환경변수 미설정" });
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const expected = `Bearer ${secret}`;
  let authValid = false;
  try {
    authValid =
      auth.length === expected.length &&
      timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    authValid = false;
  }

  if (!authValid) {
    logger.warn("[CronDailyReport] 인증 실패", { ip: req.headers.get("x-forwarded-for") });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // 어제 날짜 범위 (UTC)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const reportDate = yesterdayStart;

  try {
    const orgs = await prisma.organization.findMany({
      select: { id: true },
    });

    let generated = 0;
    let failed = 0;

    for (const org of orgs) {
      try {
        const orgId = org.id;

        const [smsSentCount, payAgg, conversionCount] = await Promise.all([
          prisma.smsLog.count({
            where: {
              organizationId: orgId,
              createdAt: { gte: yesterdayStart, lt: todayStart },
              status: "SENT",
            },
          }),
          prisma.payAppPayment.aggregate({
            where: {
              organizationId: orgId,
              status: "paid",
              paidAt: { gte: yesterdayStart, lt: todayStart },
            },
            _sum: { amount: true },
          }),
          prisma.contact.count({
            where: {
              organizationId: orgId,
              createdAt: { gte: yesterdayStart, lt: todayStart },
            },
          }),
        ]);

        const revenue = BigInt(payAgg._sum.amount ?? 0);

        await prisma.dailyReport.upsert({
          where: {
            organizationId_reportDate: {
              organizationId: orgId,
              reportDate,
            },
          },
          create: {
            organizationId: orgId,
            reportDate,
            smsSent: smsSentCount,
            revenue,
            conversionCount,
            status: "COMPLETED",
          },
          update: {
            smsSent: smsSentCount,
            revenue,
            conversionCount,
            status: "COMPLETED",
          },
        });
        generated++;
      } catch (orgErr) {
        failed++;
        logger.warn("[CronDailyReport] 조직별 집계 실패", {
          orgId: org.id,
          error: orgErr instanceof Error ? orgErr.message : String(orgErr),
        });
      }
    }

    logger.info("[CronDailyReport] 완료", { reportDate: reportDate.toISOString(), generated, failed });
    return NextResponse.json({ ok: true, generated, failed });
  } catch (err) {
    logger.error("[CronDailyReport] 실패", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
