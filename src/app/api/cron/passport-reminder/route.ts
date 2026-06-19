export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { buildPassportLink, normalizePhoneForSms, generatePassportToken } from "@/lib/passport-utils";

// ── 상수 ────────────────────────────────────────────────────────
const REMINDER_AFTER_HOURS = 72;           // 최초 발송 후 이 시간 경과 시 리마인더
const COOLDOWN_HOURS = 24;                 // 최근 발송 후 이 시간 내 재발송 금지
const MAX_TOTAL_SENDS = 3;                 // 총 발송 횟수 상한 (72h 리마인더용)
const MAX_TOTAL_SENDS_D3 = 5;             // D-3 경고 총 발송 횟수 상한 (긴급이므로 더 허용)
const D3_DAYS_THRESHOLD = 3;              // 출발일까지 이 일수 이하면 D-3 경고 발송
const BATCH_SIZE = 50;                     // 한 번에 처리할 최대 대상 수
const TOKEN_EXPIRES_HOURS = 72;            // 새 토큰 유효 시간

// ── 공통 대상 타입 ───────────────────────────────────────────────
type ReminderTarget = {
  userId: number;
  submissionId: number;
  tripId: number | null;
  name: string | null;
  phone: string | null;
  cruiseName: string | null;
  daysUntilDeparture: number | null;
};

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

