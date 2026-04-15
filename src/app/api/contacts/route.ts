import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { triggerGroupFunnel } from "@/lib/funnel-trigger";

// GET /api/contacts — 고객 목록 (역할 기반)
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);

    const type    = searchParams.get("type");
    const q       = searchParams.get("q");
    const groupId = searchParams.get("groupId");
    const page    = parseInt(searchParams.get("page")  ?? "1");
    const limit   = parseInt(searchParams.get("limit") ?? "30");

    const baseWhere = buildContactWhere(ctx, {
      ...(type ? { type } : {}),
      ...(q
        ? { OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ]}
        : {}),
      ...(groupId ? { groups: { some: { groupId } } } : {}),
    });

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: baseWhere,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          groups: { include: { group: { select: { id: true, name: true, color: true } } } },
          _count: { select: { callLogs: true } },
        },
      }),
      prisma.contact.count({ where: baseWhere }),
    ]);

    return NextResponse.json({ ok: true, contacts, total, page, limit });
  } catch (err) {
    logger.error("[GET /api/contacts]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// POST /api/contacts — 고객 생성 (OWNER / GLOBAL_ADMIN만)
export async function POST(req: Request) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const body  = await req.json();
    const { name, phone, email, type, cruiseInterest, budgetRange, adminMemo, groupIds, assignedUserId } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { ok: false, message: "이름과 전화번호는 필수입니다." },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.create({
      data: {
        organizationId: orgId,
        name,
        phone,
        email:          email          ?? null,
        type:           type           ?? "LEAD",
        cruiseInterest: cruiseInterest ?? null,
        budgetRange:    budgetRange    ?? null,
        adminMemo:      adminMemo      ?? null,
        assignedUserId: assignedUserId ?? null,
        ...(groupIds?.length
          ? { groups: { create: (groupIds as string[]).map((gid) => ({ groupId: gid })) } }
          : {}),
      },
    });

    logger.log("[POST /api/contacts] 고객 생성", { id: contact.id });

    // 그룹 배정 시 퍼널 자동 시작 (fire-and-forget)
    if (groupIds?.length && contact.id) {
      for (const gid of groupIds as string[]) {
        triggerGroupFunnel({
          contactId:      contact.id,
          groupId:        gid,
          organizationId: orgId,
          sendFirst:      true,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, contact }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { ok: false, message: "이미 등록된 전화번호입니다." },
        { status: 409 }
      );
    }
    logger.error("[POST /api/contacts]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
