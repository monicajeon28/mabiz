export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { buildPassportLink, fillTemplate, normalizePhoneForSms, generatePassportToken } from "@/lib/passport-utils";

// ── 상수 ────────────────────────────────────────────────────────
const REMINDER_AFTER_HOURS = 72;           // 최초 발송 후 이 시간 경과 시 리마인더
const COOLDOWN_HOURS = 24;                 // 최근 발송 후 이 시간 내 재발송 금지
const MAX_TOTAL_SENDS = 3;                 // 총 발송 횟수 상한 (스팸 방지)
const BATCH_SIZE = 50;                     // 한 번에 처리할 최대 대상 수
const TOKEN_EXPIRES_HOURS = 72;            // 새 토큰 유효 시간

// ── PASONA 구조 리마인더 메시지 빌더 ────────────────────────────
function buildReminderMessage(params: {
  customerName: string;
  cruiseName: string;
  daysUntilDeparture: number | null;
  link: string;
}): string {
  const { customerName, cruiseName, daysUntilDeparture, link } = params;

  const name = customerName ? `${customerName}님` : "고객님";
  const product = cruiseName ? `[${cruiseName}]` : "[크루즈 여행]";

  // N(Narrow): 출발일 정보가 있을 때만 삽입
  const narrowPart =
    daysUntilDeparture !== null && daysUntilDeparture > 0
      ? `출발까지 ${daysUntilDeparture}일 남았습니다. `
      : "";

  // PASONA 구조
  // P: 출발일이 다가옵니다 (Problem)
  // A: 여권 미제출 시 탑승 불가 (Agitate)
  // S: 지금 바로 제출 (Solution)
  // O: 링크 직접 연결 (Offer)
  // N: 출발까지 N일 남음 (Narrow)
  // A: 클릭 한 번으로 완료 (Action)
  return (
    `${name}, ${product} 여권 제출이 아직 완료되지 않았습니다.\n` +
    `여권 정보 미제출 시 탑승 수속이 불가하오니 지금 바로 제출 부탁드립니다.\n` +
    `${narrowPart}` +
    `아래 링크를 눌러 1분 안에 완료하세요.\n` +
    `${link}`
  );
}

// ── KST 기준 날짜 차이 계산 (UTC 서버에서 KST 자정 기준) ────────
function calcDaysUntilDeparture(departureDate: Date | null): number | null {
  if (!departureDate) return null;
  const depKst = new Date(departureDate.toISOString().split("T")[0] + "T00:00:00+09:00");
  const todayKst = new Date(new Date().toISOString().split("T")[0] + "T00:00:00+09:00");
  return Math.ceil((depKst.getTime() - todayKst.getTime()) / (1000 * 60 * 60 * 24));
}

// ── GET /api/cron/passport-reminder ────────────────────────────
/**
 * Vercel Cron (매일 00:00 UTC = 09:00 KST) 실행
 * 조건: SMS 발송 후 72h 초과 + 미제출 + 24h 내 재발송 없음 + 총 3회 미만
 */
