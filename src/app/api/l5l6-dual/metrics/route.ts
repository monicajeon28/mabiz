import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface L5L6MetricsQuery {
  startDate?: string; // ISO 8601
  endDate?: string; // ISO 8601
  medicalRiskLevel?: string;
  organizationId?: string;
}

interface MetricsResponse {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalAssessments: number;
    conversionRate: number;
    averageL5L6Score: number;
  };
  byMedicalRiskLevel: Array<{
    level: string;
    count: number;
    conversionRate: number;
    averageScore: number;
    avgTimeToConversion: number; // 일 단위
  }>;
  bySelfProjectionType: Array<{
    type: string;
    count: number;
    conversionRate: number;
    averageScore: number;
  }>;
  byTimingType: Array<{
    type: string;
    count: number;
    conversionRate: number;
    averageScore: number;
  }>;
  smsPerformance: {
    day0: { sent: number; conversionRate: number };
    day1: { sent: number; conversionRate: number };
    day2: { sent: number; conversionRate: number };
    day3: { sent: number; conversionRate: number };
    overallConversionRate: number;
  };
  psychologyEffectiveness: Array<{
    approach: string;
    totalAttempts: number;
    conversions: number;
    conversionRate: number;
  }>;
  trend: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
    improvementRate: number;
  };
  riskProfile: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    avgRiskScore: number;
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await validateAuth();
    if (!auth || !auth.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const medicalRiskLevel = searchParams.get("medicalRiskLevel");

    // 기본값: 최근 30일
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const startDate = startDateStr
      ? new Date(startDateStr)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // L5+L6 평가를 받은 고객들 조회
    const allContacts = await prisma.contact.findMany({
      where: {
        organizationId: auth.organizationId,
        selfProjectionAssessmentAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        l5l6CombinedScore: true,
        l5l6MedicalRiskLevel: true,
        selfProjectionScore: true,
        selfProjectionType: true,
        timingUrgencyScore: true,
        timingType: true,
        l5l6ConversionAt: true,
        l5l6SmsDay0Sent: true,
        l5l6SmsDay0SentAt: true,
        l5l6SmsDay1Sent: true,
        l5l6SmsDay1SentAt: true,
        l5l6SmsDay2Sent: true,
        l5l6SmsDay2SentAt: true,
        l5l6SmsDay3Sent: true,
        l5l6SmsDay3SentAt: true,
        selfProjectionAssessmentAt: true,
      },
    });

    const filteredContacts = medicalRiskLevel
      ? allContacts.filter((c) => c.l5l6MedicalRiskLevel === medicalRiskLevel)
      : allContacts;

    // 기본 통계
    const totalAssessments = filteredContacts.length;
    const conversions = filteredContacts.filter((c) => c.l5l6ConversionAt !== null).length;
    const conversionRate =
      totalAssessments > 0
        ? Math.round((conversions / totalAssessments) * 10000) / 100
        : 0;

    const averageL5L6Score =
      totalAssessments > 0
        ? Math.round(
            filteredContacts.reduce((sum, c) => sum + (c.l5l6CombinedScore || 0), 0) /
              totalAssessments
          )
        : 0;

    // 의료 위험 수준별 분석
    const riskLevels = ["critical", "high", "medium", "low"];
    const byMedicalRiskLevel = riskLevels.map((level) => {
      const levelContacts = filteredContacts.filter(
        (c) => c.l5l6MedicalRiskLevel === level
      );
      const levelConversions = levelContacts.filter((c) => c.l5l6ConversionAt !== null).length;

      const timeToConversions = levelContacts
        .filter((c) => c.l5l6ConversionAt !== null && c.selfProjectionAssessmentAt)
        .map((c) => {
          const days =
            (c.l5l6ConversionAt!.getTime() - c.selfProjectionAssessmentAt!.getTime()) /
            (1000 * 60 * 60 * 24);
          return days;
        });

      return {
        level,
        count: levelContacts.length,
        conversionRate:
          levelContacts.length > 0
            ? Math.round((levelConversions / levelContacts.length) * 10000) / 100
            : 0,
        averageScore:
          levelContacts.length > 0
            ? Math.round(
                levelContacts.reduce((sum, c) => sum + (c.l5l6CombinedScore || 0), 0) /
                  levelContacts.length
              )
            : 0,
        avgTimeToConversion:
          timeToConversions.length > 0
            ? Math.round(
                timeToConversions.reduce((sum, d) => sum + d, 0) / timeToConversions.length
              )
            : 0,
      };
    });

    // 자기투영 유형별 분석
    const selfProjectionTypes = [
      "personal_health",
      "family_health",
      "companion",
      "adventure",
    ];
    const bySelfProjectionType = selfProjectionTypes.map((type) => {
      const typeContacts = filteredContacts.filter((c) => c.selfProjectionType === type);
      const typeConversions = typeContacts.filter((c) => c.l5l6ConversionAt !== null).length;

      return {
        type,
        count: typeContacts.length,
        conversionRate:
          typeContacts.length > 0
            ? Math.round((typeConversions / typeContacts.length) * 10000) / 100
            : 0,
        averageScore:
          typeContacts.length > 0
            ? Math.round(
                typeContacts.reduce((sum, c) => sum + (c.selfProjectionScore || 0), 0) /
                  typeContacts.length
              )
            : 0,
      };
    });

    // 타이밍 유형별 분석
    const timingTypes = [
      "price_deadline",
      "seat_scarcity",
      "age_window",
      "health_window",
    ];
    const byTimingType = timingTypes.map((type) => {
      const typeContacts = filteredContacts.filter((c) => c.timingType === type);
      const typeConversions = typeContacts.filter((c) => c.l5l6ConversionAt !== null).length;

      return {
        type,
        count: typeContacts.length,
        conversionRate:
          typeContacts.length > 0
            ? Math.round((typeConversions / typeContacts.length) * 10000) / 100
            : 0,
        averageScore:
          typeContacts.length > 0
            ? Math.round(
                typeContacts.reduce((sum, c) => sum + (c.timingUrgencyScore || 0), 0) /
                  typeContacts.length
              )
            : 0,
      };
    });

    // SMS 성과
    const day0Sent = filteredContacts.filter((c) => c.l5l6SmsDay0Sent).length;
    const day0Converted = filteredContacts.filter(
      (c) => c.l5l6SmsDay0Sent && c.l5l6ConversionAt !== null
    ).length;

    const day1Sent = filteredContacts.filter((c) => c.l5l6SmsDay1Sent).length;
    const day1Converted = filteredContacts.filter(
      (c) => c.l5l6SmsDay1Sent && c.l5l6ConversionAt !== null
    ).length;

    const day2Sent = filteredContacts.filter((c) => c.l5l6SmsDay2Sent).length;
    const day2Converted = filteredContacts.filter(
      (c) => c.l5l6SmsDay2Sent && c.l5l6ConversionAt !== null
    ).length;

    const day3Sent = filteredContacts.filter((c) => c.l5l6SmsDay3Sent).length;
    const day3Converted = filteredContacts.filter(
      (c) => c.l5l6SmsDay3Sent && c.l5l6ConversionAt !== null
    ).length;

    const smsPerformance = {
      day0: {
        sent: day0Sent,
        conversionRate: day0Sent > 0 ? Math.round((day0Converted / day0Sent) * 10000) / 100 : 0,
      },
      day1: {
        sent: day1Sent,
        conversionRate: day1Sent > 0 ? Math.round((day1Converted / day1Sent) * 10000) / 100 : 0,
      },
      day2: {
        sent: day2Sent,
        conversionRate: day2Sent > 0 ? Math.round((day2Converted / day2Sent) * 10000) / 100 : 0,
      },
      day3: {
        sent: day3Sent,
        conversionRate: day3Sent > 0 ? Math.round((day3Converted / day3Sent) * 10000) / 100 : 0,
      },
      overallConversionRate: conversionRate,
    };

    // 심리학 기법 효과 분석
    const psychologyEffectiveness = [
      {
        approach: "의료신뢰 + 권위성",
        contacts: filteredContacts.filter((c) => c.l5l6MedicalRiskLevel === "critical"),
      },
      {
        approach: "손실회피 + 긴박감",
        contacts: filteredContacts.filter((c) => c.l5l6MedicalRiskLevel === "high"),
      },
      {
        approach: "사회증명 + 자기투영",
        contacts: filteredContacts.filter((c) => c.l5l6MedicalRiskLevel === "medium"),
      },
    ].map((item) => {
      const conversions = item.contacts.filter((c) => c.l5l6ConversionAt !== null).length;
      return {
        approach: item.approach,
        totalAttempts: item.contacts.length,
        conversions,
        conversionRate:
          item.contacts.length > 0
            ? Math.round((conversions / item.contacts.length) * 10000) / 100
            : 0,
      };
    });

    // 주간 트렌드
    const getWeeklyContacts = (weekOffset: number) => {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + weekOffset * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      return filteredContacts.filter(
        (c) =>
          c.selfProjectionAssessmentAt &&
          c.selfProjectionAssessmentAt >= weekStart &&
          c.selfProjectionAssessmentAt < weekEnd
      );
    };

    const week1Contacts = getWeeklyContacts(0);
    const week2Contacts = getWeeklyContacts(1);
    const week3Contacts = getWeeklyContacts(2);
    const week4Contacts = getWeeklyContacts(3);

    const week1Rate =
      week1Contacts.length > 0
        ? Math.round(
            (week1Contacts.filter((c) => c.l5l6ConversionAt !== null).length /
              week1Contacts.length) *
              10000
          ) / 100
        : 0;
    const week2Rate =
      week2Contacts.length > 0
        ? Math.round(
            (week2Contacts.filter((c) => c.l5l6ConversionAt !== null).length /
              week2Contacts.length) *
              10000
          ) / 100
        : 0;
    const week3Rate =
      week3Contacts.length > 0
        ? Math.round(
            (week3Contacts.filter((c) => c.l5l6ConversionAt !== null).length /
              week3Contacts.length) *
              10000
          ) / 100
        : 0;
    const week4Rate =
      week4Contacts.length > 0
        ? Math.round(
            (week4Contacts.filter((c) => c.l5l6ConversionAt !== null).length /
              week4Contacts.length) *
              10000
          ) / 100
        : 0;

    const improvementRate =
      week1Rate > 0 ? Math.round(((week4Rate - week1Rate) / week1Rate) * 100) : 0;

    // 위험 프로필
    const riskProfile = {
      critical: filteredContacts.filter((c) => c.l5l6MedicalRiskLevel === "critical").length,
      high: filteredContacts.filter((c) => c.l5l6MedicalRiskLevel === "high").length,
      medium: filteredContacts.filter((c) => c.l5l6MedicalRiskLevel === "medium").length,
      low: filteredContacts.filter((c) => c.l5l6MedicalRiskLevel === "low").length,
      avgRiskScore: averageL5L6Score,
    };

    const response: MetricsResponse = {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalAssessments,
        conversionRate,
        averageL5L6Score,
      },
      byMedicalRiskLevel,
      bySelfProjectionType,
      byTimingType,
      smsPerformance,
      psychologyEffectiveness,
      trend: {
        week1: week1Rate,
        week2: week2Rate,
        week3: week3Rate,
        week4: week4Rate,
        improvementRate,
      },
      riskProfile,
    };

    logger.info("L5+L6 메트릭 조회 완료", {
      organizationId: auth.organizationId,
      totalAssessments,
      conversionRate,
    });

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error("L5+L6 메트릭 조회 실패", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

