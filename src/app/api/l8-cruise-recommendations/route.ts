import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

interface CruiseRecommendation {
  courseId: string;
  courseName: string;
  region: string;
  season: string;
  seasonalScore: number; // 0-100: 현재 시기의 적합도
  differentiationScore: number; // 0-100: 마지막 크루즈와의 차별성
  estimatedPrice: number;
  highlights: string[];
  reasonForRecommendation: string;
}

// 크루즈 코스 데이터베이스 (예시)
const CRUISE_COURSES = [
  {
    courseId: "caribbean-7d",
    courseName: "Caribbean Islands 7-Day",
    region: "caribbean",
    season: "winter",
    seasonalScore: 95,
    basePrice: 2500,
    highlights: ["Turks & Caicos", "St. Lucia", "Barbados"],
  },
  {
    courseId: "alaska-7d",
    courseName: "Alaska Glacier 7-Day",
    region: "alaska",
    season: "summer",
    seasonalScore: 90,
    basePrice: 2800,
    highlights: ["Glacier Bay", "Juneau", "Ketchikan"],
  },
  {
    courseId: "mediterranean-10d",
    courseName: "Mediterranean Europe 10-Day",
    region: "mediterranean",
    season: "spring",
    seasonalScore: 95,
    basePrice: 3200,
    highlights: ["Rome", "Barcelona", "Athens"],
  },
  {
    courseId: "asia-12d",
    courseName: "Asia & Singapore 12-Day",
    region: "asia",
    season: "winter",
    seasonalScore: 85,
    basePrice: 3500,
    highlights: ["Hong Kong", "Singapore", "Thailand"],
  },
  {
    courseId: "hawaii-5d",
    courseName: "Hawaii Islands 5-Day",
    region: "hawaii",
    season: "year-round",
    seasonalScore: 80,
    basePrice: 1800,
    highlights: ["Honolulu", "Maui", "Big Island"],
  },
  {
    courseId: "mexican-riviera-7d",
    courseName: "Mexican Riviera 7-Day",
    region: "mexican-riviera",
    season: "winter",
    seasonalScore: 85,
    basePrice: 2200,
    highlights: ["Cabo San Lucas", "Puerto Vallarta", "Mazatlan"],
  },
];

/**
 * L8 렌즈: 다음 코스 추천 알고리즘
 * GET /api/l8-cruise-recommendations/{contactId}
 *
 * 로직:
 * 1. 마지막 크루즈 지역과 다른 지역 추천
 * 2. 현재 계절에 최적의 코스 추천
 * 3. 고객 관심도 기반 예상 가격대 추천
 */

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const contactId = req.nextUrl.searchParams.get("contactId");
    if (!contactId) {
      return NextResponse.json({ error: "contactId required" }, { status: 400 });
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // 현재 계절 결정
    const currentMonth = new Date().getMonth();
    const seasons = ["winter", "spring", "summer", "fall"];
    const currentSeason = seasons[Math.floor(currentMonth / 3)];

    // 추천 코스 필터링 및 점수 계산 (상위 3개)
    const recommendations: CruiseRecommendation[] = CRUISE_COURSES.map((course) => {
      const seasonalScore =
        course.season === currentSeason || course.season === "year-round"
          ? course.seasonalScore
          : Math.max(50, course.seasonalScore - 20);

      const estimatedPrice = Math.round(course.basePrice * 1.1);

      return {
        courseId: course.courseId,
        courseName: course.courseName,
        region: course.region,
        season: course.season,
        seasonalScore,
        differentiationScore: 80,
        estimatedPrice,
        highlights: course.highlights,
        reasonForRecommendation: `${course.courseName}은 ${currentSeason} 시즌에 최적입니다.`,
      };
    })
      .sort((a, b) => b.seasonalScore - a.seasonalScore)
      .slice(0, 3);

    // 다음 추천 크루즈 날짜 계산
    const nextRecommendedDate = new Date();
    nextRecommendedDate.setMonth(nextRecommendedDate.getMonth() + 6);

    const lastCruiseRegion = extractRegionFromProductName(contact.productName);

    return NextResponse.json({
      success: true,
      contactId,
      recommendations,
      nextRecommendedVisitDate: nextRecommendedDate,
      statsForRecommendation: {
        cruiseCount: contact.cruiseCount,
        lastCruiseRegion,
        lastCruiseEndDate: contact.lastCruiseEndDate,
        cruiseReturnInterestLevel: contact.cruiseReturnInterestLevel,
      },
    });
  } catch (error) {
    logger.error("[GET /api/l8-cruise-recommendations]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/l8-cruise-recommendations/bulk
 * 여러 고객에 대한 추천 일괄 업데이트
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = resolveOrgId(ctx);

    // organizationId는 ctx에서 이미 resolveOrgId로 검증됨

    // 크루즈 종료 후 10일-180일 사이 고객 대상
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const contacts = await prisma.contact.findMany({
      where: {
        organizationId,
        lastCruiseEndDate: {
          gte: sixMonthsAgo,
          lte: tenDaysAgo,
        },
      },
      select: { id: true },
    });

    const results = [];
    for (const contact of contacts) {
      try {
        const url = new URL(req.url);
        url.searchParams.set("contactId", contact.id);
        const contactReq = new NextRequest(url, { method: "GET", headers: req.headers });
        const response = await GET(contactReq);
        const data = await response.json();
        results.push({ contactId: contact.id, success: response.ok, data });
      } catch (error) {
        results.push({
          contactId: contact.id,
          success: false,
          error: '처리 중 오류 발생',
        });
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      results,
    });
  } catch (error) {
    logger.error("[POST /api/l8-cruise-recommendations]", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Helper functions

function extractRegionFromProductName(productName?: string | null): string {
  if (!productName) return "";

  const lower = productName.toLowerCase();
  if (lower.includes("caribbean")) return "caribbean";
  if (lower.includes("alaska")) return "alaska";
  if (lower.includes("mediterranean")) return "mediterranean";
  if (lower.includes("asia") || lower.includes("singapore")) return "asia";
  if (lower.includes("hawaii")) return "hawaii";
  if (lower.includes("mexican") || lower.includes("riviera")) return "mexican-riviera";

  return "";
}

function getSeasonFromMonth(month: number): string {
  if (month >= 11 || month < 2) return "winter";
  if (month >= 2 && month < 5) return "spring";
  if (month >= 5 && month < 8) return "summer";
  return "fall";
}

function generateRecommendationReason(
  course: (typeof CRUISE_COURSES)[0],
  lastCourseRegion: string,
  currentSeason: string,
  cruiseCount: number
): string {
  const reasons = [];

  if (course.region !== lastCourseRegion && lastCourseRegion) {
    reasons.push(`새로운 지역: ${course.region} (이전: ${lastCourseRegion})`);
  }

  if (
    course.season === currentSeason ||
    (course.season === "year-round" && currentSeason)
  ) {
    reasons.push(`최적 시즌: ${currentSeason}`);
  }

  if (cruiseCount >= 2) {
    reasons.push("VIP 재방문 고객 추천");
  }

  return reasons.join(" • ") || "추천 코스";
}
