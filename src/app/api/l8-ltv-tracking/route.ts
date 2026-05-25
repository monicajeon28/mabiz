import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, requireOrgId } from "@/lib/rbac";

const CRUISE_BASE_PRICE = 2500; // $2,500 평균 예약가

/**
 * L8 렌즈: 재방문 습관화 - LTV 계산 및 추적
 * POST /api/l8-ltv-tracking
 *
 * 요청:
 * {
 *   contactId: string,
 *   cruiseEndDate?: DateTime,
 *   cruisePrice?: number,
 *   satisfactionScore?: 1-10,
 *   nextCruiseInterestLevel?: 0-100
 * }
 */

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contactId, cruiseEndDate, cruisePrice, satisfactionScore, nextCruiseInterestLevel } = await req.json();

    if (!contactId) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // LTV 계산 공식:
    // - 크루즈 1회: $2,500 (평균 예약)
    // - 크루즈 2회: +$2,500 = $5,000
    // - 크루즈 3회+: +$2,334 (재구매율 94% 기준)
    const newCruiseCount = contact.cruiseCount + 1;
    let ltvIncrement = cruisePrice || CRUISE_BASE_PRICE;

    if (newCruiseCount > 2) {
      ltvIncrement = 2334; // 재구매율 94% 기반
    }

    const newLtvTotal = (contact.ltvTotal || 0) + ltvIncrement;

    // Cruise Club 티어 결정
    let cruiseClubTier = "bronze";
    if (newCruiseCount >= 4) cruiseClubTier = "platinum";
    else if (newCruiseCount === 3) cruiseClubTier = "gold";
    else if (newCruiseCount === 2) cruiseClubTier = "silver";

    // 업데이트
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        cruiseCount: newCruiseCount,
        ltvTotal: newLtvTotal,
        lastCruiseEndDate: cruiseEndDate ? new Date(cruiseEndDate) : new Date(),
        lastCruiseSatisfactionScore: satisfactionScore || null,
        cruiseReturnInterestLevel: nextCruiseInterestLevel || 0,
        cruiseClubTier,
        ltvCalculatedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        contact: {
          id: updatedContact.id,
          cruiseCount: updatedContact.cruiseCount,
          ltvTotal: updatedContact.ltvTotal,
          cruiseClubTier: updatedContact.cruiseClubTier,
          nextCruiseRecommendation: updatedContact.nextCruiseRecommendation,
        },
        ltvDetails: {
          cruiseCount: newCruiseCount,
          ltvIncrement,
          totalLtv: newLtvTotal,
          estimatedAnnualRepeatVisits: Math.max(1, Math.round(newCruiseCount / 2)),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[LTV_TRACKING_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/l8-ltv-tracking/stats
 * 조직 전체 LTV 통계
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const stats = await prisma.contact.aggregate({
      where: { organizationId },
      _sum: { ltvTotal: true, cruiseCount: true },
      _avg: { ltvTotal: true, cruiseCount: true },
      _max: { ltvTotal: true, cruiseCount: true },
    });

    const tierDistribution = await prisma.contact.groupBy({
      by: ["cruiseClubTier"],
      where: { organizationId, cruiseClubTier: { not: null } },
      _count: true,
    });

    const lastCruiseDateStats = await prisma.contact.aggregate({
      where: {
        organizationId,
        lastCruiseEndDate: { not: null },
      },
      _avg: {
        cruiseReturnInterestLevel: true,
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalLtv: stats._sum.ltvTotal || 0,
        totalCruises: stats._sum.cruiseCount || 0,
        avgLtvPerContact: stats._avg.ltvTotal || 0,
        avgCruisePerContact: stats._avg.cruiseCount || 0,
        maxLtv: stats._max.ltvTotal || 0,
        maxCruiseCount: stats._max.cruiseCount || 0,
      },
      tierDistribution: tierDistribution.reduce(
        (acc, t) => {
          acc[t.cruiseClubTier || "unclassified"] = t._count;
          return acc;
        },
        {} as Record<string, number>
      ),
      avgReturnInterestLevel: lastCruiseDateStats._avg.cruiseReturnInterestLevel || 0,
    });
  } catch (error) {
    console.error("[LTV_STATS_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
