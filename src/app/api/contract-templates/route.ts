import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, canManageSettings } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { createContractTemplateSchema } from "@/lib/validations/contract-templates";
import { ZodError } from "zod";

// GET /api/contract-templates - 조직별 계약 템플릿 목록 조회 (페이지네이션)
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));
    const status = searchParams.get("status");
    const category = searchParams.get("category");

    const skip = (page - 1) * limit;

    // 쿼리 조건 구성
    const where: {
      organizationId: string;
      status?: string;
      category?: string;
    } = {
      organizationId: orgId,
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
    };

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

    // Zod 스키마로 검증
    const validatedData = createContractTemplateSchema.parse(body);

    // 계약 템플릿 생성
    const template = await prisma.contractTemplate.create({
      data: {
        organizationId: orgId,
        name: validatedData.name.trim(),
        category: validatedData.category,
        description: validatedData.description?.trim() || null,
        htmlContent: validatedData.htmlContent || null,
        jsonContent: body.jsonContent || null,
        visibility: validatedData.visibility,
        createdByUserId: ctx.userId,
        fieldMapping: validatedData.fieldMapping || {},
        psychologyLenses: validatedData.psychologyLenses,
        smsDay0TemplateId: validatedData.smsDay0TemplateId || null,
        smsDay1TemplateId: validatedData.smsDay1TemplateId || null,
        smsDay2TemplateId: validatedData.smsDay2TemplateId || null,
        smsDay3TemplateId: validatedData.smsDay3TemplateId || null,
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

    // Zod 검증 에러
    if (err instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid input data", details: err.errors },
        { status: 400 }
      );
    }

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
