import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/contacts/[id]/transfer-logs — DB 전달 이력 조회
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx   = await getAuthContext();
    const orgId = ctx.role === "GLOBAL_ADMIN" ? undefined : requireOrgId(ctx);
    const { id: contactId } = await params;

    // 소유권 검증
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, ...(orgId ? { organizationId: orgId } : {}) },
      select: { id: true, organizationId: true },
    });
    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    const logs = await prisma.contactTransferLog.findMany({
      where:   { contactId },
      orderBy: { createdAt: "desc" },
      include: {
        fromOrg: { select: { name: true } },
        toOrg:   { select: { name: true } },
      },
    });

    return NextResponse.json({ ok: true, logs });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]/transfer-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
