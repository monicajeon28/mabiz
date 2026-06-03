import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { ApiResponse } from "@/lib/types/contract-templates";
import { logger } from "@/lib/logger";

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
    const authContext = await getMabizSession();
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
    logger.error("[GET /api/contract-instances/[id]]", { error: error instanceof Error ? error.message : String(error) });
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
    const authContext = await getMabizSession();
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
    const { status, signToken } = body;

    // 상태 유효성 확인
    const validStatuses = ["DRAFT", "SENT", "SIGNED", "COMPLETED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { ok: false, error: "유효하지 않은 상태입니다" },
        { status: 400 }
      );
    }

    // 상태머신 전환 매트릭스: 허용된 전환만 통과
    if (status) {
      const allowedTransitions: Record<string, string[]> = {
        DRAFT:     ["SENT", "COMPLETED"],
        SENT:      ["SIGNED", "DRAFT", "COMPLETED"],
        SIGNED:    ["COMPLETED"],
        COMPLETED: [],
      };
      const currentStatus = instance.status as string;
      const allowed = allowedTransitions[currentStatus] ?? [];
      if (!allowed.includes(status)) {
        return NextResponse.json(
          {
            ok: false,
            error: `'${currentStatus}' 상태에서 '${status}'로 전환할 수 없습니다`,
          },
          { status: 422 }
        );
      }
    }

    // SIGNED 전환 시 추가 검증
    if (status === "SIGNED") {
      // 만료일 검사
      if (instance.expiresAt && instance.expiresAt.getTime() < Date.now()) {
        return NextResponse.json(
          { ok: false, error: "계약서 유효기간이 만료되었습니다" },
          { status: 410 }
        );
      }

      // signToken 검증 (boundData 또는 요청 body에 token 포함 시)
      const storedData =
        instance.boundData && typeof instance.boundData === "object"
          ? (instance.boundData as Record<string, unknown>)
          : {};
      const storedToken =
        typeof storedData.signToken === "string" ? storedData.signToken : null;

      if (storedToken) {
        if (!signToken || typeof signToken !== "string") {
          return NextResponse.json(
            { ok: false, error: "서명 토큰이 필요합니다" },
            { status: 401 }
          );
        }
        // timingSafeEqual 비교로 타이밍 공격 방지
        const { timingSafeEqual } = await import("crypto");
        const a = Buffer.from(storedToken);
        const b = Buffer.from(signToken);
        const tokenMatch =
          a.length === b.length && timingSafeEqual(a, b);
        if (!tokenMatch) {
          return NextResponse.json(
            { ok: false, error: "유효하지 않은 서명 토큰입니다" },
            { status: 403 }
          );
        }
      }
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
      },
    });

    const response: ApiResponse<any> = {
      ok: true,
      data: {
        id: updatedInstance.id,
        templateId: updatedInstance.templateId,
        templateName: updatedInstance.template.name,
        contactId: updatedInstance.contactId,
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
    logger.error("[PATCH /api/contract-instances/[id]]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
