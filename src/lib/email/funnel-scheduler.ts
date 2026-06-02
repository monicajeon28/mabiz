/**
 * src/lib/email/funnel-scheduler.ts
 *
 * Day 0-3 자동 이메일 퍼널 스케줄러
 * - 상담 후 Day 0/1/2/3에 자동으로 이메일 발송
 * - PASONA 기반 심리학 프레임워크 적용
 * - Prisma ScheduledEmail에 등록
 */

import prisma from "@/lib/prisma";
import {
  renderFunnelDay0Email,
  renderFunnelDay1Email,
  renderFunnelDay2Email,
  renderFunnelDay3Email,
  type FunnelDay0EmailParams,
  type FunnelDay1EmailParams,
  type FunnelDay2EmailParams,
  type FunnelDay3EmailParams,
} from "@/lib/email-templates";
import { logger } from "@/lib/logger";

export interface FunnelEmailScheduleParams {
  organizationId: string;
  contactId: string;
  contactName: string;
  contactEmail: string;

  // Day 0 파라미터
  consultantName?: string;
  consultationType?: string; // "건강검진" | "영양상담" | "운동처방"

  // Day 1 파라미터
  recommendedTier?: "basic" | "standard" | "premium";
  products?: { basic: string; standard: string; premium: string };

  // Day 2 파라미터
  successStories?: { person: string; result: string; duration: string }[];

  // Day 3 파라미터
  seatsRemaining?: number;
  discountPercent?: number;
  originalPrice?: string;
  discountedPrice?: string;

  // 공통
  crmUrl?: string;
  createdByUserId?: string;
}

/**
 * Day 0-3 이메일 퍼널 자동 스케줄링
 * 상담 완료 후 이 함수 호출
 */
