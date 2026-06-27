/**
 * GET /api/cron/email-funnel
 *
 * Day 0-3 이메일 퍼널 자동 발송 Cron
 * - 매일 오전 8시 실행
 * - ScheduledEmailMessage 테이블에서 PENDING 레코드를 읽어 발송
 * - resolveUserEmailConfig로 개인/그룹/조직 SMTP 계층적 조회
 * - 발송 성공: status=SENT | 실패: status=FAILED
 */

export const maxDuration = 60;

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { sendEmailWithConfig } from "@/lib/email";
import { resolveUserEmailConfig } from "@/lib/email-resolver";
import { logger } from "@/lib/logger";

const BATCH_SIZE = 100;

/** {{변수명}} 치환 */
function renderVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function GET(req: Request) {
  try {
    // Cron 보안: Authorization 헤더 검증
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      logger.error("[Cron/EmailFunnel] CRON_SECRET 환경변수 미설정");
      return NextResponse.json({ error: "CRON_SECRET 환경변수 미설정" }, { status: 503 });
    }
    const authHeader = req.headers.get("authorization") ?? "";
    const expectedBearer = `Bearer ${expectedToken}`;
    const isValid =
      authHeader.length === expectedBearer.length &&
      timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedBearer));
    if (!isValid) {
      logger.warn("[Cron/EmailFunnel] 미인증 요청", {
        ip: req.headers.get("x-forwarded-for"),
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // ── 1단계: 발송 대상 ScheduledEmailMessage 조회 ────────────────
    // NIGHT_BLOCKED: 야간 차단 후 오전 8시 재시도를 위해 포함
    const pendingMessages = await prisma.scheduledEmailMessage.findMany({
      where: {
        OR: [
          { status: { in: ["PENDING", "NIGHT_BLOCKED"] }, scheduledAt: { lte: now } },
          // 멈춘 SENDING 복구: 이전 cron이 잠금(→SENDING) 후 타임아웃/크래시로 발송·상태변경
          // 둘 다 못한 경우, 30분 경과분을 재시도(영구 미발송 방지). 잠금이 중복발송은 막음.
          { status: "SENDING", scheduledAt: { lte: new Date(now.getTime() - 30 * 60 * 1000) } },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      take: BATCH_SIZE,
    });

    if (pendingMessages.length === 0) {
      logger.log("[Cron/EmailFunnel] 발송할 이메일 없음", { now });
      return NextResponse.json({ ok: true, sentCount: 0, failedCount: 0 });
    }

    // Contact 이메일 일괄 조회
    const contactIds = Array.from(new Set(pendingMessages.map((m) => m.contactId)));
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, email: true, optOutAt: true },
    });
    const contactEmailMap = new Map(contacts.map((c) => [c.id, c.email ?? null]));
    // 발송 시점 수신거부 재검(스케줄 후 고객이 거부했을 수 있음 — 컴플라이언스)
    const contactOptOutMap = new Map(contacts.map((c) => [c.id, c.optOutAt != null]));

    let sentCount = 0;
    let failedCount = 0;

    // ── 2단계: 배치 발송 ────────────────────────────────────────────
    for (const msg of pendingMessages) {
      try {
        // 2-1. 야간 차단 (현재 KST 22시-08시 사이 → NIGHT_BLOCKED 상태로 다음날 08시로 연기)
        const kstNowHour = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
        if (kstNowHour >= 22 || kstNowHour < 8) {
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
          await prisma.scheduledEmailMessage.update({
            where: { id: msg.id },
            data: { status: "NIGHT_BLOCKED", scheduledAt: kstTomorrowHour8 },
          });
          logger.log("[Cron/EmailFunnel] 야간 차단", {
            msgId: msg.id,
            kstNowHour,
            nextTry: kstTomorrowHour8,
          });
          continue;
        }

        // 2-1b. 낙관적 잠금 — 동일 메시지 중복 발송 방지(cron 자기겹침/중복 인스턴스)
        const locked = await prisma.scheduledEmailMessage.updateMany({
          // SENDING 포함: 위에서 복구 대상으로 집어온 멈춘 SENDING도 재잠금 가능
          where: { id: msg.id, status: { in: ["PENDING", "NIGHT_BLOCKED", "SENDING"] } },
          data:  { status: "SENDING" },
        });
        if (locked.count === 0) continue; // 이미 다른 실행이 선점 → skip

        // 2-1c. 발송 시점 수신거부 재검 — 스케줄 후 거부한 고객 차단(컴플라이언스)
        if (contactOptOutMap.get(msg.contactId)) {
          logger.log("[Cron/EmailFunnel] 수신거부 고객 — 발송 차단", { msgId: msg.id, contactId: msg.contactId });
          await prisma.scheduledEmailMessage.update({
            where: { id: msg.id },
            data: { status: "CANCELLED", failureReason: "OPT_OUT" },
          });
          continue;
        }

        // 2-2. 수신자 이메일 확인
        const toEmail = contactEmailMap.get(msg.contactId) ?? null;
        if (!toEmail || !toEmail.includes("@")) {
          logger.warn("[Cron/EmailFunnel] 수신자 이메일 없음", { msgId: msg.id, contactId: msg.contactId });
          await updateMsgStatus(msg.id, "FAILED", "NO_RECIPIENT");
          failedCount++;
          continue;
        }

        // 2-3. SMTP 설정 조회 (개인 → 그룹 → 조직 → 환경변수 폴백)
        const emailConfig = await resolveUserEmailConfig(msg.organizationId, {
          userId: msg.senderUserId ?? undefined,
          groupId: msg.groupId ?? undefined,
        });
        if (!emailConfig) {
          logger.warn("[Cron/EmailFunnel] SMTP 설정 없음", { msgId: msg.id, organizationId: msg.organizationId });
          await updateMsgStatus(msg.id, "FAILED", "NO_SMTP_CONFIG");
          failedCount++;
          continue;
        }

        // 2-4. 변수 치환 + 발신자 오버라이드 추출
        const vars: Record<string, string> =
          msg.variables && typeof msg.variables === "object"
            ? (msg.variables as Record<string, string>)
            : {};
        const subject = renderVars(msg.subject, vars);
        const html = renderVars(msg.htmlContent, vars);

        // FunnelEmail에 발신자명/이메일이 설정돼 있으면 SMTP 기본값보다 우선 적용
        const resolvedConfig = {
          ...emailConfig,
          ...(vars._senderName  ? { senderName:  vars._senderName  } : {}),
          ...(vars._senderEmail ? { senderEmail: vars._senderEmail } : {}),
        };

        // 2-5. 발송
        const ok = await sendEmailWithConfig({
          config: resolvedConfig,
          to: toEmail,
          subject,
          html,
        });

        if (ok) {
          await updateMsgStatus(msg.id, "SENT");
          sentCount++;
          logger.log("[Cron/EmailFunnel] 발송 성공", {
            msgId: msg.id,
            contactId: msg.contactId,
            day: msg.day,
          });
        } else {
          await updateMsgStatus(msg.id, "FAILED", "SMTP_ERROR");
          failedCount++;
          logger.error("[Cron/EmailFunnel] 발송 실패", { msgId: msg.id });
        }
      } catch (err) {
        logger.error("[Cron/EmailFunnel] 메시지 처리 중 오류", { msgId: msg.id, err });
        await updateMsgStatus(
          msg.id,
          "FAILED",
          err instanceof Error ? err.message : "Unknown error"
        ).catch(() => {});
        failedCount++;
      }

      // Rate limiting: 0.3초 간격 (API 부하 방지)
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    logger.log("[Cron/EmailFunnel] 배치 완료", {
      processed: pendingMessages.length,
      sentCount,
      failedCount,
    });

    return NextResponse.json({
      ok: true,
      sentCount,
      failedCount,
      processedCount: pendingMessages.length,
    });
  } catch (err) {
    logger.error("[Cron/EmailFunnel] 치명적 오류", { err });
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}

/** ScheduledEmailMessage 상태 업데이트 헬퍼 */
async function updateMsgStatus(
  msgId: string,
  status: "SENT" | "FAILED" | "NIGHT_BLOCKED",
  reason?: string
) {
  return prisma.scheduledEmailMessage.update({
    where: { id: msgId },
    data: {
      status,
      failureReason: reason ?? null,
      sentAt: status === "SENT" ? new Date() : null,
    },
  });
}
