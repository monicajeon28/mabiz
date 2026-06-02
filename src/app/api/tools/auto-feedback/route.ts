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
      },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, message: "고객을 찾을 수 없거나 권한이 없습니다." },
        { status: 404 }
      );
    }

    // 렌즈 감지 (ONE-TIME — 엔진 내부 캐싱 활용, force=false)
    const lensEngine = new LensDetectionEngine(prisma);
    const lensResult = await lensEngine.detectLens(
      contact.id,
      contact.organizationId
    );
    const lens: LensType = lensResult.primaryLens;

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

    // 렌즈별 PASONA Day 0-3 생성
    const generated = PASONA_DAYS.map((day) => {
      const seq = getPasonaTemplate(day, lens);
      if (!seq) return null;
      const scheduledAt = calculateScheduledTime(now, day);
      const message = personalize(seq.template, {
        name: customerName,
        daysSince,
      });
      return {
        day,
        phase: seq.phase,
        tone: seq.tone,
        expectedMetric: seq.expectedMetric,
        expectedRate: seq.expectedRate,
        scheduledAt,
        message,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    if (generated.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: `렌즈 ${lens}에 대한 PASONA 템플릿이 없습니다.`,
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

    // ScheduledSms 등록 (기존 Cron이 발송 처리)
    const created = await prisma.$transaction(
      generated.map((g) =>
        prisma.scheduledSms.create({
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

    logger.log("[POST /api/tools/auto-feedback] PASONA Day 0-3 자동 생성", {
      contactId: contact.id,
      lens,
      count: created.length,
    });

    return NextResponse.json({
      ok: true,
      lens,
      confidenceScore: lensResult.confidenceScore,
      created: created.map((c, i) => ({
        id: c.id,
        day: generated[i].day,
        phase: generated[i].phase,
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
