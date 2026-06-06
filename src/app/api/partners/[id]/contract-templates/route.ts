import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/partners/[id]/contract-templates - 대리점에 적용 가능한 템플릿 목록
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const partnerId = params.id;

    // 권한 확인: 대리점 존재 여부
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

    // 1. 현재 대리점이 적용한 템플릿 조회
    const appliedTemplateIds = await prisma.partnerContract.findMany({
      where: {
        partnerId,
        organizationId: orgId,
      },
      select: {
        templateId: true,
      },
    });

    const appliedIds = appliedTemplateIds.map((pc) => pc.templateId);

    // 2. 적용 가능한 템플릿 조회 (모든 활성 템플릿 + 해당 대리점 특정 템플릿)
    const availableTemplates = await prisma.contractTemplate.findMany({
      where: {
        organizationId: orgId,
        status: "ACTIVE",
      },
      include: {
        // 이 템플릿의 적용 대상 확인
        applicableEntities: {
          select: {
            entityType: true,
            partnerId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 3. 각 템플릿이 현재 대리점에서 사용 가능한지 필터링
    const filtered = availableTemplates.filter((template) => {
      // 적용 대상이 정의되지 않은 경우 → 모든 대리점에 사용 가능
      if (template.applicableEntities.length === 0) {
        return true;
      }

      // 적용 대상이 정의된 경우 → 현재 대리점이 포함되어 있는지 확인
      return template.applicableEntities.some((entity) => {
        // 모든 대리점에 적용 (partnerId = null)
        if (entity.partnerId === null) {
          return true;
        }
        // 현재 대리점에만 적용
        return entity.partnerId === partnerId;
      });
    });

    // 4. 응답 포맷
    const response = filtered.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      psychologyLenses: template.psychologyLenses,
      usageCount: template.usageCount,
      lastUsedAt: template.lastUsedAt,
      isApplied: appliedIds.includes(template.id),
    }));

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error("Failed to fetch available contract templates", {
      error,
      partnerId: params.id,
    });
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}
