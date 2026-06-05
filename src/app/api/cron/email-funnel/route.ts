/**
 * GET /api/cron/email-funnel
 *
 * Day 0-3 이메일 퍼널 자동 발송 Cron
 * - 매일 오전 8시 실행
 * - 예약 시간이 경과한 이메일을 자동 발송
 * - 최대 100개씩 배치 처리
 * - 실패한 이메일은 자동 재시도 (최대 3회)
 */

export const maxDuration = 60; // 배치 100건 × 0.5초 sleep = 최대 50초, Vercel 기본 10초 초과 방지

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { sendFunnelEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

export async function GET(req: Request) {
  try {
    // Cron 보안: Authorization 헤더 검증 — CRON_SECRET 미설정 시 fail-closed (500)
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken) {
      logger.error("[Cron] CRON_SECRET 환경변수 미설정");
      return NextResponse.json({ error: "CRON_SECRET 환경변수 미설정" }, { status: 500 });
    }
    const authHeader = req.headers.get("authorization") ?? '';
    const expectedBearer = `Bearer ${expectedToken}`;
    const isValid = authHeader.length === expectedBearer.length &&
      timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedBearer));
    if (!isValid) {
      logger.warn("[Cron] 미인증 요청", { ip: req.headers.get("x-forwarded-for") });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // ── 1단계: 발송 대상 이메일 조회 ────────────────────────────
    const pendingEmails = await prisma.scheduledEmail.findMany({
      where: {
        status: { in: ["PENDING", "NIGHT_BLOCKED"] },
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: "asc" },
      take: BATCH_SIZE,
    });

    // Contact 이메일 일괄 조회 (ScheduledEmail에 relation 없음)
    const contactIds = pendingEmails
      .map(e => e.contactId)
      .filter((id): id is string => id !== null);
    const contacts = contactIds.length > 0
      ? await prisma.contact.findMany({
          where: { id: { in: contactIds } },
          select: { id: true, email: true },
        })
      : [];
    const contactEmailMap = new Map(contacts.map(c => [c.id, c.email ?? null]));

    if (pendingEmails.length === 0) {
      logger.log("[Cron] 발송할 이메일 없음", { now });
      return NextResponse.json({ ok: true, sentCount: 0, failedCount: 0 });
    }

    let sentCount = 0;
    let failedCount = 0;

    // ── 2단계: 배치 발송 ────────────────────────────
    for (const email of pendingEmails) {
      try {
        const toEmail = email.contactId ? contactEmailMap.get(email.contactId) : null;
        if (!toEmail) {
          logger.warn("[Email] 수신자 이메일 없음", { emailId: email.id });
          await updateEmailStatus(email.id, "FAILED", "NO_RECIPIENT");
          failedCount++;
          continue;
        }

        // sendFunnelEmail 호출
        const result = await sendFunnelEmail({
          organizationId: email.organizationId,
          contactId: email.contactId ?? undefined,
          to: toEmail,
          subject: email.subject,
          html: email.content,
          channel: "FUNNEL",
        });

        if (result.result_code === 1) {
          // 발송 성공
          await updateEmailStatus(email.id, "SENT");
          sentCount++;
          logger.log("[Email] 퍼널 이메일 발송 성공", {
            emailId: email.id,
            contactId: email.contactId,
            to: toEmail.slice(0, 5) + "***",
          });
        } else {
          // 발송 실패 (failedCount 필드를 retryCount로 사용)
          const retryCount = (email.failedCount ?? 0) + 1;

          if (retryCount < MAX_RETRIES) {
            // 5분 후 재시도
            const nextRetryAt = new Date(now.getTime() + 5 * 60 * 1000);
            await prisma.scheduledEmail.update({
              where: { id: email.id },
              data: {
                status: "PENDING",
                scheduledAt: nextRetryAt,
                failedCount: retryCount,
                failureReason: result.message,
              },
            });
            logger.warn("[Email] 퍼널 이메일 재시도 등록", {
              emailId: email.id,
              retryCount,
              nextRetryAt,
            });
          } else {
            // 최대 재시도 초과
            await updateEmailStatus(email.id, "FAILED", result.message);
            failedCount++;
            logger.error("[Email] 퍼널 이메일 발송 최종 실패", {
              emailId: email.id,
              retryCount,
              reason: result.message,
            });
          }
        }
      } catch (err) {
        logger.error("[Email] 퍼널 이메일 처리 중 오류", { emailId: email.id, err });
        failedCount++;
        const retryCount = (email.failedCount ?? 0) + 1;

        if (retryCount < MAX_RETRIES) {
          const nextRetryAt = new Date(now.getTime() + 5 * 60 * 1000);
          await prisma.scheduledEmail.update({
            where: { id: email.id },
            data: {
              status: "PENDING",
              scheduledAt: nextRetryAt,
              failedCount: retryCount,
              failureReason: err instanceof Error ? err.message : "Unknown error",
            },
          });
        } else {
          await updateEmailStatus(
            email.id,
            "FAILED",
            err instanceof Error ? err.message : "Unknown error"
          );
        }
      }

      // Rate limiting: 0.5초 간격으로 발송 (API 부하 방지)
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // ── 3단계: 야간 차단 처리 (예: 밤 10시-아침 8시) ────────────────────────────
    // 밤 10시(22:00) ~ 아침 8시(8:00) 사이에 예약된 이메일은 NIGHT_BLOCKED로 변경
    const nightBlockedEmails = await prisma.scheduledEmail.findMany({
      where: {
        status: "PENDING",
        scheduledAt: {
          lte: now,
          gt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 어제부터
        },
      },
    });

    for (const email of nightBlockedEmails) {
      const hour = email.scheduledAt.getHours();
      if (hour >= 22 || hour < 8) {
        // 밤 10시 이후 또는 아침 8시 전
        await prisma.scheduledEmail.update({
          where: { id: email.id },
          data: {
            status: "NIGHT_BLOCKED",
            scheduledAt: new Date(email.scheduledAt.getTime() + 24 * 60 * 60 * 1000), // 내일 같은 시간으로 변경
          },
        });
        logger.log("[Email] 야간 차단 적용", {
          emailId: email.id,
          originalTime: email.scheduledAt,
        });
      }
    }

    logger.log("[Cron] 이메일 퍼널 발송 완료", {
      processedCount: pendingEmails.length,
      sentCount,
      failedCount,
    });

    return NextResponse.json({
      ok: true,
      sentCount,
      failedCount,
      processedCount: pendingEmails.length,
    });
  } catch (err) {
    logger.error("[Cron] 이메일 퍼널 발송 중 오류", { err });
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * ScheduledEmail 상태 업데이트 헬퍼
 */
async function updateEmailStatus(
  emailId: string,
  status: "SENT" | "FAILED" | "CANCELLED",
  reason?: string
) {
  return prisma.scheduledEmail.update({
    where: { id: emailId },
    data: {
      status,
      failureReason: reason ?? null,
      sentAt: status === "SENT" ? new Date() : null,
    },
  });
}
