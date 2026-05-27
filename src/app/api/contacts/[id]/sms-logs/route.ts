import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: contactId } = await params;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);
    const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
    const skip = (page - 1) * limit;

    // Contact 소유권 검증
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ ok: false, message: "Contact not found" }, { status: 404 });
    }

    // SMS 로그 조회 + 전체 개수
    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        where: {
          contactId,
          organizationId: orgId,
        },
        orderBy: { sentAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          phone: true,
          contentPreview: true,
          status: true,
          blockReason: true,
          resultCode: true,
          channel: true,
          sentAt: true,
        },
      }),
      prisma.smsLog.count({
        where: {
          contactId,
          organizationId: orgId,
        },
      }),
    ]);

    logger.log("[GET /api/contacts/[id]/sms-logs]", { contactId, orgId, page, limit, total });

    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      ok: true,
      logs,
      total,
      page,
      pageSize: limit,
      totalPages,
      hasMore: page < totalPages,
    });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]/sms-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
