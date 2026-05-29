import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, buildContactWhere } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { detectLenses } from "@/lib/lens-detector";
import { detectRiskFlags } from "@/lib/risk-detector";

type Params = { params: Promise<{ id: string }> };

// GET /api/contacts/[id]/profile-360 — 고객 360도 통합 정보
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;
    const where = buildContactWhere(ctx, { id });

    const contact = await prisma.contact.findFirst({
      where,
      include: {
        groups: { include: { group: { select: { id: true, name: true } } } },
        callLogs: { orderBy: { createdAt: "desc" as const }, take: 20 },
        memos: { orderBy: { createdAt: "desc" as const }, take: 20 },
        organization: { select: { id: true, name: true } },
        vipSequences: { where: { status: "ACTIVE" as const } },
      },
    });

    if (!contact) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    // 렌즈 감지
    const lenses = detectLenses({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email ?? undefined,
      type: contact.type,
      cruiseInterest: contact.cruiseInterest,
      budgetRange: contact.budgetRange,
      lastContactedAt: contact.lastContactedAt,
      createdAt: contact.createdAt,
      segment: contact.segment,
      age: contact.age,
      maritalStatus: contact.maritalStatus,
      childrenCount: contact.childrenCount,
      affiliateManagerId: contact.affiliateManagerId,
      affiliateAgentId: contact.affiliateAgentId,
      callLogs: (contact.callLogs || []).map((l) => ({
        content: l.content ?? null,
        createdAt: l.createdAt,
      })),
      memos: (contact.memos || []).map((m) => ({
        content: m.content,
        createdAt: m.createdAt,
      })),
    });

    // Risk Flag 감지
    const { flags: riskFlags, riskScore, severity } = detectRiskFlags({
      id: contact.id,
      name: contact.name,
      type: contact.type,
      lastContactedAt: contact.lastContactedAt,
      createdAt: contact.createdAt,
      segment: contact.segment,
      leadScore: contact.leadScore ?? undefined,
      adminMemo: contact.adminMemo,
      departureDate: contact.departureDate,
      tags: contact.tags,
      callLogs: (contact.callLogs || []).map((l) => ({
        content: l.content ?? null,
        createdAt: l.createdAt,
      })),
      memos: (contact.memos || []).map((m) => ({
        content: m.content,
        createdAt: m.createdAt,
      })),
    });

    // 통계
    const callCount = contact.callLogs?.length || 0;
    const memoCount = contact.memos?.length || 0;
    const lastContactDays =
      contact.lastContactedAt ?
        Math.floor((Date.now() - new Date(contact.lastContactedAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;

    return NextResponse.json({
      ok: true,
      data: {
        // 기본 정보
        basicInfo: {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          type: contact.type,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
        },

        // 여행 정보
        travelInfo: {
          cruiseInterest: contact.cruiseInterest,
          departureDate: contact.departureDate,
          budgetRange: contact.budgetRange,
          recommendedProduct: contact.recommendedProduct,
          segment: contact.segment,
        },

        // 그룹 & 할당
        assignment: {
          organization: contact.organization?.name || null,
          assignedUserId: contact.assignedUserId,
          groups: contact.groups?.map((g) => ({
            id: g.group.id,
            name: g.group.name,
          })) || [],
          tags: contact.tags || [],
        },

        // 렌즈 분석 (심리학)
        lenses: {
          detected: lenses,
          count: lenses.length,
        },

        // 위험도 분석
        risk: {
          riskScore,
          severity,
          flags: riskFlags,
          hasP0Flag: riskFlags.some(
            (f) =>
              f === "INACTIVE_1MONTH" ||
              f === "INACTIVE_6MONTH" ||
              f === "COMPETITOR_STRONG" ||
              f === "DEPARTURE_URGENT"
          ),
        },

        // 활동 통계
        activity: {
          callCount,
          memoCount,
          lastContactedAt: contact.lastContactedAt,
          lastContactDays,
          leadScore: contact.leadScore,
          totalActivityCount: callCount + memoCount,
        },

        // 제휴 정보
        affiliate: {
          affiliateManagerId: contact.affiliateManagerId,
          affiliateAgentId: contact.affiliateAgentId,
          affiliateLinkId: contact.affiliateLinkId,
        },

        // 소스 정보
        source: {
          sourceType: contact.sourceType,
          sourceId: contact.sourceId,
          signupMethod: contact.signupMethod,
        },

        // VIP 상태
        vip: {
          activeSequences: contact.vipSequences?.length || 0,
          isVip: contact.segment === "VIP",
        },

        // 추가 정보
        additional: {
          age: contact.age,
          maritalStatus: contact.maritalStatus,
          childrenCount: contact.childrenCount,
          adminMemo: contact.adminMemo,
        },

        // 최근 활동 요약
        recentActivity: {
          latestCall: contact.callLogs?.[0] ? {
            date: contact.callLogs[0].createdAt,
            content: (contact.callLogs[0].content || "").substring(0, 100),
          } : null,
          latestMemo: contact.memos?.[0] ? {
            date: contact.memos[0].createdAt,
            content: contact.memos[0].content.substring(0, 100),
          } : null,
        },
      },
    });
  } catch (err) {
    logger.error("[GET /api/contacts/[id]/profile-360]", { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
