import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import {
  createContractTemplateSchema,
  listContractTemplatesQuerySchema,
} from "@/lib/validations/contract-templates";
import { ContractTemplateResponse, ApiResponse } from "@/lib/types/contract-templates";

/**
 * GET /api/contract-templates
 * 계약서 템플릿 목록 조회 + 필터
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { organizationId } = authContext;

    // 쿼리 파라미터 파싱
    const searchParams = request.nextUrl.searchParams;
    const queryData = {
      category: searchParams.get("category") || undefined,
      status: searchParams.get("status") || undefined,
      lens: searchParams.get("lens") || undefined,
      sort: searchParams.get("sort") || "recent",
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!)
        : 20,
    };

    const validatedQuery = listContractTemplatesQuerySchema.parse(queryData);
    const { category, status, lens, sort, page, limit } = validatedQuery;

    // 필터 조건 구성
    const where: any = {
      organizationId,
    };

    if (category) where.category = category;
    if (status) where.status = status;
    if (lens) {
      where.psychologyLenses = {
        has: lens,
      };
    }

    // 정렬 조건 구성
    let orderBy: any = { createdAt: "desc" };
    if (sort === "mostUsed") {
      orderBy = { usageCount: "desc" };
    } else if (sort === "alphabetical") {
      orderBy = { name: "asc" };
    }

    // 페이지네이션
    const skip = (page - 1) * limit;

    // 데이터 조회
    const [templates, totalCount] = await Promise.all([
      prisma.contractTemplate.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.contractTemplate.count({ where }),
    ]);

    // 응답 포맷팅
    const response: ApiResponse<ContractTemplateResponse[]> = {
      ok: true,
      data: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        psychologyLenses: t.psychologyLenses,
        usageCount: t.usageCount,
        lastUsedAt: t.lastUsedAt?.toISOString() || null,
        status: t.status,
        visibility: t.visibility,
        isSystemTemplate: t.isSystemTemplate,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      message: `총 ${totalCount}개 템플릿 조회됨 (페이지 ${page}/${Math.ceil(totalCount / limit)})`,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[GET /api/contract-templates] Error:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { ok: false, error: "Invalid query parameters" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contract-templates
 * 새 템플릿 생성
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { organizationId, userId } = authContext;

    const body = await request.json();

    // 입력 검증
    const validatedData = createContractTemplateSchema.parse(body);

    // isSystemTemplate는 시스템만 설정 가능 (요청에서 받지 않음)
    // 관리자 체크를 추가하려면 여기서 role 확인

    // 같은 이름의 템플릿 존재 확인
    const existingTemplate = await prisma.contractTemplate.findFirst({
      where: {
        organizationId,
        name: validatedData.name,
      },
    });

    if (existingTemplate) {
      return NextResponse.json(
        { ok: false, error: "템플릿명이 이미 존재합니다" },
        { status: 400 }
      );
    }

    // 템플릿 생성
    const template = await prisma.contractTemplate.create({
      data: {
        organizationId,
        name: validatedData.name,
        description: validatedData.description,
        category: validatedData.category,
        htmlContent: validatedData.htmlContent,
        fieldMapping: validatedData.fieldMapping,
        psychologyLenses: validatedData.psychologyLenses,
        smsDay0TemplateId: validatedData.smsDay0TemplateId,
        smsDay1TemplateId: validatedData.smsDay1TemplateId,
        smsDay2TemplateId: validatedData.smsDay2TemplateId,
        smsDay3TemplateId: validatedData.smsDay3TemplateId,
        visibility: validatedData.visibility,
        status: validatedData.status,
        createdByUserId: userId,
      },
    });

    const response: ApiResponse<ContractTemplateResponse> = {
      ok: true,
      data: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        htmlContent: template.htmlContent,
        fieldMapping: template.fieldMapping as Record<string, any>,
        psychologyLenses: template.psychologyLenses,
        smsDay0TemplateId: template.smsDay0TemplateId,
        smsDay1TemplateId: template.smsDay1TemplateId,
        smsDay2TemplateId: template.smsDay2TemplateId,
        smsDay3TemplateId: template.smsDay3TemplateId,
        visibility: template.visibility,
        status: template.status,
        version: template.version,
        isSystemTemplate: template.isSystemTemplate,
        usageCount: template.usageCount,
        lastUsedAt: null,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
      message: "템플릿이 성공적으로 생성되었습니다",
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("[POST /api/contract-templates] Error:", error);
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { ok: false, error: "Invalid input data" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