// ── D-3 최종 경고 메시지 빌더 (긴박감 강조) ────────────────────
function buildD3Message(params: {
  customerName: string;
  cruiseName: string;
  daysUntilDeparture: number | null;
  link: string;
}): string {
  const { customerName, cruiseName, daysUntilDeparture, link } = params;

  const name = customerName ? `${customerName}님` : "고객님";
  const product = cruiseName ? `[${cruiseName}]` : "[크루즈 여행]";

  // D-N 표시: 출발일까지 남은 일수 (없으면 "D-3" 고정 표시)
  const dLabel =
    daysUntilDeparture !== null && daysUntilDeparture >= 0
      ? `D-${daysUntilDeparture}`
      : "D-3";

  // 긴박감(Loss Aversion + Urgency) 강조 메시지
  // Grant Cardone L6(타이밍/손실회피) + L10(즉시구매 클로징) 적용
  return (
    `[${dLabel} 최종 경고] ${name}\n` +
    `${product} 출발이 ${dLabel}로 다가왔습니다.\n` +
    `⚠️ 지금 즉시 여권을 제출하지 않으면 탑승 수속이 불가합니다.\n` +
    `수속 마감 전 지금 바로 제출하세요 → ${link}`
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
 *
 * Stage 1 — 72h 리마인더:
 *   최초 SMS 발송 후 72h 초과 + 미제출 + 24h 쿨다운 + 총 3회 미만
 *
 * Stage 2 — D-3 최종 경고 (신규):
 *   출발일 ≤ 3일 + 미제출 + 24h 쿨다운 + 총 5회 미만 (72h 조건 무관)
 *   Stage 1 처리 대상과 중복 발송 방지
 */
export async function GET(req: Request) {
  // ── 1. Cron 인증 ────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (!secret) {
    logger.error("[PassportReminder] CRON_SECRET 미설정");
    return NextResponse.json({ ok: false, error: "Service Unavailable" }, { status: 503 });
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
    // ── 3. 공통 DB 조회 (Stage 1·2 공유) ────────────────────────
    const cutoff72h = new Date(now.getTime() - REMINDER_AFTER_HOURS * 60 * 60 * 1000);
    const cutoff24h = new Date(now.getTime() - COOLDOWN_HOURS * 60 * 60 * 1000);

    // 미제출 레코드 조회 (Stage 1 + 2 합산 대비 여유 있게)
    const pendingSubmissions = await prisma.gmPassportSubmission.findMany({
      where: { isSubmitted: false },
      select: { userId: true, tripId: true, id: true },
      take: BATCH_SIZE * 4,
    });

    if (pendingSubmissions.length === 0) {
      logger.log("[PassportReminder] 미제출 대상 없음");
      return NextResponse.json({ ok: true, sent: 0, skipped: 0, d3Sent: 0, d3Skipped: 0 });
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

    // ── 4. Aligo 환경변수 확인 ──────────────────────────────────
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

    // 가드 통과 후 클로저에서 타입 재확장 방지
    const checkedApiKey: string = apiKey;
    const checkedAligoUserId: string = aligoUserId;
    const checkedSenderPhone: string = senderPhone;

    // ── 5. 공통 발송 함수 (sendReminder) ────────────────────────
    type SendOutcome =
      | { kind: "sent" }
      | { kind: "skipped"; userId: number; reason: string };

    /**
     * 토큰 갱신 → 메시지 생성 → Aligo 발송 → 로그 기록
     * @param target  발송 대상
     * @param buildMessage  메시지 생성 함수 (72h용 / D-3용 분기)
     * @param logPrefix  logger 접두사 ([72h리마인더] / [D-3경고])
     */
    async function sendReminder(
      target: ReminderTarget,
      buildMessage: (params: {
        customerName: string;
        cruiseName: string;
        daysUntilDeparture: number | null;
        link: string;
      }) => string,
      logPrefix: string
    ): Promise<SendOutcome> {
      const normalizedPhone = normalizePhoneForSms(target.phone);

      if (!normalizedPhone) {
        await recordLog({
          userId: target.userId,
          messageBody: "(전화번호 없음)",
          status: "FAILED",
          errorReason: `${logPrefix} 전화번호 없음`,
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
        logger.error(`[PassportReminder]${logPrefix} 토큰 갱신 실패`, {
          userId: target.userId,
          err: updateErr instanceof Error ? updateErr.message : String(updateErr),
        });
        return { kind: "skipped", userId: target.userId, reason: "token_update_failed" };
      }

      const messageBody = buildMessage({
        customerName: target.name ?? "",
        cruiseName: target.cruiseName ?? "",
        daysUntilDeparture: target.daysUntilDeparture,
        link,
      });

      const msgType: "SMS" | "LMS" = new Blob([messageBody]).size > 90 ? "LMS" : "SMS";
      const lmsTitle = logPrefix.includes("D-3") ? "여권 제출 최종 경고" : "여권 제출 리마인더";

      let sendError: string | null = null;
      try {
        const formData = new URLSearchParams();
        formData.append("key", checkedApiKey);
        formData.append("user_id", checkedAligoUserId);
        formData.append("sender", checkedSenderPhone);
        formData.append("receiver", normalizedPhone);
        formData.append("msg", messageBody);
        formData.append("msg_type", msgType);
        if (msgType === "LMS") formData.append("title", lmsTitle);

        const aligoRes = await fetch("https://apis.aligo.in/send/", {
          method: "POST",
          signal: AbortSignal.timeout(10_000),
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
        logger.warn(`[PassportReminder]${logPrefix} 발송 실패`, {
          userId: target.userId,
          error: sendError,
        });
        return { kind: "skipped", userId: target.userId, reason: sendError };
      }

      logger.log(`[PassportReminder]${logPrefix} 발송 성공`, {
        userId: target.userId,
        daysUntilDeparture: target.daysUntilDeparture,
      });
      return { kind: "sent" };
    }

    // ── 6. Stage 1: 72h 리마인더 대상 필터링 + 발송 ─────────────
    const reminder72hTargets: ReminderTarget[] = [];
    const processedUserIds72h = new Set<number>(); // userId 중복 발송 방지

    for (const sub of pendingSubmissions) {
      if (reminder72hTargets.length >= BATCH_SIZE) break;

      // 동일 userId의 여러 submission → 첫 번째만 처리
      if (processedUserIds72h.has(sub.userId)) continue;

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

      processedUserIds72h.add(sub.userId);
      reminder72hTargets.push({
        userId: sub.userId,
        submissionId: sub.id,
        tripId: sub.tripId,
        name: user.name,
        phone: user.phone,
        cruiseName: trip?.cruiseName ?? null,
        daysUntilDeparture: calcDaysUntilDeparture(departure),
      });
    }

    const settled72h = await Promise.allSettled(
      reminder72hTargets.map((t) => sendReminder(t, buildReminderMessage, "[72h리마인더]"))
    );

    // Stage 1에서 성공 발송된 submissionId만 집합에 포함
    // (실패 항목은 Stage 2 D-3 경고에서 재시도 가능해야 함)
    const processedSubmissionIds = new Set<number>();

    let sent72h = 0;
    let skipped72h = 0;
    const errors72h: Array<{ userId: number; reason: string }> = [];

    for (let i = 0; i < settled72h.length; i++) {
      const result = settled72h[i];
      if (result.status === "rejected") {
        skipped72h++;
        errors72h.push({ userId: -1, reason: String(result.reason) });
      } else if (result.value.kind === "sent") {
        sent72h++;
        processedSubmissionIds.add(reminder72hTargets[i].submissionId); // 성공만 추가
      } else {
        skipped72h++;
        errors72h.push({ userId: result.value.userId, reason: result.value.reason });
      }
    }

    logger.log("[PassportReminder] Stage 1 (72h) 완료", {
      sent: sent72h,
      skipped: skipped72h,
      errors: errors72h.length,
    });

    // ── 7. Stage 2: D-3 최종 경고 대상 필터링 + 발송 ───────────
    //
    // 72h 리마인더 조건(firstSentAt 72h 이전)과 무관하게 독립 실행.
    // 단, Stage 1에서 이미 오늘 처리된 userId는 중복 발송 방지.
    const d3Targets: ReminderTarget[] = [];

    for (const sub of pendingSubmissions) {
      if (d3Targets.length >= BATCH_SIZE) break;

      // Stage 1에서 이미 처리된 submission 중복 제외 (submissionId 기준)
      if (processedSubmissionIds.has(sub.id)) continue;

      const log = logMap.get(sub.userId);
      const trip = tripMap.get(sub.userId);
      const user = userMap.get(sub.userId);

      if (!user) continue;

      // 출발일이 이미 지난 고객 제외
      const departure = trip?.departure ?? null;
      if (!departure || departure < now) continue;

      // D-3 조건: 출발일까지 0~D3_DAYS_THRESHOLD 일 (이미 지난 경우 제외)
      const days = calcDaysUntilDeparture(departure);
      if (days === null || days < 0 || days > D3_DAYS_THRESHOLD) continue;

      // 24h 쿨다운 유지
      if (log?.lastSentAt && log.lastSentAt > cutoff24h) continue;

      // 총 발송 횟수 상한 (D-3은 MAX_TOTAL_SENDS_D3 = 5)
      if (log && log.totalCount >= MAX_TOTAL_SENDS_D3) continue;

      d3Targets.push({
        userId: sub.userId,
        submissionId: sub.id,
        tripId: sub.tripId,
        name: user.name,
        phone: user.phone,
        cruiseName: trip?.cruiseName ?? null,
        daysUntilDeparture: days,
      });
    }

    const settledD3 = await Promise.allSettled(
      d3Targets.map((t) => sendReminder(t, buildD3Message, "[D-3경고]"))
    );

    let sentD3 = 0;
    let skippedD3 = 0;
    const errorsD3: Array<{ userId: number; reason: string }> = [];

    for (const result of settledD3) {
      if (result.status === "rejected") {
        skippedD3++;
        errorsD3.push({ userId: -1, reason: String(result.reason) });
      } else if (result.value.kind === "sent") {
        sentD3++;
      } else {
        skippedD3++;
        errorsD3.push({ userId: result.value.userId, reason: result.value.reason });
      }
    }

    logger.log("[PassportReminder] Stage 2 (D-3) 완료", {
      sent: sentD3,
      skipped: skippedD3,
      errors: errorsD3.length,
    });

    // ── 8. 통합 결과 반환 ────────────────────────────────────────
    const totalSent = sent72h + sentD3;
    const totalSkipped = skipped72h + skippedD3;

    logger.log("[PassportReminder] 전체 완료", {
      totalSent,
      totalSkipped,
      reminder72h: { sent: sent72h, skipped: skipped72h },
      d3Warning: { sent: sentD3, skipped: skippedD3 },
    });

    return NextResponse.json({
      ok: true,
      sent: totalSent,
      skipped: totalSkipped,
      reminder72h: { sent: sent72h, skipped: skipped72h, errors: errors72h },
      d3Warning: { sent: sentD3, skipped: skippedD3, errors: errorsD3 },
    });
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
