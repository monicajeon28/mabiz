export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { sendFunnelEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/scheduled-email
 * Vercel Cron (매 5분) — PENDING 상태 + scheduledAt <= now() 발송 처리
 * 패턴: scheduled-sms와 동일 (낙관적 잠금, 최대 50건/회)
 */
export async function GET(req: Request) {
  // Cron 인증 — Vercel Cron Bearer token
  const secret = process.env.CRON_SECRET;
  const auth   = req.headers.get("authorization") ?? "";

  if (!secret) {
    const msg = "CRON_SECRET 환경변수 미설정";
    logger.error("[CronScheduledEmail] 인증 실패", { reason: msg });
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const expected = `Bearer ${secret}`;
  let authValid = false;
  try {
    authValid = auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    authValid = false;
  }

  if (!authValid) {
    logger.warn("[CronScheduledEmail] 인증 실패", { ip: req.headers.get("x-forwarded-for") });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();

  // KST 시간 계산 (UTC+9)
  const kstNowHour = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
  const isNightTime = kstNowHour >= 22 || kstNowHour < 8;

  // 처리할 예약 목록 (최대 50건/회, 오래된 것부터)
  // NIGHT_BLOCKED: 야간 차단 후 오전 8시 재시도를 위해 포함
  const due = await prisma.scheduledEmail.findMany({
    where:   { status: { in: ["PENDING", "NIGHT_BLOCKED"] }, scheduledAt: { lte: now } },
    orderBy: { scheduledAt: "asc" },
    take:    50,
  });

  if (due.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  let errors    = 0;

  for (const item of due) {
    try {
      // 야간 차단 (KST 22시-08시 사이 → NIGHT_BLOCKED 상태로 다음날 08시로 연기)
      if (isNightTime) {
        const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const kstTomorrowHour8 = new Date(
          Date.UTC(
            kstNow.getUTCFullYear(),
            kstNow.getUTCMonth(),
            kstNow.getUTCDate() + 1,
            -1, // UTC 23:00 = KST 08:00
            0,
            0,
            0
          )
        );
        await prisma.scheduledEmail.updateMany({
          where: { id: item.id },
          data:  { status: "NIGHT_BLOCKED", scheduledAt: kstTomorrowHour8 },
        });
        logger.log("[Cron/ScheduledEmail] 야간 차단", {
          id: item.id,
          kstNowHour,
          nextTry: kstTomorrowHour8,
        });
        continue;
      }

      // 낙관적 잠금 — 다른 Cron 인스턴스 중복 처리 방지
      const locked = await prisma.scheduledEmail.updateMany({
        where: { id: item.id, status: { in: ["PENDING", "NIGHT_BLOCKED"] } },
        data:  { status: "SENDING" },
      });
      if (locked.count === 0) continue;

      // 수신자 목록 조회
      const recipients: { id: string; name: string; email: string | null }[] = [];

      if (item.contactId) {
        const c = await prisma.contact.findFirst({
          where:  { id: item.contactId, organizationId: item.organizationId, deletedAt: null },
          select: { id: true, name: true, email: true },
        });
        if (c) recipients.push(c);
      } else if (item.groupId) {
        const members = await prisma.contactGroupMember.findMany({
          where: {
            groupId: item.groupId,
            contact: { organizationId: item.organizationId, deletedAt: null },
          },
          include: { contact: { select: { id: true, name: true, email: true } } },
          take: 200,
        });
        recipients.push(...members.map((m) => m.contact));
      }

      let sentCount   = 0;
      let failedCount = 0;

      for (const r of recipients) {
        if (!r.email) { failedCount++; continue; }

        // 개인화 치환
        const personalHtml = item.content
          .replace(/\[고객명\]/g, r.name)
          .replace(/\[이름\]/g,   r.name);
        const personalSubject = item.subject
          .replace(/\[고객명\]/g, r.name)
          .replace(/\[이름\]/g,   r.name);

        const result = await sendFunnelEmail({
          organizationId: item.organizationId,
          contactId:      r.id,
          to:             r.email,
          subject:        personalSubject,
          html:           personalHtml,
          channel:        "MANUAL",
        });

        if (result.result_code === 1) { sentCount++; } else { failedCount++; }
      }

      await prisma.scheduledEmail.update({
        where: { id: item.id },
        data: {
          status:      "SENT",
          sentAt:      new Date(),
          sentCount,
          failedCount,
        },
      });

      logger.log("[Cron/ScheduledEmail] 처리 완료", { id: item.id, sentCount, failedCount });
      processed++;
    } catch (err) {
      logger.error("[Cron/ScheduledEmail] 처리 실패", { id: item.id, err });
      await prisma.scheduledEmail.update({
        where: { id: item.id },
        data:  { status: "FAILED", failureReason: err instanceof Error ? err.message : "Unknown" },
      }).catch(() => null);
      errors++;
    }
  }

  return NextResponse.json({ ok: true, processed, errors });
}
