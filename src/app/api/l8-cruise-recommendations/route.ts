import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contactId } = await params;

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // 마지막 크루즈 코스 추출 (productName에서)
    const lastCourseRegion = extractRegionFromProductName(contact.productName);

    // 현재 계절 결정
    const currentMonth = new Date().getMonth();
    const currentSeason = getSeasonFromMonth(currentMonth);

    // 추천 코스 필터링 및 점수 계산
    const recommendations: CruiseRecommendation[] = CRUISE_COURSES.filter(
      (course) =>
        course.region !== lastCourseRegion || // 다른 지역 우선
        CRUISE_COURSES.filter((c) => c.region !== lastCourseRegion).length === 0 // 같은 지역만 남았으면 포함
    )
      .map((course) => {
        // 계절 점수
        const seasonalScore =
          course.season === currentSeason || course.season === "year-round"
            ? course.seasonalScore
            : Math.max(50, course.seasonalScore - 20);

        // 차별성 점수 (마지막 코스와 다른 정도)
        const differentiationScore = lastCourseRegion ? 85 : 70;

        // 예상 가격 (고객 관심도 기반 동적 가격)
        const estimatedPrice = Math.round(
          course.basePrice *
            (0.9 + (contact.budgetRange === "premium" ? 0.15 : 0.05))
        );

        return {
          courseId: course.courseId,
          courseName: course.courseName,
          region: course.region,
          season: course.season,
          seasonalScore,
          differentiationScore,
          estimatedPrice,
          highlights: course.highlights,
          reasonForRecommendation: generateRecommendationReason(
            course,
            lastCourseRegion,
            currentSeason,
            contact.cruiseCount
          ),
        };
      })
      .sort((a, b) => {
        // 점수 기반 정렬 (계절 + 차별성)
        const scoreA = a.seasonalScore * 0.6 + a.differentiationScore * 0.4;
        const scoreB = b.seasonalScore * 0.6 + b.differentiationScore * 0.4;
        return scoreB - scoreA;
      })
      .slice(0, 3); // 상위 3개 추천

    // 다음 추천 크루즈 날짜 계산 (6개월 후)
    const nextRecommendedDate = new Date(
      contact.lastCruiseEndDate || new Date()
    );
    nextRecommendedDate.setMonth(nextRecommendedDate.getMonth() + 6);

    // 추천 코스 이름 업데이트
    if (recommendations.length > 0) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          nextCruiseRecommendation: recommendations[0].courseName,
          returnVisitScheduledDate: nextRecommendedDate,
        },
      });
    }

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
    console.error("[RECOMMENDATIONS_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/l8-cruise-recommendations/bulk
 * 여러 고객에 대한 추천 일괄 업데이트
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = await req.json();

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

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
        const response = await GET(req, { params: Promise.resolve({ contactId: contact.id }) });
        const data = await response.json();
        results.push({ contactId: contact.id, success: response.ok, data });
      } catch (error) {
        results.push({
          contactId: contact.id,
          success: false,
          error: String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      results,
    });
  } catch (error) {
    console.error("[BULK_RECOMMENDATIONS_ERROR]", error);
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
