import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// DELETE /api/scheduled-sms/[id] — 예약 SMS 취소
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, message: "id가 없습니다." }, { status: 400 });
    }

    // 존재 여부 + 소유권 확인
    const item = await prisma.scheduledSms.findFirst({
      where: { id },
      select: { id: true, organizationId: true, status: true },
    });

    if (!item) {
      return NextResponse.json({ ok: false, message: "예약 SMS를 찾을 수 없습니다." }, { status: 404 });
    }

    // 다른 조직 건 → 403
    if (item.organizationId !== orgId) {
      return NextResponse.json({ ok: false, message: "접근 권한이 없습니다." }, { status: 403 });
    }

    // 이미 SENT/FAILED면 취소 불가 → 400
    if (item.status !== "PENDING") {
      return NextResponse.json(
        { ok: false, message: `취소할 수 없는 상태입니다. (현재: ${item.status})` },
        { status: 400 }
      );
    }

    await prisma.scheduledSms.update({
      where: { id },
      data:  { status: "CANCELLED" },
    });

    logger.log("[DELETE /api/scheduled-sms/[id]]", { id, orgId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/scheduled-sms/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
