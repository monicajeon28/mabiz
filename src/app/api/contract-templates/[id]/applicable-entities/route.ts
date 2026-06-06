import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/contract-templates/[id]/applicable-entities - 템플릿 적용 대상 조회
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const templateId = params.id;

    // 템플릿 확인
    const template = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
      select: { organizationId: true },
    });

    if (!template || template.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Template not found or unauthorized" },
        { status: 404 }
      );
    }

    // 적용 대상 조회
    const applicableEntities = await prisma.contractApplicableEntity.findMany({
      where: {
        templateId,
        organizationId: orgId,
      },
      include: {
        partner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // 응답 포맷
    const hasSpecificPartners = applicableEntities.some((e) => e.entityType === "partner" && e.partnerId);
    const partners = hasSpecificPartners
      ? applicableEntities
          .filter((e) => e.entityType === "partner" && e.partnerId)
          .map((e) => ({
            id: e.id,
            partnerId: e.partnerId,
            partnerName: e.partner?.name || "Unknown",
          }))
      : [];

    return NextResponse.json({
      success: true,
      data: {
        applyToAll: applicableEntities.length === 0 || !hasSpecificPartners,
        applicablePartners: partners,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch applicable entities", {
      error,
      templateId: params.id,
    });
    return NextResponse.json(
      { error: "Failed to fetch applicable entities" },
      { status: 500 }
    );
  }
}

// PATCH /api/contract-templates/[id]/applicable-entities - 템플릿 적용 대상 변경
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const templateId = params.id;
    const body = await req.json();

    const { applyToAll, partnerIds } = body;

    if (typeof applyToAll !== "boolean") {
      return NextResponse.json(
        { error: "applyToAll must be a boolean" },
        { status: 400 }
      );
    }

    // 템플릿 확인
    const template = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
      select: { organizationId: true },
    });

    if (!template || template.organizationId !== orgId) {
      return NextResponse.json(
        { error: "Template not found or unauthorized" },
        { status: 404 }
      );
    }

    // 트랜잭션으로 적용 대상 변경
    const result = await prisma.$transaction(async (tx) => {
      // 1. 기존 적용 대상 삭제
      await tx.contractApplicableEntity.deleteMany({
        where: {
          templateId,
          organizationId: orgId,
        },
      });

      // 2. 새로운 적용 대상 설정
      if (!applyToAll && partnerIds && Array.isArray(partnerIds) && partnerIds.length > 0) {
        // 파트너 존재 여부 확인
        const partners = await tx.partner.findMany({
          where: {
            id: { in: partnerIds },
            organizationId: orgId,
          },
          select: { id: true },
        });

        if (partners.length !== partnerIds.length) {
          throw new Error("One or more partners not found");
        }

        // 적용 대상 생성
        await tx.contractApplicableEntity.createMany({
          data: partnerIds.map((partnerId: string) => ({
            templateId,
            organizationId: orgId,
            entityType: "partner",
            partnerId,
          })),
        });
      }

      return {
        applyToAll,
        partnerCount: applyToAll ? 0 : (partnerIds?.length || 0),
      };
    });

    logger.info("Contract template applicable entities updated", {
      templateId,
      organizationId: orgId,
      applyToAll: result.applyToAll,
      partnerCount: result.partnerCount,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: "Applicable entities updated successfully",
        applyToAll: result.applyToAll,
        partnerCount: result.partnerCount,
      },
    });
  } catch (error) {
    logger.error("Failed to update applicable entities", {
      error,
      templateId: params.id,
    });

    if (error instanceof Error && error.message === "One or more partners not found") {
      return NextResponse.json(
        { error: "One or more partners not found" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update applicable entities" },
      { status: 500 }
    );
  }
}
