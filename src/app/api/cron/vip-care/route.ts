import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendSms, getOrgSmsConfig } from "@/lib/aligo";

// Vercel Cron: 매시간 실행
// vercel.json: { "crons": [{ "path": "/api/cron/vip-care", "schedule": "0 * * * *" }] }

export async function GET(req: Request) {
  // Cron 보안 검증
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now   = new Date();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  logger.log("[Cron/vip-care] 시작", { time: now.toISOString() });

  // 활성 VIP 케어 시퀀스 전체 조회
  const sequences = await prisma.vipCareSequence.findMany({
    where: { status: "ACTIVE" },
    include: {
      contact: {
        select: {
          id: true, name: true, phone: true,
          optOutAt: true, organizationId: true,
        },
      },
    },
  });

  let sentCount    = 0;
  let skippedCount = 0;

  for (const seq of sequences) {
    const { contact } = seq;

    // 수신거부 체크
    if (contact.optOutAt) {
      skippedCount++;
      continue;
    }

    // 해당 조직의 SMS 설정 조회
    const smsConfig = await getOrgSmsConfig(contact.organizationId);
    if (!smsConfig?.isActive) {
      skippedCount++;
      continue;
    }

    // 오늘 발송해야 할 VipCareLog 조회 (PENDING 상태)
    const todayLogs = await prisma.vipCareLog.findMany({
      where: {
        sequenceId: seq.id,
        status: "PENDING",
        scheduledAt: { gte: today, lt: new Date(today.getTime() + 86400000) },
      },
    });

    for (const log of todayLogs) {
      if (!log.content) {
        skippedCount++;
        continue;
      }

      // 개인화 변수 치환
      const message = log.content
        .replace(/\[고객명\]/g, contact.name)
        .replace(/\[이름\]/g, contact.name);

      // 발송 전 SENDING으로 원자적 업데이트 (중복 방지)
      const updated = await prisma.vipCareLog.updateMany({
        where: { id: log.id, status: "PENDING" },
        data: { status: "SENDING" },
      });

      if (updated.count === 0) continue; // 이미 다른 프로세스가 처리 중

      const result = await sendSms({
        config: {
          key:    smsConfig.aligoKey,
          userId: smsConfig.aligoUserId,
          sender: smsConfig.senderPhone,
        },
        receiver: contact.phone,
        msg:      message,
        msgType:  message.length > 90 ? "LMS" : "SMS",
      });

      const finalStatus =
        result.result_code === 1   ? "SENT" :
        result.result_code === -98 ? "NIGHT_BLOCKED" :
        result.result_code === -99 ? "OPTED_OUT" : "FAILED";

      await prisma.vipCareLog.update({
        where: { id: log.id },
        data:  { status: finalStatus, sentAt: new Date() },
      });

      if (finalStatus === "SENT") sentCount++;
      else skippedCount++;
    }
  }

  // SmsLog 90일 초과 레코드 자동 삭제 (DB 용량 관리)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
  const { count: deletedLogs } = await prisma.smsLog.deleteMany({
    where: { sentAt: { lt: ninetyDaysAgo } },
  }).catch(() => ({ count: 0 }));

  logger.log("[Cron/vip-care] 완료", { sentCount, skippedCount, deletedLogs });
  return NextResponse.json({ ok: true, sentCount, skippedCount, deletedLogs });
}
