import "server-only";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

/**
 * PATCH /api/affiliate-issuance/[id]
 * GLOBAL_ADMIN 전용 — 어필리에이트 상태 변경 (ACTIVE / INACTIVE / SUSPENDED)
 *
 * Request body: { status: "ACTIVE" | "INACTIVE" | "SUSPENDED" }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: "인증이 필요합니다." }, { status: 401 });
    }
    if (ctx.role !== "GLOBAL_ADMIN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await params;
    const profileId = parseInt(id, 10);
    if (isNaN(profileId)) {
      return NextResponse.json({ ok: false, error: "유효하지 않은 ID입니다." }, { status: 400 });
    }

    // 요청 바디 파싱
    let status: string | undefined;
    try {
      const body = await req.json();
      status = body?.status;
    } catch {
      return NextResponse.json({ ok: false, error: "요청 바디를 파싱할 수 없습니다." }, { status: 400 });
    }

    if (!status || !(VALID_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { ok: false, error: `status는 ${VALID_STATUSES.join(" / ")} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    // 기존 프로필 조회
    const existing = await prisma.gmAffiliateProfile.findUnique({
      where: { id: profileId },
      select: { id: true, status: true, displayName: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "어필리에이트를 찾을 수 없습니다." }, { status: 404 });
    }

    // 상태 업데이트 (updatedAt은 @updatedAt으로 자동 갱신)
    const updated = await prisma.gmAffiliateProfile.update({
      where: { id: profileId },
      data: { status: status as ValidStatus },
      select: { id: true, status: true },
    });

    logger.info(
      `affiliate-issuance PATCH: 상태 변경 profileId=${profileId} ${existing.status} → ${status} adminId=${ctx.userId}`
    );

    return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
  } catch (err) {
    logger.error("affiliate-issuance PATCH 오류", err);
    return NextResponse.json({ ok: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
