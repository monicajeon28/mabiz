import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/contract-templates/[id]/audit-logs
 * 특정 템플릿의 감사 로그 조회
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // ID 검증
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { ok: false, error: "Invalid template ID" },
        { status: 400 }
      );
    }

    // 쿼리 파라미터
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const action = searchParams.get("action") || undefined;

    // 템플릿 존재 확인 (권한도 함께 확인)
    const template = await prisma.contractTemplate.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
      select: { id: true },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, error: "Template not found" },
        { status: 404 }
      );
    }

    // 페이지네이션
    const skip = (page - 1) * limit;

    // 감사 로그 조회
    const [logs, totalCount] = await Promise.all([
      prisma.contractTemplateAuditLog.findMany({
        where: {
          organizationId: orgId,
          templateId: id,
          ...(action && { action }),
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contractTemplateAuditLog.count({
        where: {
          organizationId: orgId,
          templateId: id,
          ...(action && { action }),
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json(
      {
        ok: true,
        data: logs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
        },
        message: `Retrieved ${logs.length} audit logs (page ${page}/${totalPages})`,
      },
      { status: 200 }
    );
  } catch (err) {
    logger.error("contract-templates audit-logs GET error:", err);

    if ((err as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if ((err as Error).message === "ORGANIZATION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "Organization required" }, { status: 400 });
    }

    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
