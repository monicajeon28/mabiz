import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMabizSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/contract-instances/[id]/send-sign-link
 * 옵션 A: 즉시 서명 — 계약서 상태를 SENT로 전환하고 서명 URL 반환
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authContext = await getMabizSession();
    if (!authContext) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = authContext;
    const { id } = await params;

    const instance = await prisma.contractInstance.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        status: true,
        expiresAt: true,
        boundData: true,
      },
    });

    if (!instance) {
      return NextResponse.json({ ok: false, error: "계약서를 찾을 수 없습니다" }, { status: 404 });
    }

    if (instance.organizationId !== organizationId) {
      return NextResponse.json({ ok: false, error: "접근 권한이 없습니다" }, { status: 403 });
    }

    // DRAFT 또는 SENT 상태에서만 서명 링크 발송 가능
    if (instance.status === "SIGNED" || instance.status === "COMPLETED") {
      return NextResponse.json(
        { ok: false, error: "이미 서명 완료된 계약서입니다" },
        { status: 422 }
      );
    }

    // DRAFT → SENT 전환 (이미 SENT면 유지)
    if (instance.status === "DRAFT") {
      await prisma.contractInstance.update({
        where: { id },
        data: { status: "SENT" },
      });
    }

    // 서명 URL 생성: /contract/sign/[id]
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "https://mabizcruisedot.com";

    const signUrl = `${baseUrl}/contract/sign/instance/${id}`;

    logger.log("[POST /api/contract-instances/[id]/send-sign-link]", {
      instanceId: id,
      signUrl,
    });

    return NextResponse.json({
      ok: true,
      signUrl,
      message: "서명 링크가 준비되었습니다. 고객에게 전달하세요.",
    });
  } catch (error) {
    logger.error("[POST /api/contract-instances/[id]/send-sign-link]", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
