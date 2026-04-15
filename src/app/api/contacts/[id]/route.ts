import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere, canDelete } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/contacts/[id]
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx  = await getAuthContext();
    const { id } = await params;
    const where  = buildContactWhere(ctx, { id });

    const contact = await prisma.contact.findFirst({
      where,
      include: {
        groups:       { include: { group: true } },
        callLogs:     { orderBy: { createdAt: "desc" }, take: 30 },
        memos:        { orderBy: { createdAt: "desc" }, take: 30 },
        vipSequences: {
          where:   { status: "ACTIVE" },
          include: { logs: { orderBy: { scheduledAt: "asc" }, take: 30 } },
        },
      },
    });

    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });
    return NextResponse.json({ ok: true, contact });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// PATCH /api/contacts/[id]
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx  = await getAuthContext();
    const { id } = await params;
    const body   = await req.json();
    const where  = buildContactWhere(ctx, { id });

    const existing = await prisma.contact.findFirst({ where });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    const { name, phone, email, type, cruiseInterest, budgetRange, adminMemo, assignedUserId } = body;

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(name           !== undefined ? { name }           : {}),
        ...(phone          !== undefined ? { phone }          : {}),
        ...(email          !== undefined ? { email }          : {}),
        ...(type           !== undefined ? { type }           : {}),
        ...(cruiseInterest !== undefined ? { cruiseInterest } : {}),
        ...(budgetRange    !== undefined ? { budgetRange }    : {}),
        ...(adminMemo      !== undefined ? { adminMemo }      : {}),
        // OWNER/ADMIN만 담당자 변경 가능
        ...(assignedUserId !== undefined && ctx.role !== "AGENT"
          ? { assignedUserId }
          : {}),
      },
    });

    return NextResponse.json({ ok: true, contact });
  } catch (err) {
    logger.error("[PATCH /api/contacts/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// DELETE /api/contacts/[id] — OWNER / GLOBAL_ADMIN 만
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx  = await getAuthContext();
    const { id } = await params;

    // 삭제 권한 체크
    if (!canDelete(ctx)) {
      return NextResponse.json(
        { ok: false, message: "삭제 권한이 없습니다. 관리자에게 문의하세요." },
        { status: 403 }
      );
    }

    const where    = buildContactWhere(ctx, { id });
    const existing = await prisma.contact.findFirst({ where });
    if (!existing) return NextResponse.json({ ok: false }, { status: 404 });

    await prisma.contact.delete({ where: { id } });
    logger.log("[DELETE /api/contacts/[id]] 고객 삭제", { id, role: ctx.role });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/contacts/[id]]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
