export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgIdOrNull } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/b2b-prospects?eduType=INQUIRER&q=검색어&page=1&limit=50
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();

    // 판매원·프리세일즈 완전 차단
    if (ctx.role === 'AGENT' || ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다' }, { status: 403 });
    }

    const orgId = resolveOrgIdOrNull(ctx);

    const { searchParams } = new URL(req.url);
    const eduType = searchParams.get("eduType") ?? undefined;
    const q = searchParams.get("q") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
    const skip = (page - 1) * limit;
    const status = searchParams.get("status") ?? undefined;

    const where = {
      ...(orgId !== null ? { organizationId: orgId } : {}),
      deletedAt: null,
      ...(eduType ? { eduType } : {}),
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    };

    const [prospects, total] = await Promise.all([
      prisma.b2BProspect.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          eduType: true,
          productName: true,
          paymentAmount: true,
          paymentDate: true,
          notes: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.b2BProspect.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      prospects,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNAUTHORIZED') || msg.includes('401') || msg.includes('인증')) {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다' }, { status: 401 });
    }
    logger.error("[GET /api/b2b-prospects]", { err });
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}

// PATCH /api/b2b-prospects?id=xxx — 상태 변경
export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();

    // 판매원·프리세일즈 완전 차단
    if (ctx.role === 'AGENT' || ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: '접근 권한이 없습니다' }, { status: 403 });
    }

    const orgId = resolveOrgIdOrNull(ctx);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "id 필수" }, { status: 400 });
    }

    const body = await req.json() as { status?: string; notes?: string };

    // 소유권 확인 (PK 단일 조회 — orderBy 불필요)
    const existing = await prisma.b2BProspect.findFirst({
      where: { id, ...(orgId !== null ? { organizationId: orgId } : {}), deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "찾을 수 없습니다" }, { status: 404 });
    }

    const updated = await prisma.b2BProspect.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        eduType: true,
        productName: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, prospect: updated });
  } catch (err) {
    logger.error("[PATCH /api/b2b-prospects]", { err });
    return NextResponse.json({ ok: false, error: "서버 오류" }, { status: 500 });
  }
}
