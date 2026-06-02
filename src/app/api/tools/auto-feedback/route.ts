/**
 * AutoFeedbackGenerator API
 * @date 2026-06-02
 * @description
 *  거장단 토론 결론(Phase 1-2) 반영:
 *   - CRM거장: 렌즈 감지는 ONE-TIME, 생성 시 재감지 X (일관성 보장)
 *   - 심리학거장: 렌즈별 PASONA Day 0-3 자동 생성 (기존 pasona-sequences 재사용)
 *   - TS아키텍트: Day 0-3 발송 일정은 기존 SMS_DAY0_3_SCHEDULE(에빙하우스) 재사용
 *   - 보안전문가: Manager 자기 Contact만(buildContactWhere), PII는 변수 치환만
 *
 *  Contact 렌즈(L0-L10) → PASONA Day 0/1/2/3 SMS 생성 → ScheduledSms 등록.
 *  실제 발송은 기존 Cron(sms-day0-init / sms-day3-action 등)이 처리.
 *
 *  POST /api/tools/auto-feedback
 *  Body: { contactId: string, dryRun?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { LensDetectionEngine } from "@/lib/services/lens-detection-engine";
import { getPasonaTemplate } from "@/lib/messages/pasona-sequences";
import {
  SMS_DAY0_3_SCHEDULE,
  calculateScheduledTime,
} from "@/lib/automation/sms-day0-3";
import type { LensType } from "@/lib/types/lens";

/** PASONA 시퀀스가 정의된 Day (L0-L10 공통) */
const PASONA_DAYS: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];

/**
 * PASONA 템플릿 변수 치환 (개인화)
 * 변수가 없는 토큰은 합리적 기본값으로 대체해 빈칸 방지
 */
