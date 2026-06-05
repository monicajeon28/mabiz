import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildTrashWhere, canViewTrash } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/contacts/trash — 고객 휴지통(삭제 DB) 목록
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();

    // 휴지통 조회 권한(OWNER·GLOBAL_ADMIN)이 아니면 차단
    if (!canViewTrash(ctx)) {
      return NextResponse.json({ ok: false, error: "휴지통 접근 권한이 없습니다." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit")) || 50));

    // 검색어(이름/전화) optional
    const extra: Record<string, unknown> = {};
    if (q) {
      extra.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ];
    }

    // 권한 스코프 내 삭제된(deletedAt != null) 고객만
    const where = buildTrashWhere(ctx, extra);

    const [rows, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          deletedAt: true,
          deletedBy: true,
          deletedByName: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
        orderBy: { deletedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    const contacts = rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      deletedAt: c.deletedAt,
      deletedByName: c.deletedByName,
      orgName: c.organization?.name ?? null,
    }));

    return NextResponse.json({ ok: true, contacts, total, page, limit });
  } catch (e) {
    // 권한 스코프(throw) 처리
    if (e instanceof Error && e.message === "NO_TRASH_ACCESS") {
      return NextResponse.json({ ok: false, error: "휴지통 접근 권한이 없습니다." }, { status: 403 });
    }
    logger.error("[contacts/trash][GET] 실패", { error: String(e) });
    return NextResponse.json({ ok: false, error: "휴지통 조회 실패" }, { status: 500 });
  }
}
