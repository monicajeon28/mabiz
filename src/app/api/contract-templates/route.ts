import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, canManageSettings } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/contract-templates - 조직별 계약 템플릿 목록 조회 (페이지네이션)
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));
    const status = searchParams.get("status") ?? "ACTIVE";
    const category = searchParams.get("category");

    const skip = (page - 1) * limit;

    // 쿼리 조건 구성
    const where: any = {
      organizationId: orgId,
    };

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    // 병렬 조회: 목록 + 총 개수
    const [templates, total] = await Promise.all([
      prisma.contractTemplate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          visibility: true,
          status: true,
          version: true,
          usageCount: true,
          lastUsedAt: true,
          psychologyLenses: true,
          isSystemTemplate: true,
          createdAt: true,
          updatedAt: true,
          createdByUserId: true,
        },
      }),
      prisma.contractTemplate.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json(
      {
        ok: true,
        data: templates,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    logger.error("contract-templates GET error:", err instanceof Error ? err : new Error(String(err)));
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

// POST /api/contract-templates - 새로운 계약 템플릿 생성
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    // OWNER 이상만 템플릿 생성 가능
    if (!canManageSettings(ctx)) {
      return NextResponse.json(
        { ok: false, error: "Permission denied - OWNER role required" },
        { status: 403 }
      );
    }

    const body = await req.json();

    // 필수 필드 검증
    const { name, category, htmlContent, jsonContent, description, visibility } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid required field: name" },
        { status: 400 }
      );
    }

    if (!category || typeof category !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid required field: category" },
        { status: 400 }
      );
    }

    // 유효한 카테고리 확인
    const validCategories = ["CRUISE", "RENTAL", "HOTEL", "PACKAGE", "OTHER"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { ok: false, error: `Invalid category: ${category}` },
        { status: 400 }
      );
    }

    // 옵션 필드 검증
    const validVisibilities = ["ORGANIZATION", "MANAGER_ONLY", "PERSONAL"];
    const resolvedVisibility = visibility && validVisibilities.includes(visibility)
      ? visibility
      : "ORGANIZATION";

    // 계약 템플릿 생성
    const template = await prisma.contractTemplate.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        category,
        description: description?.trim() || null,
        htmlContent: htmlContent || null,
        jsonContent: jsonContent || null,
        visibility: resolvedVisibility,
        createdByUserId: ctx.userId,
        fieldMapping: body.fieldMapping || {},
        psychologyLenses: Array.isArray(body.psychologyLenses) ? body.psychologyLenses : [],
        smsDay0TemplateId: body.smsDay0TemplateId || null,
        smsDay1TemplateId: body.smsDay1TemplateId || null,
        smsDay2TemplateId: body.smsDay2TemplateId || null,
        smsDay3TemplateId: body.smsDay3TemplateId || null,
        status: "DRAFT",
        version: 1,
        isSystemTemplate: false,
      },
    });

    logger.info(
      `[ContractTemplate] Created template: ${template.id} by ${ctx.userId} in org ${orgId}`
    );

    return NextResponse.json(
      {
        ok: true,
        data: template,
      },
      { status: 201 }
    );
  } catch (err) {
    logger.error("contract-templates POST error:", err instanceof Error ? err : new Error(String(err)));
    if ((err as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if ((err as Error).message === "ORGANIZATION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "Organization required" }, { status: 400 });
    }
    if ((err as Error).message?.includes("JSON")) {
      return NextResponse.json({ ok: false, error: "Invalid JSON in request body" }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
