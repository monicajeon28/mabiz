/**
 * ToolClickTracker API
 * @date 2026-06-02
 * @description
 *  거장단 토론 결론(Phase 1-2) 반영:
 *   - 보안전문가: 미니멀 로깅(개인정보 NO), Manager 자기 Contact만, 재시도 X
 *   - CRM거장: 클릭 → 성공률 계산(사용 vs 성공) → TOP 스크립트 순위
 *   - TS아키텍트: 별도 테이블 없이 기존 AuditLog 재사용(스키마 변경 금지)
 *
 *  저장 정보(AuditLog): action=TOOL_CLICK, resourceType=PlaybookScript,
 *    resourceId=scriptId, purpose=situation, reasonDescription=success|click
 *  → contactId/phone 등 PII는 절대 저장하지 않음.
 *
 *  POST /api/tools/click-tracker  — 스크립트 클릭/성공 기록
 *  GET  /api/tools/click-tracker  — 성공률 + TOP 스크립트 순위 집계
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

const ACTION = "TOOL_CLICK";
const RESOURCE_TYPE = "PlaybookScript";

type ClickEvent = "click" | "success";

/**
 * POST: 스크립트 클릭 또는 성공 기록 (미니멀 로깅)
 * Body: { scriptId: string, event?: "click" | "success", situation?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    // FREE_SALES는 고객 DB 접근 불가 → 도구 클릭 추적도 차단
    if (ctx.role === "FREE_SALES") {
      return NextResponse.json(
        { ok: false, message: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const scriptId = typeof body?.scriptId === "string" ? body.scriptId : "";
    const event: ClickEvent = body?.event === "success" ? "success" : "click";
    const situation =
      typeof body?.situation === "string"
        ? body.situation.slice(0, 100)
        : undefined;

    if (!scriptId) {
      return NextResponse.json(
        { ok: false, message: "scriptId는 필수입니다." },
        { status: 400 }
      );
    }

    // 미니멀 로깅: PII 없음. 누가(userId), 무엇을(scriptId), 결과(event)만.
    await prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: ACTION,
        resourceType: RESOURCE_TYPE,
        resourceId: scriptId,
        status: "SUCCESS",
        purpose: situation, // 상황 코드(PRICE_OBJECTION 등) — PII 아님
        reasonDescription: event, // "click" | "success"
        piiFieldsAccessed: [],
      },
    });

    return NextResponse.json({ ok: true, scriptId, event });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    logger.error("[POST /api/tools/click-tracker]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * GET: 성공률 + TOP 스크립트 순위 집계
 * Query: ?limit=10
 * 권한: 본인(userId) 집계만. GLOBAL_ADMIN/OWNER는 조직 전체 집계.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === "FREE_SALES") {
      return NextResponse.json(
        { ok: false, message: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limitRaw = parseInt(searchParams.get("limit") || "10", 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(50, Math.max(1, limitRaw))
      : 10;

    // 권한 범위: AGENT는 본인 기록만, OWNER/ADMIN은 조직 전체
    const scopeWhere =
      ctx.role === "AGENT"
        ? { userId: ctx.userId }
        : ctx.organizationId
          ? { organizationId: ctx.organizationId }
          : {};

    // 클릭(사용) vs 성공 집계 — resourceId(scriptId)별 groupBy
    const [clickGroups, successGroups] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ["resourceId"],
        where: {
          ...scopeWhere,
          action: ACTION,
          resourceType: RESOURCE_TYPE,
          reasonDescription: "click",
          resourceId: { not: null },
        },
        _count: { resourceId: true },
      }),
      prisma.auditLog.groupBy({
        by: ["resourceId"],
        where: {
          ...scopeWhere,
          action: ACTION,
          resourceType: RESOURCE_TYPE,
          reasonDescription: "success",
          resourceId: { not: null },
        },
        _count: { resourceId: true },
      }),
    ]);

    const successMap = new Map<string, number>();
    for (const g of successGroups) {
      if (g.resourceId) successMap.set(g.resourceId, g._count.resourceId);
    }

    // 사용된 스크립트 메타데이터 조회(제목 표시용)
    const scriptIds = clickGroups
      .map((g) => g.resourceId)
      .filter((id): id is string => Boolean(id));

    const scripts = scriptIds.length
      ? await prisma.salesPlaybook.findMany({
          where: { id: { in: scriptIds } },
          select: { id: true, title: true, type: true },
        })
      : [];
    const scriptMeta = new Map(scripts.map((s) => [s.id, s]));

    const ranking = clickGroups
      .map((g) => {
        const id = g.resourceId as string;
        const usageCount = g._count.resourceId;
        const successCount = successMap.get(id) || 0;
        const successRate =
          usageCount > 0 ? Math.round((successCount / usageCount) * 100) : 0;
        const meta = scriptMeta.get(id);
        return {
          scriptId: id,
          title: meta?.title || "(삭제된 스크립트)",
          type: meta?.type || "unknown",
          usageCount,
          successCount,
          successRate, // 0-100
        };
      })
      // TOP 정렬: 성공률 우선, 동률이면 사용량
      .sort((a, b) => b.successRate - a.successRate || b.usageCount - a.usageCount)
      .slice(0, limit);

    const totalClicks = clickGroups.reduce(
      (sum, g) => sum + g._count.resourceId,
      0
    );
    const totalSuccess = successGroups.reduce(
      (sum, g) => sum + g._count.resourceId,
      0
    );

    return NextResponse.json({
      ok: true,
      scope: ctx.role === "AGENT" ? "self" : "organization",
      summary: {
        totalClicks,
        totalSuccess,
        overallSuccessRate:
          totalClicks > 0 ? Math.round((totalSuccess / totalClicks) * 100) : 0,
        uniqueScripts: clickGroups.length,
      },
      ranking,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    logger.error("[GET /api/tools/click-tracker]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
