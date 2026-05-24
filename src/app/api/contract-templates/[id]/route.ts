import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { updateContractTemplateSchema } from "@/lib/validations/contract-templates";
import {
  logContractTemplateAudit,
  generateChangeDescription,
  maskSensitiveFields,
  canDeleteTemplate,
} from "@/lib/contract-templates-audit";

type Params = { params: Promise<{ id: string }> };

// GET /api/contract-templates/[id] - 특정 계약 템플릿 상세 조회
export async function GET(_req: Request, { params }: Params) {
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

    // 템플릿 조회
    const template = await prisma.contractTemplate.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        instances: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: template,
      },
      { status: 200 }
    );
  } catch (err) {
    logger.error("contract-templates GET [id] error:", err);
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

// PATCH /api/contract-templates/[id] - 계약 템플릿 수정
export async function PATCH(req: NextRequest, { params }: Params) {
  let previousValues: Record<string, any> | null = null;

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

    // 요청 본문 파싱
    const body = await req.json().catch(() => ({}));

    // 입력 검증
    const validatedData = updateContractTemplateSchema.parse(body);

    // 기존 템플릿 조회
    const template = await prisma.contractTemplate.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, error: "Template not found" },
        { status: 404 }
      );
    }

    // 시스템 템플릿 수정 불가
    if (template.isSystemTemplate) {
      await logContractTemplateAudit({
        organizationId: orgId,
        templateId: id,
        userId: ctx.userId,
        action: "UPDATE",
        request: req,
        error: new Error("Cannot update system template"),
      });

      return NextResponse.json(
        { ok: false, error: "System templates cannot be modified" },
        { status: 403 }
      );
    }

    // 이름 변경 시 중복 확인
    if (validatedData.name && validatedData.name !== template.name) {
      const existing = await prisma.contractTemplate.findFirst({
        where: {
          organizationId: orgId,
          name: validatedData.name,
          id: { not: id },
        },
      });

      if (existing) {
        await logContractTemplateAudit({
          organizationId: orgId,
          templateId: id,
          userId: ctx.userId,
          action: "UPDATE",
          request: req,
          error: new Error("Duplicate template name"),
        });

        return NextResponse.json(
          { ok: false, error: "Template name already exists" },
          { status: 400 }
        );
      }
    }

    // 변경값 저장 (감사 로그용)
    previousValues = maskSensitiveFields({
      name: template.name,
      description: template.description,
      category: template.category,
      status: template.status,
      visibility: template.visibility,
      psychologyLenses: template.psychologyLenses,
      version: template.version,
    });

    // 템플릿 업데이트
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

    // 변경값 마스킹 후 감사 로그
    const newValues = maskSensitiveFields({
      name: updatedTemplate.name,
      description: updatedTemplate.description,
      category: updatedTemplate.category,
      status: updatedTemplate.status,
      visibility: updatedTemplate.visibility,
      psychologyLenses: updatedTemplate.psychologyLenses,
      version: updatedTemplate.version,
    });

    const changeDescription = generateChangeDescription(
      previousValues!,
      newValues
    );

    await logContractTemplateAudit({
      organizationId: orgId,
      templateId: id,
      userId: ctx.userId,
      action: "UPDATE",
      previousValues,
      newValues,
      changeDescription,
      request: req,
    });

    logger.info(`Contract template updated: ${id} (v${updatedTemplate.version})`);

    return NextResponse.json(
      {
        ok: true,
        data: updatedTemplate,
        message: `Template updated successfully (v${updatedTemplate.version})`,
      },
      { status: 200 }
    );
  } catch (err) {
    logger.error("contract-templates PATCH [id] error:", err);

    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json(
        { ok: false, error: "Invalid input data" },
        { status: 400 }
      );
    }

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

// DELETE /api/contract-templates/[id] - 계약 템플릿 삭제
export async function DELETE(req: NextRequest, { params }: Params) {
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

    // 요청 본문 파싱 (삭제 사유 등)
    const body = await req.json().catch(() => ({}));
    const { reason } = body as { reason?: string };

    // 기존 템플릿 조회
    const template = await prisma.contractTemplate.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { ok: false, error: "Template not found" },
        { status: 404 }
      );
    }

    // 시스템 템플릿 삭제 불가
    if (template.isSystemTemplate) {
      await logContractTemplateAudit({
        organizationId: orgId,
        templateId: id,
        userId: ctx.userId,
        action: "DELETE",
        reason,
        request: req,
        error: new Error("Cannot delete system template"),
      });

      return NextResponse.json(
        { ok: false, error: "System templates cannot be deleted" },
        { status: 403 }
      );
    }

    // 사용 중인 인스턴스 확인
    const deleteCheck = await canDeleteTemplate(id);

    if (!deleteCheck.canDelete) {
      // 진행 중인 계약서가 있으면 ARCHIVED로 변경
      await prisma.contractTemplate.update({
        where: { id },
        data: { status: "ARCHIVED" },
      });

      await logContractTemplateAudit({
        organizationId: orgId,
        templateId: id,
        userId: ctx.userId,
        action: "ARCHIVE",
        changeDescription: `Archived due to active instances (${deleteCheck.activeInstanceCount})`,
        reason: reason || deleteCheck.reason,
        request: req,
      });

      logger.info(
        `Contract template archived (has ${deleteCheck.activeInstanceCount} active instances): ${id}`
      );

      return NextResponse.json(
        {
          ok: true,
          message: `Template archived: ${deleteCheck.reason}`,
        },
        { status: 200 }
      );
    }

    // 템플릿 물리 삭제
    await prisma.contractTemplate.delete({
      where: { id },
    });

    await logContractTemplateAudit({
      organizationId: orgId,
      templateId: id,
      userId: ctx.userId,
      action: "DELETE",
      previousValues: maskSensitiveFields({
        name: template.name,
        category: template.category,
        status: template.status,
      }),
      reason,
      request: req,
    });

    logger.info(`Contract template deleted: ${id}`);

    return NextResponse.json(
      {
        ok: true,
        message: "Template deleted successfully",
      },
      { status: 200 }
    );
  } catch (err) {
    logger.error("contract-templates DELETE [id] error:", err);

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