export async function scheduleDay0To3Funnel(params: FunnelEmailScheduleParams): Promise<{
  ok: boolean;
  message: string;
  scheduledIds?: string[];
}> {
  try {
    const {
      organizationId,
      contactId,
      contactName,
      contactEmail,
      consultantName = "전문가",
      consultationType = "건강검진",
      recommendedTier = "standard",
      products = {
        basic: "건강검진 기본형",
        standard: "건강검진 표준형",
        premium: "건강검진 프리미엄형",
      },
      successStories,
      seatsRemaining = 10,
      discountPercent = 25,
      originalPrice = "498,000원",
      discountedPrice = "374,000원",
      crmUrl = "https://crm.cruisedot.co.kr",
      createdByUserId,
    } = params;

    // 유효성 검증
    if (!contactEmail || !contactEmail.includes("@")) {
      return { ok: false, message: "유효하지 않은 이메일 주소" };
    }

    const now = new Date();
    const scheduledIds: string[] = [];

    // ── Day 0: 상담 직후 (즉시, 또는 1시간 뒤) ──────────────────
    const day0Time = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1시간 뒤

    const day0Params: FunnelDay0EmailParams = {
      name: contactName,
      consultantName,
      consultationType,
      crmUrl,
    };

    const { subject: day0Subject, html: day0Html } = renderFunnelDay0Email(day0Params);

    const day0Email = await prisma.scheduledEmail.create({
      data: {
        organizationId,
        contactId,
        subject: day0Subject,
        content: day0Html,
        scheduledAt: day0Time,
        status: "PENDING",
        createdByUserId: createdByUserId ?? null,
      },
    });

    scheduledIds.push(day0Email.id);
    logger.log("[Funnel Scheduler] Day 0 이메일 등록", {
      contactId,
      scheduledAt: day0Time,
      emailId: day0Email.id,
    });

    // ── Day 1: 상담 다음날 오전 9시 ──────────────────────────
    const day1Time = new Date(now);
    day1Time.setDate(day1Time.getDate() + 1);
    day1Time.setHours(9, 0, 0, 0);

    const day1Params: FunnelDay1EmailParams = {
      name: contactName,
      recommendedTier,
      product1: products.basic,
      product2: products.standard,
      product3: products.premium,
      crmUrl,
    };

    const { subject: day1Subject, html: day1Html } = renderFunnelDay1Email(day1Params);

    const day1Email = await prisma.scheduledEmail.create({
      data: {
        organizationId,
        contactId,
        subject: day1Subject,
        content: day1Html,
        scheduledAt: day1Time,
        status: "PENDING",
        createdByUserId: createdByUserId ?? null,
      },
    });

    scheduledIds.push(day1Email.id);
    logger.log("[Funnel Scheduler] Day 1 이메일 등록", {
      contactId,
      scheduledAt: day1Time,
      emailId: day1Email.id,
    });

    // ── Day 2: 상담 2일 후 오전 10시 ──────────────────────────
    const day2Time = new Date(now);
    day2Time.setDate(day2Time.getDate() + 2);
    day2Time.setHours(10, 0, 0, 0);

    const day2Params: FunnelDay2EmailParams = {
      name: contactName,
      successStories,
      satisfactionRate: 94,
      crmUrl,
    };

    const { subject: day2Subject, html: day2Html } = renderFunnelDay2Email(day2Params);

    const day2Email = await prisma.scheduledEmail.create({
      data: {
        organizationId,
        contactId,
        subject: day2Subject,
        content: day2Html,
        scheduledAt: day2Time,
        status: "PENDING",
        createdByUserId: createdByUserId ?? null,
      },
    });

    scheduledIds.push(day2Email.id);
    logger.log("[Funnel Scheduler] Day 2 이메일 등록", {
      contactId,
      scheduledAt: day2Time,
      emailId: day2Email.id,
    });

    // ── Day 3: 상담 3일 후 오전 8시 (최종 클로징) ──────────────────────────
    const day3Time = new Date(now);
    day3Time.setDate(day3Time.getDate() + 3);
    day3Time.setHours(8, 0, 0, 0);

    const day3Params: FunnelDay3EmailParams = {
      name: contactName,
      seatsRemaining,
      discountPercent,
      discountExpiresIn: 72,
      originalPrice,
      discountedPrice,
      crmUrl,
    };

    const { subject: day3Subject, html: day3Html } = renderFunnelDay3Email(day3Params);

    const day3Email = await prisma.scheduledEmail.create({
      data: {
        organizationId,
        contactId,
        subject: day3Subject,
        content: day3Html,
        scheduledAt: day3Time,
        status: "PENDING",
        createdByUserId: createdByUserId ?? null,
      },
    });

    scheduledIds.push(day3Email.id);
    logger.log("[Funnel Scheduler] Day 3 이메일 등록", {
      contactId,
      scheduledAt: day3Time,
      emailId: day3Email.id,
    });

    // ── Day 7: 팔로우업 (1주 뒤) ──────────────────────────
    // Grant Cardone Follow-up: "혹시 마음 바뀌셨나요?"
    const day7Time = new Date(now);
    day7Time.setDate(day7Time.getDate() + 7);
    day7Time.setHours(14, 0, 0, 0);

    const day7Html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#1e3a5f;padding:28px 32px;color:#fff;font-size:20px;font-weight:700;">
              🚢 크루즈닷 CRM
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:700;">
                혹시 마음이 바뀌셨나요? 🤔
              </h2>
              <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.6;">
                ${contactName}님께 어제 보내드린 메시지들을 아직 못 보셨거나,<br />
                혹은 여전히 고민 중이신 건 아닐까요?
              </p>

              <div style="background:#e7f3ff;border-left:4px solid #0d6efd;padding:16px;border-radius:6px;margin:20px 0;">
                <p style="margin:0 0 8px;color:#004085;font-size:13px;font-weight:600;">
                  💬 추가 질문이나 우려사항이 있으신가요?
                </p>
                <p style="margin:0;color:#004085;font-size:12px;">
                  지금 바로 저희 전문가팀에 연락주시면, 당신의 모든 질문에 답변해드리겠습니다.
                </p>
              </div>

              <div style="text-align:center;margin:24px 0;">
                <a href="${crmUrl}/contact-support"
                   style="display:inline-block;background:#0d6efd;color:#fff;text-decoration:none;
                          padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                  무료 상담 신청하기
                </a>
              </div>

              <p style="margin:16px 0 0;color:#6b7280;font-size:12px;line-height:1.6;">
                또는 카톡으로 @크루즈닷 에 메시지를 보내주셔도 됩니다.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const day7Email = await prisma.scheduledEmail.create({
      data: {
        organizationId,
        contactId,
        subject: `[크루즈닷] ${contactName}님, 혹시 마음이 바뀌셨나요?`,
        content: day7Html,
        scheduledAt: day7Time,
        status: "PENDING",
        createdByUserId: createdByUserId ?? null,
      },
    });

    scheduledIds.push(day7Email.id);
    logger.log("[Funnel Scheduler] Day 7 이메일 등록", {
      contactId,
      scheduledAt: day7Time,
      emailId: day7Email.id,
    });

    return {
      ok: true,
      message: `Day 0-7 이메일 퍼널 (5개) 등록 완료`,
      scheduledIds,
    };
  } catch (err) {
    logger.error("[Funnel Scheduler] 오류", { err });
    return { ok: false, message: err instanceof Error ? err.message : "알 수 없는 오류" };
  }
}

/**
 * 특정 Contact의 퍼널 이메일을 취소하거나 일시정지
 * (예: 사용자가 구매를 완료한 경우 나머지 이메일 정지)
 */
export async function cancelFunnelEmails(
  organizationId: string,
  contactId: string,
  reason: "PURCHASED" | "UNSUBSCRIBED" | "MANUAL"
): Promise<{ ok: boolean; cancelledCount: number }> {
  try {
    const result = await prisma.scheduledEmail.updateMany({
      where: {
        organizationId,
        contactId,
        status: { in: ["PENDING", "NIGHT_BLOCKED"] },
      },
      data: {
        status: "CANCELLED",
        failureReason: `Funnel cancelled: ${reason}`,
      },
    });

    logger.log("[Funnel Scheduler] 퍼널 취소", {
      contactId,
      cancelledCount: result.count,
      reason,
    });

    return { ok: true, cancelledCount: result.count };
  } catch (err) {
    logger.error("[Funnel Scheduler] 퍼널 취소 실패", { err });
    return { ok: false, cancelledCount: 0 };
  }
}
