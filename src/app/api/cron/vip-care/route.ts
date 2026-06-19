export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendByChannel, resolveUserSmsConfig } from "@/lib/aligo";

// Vercel Cron: 매시간 실행
// vercel.json: { "crons": [{ "path": "/api/cron/vip-care", "schedule": "0 * * * *" }] }

// 배치 크기: 한 번에 처리할 VipCareLog 수
// Vercel Pro cron 최대 300s → 100건 × 평균 2s = 200s 이내
const BATCH_SIZE = 100;
const MAX_DURATION_MS = 250_000; // 250s (Vercel 타임아웃 전 안전 종료)

export async function GET(req: Request) {
  // Cron 보안 검증 — CRON_SECRET 미설정 시 fail-closed (500)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET 환경변수 미설정" }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const startTime = Date.now();
  const now   = new Date();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86_400_000);

  logger.log("[Cron/vip-care] 시작", { time: now.toISOString() });

  let sentCount      = 0;
  let skippedCount   = 0;
  let processedTotal = 0;
  let earlyExit      = false;

  // 조직별 SMS 설정 캐시 (같은 조직 반복 조회 방지)
  const smsConfigCache: Record<string, Awaited<ReturnType<typeof resolveUserSmsConfig>>> = {};

  // ─── 핵심 변경: 시퀀스 루프 제거 ──────────────────────────────────
  // 오늘 발송해야 할 VipCareLog를 직접 JOIN 쿼리로 한 번에 조회.
  // 처리된 레코드는 SENDING/SENT/FAILED로 status가 바뀌므로
  // 다음 배치 조회 시 자연스럽게 제외됨 → cursor 불필요.
  // ─────────────────────────────────────────────────────────────────
  while (true) {
    // 시간 초과 시 조기 종료 (다음 cron 실행에서 이어서 처리)
    if (Date.now() - startTime > MAX_DURATION_MS) {
      earlyExit = true;
      logger.log("[Cron/vip-care] 시간 초과로 조기 종료, 다음 실행에서 이어서 처리", {
        processedTotal,
      });
      break;
    }

    // 오늘 발송 대상 로그를 한 번의 쿼리로 조회 (Prisma가 내부적으로 JOIN 생성)
    // 처리 후 status 변경되므로 항상 첫 페이지부터 조회해도 중복 없음
    const logs = await prisma.vipCareLog.findMany({
      take: BATCH_SIZE,
      where: {
        status: { in: ["PENDING", "NIGHT_BLOCKED"] },
        scheduledAt: { gte: today, lt: tomorrow },
        sequence: {
          status: "ACTIVE",
          contact: { optOutAt: null },
        },
      },
      include: {
        sequence: {
          include: {
            contact: {
              select: {
                id: true, name: true, phone: true,
                email: true, organizationId: true,
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    if (logs.length === 0) break;

    processedTotal += logs.length;

    logger.log(`[Cron/vip-care] 배치 처리 중 ${processedTotal}건`, {
      batchSize: logs.length,
    });

    let acquiredCount = 0;

    for (const log of logs) {
      const contact = log.sequence.contact;

      // 조직 SMS 설정 캐시 조회
      if (!Object.prototype.hasOwnProperty.call(smsConfigCache, contact.organizationId)) {
        smsConfigCache[contact.organizationId] = await resolveUserSmsConfig(contact.organizationId);
      }
      const smsConfig = smsConfigCache[contact.organizationId];
      if (!smsConfig) {
        skippedCount++;
        continue;
      }

      if (!log.content) {
        skippedCount++;
        continue;
      }

      // 개인화 변수 치환
      const message = log.content
        .replace(/\[고객명\]/g, contact.name)
        .replace(/\[이름\]/g, contact.name);

      // CAS: 중복 발송 방지 — PENDING/NIGHT_BLOCKED → SENDING 원자적 업데이트
      const updated = await prisma.vipCareLog.updateMany({
        where: { id: log.id, status: { in: ["PENDING", "NIGHT_BLOCKED"] } },
        data: { status: "SENDING" },
      });
      if (updated.count === 0) continue; // 다른 프로세스가 먼저 처리 중
      acquiredCount++;

      const ch = (log.channel || "SMS") as "SMS" | "EMAIL" | "KAKAO";

      try {
        const result = await sendByChannel({
          channel:  ch,
          smsConfig: {
            key:    smsConfig.key,
            userId: smsConfig.userId,
            sender: smsConfig.sender,
          },
          receiver:       contact.phone,
          email:          contact.email,
          msg:            message,
          organizationId: contact.organizationId,
          contactId:      contact.id,
        });

        const code = Number(result.result_code);
        const finalStatus =
          code === 1   ? "SENT"          :
          code === -98 ? "NIGHT_BLOCKED" :
          code === -99 ? "OPTED_OUT"     : "FAILED";

        await prisma.vipCareLog.update({
          where: { id: log.id },
          data:  { status: finalStatus, sentAt: new Date() },
        });

        if (finalStatus === "SENT") sentCount++;
        else skippedCount++;
      } catch (sendErr) {
        // 발송 중 예외 발생 시 SENDING → PENDING 원복 (다음 cron에서 재처리 가능)
        logger.error("[Cron/vip-care] 발송 실패, PENDING 원복", {
          logId: log.id, contactId: contact.id, error: sendErr,
        });
        await prisma.vipCareLog.update({
          where: { id: log.id },
          data:  { status: "PENDING" },
        }).catch((rollbackErr: unknown) => {
          logger.error("[Cron/vip-care] SENDING→PENDING 롤백 실패 — 레코드 고착됨", { logId: log.id, error: rollbackErr });
        });
        skippedCount++;
      }
    }

    // 이번 배치에서 아무 레코드도 선점하지 못하면 같은 100건을 반복 조회하지 않도록 종료.
    if (acquiredCount === 0) {
      logger.warn("[Cron/vip-care] 처리 가능한 레코드가 없어 조기 종료", { processedTotal });
      break;
    }

    // 마지막 배치이면 루프 종료
    if (logs.length < BATCH_SIZE) break;
  }

  // ─── 시퀀스 자동완료 ─────────────────────────────────────────────
  // 모든 로그가 종료 상태(SENT/OPTED_OUT/CANCELLED/FAILED)이면 COMPLETED 처리
  // (미완료 상태: PENDING/SENDING/NIGHT_BLOCKED/PAUSED/FAILED 가 없어야 함)
  // ─────────────────────────────────────────────────────────────────
  const completedSeqs = await prisma.$queryRaw<{ id: string }[]>`
    SELECT s.id
    FROM "VipCareSequence" s
    WHERE s.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM "VipCareLog" l
        WHERE l."sequenceId" = s.id
          AND l.status IN ('PENDING', 'SENDING', 'NIGHT_BLOCKED', 'PAUSED', 'FAILED')
      )
      AND EXISTS (
        SELECT 1 FROM "VipCareLog" l2 WHERE l2."sequenceId" = s.id
      )
  `;

  let completedCount = 0;
  if (completedSeqs.length > 0) {
    const result = await prisma.vipCareSequence.updateMany({
      where: { id: { in: completedSeqs.map(s => s.id) } },
      data: { status: "COMPLETED" },
    });
    completedCount = result.count;
  }

  // SmsLog 90일 초과 레코드 자동 삭제 (DB 용량 관리)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
  const { count: deletedLogs } = await prisma.smsLog.deleteMany({
    where: { sentAt: { lt: ninetyDaysAgo } },
  }).catch((err: unknown) => {
    logger.error("[Cron/vip-care] SmsLog 삭제 실패", { error: err });
    return { count: 0 };
  });

  const durationMs = Date.now() - startTime;
  logger.log("[Cron/vip-care] 완료", {
    sentCount, skippedCount, completedCount, deletedLogs,
    processedTotal, durationMs, earlyExit,
  });

  return NextResponse.json({
    ok: true,
    sentCount, skippedCount, completedCount, deletedLogs,
    processedTotal, durationMs, earlyExit,
  });
}
