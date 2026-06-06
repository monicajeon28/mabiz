import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/partners/[id]/contracts - 대리점의 적용된 계약서 조회
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const partnerId = params.id;

    // 권한 확인: 해당 대리점 관리 가능 여부
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { organizationId: true },
    });

    if (!partner || partner.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Partner not found or unauthorized" },
        { status: 404 }
      );
    }

    // 대리점의 적용된 계약서 조회
    const contracts = await prisma.partnerContract.findMany({
      where: {
        partnerId,
        organizationId: orgId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            psychologyLenses: true,
          },
        },
        sections: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { appliedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: contracts,
    });
  } catch (error) {
    logger.error("Failed to fetch partner contracts", {
      error,
      partnerId: params.id,
    });
    return NextResponse.json(
      { error: "Failed to fetch contracts" },
      { status: 500 }
    );
  }
}

// POST /api/partners/[id]/contracts - 템플릿을 대리점에 적용
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const partnerId = params.id;
    const body = await req.json();
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required" },
        { status: 400 }
      );
    }

    // 권한 확인
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { organizationId: true },
    });

    if (!partner || partner.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Partner not found or unauthorized" },
        { status: 404 }
      );
    }

    // 템플릿 확인
    const template = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        htmlContent: true,
        jsonContent: true,
        fieldMapping: true,
        psychologyLenses: true,
      },
    });

    if (!template || template.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Template not found or unauthorized" },
        { status: 404 }
      );
    }

    // 기존 계약서 확인
    const existingContract = await prisma.partnerContract.findUnique({
      where: {
        partnerId_templateId: {
          partnerId,
          templateId,
        },
      },
    });

    if (existingContract) {
      return NextResponse.json(
        { error: "This template is already applied to this partner" },
        { status: 409 }
      );
    }

    // 트랜잭션으로 계약서 생성 + 섹션 복사
    const contract = await prisma.$transaction(async (tx) => {
      // 1. 계약서 생성
      const newContract = await tx.partnerContract.create({
        data: {
          organizationId: orgId,
          partnerId,
          templateId,
          htmlContent: template.htmlContent || "",
          jsonContent: template.jsonContent ?? undefined,
          fieldMapping: template.fieldMapping ?? {},
          psychologyLenses: template.psychologyLenses || [],
          status: "active",
        },
      });

      // 2. 템플릿에서 섹션 조회 (ContractTemplate은 직접 섹션을 가지지 않음)
      // → 대신 htmlContent를 기반으로 기본 섹션 생성
      await tx.partnerContractSection.create({
        data: {
          contractId: newContract.id,
          title: "계약서",
          content: template.htmlContent || "",
          order: 0,
        },
      });

      return newContract;
    });

    // 사용 통계 업데이트
    await prisma.contractTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    logger.error("Failed to apply contract template to partner", {
      error,
      partnerId: params.id,
    });
    return NextResponse.json(
      { error: "Failed to apply template" },
      { status: 500 }
    );
  }
}
