import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// GET /api/b2b?status=NEW&page=1
export async function GET(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = ctx.role === "GLOBAL_ADMIN" ? undefined : requireOrgId(ctx);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit  = 30;

    const where = {
      ...(orgId ? { organizationId: orgId } : {}),
      ...(status ? { status }              : {}),
    };

    const [prospects, total] = await Promise.all([
      prisma.b2BProspect.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.b2BProspect.count({ where }),
    ]);

    // 상태별 카운트
    const counts = await prisma.b2BProspect.groupBy({
      by:    ["status"],
      where: orgId ? { organizationId: orgId } : {},
      _count: { id: true },
    });

    return NextResponse.json({ ok: true, prospects, total, page, counts });
  } catch (err) {
    logger.error("[GET /api/b2b]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/b2b — 신규 잠재고객 등록 (관리자/대리점장)
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const body = await req.json() as {
      name: string; phone: string; email?: string;
      companyName?: string; position?: string; groupSize?: number;
      packageInterest?: string; budget?: string; preferredDate?: string;
      destination?: string; notes?: string; source?: string;
    };

    if (!body.name?.trim() || !body.phone?.trim()) {
      return NextResponse.json({ ok: false, message: "이름과 전화번호는 필수입니다." }, { status: 400 });
    }

    const prospect = await prisma.b2BProspect.create({
      data: {
        organizationId:  orgId,
        name:            body.name.trim(),
        phone:           body.phone.trim(),
        email:           body.email           ?? null,
        companyName:     body.companyName      ?? null,
        position:        body.position         ?? null,
        groupSize:       body.groupSize        ?? null,
        packageInterest: body.packageInterest  ?? null,
        budget:          body.budget           ?? null,
        preferredDate:   body.preferredDate    ?? null,
        destination:     body.destination      ?? null,
        notes:           body.notes            ?? null,
        source:          body.source           ?? "DIRECT",
        status:          "NEW",
      },
    });

    logger.log("[POST /api/b2b] 잠재고객 등록", { id: prospect.id, orgId });

    return NextResponse.json({ ok: true, prospect }, { status: 201 });
  } catch (err) {
    logger.error("[POST /api/b2b]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
