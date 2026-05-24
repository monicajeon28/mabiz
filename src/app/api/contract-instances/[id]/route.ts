import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { ApiResponse } from "@/lib/types/contract-templates";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 시간 남은 표시
 */
function getTimeRemaining(expiresAt: Date | null): string {
  if (!expiresAt) return "무제한";

  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();

  if (diff <= 0) return "시간초과";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  return `${minutes}분`;
}

/**
 * GET /api/contract-instances/[id]
 * 계약서 인스턴스 상세 조회
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
    const { id } = await params;

    const instance = await prisma.contractInstance.findUnique({
      where: { id },
      include: {
        template: {
          select: { name: true },
        },
        contact: {
          select: { name: true },
        },
      },
    });

    if (!instance) {
      return NextResponse.json(
        { ok: false, error: "계약서를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인
    if (instance.organizationId !== organizationId) {
      return NextResponse.json(
        { ok: false, error: "접근 권한이 없습니다" },
        { status: 403 }
      );
    }

    const response: ApiResponse<any> = {
      ok: true,
      data: {
        id: instance.id,
        templateId: instance.templateId,
        templateName: instance.template.name,
        contactId: instance.contactId,
        contactName: instance.contact?.name || null,
        status: instance.status,
        boundData: instance.boundData,
        appliedLenses: instance.appliedLenses,
        expiresAt: instance.expiresAt?.toISOString() || null,
        timeRemaining: getTimeRemaining(instance.expiresAt),
        smsStatus: {
          day0Sent: instance.smsDay0Sent,
          day0SentAt: instance.smsDay0SentAt?.toISOString() || null,
          day1Sent: instance.smsDay1Sent,
          day1SentAt: instance.smsDay1SentAt?.toISOString() || null,
          day2Sent: instance.smsDay2Sent,
          day2SentAt: instance.smsDay2SentAt?.toISOString() || null,
          day3Sent: instance.smsDay3Sent,
          day3SentAt: instance.smsDay3SentAt?.toISOString() || null,
        },
        signedAt: instance.signedAt?.toISOString() || null,
        createdAt: instance.createdAt.toISOString(),
        updatedAt: instance.updatedAt.toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[GET /api/contract-instances/[id]] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/contract-instances/[id]
 * 계약서 인스턴스 상태 업데이트
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
    const { id } = await params;

    const instance = await prisma.contractInstance.findUnique({
      where: { id },
      include: {
        template: { select: { name: true } },
        contact: { select: { name: true } },
      },
    });

    if (!instance) {
      return NextResponse.json(
        { ok: false, error: "계약서를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인
    if (instance.organizationId !== organizationId) {
      return NextResponse.json(
        { ok: false, error: "접근 권한이 없습니다" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status } = body;

    // 상태 유효성 확인
    const validStatuses = ["DRAFT", "SENT", "SIGNED", "COMPLETED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { ok: false, error: "유효하지 않은 상태입니다" },
        { status: 400 }
      );
    }

    // 인스턴스 업데이트
    const updatedInstance = await prisma.contractInstance.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(status === "SIGNED" && {
          signedAt: new Date(),
        }),
      },
      include: {
        template: { select: { name: true } },
        contact: { select: { name: true } },
      },
    });

    const response: ApiResponse<any> = {
      ok: true,
      data: {
        id: updatedInstance.id,
        templateId: updatedInstance.templateId,
        templateName: updatedInstance.template.name,
        contactId: updatedInstance.contactId,
        contactName: updatedInstance.contact?.name || null,
        status: updatedInstance.status,
        expiresAt: updatedInstance.expiresAt?.toISOString() || null,
        timeRemaining: getTimeRemaining(updatedInstance.expiresAt),
        signedAt: updatedInstance.signedAt?.toISOString() || null,
        createdAt: updatedInstance.createdAt.toISOString(),
        updatedAt: updatedInstance.updatedAt.toISOString(),
      },
      message: "계약서 상태가 업데이트되었습니다",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[PATCH /api/contract-instances/[id]] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