function personalize(
  template: string,
  vars: { name: string; daysSince?: number }
): string {
  return template
    .replace(/\{\{\s*name\s*\}\}/g, vars.name)
    .replace(/\{\{\s*daysSince\s*\}\}/g, String(vars.daysSince ?? "최근"))
    // 남은 변수는 안전한 자리표시자로 (발송 전 검수/대체 가능)
    .replace(/\{\{\s*discount\s*\}\}/g, "15")
    .replace(/\{\{\s*remaining\s*\}\}/g, "소수")
    .replace(/\{\{\s*hours\s*\}\}/g, "24")
    .replace(/\{\{\s*link\s*\}\}/g, "")
    .replace(/\{\{\s*[\w]+\s*\}\}/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === "FREE_SALES") {
      return NextResponse.json(
        { ok: false, message: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const contactId = typeof body?.contactId === "string" ? body.contactId : "";
    const dryRun = body?.dryRun === true;

    if (!contactId) {
      return NextResponse.json(
        { ok: false, message: "contactId는 필수입니다." },
        { status: 400 }
      );
    }

    // 권한: Manager 자기 Contact만 (buildContactWhere가 role별 격리)
    const where = buildContactWhere(ctx, { id: contactId });
    const contact = await prisma.contact.findFirst({
      where,
      select: {
        id: true,
        name: true,
        organizationId: true,
        lastContactedAt: true,
        optOutAt: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, message: "고객을 찾을 수 없거나 권한이 없습니다." },
        { status: 404 }
      );
    }

    // GDPR: SMS 거부 여부 확인
    if (contact.optOutAt) {
      return NextResponse.json(
        {
          ok: false,
          message: "해당 고객은 SMS 수신을 거부하셨습니다.",
          code: "SMS_OPT_OUT",
        },
        { status: 400 }
      );
    }

    // NOTE: 중복 방지 findFirst는 트랜잭션 내부로 이동 (race condition 방지)
    // 아래 $transaction 인터랙티브 콜백 안에서 처리

    // 렌즈 감지 (ONE-TIME — 엔진 내부 캐싱 활용, force=false)
    let lensResult;
    try {
      const lensEngine = new LensDetectionEngine(prisma);
      lensResult = await lensEngine.detectLens(
        contact.id,
        contact.organizationId
      );
    } catch (lensErr) {
      logger.error("[POST /api/tools/auto-feedback] 렌즈 감지 실패", {
        contactId: contact.id,
        error: lensErr,
      });
      return NextResponse.json(
        {
          ok: false,
          message: "고객 분석에 실패했습니다. 관리자에게 문의하세요.",
          code: "LENS_DETECTION_FAILED",
        },
        { status: 500 }
      );
    }

    const lens: LensType = lensResult.primaryLens;
    if (!lens) {
      return NextResponse.json(
        {
          ok: false,
          message: "고객의 렌즈를 결정할 수 없습니다.",
          code: "LENS_NOT_DETERMINED",
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const customerName = contact.name || "고객";
    const daysSince = contact.lastContactedAt
      ? Math.max(
          0,
          Math.round(
            (now.getTime() - contact.lastContactedAt.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : undefined;

    // 렌즈별 PASONA Day 0-3 생성 (개별 day 실패 시 해당 day만 skip)
    const generated: Array<{
      day: 0 | 1 | 2 | 3;
      phase: string;
      tone: string;
      expectedMetric: string;
      expectedRate: number;
      scheduledAt: Date;
      message: string;
    }> = [];

    for (const day of PASONA_DAYS) {
      try {
        const seq = getPasonaTemplate(day, lens);
        if (!seq) continue;

        const scheduledAt = calculateScheduledTime(now, day);
        if (!scheduledAt) {
          // 스케줄 테이블에 해당 day가 없음 — 건너뜀
          logger.log(
            `[POST /api/tools/auto-feedback] day=${day} 스케줄 없음, skip`,
            { contactId: contact.id, lens }
          );
          continue;
        }

        const message = personalize(seq.template, {
          name: customerName,
          daysSince,
        });

        if (!message || message.length === 0) continue;

        generated.push({
          day,
          phase: seq.phase,
          tone: seq.tone ?? "neutral",
          expectedMetric: seq.expectedMetric ?? "open_rate",
          expectedRate: seq.expectedRate ?? 0.5,
          scheduledAt,
          message,
        });
      } catch (dayErr) {
        // 개별 day 에러는 전체를 중단시키지 않음
        logger.error(
          `[POST /api/tools/auto-feedback] day=${day} 생성 실패, skip`,
          { contactId: contact.id, lens, error: dayErr }
        );
      }
    }

    if (generated.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: `렌즈 ${lens}에 대한 PASONA 템플릿이 없습니다.`,
          code: "NO_TEMPLATE_FOR_LENS",
        },
        { status: 404 }
      );
    }

    // dryRun이면 미리보기만 반환 (스케줄 미등록)
    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        lens,
        confidenceScore: lensResult.confidenceScore,
        messages: generated,
        schedule: SMS_DAY0_3_SCHEDULE,
      });
    }

    // ScheduledSms 등록 — 중복 체크 + 생성을 단일 인터랙티브 트랜잭션으로 묶어
    // findFirst→create 사이의 race condition 방지
    let created: Array<{ id: string; scheduledAt: Date; status: string }>;
    try {
      const txResult = await prisma.$transaction(async (tx) => {
        // 트랜잭션 내부에서 중복 확인 (race condition 방지)
        const existingScheduled = await tx.scheduledSms.findFirst({
          where: {
            contactId: contact.id,
            status: { in: ["PENDING", "RETRY"] },
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 최근 24시간
            },
          },
          select: { id: true },
        });

        if (existingScheduled) {
          // 트랜잭션 내부에서 충돌을 알리는 특수 에러
          const err = new Error("SMS_ALREADY_SCHEDULED");
          (err as Error & { code?: string }).code = "SMS_ALREADY_SCHEDULED";
          throw err;
        }

        return Promise.all(
          generated.map((g) =>
            tx.scheduledSms.create({
              data: {
                organizationId: contact.organizationId,
                contactId: contact.id,
                message: g.message,
                scheduledAt: g.scheduledAt,
                status: "PENDING",
                channel: "FUNNEL",
                createdByUserId: ctx.userId,
              },
              select: { id: true, scheduledAt: true, status: true },
            })
          )
        );
      });

      created = txResult;
    } catch (dbErr) {
      // 중복 예약 충돌 처리
      if (
        dbErr instanceof Error &&
        dbErr.message === "SMS_ALREADY_SCHEDULED"
      ) {
        return NextResponse.json(
          {
            ok: false,
            message: "이미 SMS가 예약되어 있습니다.",
            code: "SMS_ALREADY_SCHEDULED",
          },
          { status: 400 }
        );
      }
      logger.error("[POST /api/tools/auto-feedback] DB 트랜잭션 실패", {
        contactId: contact.id,
        generatedCount: generated.length,
        error: dbErr,
      });
      return NextResponse.json(
        {
          ok: false,
          message: "메시지 저장에 실패했습니다.",
          code: "DATABASE_ERROR",
        },
        { status: 500 }
      );
    }

    logger.log("[POST /api/tools/auto-feedback] PASONA Day 0-3 자동 생성 완료", {
      contactId: contact.id,
      lens,
      confidenceScore: lensResult.confidenceScore,
      count: created.length,
      days: generated.map((g) => g.day),
    });

    return NextResponse.json({
      ok: true,
      lens,
      confidenceScore: lensResult.confidenceScore,
      smsCount: created.length,
      created: created.map((c, i) => ({
        id: c.id,
        day: generated[i].day,
        phase: generated[i].phase,
        tone: generated[i].tone,
        scheduledAt: c.scheduledAt,
        status: c.status,
      })),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (err instanceof Error && err.message === "FREE_SALES_NO_ACCESS") {
      return NextResponse.json(
        { ok: false, message: "권한이 없습니다." },
        { status: 403 }
      );
    }
    logger.error("[POST /api/tools/auto-feedback]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
