import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/contacts/[id]/transfer-logs — DB 전달 이력 조회 (toUserId 이름 포함)
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

    // toUserId 이름 배치 조회
    const toUserIds = [...new Set(logs.map(l => l.toUserId).filter((x): x is string => !!x))];
    const [orgMembers, globalAdmins] = toUserIds.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.organizationMember.findMany({
            where:  { id: { in: toUserIds } },
            select: { id: true, displayName: true, organization: { select: { name: true } } },
          }),
          prisma.globalAdmin.findMany({
            where:  { id: { in: toUserIds } },
            select: { id: true, displayName: true },
          }),
        ]);

    const nameMap = new Map<string, { name: string; orgName: string }>();
    orgMembers.forEach(m => nameMap.set(m.id, { name: m.displayName ?? m.id, orgName: m.organization.name }));
    globalAdmins.forEach(a => nameMap.set(a.id, { name: a.displayName ?? "본사", orgName: "본사" }));

    const enrichedLogs = logs.map(l => {
      const target = l.toUserId ? nameMap.get(l.toUserId) : null;
      return {
        ...l,
        toUserName:    target?.name    ?? null,
        toUserOrgName: target?.orgName ?? (l.toOrg?.name ?? null),
        canRecall: l.transferredBy === ctx.userId || ctx.role === "GLOBAL_ADMIN",
      };
    });

    return NextResponse.json({ ok: true, logs: enrichedLogs });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]/transfer-logs]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
