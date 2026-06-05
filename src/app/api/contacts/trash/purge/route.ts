import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildTrashWhere, canPurge } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// POST /api/contacts/trash/purge — 휴지통 고객 영구삭제(완전삭제)
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    // 영구삭제는 시스템관리자(GLOBAL_ADMIN)만
    if (!canPurge(ctx)) {
      return NextResponse.json(
        { ok: false, error: "영구삭제는 시스템관리자만 가능합니다." },
        { status: 403 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: "영구삭제할 대상이 없습니다." }, { status: 400 });
    }

    // 권한 스코프 내 삭제된(deletedAt != null) 건만 대상으로 확인 — 활성 고객 보호
    const where = buildTrashWhere(ctx, { id: { in: ids } });
    const targets = await prisma.contact.findMany({
      where,
      select: { id: true },
    });
    const purgeIds = targets.map((t) => t.id);

    if (purgeIds.length === 0) {
      return NextResponse.json({ ok: true, purged: 0 });
    }

    // 하드삭제(cascade) — deletedAt != null 재확인으로 활성 고객 이중 보호
    const result = await prisma.contact.deleteMany({
      where: { id: { in: purgeIds }, deletedAt: { not: null } },
    });

    logger.warn("[contacts/trash/purge] 영구삭제", { purged: result.count, userId: ctx.userId });
    return NextResponse.json({ ok: true, purged: result.count });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_TRASH_ACCESS") {
      return NextResponse.json({ ok: false, error: "휴지통 접근 권한이 없습니다." }, { status: 403 });
    }
    logger.error("[contacts/trash/purge][POST] 실패", { error: String(e) });
    return NextResponse.json({ ok: false, error: "영구삭제 실패" }, { status: 500 });
  }
}
