import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { ApiResponse } from "@/lib/types/contract-templates";
import { logger } from "@/lib/logger";

// ─── 상태머신 전환 매트릭스 ────────────────────────────────────────────────────
// 허용된 전환만 정의. 목록에 없는 조합은 모두 거부.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT:     ["SENT"],
  SENT:      ["SIGNED", "DRAFT"],   // 재발송을 위한 SENT→DRAFT 허용
  SIGNED:    ["COMPLETED"],
  COMPLETED: [],                    // 완료 상태에서는 어떤 전환도 불허
};

function isTransitionAllowed(from: string, to: string): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

// ─── timingSafeEqual 기반 토큰 비교 ──────────────────────────────────────────
function safeTokenCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

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
    const { status, signToken } = body as { status?: string; signToken?: string };

    // 상태 유효성 확인
    const validStatuses = ["DRAFT", "SENT", "SIGNED", "COMPLETED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { ok: false, error: "유효하지 않은 상태입니다" },
        { status: 400 }
      );
    }

    // 상태머신 전환 검증 (역방향/임의 전환 방지)
    if (status && status !== instance.status) {
      if (!isTransitionAllowed(instance.status, status)) {
        return NextResponse.json(
          {
            ok: false,
            error: `${instance.status} → ${status} 전환은 허용되지 않습니다`,
          },
          { status: 422 }
        );
      }

      // SIGNED 전환 시 signToken 필수 검증
      if (status === "SIGNED") {
        if (!signToken) {
          return NextResponse.json(
            { ok: false, error: "서명 전환 시 signToken이 필요합니다" },
            { status: 400 }
          );
        }

        const boundData = instance.boundData as Record<string, unknown>;
        const storedToken =
          typeof boundData?.signToken === "string" ? boundData.signToken : "";

        if (!storedToken || !safeTokenCompare(storedToken, signToken)) {
          logger.error("[PATCH /api/contract-instances/[id]] signToken 불일치", {
            id,
          });
          return NextResponse.json(
            { ok: false, error: "유효하지 않은 서명 토큰입니다" },
            { status: 403 }
          );
        }

        // 토큰 만료 확인
        const tokenExpiresAt =
          typeof boundData?.signTokenExpiresAt === "string"
            ? new Date(boundData.signTokenExpiresAt)
            : null;
        if (tokenExpiresAt && tokenExpiresAt < new Date()) {
          return NextResponse.json(
            { ok: false, error: "서명 토큰이 만료되었습니다" },
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
          // 서명 완료 후 토큰 무효화 (boundData에서 signToken 제거)
          boundData: {
            ...(instance.boundData as object),
            signToken: null,
            signTokenExpiresAt: null,
          },
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
