import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "all"; // all, month, week

    const baseWhere = buildContactWhere(ctx);

    // 1. 출처별 고객 분포
    const sourceDistribution = await prisma.contact.groupBy({
      by: ["sourceType"],
      where: baseWhere,
      _count: { id: true },
    });

    // 2. 본사별 고객 분포
    const managerDistribution = await prisma.contact.groupBy({
      by: ["affiliateManagerId"],
      where: { ...baseWhere, sourceType: "affiliate" },
      _count: { id: true },
    });

    // 3. 판매원별 고객 분포
    const agentDistribution = await prisma.contact.groupBy({
      by: ["affiliateAgentId"],
      where: { ...baseWhere, sourceType: "affiliate" },
      _count: { id: true },
    });

    // 4. 출처별 응답율 (lastContactedAt 기준)
    const sourceStats = await Promise.all(
      sourceDistribution.map(async (s) => {
        const total = s._count.id;
        const contacted = await prisma.contact.count({
          where: {
            ...baseWhere,
            sourceType: s.sourceType,
            lastContactedAt: { not: null },
          },
        });
        const avgScore = await prisma.contact.aggregate({
          where: { ...baseWhere, sourceType: s.sourceType },
          _avg: { leadScore: true },
        });

        return {
          sourceType: s.sourceType,
          count: total,
          responseRate: total > 0 ? Math.round((contacted / total) * 100) : 0,
          avgLeadScore: Math.round(avgScore._avg.leadScore ?? 0),
        };
      })
    );

    // 5. 본사/판매원 이름 조회
    const affiliateUserIds = [
      ...new Set([
        ...managerDistribution.map((m) => m.affiliateManagerId).filter(Boolean),
        ...agentDistribution.map((a) => a.affiliateAgentId).filter(Boolean),
      ]),
    ] as string[];

    const affiliateMembers = affiliateUserIds.length > 0
      ? await prisma.organizationMember.findMany({
          where: { id: { in: affiliateUserIds } },
          select: { id: true, displayName: true },
        })
      : [];

    const nameMap = new Map<string, string>();
    affiliateMembers.forEach((m) => nameMap.set(m.id, m.displayName ?? m.id));

    const managerStats = managerDistribution
      .map((m) => ({
        managerId: m.affiliateManagerId,
        managerName: nameMap.get(m.affiliateManagerId ?? "") ?? "미지정",
        count: m._count.id,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const agentStats = agentDistribution
      .map((a) => ({
        agentId: a.affiliateAgentId,
        agentName: nameMap.get(a.affiliateAgentId ?? "") ?? "미지정",
        count: a._count.id,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    logger.log("[GET /api/contacts/analytics]", {
      sourceCount: sourceStats.length,
      managerCount: managerStats.length,
      agentCount: agentStats.length,
    });

    return NextResponse.json({
      ok: true,
      sourceDistribution: sourceStats,
      topManagers: managerStats,
      topAgents: agentStats,
      summary: {
        totalContacts: sourceStats.reduce((sum, s) => sum + s.count, 0),
        affiliateContacts: sourceStats.find((s) => s.sourceType === "affiliate")?.count ?? 0,
        customerContacts: sourceStats.find((s) => s.sourceType === "user")?.count ?? 0,
        inquiryContacts: sourceStats.find((s) => s.sourceType === "inquiry")?.count ?? 0,
      },
    });
  } catch (err) {
    logger.error("[GET /api/contacts/analytics]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
