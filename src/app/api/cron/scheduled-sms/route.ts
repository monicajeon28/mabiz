export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendSms, getOrgSmsConfig } from "@/lib/aligo";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/scheduled-sms
 * Vercel Cron (매 5분) — PENDING 상태 + scheduledAt <= now() 발송 처리
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(req: Request) {
  // Cron 인증
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      logger.warn("[CronScheduledSms] CRON_SECRET 환경변수 미설정 — 프로덕션에서 차단");
      return NextResponse.json({ ok: false, message: "CRON_SECRET required" }, { status: 500 });
    }
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  } else {
    // 개발 환경: secret 있으면 검증, 없으면 통과
    if (secret && auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const now = new Date();

  // 처리할 예약 목록 (최대 50건/회)
  const due = await prisma.scheduledSms.findMany({
    where: {
      status:      "PENDING",
      scheduledAt: { lte: now },
    },
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
      // 낙관적 잠금 — PENDING → SENDING (다른 인스턴스 중복 처리 방지)
      const locked = await prisma.scheduledSms.updateMany({
        where: { id: item.id, status: "PENDING" },
        data:  { status: "SENDING" },
      });
      if (locked.count === 0) continue; // 이미 다른 인스턴스가 처리 중

      const smsConfig = await getOrgSmsConfig(item.organizationId);
      if (!smsConfig) {
        await prisma.scheduledSms.update({
          where: { id: item.id },
          data:  { status: "FAILED" },
        });
        errors++;
        continue;
      }

      const config = {
        key:    smsConfig.aligoKey,
        userId: smsConfig.aligoUserId,
        sender: smsConfig.senderPhone,
      };

      // 수신자 목록 조회
      const recipients: { id: string; name: string; phone: string }[] = [];

      if (item.contactId) {
        const c = await prisma.contact.findFirst({
          where: { id: item.contactId, organizationId: item.organizationId, optOutAt: null },
          select: { id: true, name: true, phone: true },
        });
        if (c) recipients.push(c);
      } else if (item.groupId) {
        const members = await prisma.contactGroupMember.findMany({
          where: {
            groupId: item.groupId,
            contact: { organizationId: item.organizationId, optOutAt: null, phone: { not: "" } },
          },
          include: { contact: { select: { id: true, name: true, phone: true } } },
          take: 200,
        });
        recipients.push(...members.map((m) => m.contact));
      }

      let sentCount   = 0;
      let failedCount = 0;

      for (const r of recipients) {
        const msg = item.message
          .replace(/\[고객명\]/g, r.name)
          .replace(/\[이름\]/g,   r.name);

        const result = await sendSms({
          config,
          receiver:       r.phone,
          msg,
          organizationId: item.organizationId,
          contactId:      r.id,
          channel:        "MANUAL",
        });

        if (Number(result.result_code) === 1) sentCount++;
        else failedCount++;
      }

      await prisma.scheduledSms.update({
        where: { id: item.id },
        data: {
          status:     "SENT",
          sentAt:     new Date(),
          sentCount,
          failedCount,
        },
      });

      logger.log("[Cron/ScheduledSms] 처리 완료", {
        id: item.id, sentCount, failedCount,
      });
      processed++;
    } catch (err) {
      logger.error("[Cron/ScheduledSms] 처리 실패", { id: item.id, err });
      await prisma.scheduledSms.update({
        where: { id: item.id },
        data:  { status: "FAILED" },
      }).catch((e) => logger.log('[CronSMS] FAILED 상태 업데이트 실패', { error: e instanceof Error ? e.message : String(e) }));
      errors++;
    }
  }

  return NextResponse.json({ ok: true, processed, errors });
}
