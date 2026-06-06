import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/partners/[id]/contracts/[contractId] - 개별 계약서 조회
export async function GET(
  req: Request,
  { params }: { params: { id: string; contractId: string } }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const partnerId = params.id;
    const contractId = params.contractId;

    // 권한 확인
    const contract = await prisma.partnerContract.findUnique({
      where: { id: contractId },
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
    });

    if (
      !contract ||
      contract.organizationId !== orgId ||
      contract.partnerId !== partnerId
    ) {
      return NextResponse.json(
        { error: "Contract not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    logger.error("Failed to fetch contract", {
      error,
      contractId: params.contractId,
    });
    return NextResponse.json(
      { error: "Failed to fetch contract" },
      { status: 500 }
    );
  }
}

// PATCH /api/partners/[id]/contracts/[contractId] - 계약서 편집
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; contractId: string } }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const partnerId = params.id;
    const contractId = params.contractId;
    const body = await req.json();

    const { htmlContent, jsonContent, sections, status, fieldMapping } = body;

    // 권한 확인
    const contract = await prisma.partnerContract.findUnique({
      where: { id: contractId },
    });

    if (
      !contract ||
      contract.organizationId !== orgId ||
      contract.partnerId !== partnerId
    ) {
      return NextResponse.json(
        { error: "Contract not found or unauthorized" },
        { status: 404 }
      );
    }

    // 트랜잭션으로 계약서 업데이트
    const updated = await prisma.$transaction(async (tx) => {
      // 1. 계약서 메타데이터 업데이트
      const updatedContract = await tx.partnerContract.update({
        where: { id: contractId },
        data: {
          ...(htmlContent !== undefined && { htmlContent }),
          ...(jsonContent !== undefined && { jsonContent }),
          ...(status !== undefined && { status }),
          ...(fieldMapping !== undefined && { fieldMapping }),
        },
      });

      // 2. 섹션 업데이트 (있으면)
      if (sections && Array.isArray(sections)) {
        // 기존 섹션 삭제
        await tx.partnerContractSection.deleteMany({
          where: { contractId },
        });

        // 새 섹션 생성
        for (const section of sections) {
          await tx.partnerContractSection.create({
            data: {
              contractId,
              title: section.title,
              content: section.content || "",
              order: section.order || 0,
            },
          });
        }
      }

      return updatedContract;
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error("Failed to update contract", {
      error,
      contractId: params.contractId,
    });
    return NextResponse.json(
      { error: "Failed to update contract" },
      { status: 500 }
    );
  }
}

// DELETE /api/partners/[id]/contracts/[contractId] - 계약서 삭제
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; contractId: string } }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const partnerId = params.id;
    const contractId = params.contractId;

    // 권한 확인
    const contract = await prisma.partnerContract.findUnique({
      where: { id: contractId },
    });

    if (
      !contract ||
      contract.organizationId !== orgId ||
      contract.partnerId !== partnerId
    ) {
      return NextResponse.json(
        { error: "Contract not found or unauthorized" },
        { status: 404 }
      );
    }

    // 삭제
    await prisma.partnerContract.delete({
      where: { id: contractId },
    });

    return NextResponse.json({
      success: true,
      message: "Contract deleted successfully",
    });
  } catch (error) {
    logger.error("Failed to delete contract", {
      error,
      contractId: params.contractId,
    });
    return NextResponse.json(
      { error: "Failed to delete contract" },
      { status: 500 }
    );
  }
}
