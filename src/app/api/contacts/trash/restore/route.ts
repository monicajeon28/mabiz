import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildTrashWhere, canViewTrash } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// POST /api/contacts/trash/restore — 휴지통 고객 복구
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    // 휴지통 권한(OWNER·GLOBAL_ADMIN)이 아니면 차단
    if (!canViewTrash(ctx)) {
      return NextResponse.json({ ok: false, error: "휴지통 접근 권한이 없습니다." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: "복구할 대상이 없습니다." }, { status: 400 });
    }

    // 권한 스코프 내 삭제된 고객만 복구 대상으로 조회
    const where = buildTrashWhere(ctx, { id: { in: ids } });
    const targets = await prisma.contact.findMany({
      where,
      select: { id: true, name: true, phone: true, organizationId: true },
    });

    if (targets.length === 0) {
      return NextResponse.json({ ok: true, restored: 0, conflicts: [] });
    }

    // ── phone 충돌 체크 ──────────────────────────────
    // 복구 시 (phone, organizationId)가 활성(deletedAt:null) 고객과 겹치면 복구 불가.
    // phone이 null이면 충돌체크 없이 복구.
    const phoneTargets = targets.filter((t) => t.phone != null && t.phone !== "");
    const okIds: string[] = [];
    const conflicts: { id: string; name: string | null; phone: string | null }[] = [];

    if (phoneTargets.length > 0) {
      const activeDup = await prisma.contact.findMany({
        where: {
          deletedAt: null,
          OR: phoneTargets.map((t) => ({ phone: t.phone, organizationId: t.organizationId })),
        },
        select: { phone: true, organizationId: true },
      });
      const dupKey = new Set(activeDup.map((d) => `${d.organizationId}::${d.phone}`));

      for (const t of targets) {
        if (t.phone && dupKey.has(`${t.organizationId}::${t.phone}`)) {
          conflicts.push({ id: t.id, name: t.name, phone: t.phone });
        } else {
          okIds.push(t.id);
        }
      }
    } else {
      // phone 있는 대상이 없으면 전부 복구 가능
      okIds.push(...targets.map((t) => t.id));
    }

    let restored = 0;
    if (okIds.length > 0) {
      const result = await prisma.contact.updateMany({
        where: { id: { in: okIds } },
        data: { deletedAt: null, deletedBy: null, deletedByName: null },
      });
      restored = result.count;
    }

    logger.info("[contacts/trash/restore] 복구", { restored, conflicts: conflicts.length, userId: ctx.userId });
    return NextResponse.json({ ok: true, restored, conflicts });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_TRASH_ACCESS") {
      return NextResponse.json({ ok: false, error: "휴지통 접근 권한이 없습니다." }, { status: 403 });
    }
    logger.error("[contacts/trash/restore][POST] 실패", { error: String(e) });
    return NextResponse.json({ ok: false, error: "복구 실패" }, { status: 500 });
  }
}
