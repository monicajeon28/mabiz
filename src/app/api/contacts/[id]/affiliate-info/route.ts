import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/contacts/[id]/affiliate-info — 제휴 담당자 상세 정보 (L9 의료신뢰 + L10 클로징)
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const where = buildContactWhere(ctx, { id });

    const contact = await prisma.contact.findFirst({
      where,
      select: {
        id: true,
        name: true,
        affiliateManagerId: true,
        affiliateAgentId: true,
        createdAt: true,
      },
    });

    if (!contact) return NextResponse.json({ ok: false }, { status: 404 });

    // 본사 + 대리점장 배치 조회
    const userIds = [contact.affiliateManagerId, contact.affiliateAgentId].filter(
      (x): x is string => !!x
    );

    const members = userIds.length > 0
      ? await prisma.organizationMember.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            displayName: true,
            phone: true,
            email: true,
            role: true,
            organization: { select: { name: true } },
          },
        })
      : [];

    const memberMap = new Map(members.map((m) => [m.id, m]));

    const manager = contact.affiliateManagerId ? memberMap.get(contact.affiliateManagerId) : null;
    const agent = contact.affiliateAgentId ? memberMap.get(contact.affiliateAgentId) : null;

    // L9 의료신뢰 / L10 클로징 — 역할 기반 trustScore
    const roleToScore: Record<string, { score: number; label: string }> = {
      GLOBAL_ADMIN: { score: 99, label: "총괄 크루즈 전문가" },
      OWNER: { score: 97, label: "지사장급 전문가" },
      MANAGER: { score: 93, label: "전문 크루즈 컨설턴트" },
      AGENT: { score: 88, label: "크루즈 맞춤 컨설턴트" },
      FREE_SALES: { score: 82, label: "크루즈 판매 전문가" },
    };

    const buildMemberData = (m: typeof members[0]) => {
      const ts = roleToScore[m.role] ?? roleToScore.AGENT;
      return {
        id: m.id,
        name: m.displayName ?? m.id,
        phone: m.phone,
        email: m.email,
        org: m.organization.name,
        trustScore: ts.score,
        expertise: ts.label,
      };
    };

    return NextResponse.json({
      ok: true,
      data: {
        manager: manager ? buildMemberData(manager) : null,
        agent: agent ? buildMemberData(agent) : null,
        assignedAt: contact.createdAt,
      },
    });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]/affiliate-info]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