export async function GET(req: Request) {
  // ── 1. Cron 인증 ────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (!secret) {
    logger.error("[PassportReminder] CRON_SECRET 미설정");
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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
    logger.warn("[PassportReminder] 인증 실패", {
      ip: req.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. KST 시간대 검증 (08:30~10:00 KST 범위에서만 실행) ───
  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;
  const kstMin = now.getUTCMinutes();
  const kstTotalMin = kstHour * 60 + kstMin;
  // 08:30 ~ 10:00 KST 허용 (cron 지연 대비 30분 여유)
  if (kstTotalMin < 8 * 60 + 30 || kstTotalMin > 10 * 60) {
    logger.warn("[PassportReminder] 허용 시간 외 실행 시도 — 스킵", { kstHour, kstMin });
    return NextResponse.json({ ok: true, skipped: true, reason: "out_of_window" });
  }

  try {
    // ── 3. 리마인더 대상 조회 ───────────────────────────────────
    // 조건:
    //   A) GmPassportSubmission.isSubmitted = false
    //   B) 최초 SMS 발송 로그가 72h 이전에 있음 (= sentAt <= now - 72h)
    //   C) 최근 24h 이내 SUCCESS 로그 없음
    //   D) SUCCESS 총 발송 횟수 < MAX_TOTAL_SENDS (3회)
    //   E) 출발일이 오늘 이후 (이미 출발한 고객 제외)

    const cutoff72h = new Date(now.getTime() - REMINDER_AFTER_HOURS * 60 * 60 * 1000);
    const cutoff24h = new Date(now.getTime() - COOLDOWN_HOURS * 60 * 60 * 1000);

    // 미제출 제출 레코드 기준으로 시작 (userId 목록)
    const pendingSubmissions = await prisma.gmPassportSubmission.findMany({
      where: { isSubmitted: false },
      select: { userId: true, tripId: true, id: true },
      take: BATCH_SIZE * 3, // 필터링 후 BATCH_SIZE 맞추기 위해 여유 있게 조회
    });

    if (pendingSubmissions.length === 0) {
      logger.log("[PassportReminder] 미제출 대상 없음");
      return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
    }

    const userIds = [...new Set(pendingSubmissions.map((s) => s.userId))];

    // 각 userId별 로그 집계 (한 번에 조회)
    const logGroups = await prisma.gmPassportRequestLog.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: "SUCCESS" },
      _count: { id: true },
      _max: { sentAt: true },
      _min: { sentAt: true },
    });

    const logMap = new Map(
      logGroups.map((g) => [
        g.userId,
        {
          totalCount: g._count.id,
          lastSentAt: g._max.sentAt,
          firstSentAt: g._min.sentAt,
        },
      ])
    );

    // 출발일 확인을 위해 Trip 조회
    const trips = await prisma.gmTrip.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, startDate: true, departureDate: true, cruiseName: true },
      orderBy: { startDate: "desc" },
    });

    // userId → 최신 여행 매핑 (startDate 우선, 없으면 departureDate)
    const tripMap = new Map<number, { cruiseName: string | null; departure: Date | null }>();
    for (const trip of trips) {
      if (!tripMap.has(trip.userId)) {
        tripMap.set(trip.userId, {
          cruiseName: trip.cruiseName,
          departure: trip.startDate ?? trip.departureDate,
        });
      }
    }

    // 유저 정보 조회 (이름, 전화번호)
    const users = await prisma.gmUser.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, phone: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // ── 4. 대상 필터링 ─────────────────────────────────────────
    const targets: Array<{
      userId: number;
      submissionId: number;
      tripId: number | null;
      name: string | null;
      phone: string | null;
      cruiseName: string | null;
      daysUntilDeparture: number | null;
    }> = [];

    for (const sub of pendingSubmissions) {
      if (targets.length >= BATCH_SIZE) break;

      const log = logMap.get(sub.userId);
      const trip = tripMap.get(sub.userId);
      const user = userMap.get(sub.userId);

      if (!user) continue;

      // E) 출발일 확인 — 출발일이 이미 지난 고객 제외
      const departure = trip?.departure ?? null;
      if (departure && departure < now) continue;

      // B) 최초 발송이 72h 이전인지 확인 — 한 번도 발송 안 했으면 제외
      if (!log || !log.firstSentAt) continue;
      if (log.firstSentAt > cutoff72h) continue;

      // C) 최근 24h 이내 발송 있으면 제외
      if (log.lastSentAt && log.lastSentAt > cutoff24h) continue;

      // D) 총 발송 횟수 초과 시 제외
      if (log.totalCount >= MAX_TOTAL_SENDS) continue;

      targets.push({
        userId: sub.userId,
        submissionId: sub.id,
        tripId: sub.tripId,
        name: user.name,
        phone: user.phone,
        cruiseName: trip?.cruiseName ?? null,
        daysUntilDeparture: calcDaysUntilDeparture(departure),
      });
    }

    if (targets.length === 0) {
      logger.log("[PassportReminder] 필터링 후 발송 대상 없음");
      return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
    }

    // ── 5. Aligo 환경변수 확인 ──────────────────────────────────
    const apiKey = process.env.ALIGO_API_KEY;
    const aligoUserId = process.env.ALIGO_USER_ID;
    const senderPhone = process.env.ALIGO_SENDER_PHONE;

    if (!apiKey || !aligoUserId || !senderPhone) {
      logger.error("[PassportReminder] Aligo 환경변수 미설정");
      return NextResponse.json(
        { ok: false, error: "Aligo config missing" },
        { status: 500 }
      );
    }

    // ── 6. 발송 루프 (병렬 처리) ────────────────────────────────
    type SendOutcome =
      | { kind: "sent" }
      | { kind: "skipped"; userId: number; reason: string };

    async function sendOne(target: (typeof targets)[number]): Promise<SendOutcome> {
      const normalizedPhone = normalizePhoneForSms(target.phone);

      if (!normalizedPhone) {
        await recordLog({
          userId: target.userId,
          messageBody: "(전화번호 없음)",
          status: "FAILED",
          errorReason: "전화번호 없음",
        });
        return { kind: "skipped", userId: target.userId, reason: "전화번호 없음" };
      }

      const newToken = generatePassportToken();
      const tokenExpiresAt = new Date(now.getTime() + TOKEN_EXPIRES_HOURS * 60 * 60 * 1000);
      const link = buildPassportLink(newToken);

      try {
        await prisma.gmPassportSubmission.update({
          where: { id: target.submissionId },
          data: { token: newToken, tokenExpiresAt, isSubmitted: false, updatedAt: now },
        });
      } catch (updateErr) {
        logger.error("[PassportReminder] 토큰 갱신 실패", {
          userId: target.userId,
          err: updateErr instanceof Error ? updateErr.message : String(updateErr),
        });
        return { kind: "skipped", userId: target.userId, reason: "token_update_failed" };
      }

      const messageBody = buildReminderMessage({
        customerName: target.name ?? "",
        cruiseName: target.cruiseName ?? "",
        daysUntilDeparture: target.daysUntilDeparture,
        link,
      });

      const msgType: "SMS" | "LMS" = new Blob([messageBody]).size > 90 ? "LMS" : "SMS";

      let sendError: string | null = null;
      try {
        const formData = new URLSearchParams();
        formData.append("key", apiKey);
        formData.append("user_id", aligoUserId);
        formData.append("sender", senderPhone);
        formData.append("receiver", normalizedPhone);
        formData.append("msg", messageBody);
        formData.append("msg_type", msgType);
        if (msgType === "LMS") formData.append("title", "여권 제출 리마인더");

        const aligoRes = await fetch("https://apis.aligo.in/send/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
          body: formData.toString(),
        });

        if (!aligoRes.ok) {
          const text = await aligoRes.text();
          throw new Error(`HTTP ${aligoRes.status}: ${text}`);
        }

        const json = (await aligoRes.json()) as { result_code: string; message?: string };
        if (String(json.result_code) !== "1") {
          sendError = json.message ?? `result_code: ${json.result_code}`;
        }
      } catch (sendErr) {
        sendError = sendErr instanceof Error ? sendErr.message : String(sendErr);
      }

      await recordLog({
        userId: target.userId,
        messageBody,
        status: sendError ? "FAILED" : "SUCCESS",
        errorReason: sendError,
      });

      if (sendError) {
        logger.warn("[PassportReminder] 발송 실패", { userId: target.userId, error: sendError });
        return { kind: "skipped", userId: target.userId, reason: sendError };
      }

      logger.log("[PassportReminder] 발송 성공", {
        userId: target.userId,
        daysUntilDeparture: target.daysUntilDeparture,
      });
      return { kind: "sent" };
    }

    const settled = await Promise.allSettled(targets.map(sendOne));

    let sent = 0;
    let skipped = 0;
    const errors: Array<{ userId: number; reason: string }> = [];

    for (const result of settled) {
      if (result.status === "rejected") {
        skipped++;
        errors.push({ userId: -1, reason: String(result.reason) });
      } else if (result.value.kind === "sent") {
        sent++;
      } else {
        skipped++;
        errors.push({ userId: result.value.userId, reason: result.value.reason });
      }
    }

    logger.log("[PassportReminder] 실행 완료", { sent, skipped, errors: errors.length });
    return NextResponse.json({ ok: true, sent, skipped, errors });
  } catch (err) {
    logger.error("[PassportReminder] 전체 오류", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

// ── 로그 헬퍼 ────────────────────────────────────────────────────
async function recordLog(params: {
  userId: number;
  messageBody: string;
  status: "SUCCESS" | "FAILED";
  errorReason?: string | null;
}) {
  try {
    await prisma.gmPassportRequestLog.create({
      data: {
        userId: params.userId,
        adminId: null, // Cron 자동 발송 — 관리자 없음
        templateId: null,
        messageBody: params.messageBody,
        messageChannel: "SMS",
        status: params.status,
        errorReason: params.errorReason ?? null,
        sentAt: new Date(),
      },
    });
  } catch (err) {
    logger.error("[PassportReminder] 로그 기록 실패", {
      userId: params.userId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
