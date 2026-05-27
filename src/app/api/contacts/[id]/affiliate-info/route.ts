import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere, maskContactInfo } from "@/lib/rbac";
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

    // 본사 + 판매원 배치 조회
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
            organization: { select: { name: true } },
          },
        })
      : [];

    const memberMap = new Map(members.map((m) => [m.id, m]));

    const manager = contact.affiliateManagerId ? memberMap.get(contact.affiliateManagerId) : null;
    const agent = contact.affiliateAgentId ? memberMap.get(contact.affiliateAgentId) : null;

    // L9 의료신뢰: 담당자 경험도/신뢰도 점수 (더미, 향후 실제 데이터로 대체)
    // L10 클로징: 즉시 연락 CTA
    return NextResponse.json({
      ok: true,
      data: {
        manager: manager
          ? {
              id: manager.id,
              name: manager.displayName ?? manager.id,
              phone: manager.phone,
              email: manager.email,
              org: manager.organization.name,
              trustScore: 95, // L9: 신뢰도 점수
              expertise: "15년+ 크루즈 판매 경력",
            }
          : null,
        agent: agent
          ? {
              id: agent.id,
              name: agent.displayName ?? agent.id,
              phone: agent.phone,
              email: agent.email,
              org: agent.organization.name,
              trustScore: 88,
              expertise: "크루즈 맞춤 컨설턴트",
            }
          : null,
        assignedAt: contact.createdAt,
      },
    });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]/affiliate-info]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
