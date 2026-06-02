/**
 * ToolClickTracker API
 * @date 2026-06-03
 * @description
 *  거장단 토론 결론(Phase 1-2) 반영:
 *   - 보안전문가: 미니멀 로깅(개인정보 NO), Manager 자기 Contact만, 재시도 X
 *   - CRM거장: 클릭 → 성공률 계산(사용 vs 성공) → TOP 스크립트 순위
 *   - TS아키텍트: 별도 테이블 없이 기존 AuditLog 재사용(스키마 변경 금지)
 *
 *  저장 정보(AuditLog): action=TOOL_CLICK, resourceType=PlaybookScript,
 *    resourceId=scriptId, purpose=situation, reasonDescription=event, durationMs=통화시간
 *  → contactId/phone/email/name 등 PII는 절대 저장하지 않음.
 *
 *  Task 5 요구사항:
 *  - POST /api/tools/click-tracker — 스크립트 클릭/사용/성공 기록 (durationMs 선택)
 *  - GET  /api/tools/click-tracker/stats?scriptId=...&days=7 — 성공률 + 통계
 *  - 권한: AGENT/FREE_SALES는 본인 기록만, MANAGER는 팀 기록, ADMIN/OWNER는 전체
 *  - 감사로그: AuditLog에 기록 (PII 0)
 *  - 에러: 401(인증실패), 403(권한부족), 400(검증실패), 500(서버에러)
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

const ACTION = "TOOL_CLICK";
const RESOURCE_TYPE = "PlaybookScript";

// CallSituation 타입 정의 (src/lib/playbook/call-situations.ts 참고)
type CallSituation =
  | "PRICE_OBJECTION"
  | "HEALTH_CONCERN"
  | "REFUND_REQUEST"
  | "COMPLAINT"
  | "FOOD_CONSULTATION"
  | "UPSELL"
  | "REBOOKING"
  | "CONTRACT_RENEWAL";

type ClickEvent = "click" | "use" | "success";

/**
 * POST /api/tools/click-tracker
 * 스크립트 클릭/사용/성공 기록 (미니멀 로깅, PII 제로)
 *
 * Body: {
 *   scriptId: string (필수)
 *   event: "click" | "use" | "success" (선택, 기본값: "click")
 *   situation?: CallSituation (선택: PRICE_OBJECTION, HEALTH_CONCERN 등)
 *   durationMs?: number (선택: 통화 시간 ms)
 * }
 *
 * Response: { success: true, trackId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    // FREE_SALES는 도구 사용 추적 불가
    if (ctx.role === "FREE_SALES") {
      logger.warn("[POST /api/tools/click-tracker] FREE_SALES access denied", {
        userId: ctx.userId,
      });
      return NextResponse.json(
        { success: false, error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const body = await req.json();

    // 필수 검증: scriptId
    const scriptId = typeof body?.scriptId === "string" ? body.scriptId.trim() : "";
    if (!scriptId) {
      return NextResponse.json(
        { success: false, error: "scriptId는 필수입니다." },
        { status: 400 }
      );
    }

    // 선택 항목 검증
    const eventRaw = body?.event || "click";
    if (!["click", "use", "success"].includes(eventRaw)) {
      return NextResponse.json(
        { success: false, error: "event는 click|use|success 중 하나여야 합니다." },
        { status: 400 }
      );
    }
    const event: ClickEvent = eventRaw as ClickEvent;

    let situation: string | undefined;
    if (body?.situation) {
      if (typeof body.situation !== "string") {
        return NextResponse.json(
          { success: false, error: "situation은 문자열이어야 합니다." },
          { status: 400 }
        );
      }
      situation = body.situation.slice(0, 100);
    }

    let durationMs: number | undefined;
    if (body?.durationMs !== undefined) {
      const parsed = Number(body.durationMs);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return NextResponse.json(
          { success: false, error: "durationMs는 0 이상의 정수여야 합니다." },
          { status: 400 }
        );
      }
      durationMs = Math.floor(parsed);
    }

    // 미니멀 로깅: PII 없음. 누가(userId), 무엇을(scriptId), 결과(event)만.
    const auditLog = await prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: ACTION,
        resourceType: RESOURCE_TYPE,
        resourceId: scriptId,
        status: "SUCCESS",
        purpose: situation, // 상황 코드(PRICE_OBJECTION 등) — PII 아님
        reasonDescription: event, // "click" | "use" | "success"
        durationMs, // 통화 시간 (선택)
        piiFieldsAccessed: [], // PII 제로 정책
      },
    });

    logger.info("[POST /api/tools/click-tracker] Success", {
      userId: ctx.userId,
      scriptId,
      event,
      situation,
      trackId: auditLog.id.toString(),
    });

    return NextResponse.json({
      success: true,
      trackId: auditLog.id.toString(),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다." },
        { status: 401 }
      );
    }
    logger.error("[POST /api/tools/click-tracker]", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tools/click-tracker/stats?scriptId=...&days=7
 * 성공률 + 순위 + 통계 조회
 *
 * Query Parameters:
 *   scriptId?: string (특정 스크립트만 조회, 생략 시 전체 TOP 순위)
 *   days?: number (기본 7, 범위 1-365)
 *
 * Response: {
 *   success: true,
 *   scriptId?: string (단일 조회 시)
 *   usageCount: number,
 *   successCount: number,
 *   successRate: number (0-100),
 *   ranking: number (상위 N등),
 *   topScripts: [ { scriptId, title, type, successRate, usageCount } ]
 * }
 *
 * 권한:
 *   - AGENT/FREE_SALES: 본인 userId 기록만 조회
 *   - MANAGER: 팀 userId 기록 조회 (TODO: 팀 정보 추가 시)
 *   - ADMIN/OWNER: 조직 전체 조회
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role === "FREE_SALES") {
      logger.warn("[GET /api/tools/click-tracker/stats] FREE_SALES access denied", {
        userId: ctx.userId,
      });
      return NextResponse.json(
        { success: false, error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const scriptId = searchParams.get("scriptId") || undefined;
    const daysRaw = parseInt(searchParams.get("days") || "7", 10);
    const days = Number.isFinite(daysRaw)
      ? Math.min(365, Math.max(1, daysRaw))
      : 7;

    // 기간 필터
    const since = new Date();
    since.setDate(since.getDate() - days);

    // 권한 범위: AGENT/FREE_SALES는 본인, MANAGER는 팀(TODO), ADMIN/OWNER는 조직 전체
    const scopeWhere: Record<string, unknown> = {
      organizationId: ctx.organizationId,
      createdAt: { gte: since },
      action: ACTION,
      resourceType: RESOURCE_TYPE,
      resourceId: { not: null },
    };

    if (ctx.role === "AGENT") {
      (scopeWhere as Record<string, unknown>).userId = ctx.userId;
    }

    // 단일 스크립트 조회 vs 전체 TOP 순위
    if (scriptId) {
      // === 단일 스크립트 상세 조회 ===
      const whereClause = {
        ...scopeWhere,
        resourceId: scriptId,
      };

      const [useGroups, successGroups] = await Promise.all([
        prisma.auditLog.groupBy({
          by: ["reasonDescription"],
          where: whereClause,
          _count: { id: true },
        }),
        prisma.auditLog.count({
          where: {
            ...whereClause,
            reasonDescription: "success",
          },
        }),
      ]);

      const useCount = useGroups.reduce((sum, g) => sum + g._count.id, 0);
      const successCount = successGroups;
      const successRate =
        useCount > 0 ? Math.round((successCount / useCount) * 100) : 0;

      // 스크립트 메타
      const script = await prisma.salesPlaybook.findUnique({
        where: { id: scriptId },
        select: { id: true, title: true, type: true },
      });

      // 전체 스크립트 중 순위 계산
      const allScriptRankings = await prisma.auditLog.groupBy({
        by: ["resourceId"],
        where: scopeWhere,
        _count: { id: true },
      });

      const rankings = allScriptRankings
        .map((g) => {
          const id = g.resourceId!;
          const count = g._count.id;
          return { scriptId: id, successCount: count };
        })
        .sort((a, b) => b.successCount - a.successCount);

      const ranking =
        rankings.findIndex((r) => r.scriptId === scriptId) + 1 || 0;

      return NextResponse.json({
        success: true,
        scriptId,
        title: script?.title || "(삭제된 스크립트)",
        type: script?.type || "unknown",
        usageCount: useCount,
        successCount,
        successRate,
        ranking,
        scope: ctx.role === "AGENT" ? "self" : "organization",
        period: { days, since: since.toISOString() },
      });
    } else {
      // === 전체 TOP 스크립트 순위 ===
      const limit = Math.min(
        50,
        Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
      );

      // 전체 사용 통계
      const useGroups = await prisma.auditLog.groupBy({
        by: ["resourceId"],
        where: scopeWhere,
        _count: { id: true },
      });

      const resourceIds = useGroups
        .map((g) => g.resourceId)
        .filter((id): id is string => Boolean(id));

      // 성공 통계
      const successGroups = await prisma.auditLog.groupBy({
        by: ["resourceId"],
        where: {
          ...scopeWhere,
          reasonDescription: "success",
        },
        _count: { id: true },
      });

      const successMap = new Map<string, number>();
      for (const g of successGroups) {
        if (g.resourceId) successMap.set(g.resourceId, g._count.id);
      }

      // 스크립트 메타
      const scripts = resourceIds.length
        ? await prisma.salesPlaybook.findMany({
            where: { id: { in: resourceIds } },
            select: { id: true, title: true, type: true },
          })
        : [];
      const scriptMeta = new Map<string, typeof scripts[number]>(
        scripts.map((s) => [s.id, s])
      );

      // 순위 계산
      const ranking = useGroups
        .map((g) => {
          const id = g.resourceId as string;
          const usageCount = g._count.id;
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
            successRate,
          };
        })
        .sort((a, b) => b.successRate - a.successRate || b.usageCount - a.usageCount)
        .slice(0, limit);

      const totalUse = useGroups.reduce((sum, g) => sum + g._count.id, 0);
      const totalSuccess = successGroups.reduce(
        (sum, g) => sum + g._count.id,
        0
      );

      logger.info("[GET /api/tools/click-tracker/stats] Success", {
        userId: ctx.userId,
        scope: ctx.role === "AGENT" ? "self" : "organization",
        days,
        topCount: ranking.length,
      });

      return NextResponse.json({
        success: true,
        scope: ctx.role === "AGENT" ? "self" : "organization",
        summary: {
          totalUsage: totalUse,
          totalSuccess,
          overallSuccessRate:
            totalUse > 0 ? Math.round((totalSuccess / totalUse) * 100) : 0,
          uniqueScripts: useGroups.length,
        },
        topScripts: ranking,
        period: { days, since: since.toISOString() },
      });
    }
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다." },
        { status: 401 }
      );
    }
    logger.error("[GET /api/tools/click-tracker/stats]", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
