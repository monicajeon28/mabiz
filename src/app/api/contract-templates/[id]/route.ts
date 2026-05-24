import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import {
  updateContractTemplateSchema,
} from "@/lib/validations/contract-templates";
import { ContractTemplateResponse, ApiResponse } from "@/lib/types/contract-templates";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/contract-templates/[id]
 * 템플릿 상세 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { organizationId } = authContext;
    const { id } = params;

    const template = await prisma.contractTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, error: "템플릿을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인
    if (template.organizationId !== organizationId) {
      return NextResponse.json(
        { ok: false, error: "접근 권한이 없습니다" },
        { status: 403 }
      );
    }

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
        lastUsedAt: template.lastUsedAt?.toISOString() || null,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[GET /api/contract-templates/[id]] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/contract-templates/[id]
 * 템플릿 수정
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { organizationId } = authContext;
    const { id } = params;

    const template = await prisma.contractTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, error: "템플릿을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인
    if (template.organizationId !== organizationId) {
      return NextResponse.json(
        { ok: false, error: "접근 권한이 없습니다" },
        { status: 403 }
      );
    }

    // 시스템 템플릿 수정 불가
    if (template.isSystemTemplate) {
      return NextResponse.json(
        { ok: false, error: "시스템 템플릿은 수정할 수 없습니다" },
        { status: 400 }
      );
    }

    const body = await request.json();

    // 입력 검증
    const validatedData = updateContractTemplateSchema.parse(body);

    // 이름 변경 시 중복 확인
    if (validatedData.name && validatedData.name !== template.name) {
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
    }

    // 템플릿 수정 및 버전 증가
    const updatedTemplate = await prisma.contractTemplate.update({
      where: { id },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.description !== undefined && {
          description: validatedData.description,
        }),
        ...(validatedData.category && { category: validatedData.category }),
        ...(validatedData.htmlContent && {
          htmlContent: validatedData.htmlContent,
        }),
        ...(validatedData.fieldMapping && {
          fieldMapping: validatedData.fieldMapping,
        }),
        ...(validatedData.psychologyLenses && {
          psychologyLenses: validatedData.psychologyLenses,
        }),
        ...(validatedData.smsDay0TemplateId !== undefined && {
          smsDay0TemplateId: validatedData.smsDay0TemplateId,
        }),
        ...(validatedData.smsDay1TemplateId !== undefined && {
          smsDay1TemplateId: validatedData.smsDay1TemplateId,
        }),
        ...(validatedData.smsDay2TemplateId !== undefined && {
          smsDay2TemplateId: validatedData.smsDay2TemplateId,
        }),
        ...(validatedData.smsDay3TemplateId !== undefined && {
          smsDay3TemplateId: validatedData.smsDay3TemplateId,
        }),
        ...(validatedData.visibility && {
          visibility: validatedData.visibility,
        }),
        ...(validatedData.status && { status: validatedData.status }),
        version: template.version + 1,
      },
    });

    const response: ApiResponse<ContractTemplateResponse> = {
      ok: true,
      data: {
        id: updatedTemplate.id,
        name: updatedTemplate.name,
        description: updatedTemplate.description,
        category: updatedTemplate.category,
        htmlContent: updatedTemplate.htmlContent,
        fieldMapping: updatedTemplate.fieldMapping as Record<string, any>,
        psychologyLenses: updatedTemplate.psychologyLenses,
        smsDay0TemplateId: updatedTemplate.smsDay0TemplateId,
        smsDay1TemplateId: updatedTemplate.smsDay1TemplateId,
        smsDay2TemplateId: updatedTemplate.smsDay2TemplateId,
        smsDay3TemplateId: updatedTemplate.smsDay3TemplateId,
        visibility: updatedTemplate.visibility,
        status: updatedTemplate.status,
        version: updatedTemplate.version,
        isSystemTemplate: updatedTemplate.isSystemTemplate,
        usageCount: updatedTemplate.usageCount,
        lastUsedAt: updatedTemplate.lastUsedAt?.toISOString() || null,
        createdAt: updatedTemplate.createdAt.toISOString(),
        updatedAt: updatedTemplate.updatedAt.toISOString(),
      },
      message: "템플릿이 성공적으로 수정되었습니다",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[PATCH /api/contract-templates/[id]] Error:", error);
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

/**
 * DELETE /api/contract-templates/[id]
 * 템플릿 삭제 (논리적 또는 물리적)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { organizationId } = authContext;
    const { id } = params;

    const template = await prisma.contractTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, error: "템플릿을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인
    if (template.organizationId !== organizationId) {
      return NextResponse.json(
        { ok: false, error: "접근 권한이 없습니다" },
        { status: 403 }
      );
    }

    // 시스템 템플릿 삭제 불가
    if (template.isSystemTemplate) {
      return NextResponse.json(
        { ok: false, error: "시스템 템플릿은 삭제할 수 없습니다" },
        { status: 400 }
      );
    }

    // 사용 중인 템플릿의 경우 논리적 삭제 (ARCHIVED)
    if (template.usageCount > 0) {
      await prisma.contractTemplate.update({
        where: { id },
        data: { status: "ARCHIVED" },
      });

      const response: ApiResponse<null> = {
        ok: true,
        message: `템플릿이 보관되었습니다 (${template.usageCount}개의 계약서가 사용 중입니다)`,
      };

      return NextResponse.json(response);
    }

    // 사용하지 않는 템플릿의 경우 물리적 삭제
    await prisma.contractTemplate.delete({
      where: { id },
    });

    const response: ApiResponse<null> = {
      ok: true,
      message: "템플릿이 성공적으로 삭제되었습니다",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[DELETE /api/contract-templates/[id]] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
