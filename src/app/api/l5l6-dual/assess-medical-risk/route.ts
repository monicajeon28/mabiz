import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface MedicalRiskInput {
  contactId: string;
  personalHealthCondition?: string;
  personalHealthConcern?: string[];
  spouseHealthCondition?: string;
  spouseHealthConcern?: string[];
  age?: number;
  spouseAge?: number;
}

interface MedicalRiskAssessment {
  selfProjectionScore: number;
  timingUrgencyScore: number;
  l5l6CombinedScore: number;
  l5l6MedicalRiskLevel: "low" | "medium" | "high" | "critical";
  ageRelevanceScore: number;
  compoundHealthRisk: boolean;
  psychologyInsight: string;
  recommendedApproach: string;
}

// 의료 상태 → 점수 매핑
const HEALTH_CONDITION_SCORES: Record<string, number> = {
  배멀미: 35,
  당뇨: 55,
  고혈압: 50,
  천식: 40,
  심장질환: 75,
  암_완치: 65,
  척추질환: 45,
  무릎질환: 40,
  임신중: 85,
  수술후: 60,
};

// 나이별 의료 위험 점수
const AGE_RELEVANCE_SCORES: Record<string, number> = {
  "20s": 20,
  "30s": 25,
  "40s": 35,
  "50s": 55,
  "60s": 75,
  "70s": 90,
  "80+": 100,
};

function getAgeRange(age?: number): string {
  if (!age) return "unknown";
  if (age < 30) return "20s";
  if (age < 40) return "30s";
  if (age < 50) return "40s";
  if (age < 60) return "50s";
  if (age < 70) return "60s";
  if (age < 80) return "70s";
  return "80+";
}

function calculateHealthScore(
  conditions: string[] = [],
  age?: number
): { score: number; risk: "low" | "medium" | "high" | "critical" } {
  let baseScore = 0;

  // 건강 상태별 점수 합산
  conditions.forEach((condition) => {
    baseScore += HEALTH_CONDITION_SCORES[condition] || 20;
  });

  // 중복 건강 문제 가중치
  if (conditions.length > 1) {
    baseScore *= 1.2;
  }

  // 나이 가중치
  const ageScore = AGE_RELEVANCE_SCORES[getAgeRange(age)] || 30;
  baseScore = (baseScore + ageScore) / 2;

  // 0-100 범위로 제한
  baseScore = Math.min(100, Math.max(0, baseScore));

  // 위험도 판정
  let risk: "low" | "medium" | "high" | "critical" = "low";
  if (baseScore >= 75) risk = "critical";
  else if (baseScore >= 55) risk = "high";
  else if (baseScore >= 35) risk = "medium";

  return { score: Math.round(baseScore), risk };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await validateAuth();
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { contactId, personalHealthCondition, personalHealthConcern, spouseHealthCondition, spouseHealthConcern, age, spouseAge } = (await req.json()) as MedicalRiskInput;

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 }
      );
    }

    // Contact 조회
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { organizationId: true, age: true, spouseHealthCondition: true },
    });

    if (!contact || contact.organizationId !== auth.organizationId) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // 본인 건강 위험 평가
    const personalConditions = personalHealthConcern || [];
    const personalRisk = calculateHealthScore(personalConditions, age || contact.age || undefined);

    // 배우자 건강 위험 평가
    const spouseConditions = spouseHealthConcern || [];
    const spouseRisk = calculateHealthScore(spouseConditions, spouseAge);

    // 복합 건강 위험 판정
    const compoundHealthRisk =
      (personalRisk.risk === "high" || personalRisk.risk === "critical") &&
      (spouseRisk.risk === "high" || spouseRisk.risk === "critical");

    // L5 자기투영 점수 (본인 + 배우자 건강 상태)
    const selfProjectionScore = Math.round(
      (personalRisk.score + spouseRisk.score) / 2
    );

    // L6 타이밍 점수 (건강 위험 × 나이)
    const ageRelevanceScore = AGE_RELEVANCE_SCORES[getAgeRange(age || contact.age || undefined)] || 30;
    const timingUrgencyScore = Math.round(
      (personalRisk.score * 0.6 + ageRelevanceScore * 0.4)
    );

    // 통합 점수
    const l5l6CombinedScore = Math.round(
      (selfProjectionScore * 0.5 + timingUrgencyScore * 0.5)
    );

    // 의료 위험 수준 결정
    let l5l6MedicalRiskLevel: "low" | "medium" | "high" | "critical" = "low";
    if (compoundHealthRisk) {
      l5l6MedicalRiskLevel = "critical";
    } else if (personalRisk.risk === "high" || spouseRisk.risk === "high") {
      l5l6MedicalRiskLevel = "high";
    } else if (personalRisk.risk === "medium" || spouseRisk.risk === "medium") {
      l5l6MedicalRiskLevel = "medium";
    }

    // 심리학 인사이트
    let psychologyInsight = "";
    if (compoundHealthRisk) {
      psychologyInsight =
        "배우자 함께 건강한 여행이 필요한 시점입니다. 의료 지원이 있는 크루즈가 최적의 선택입니다.";
    } else if (l5l6MedicalRiskLevel === "high") {
      psychologyInsight =
        "건강 상태를 고려했을 때, 지금이 크루즈를 통해 건강을 회복할 최적의 기회입니다.";
    } else {
      psychologyInsight =
        "건강한 가족과 함께 소중한 시간을 만드는 것이 중요한 시점입니다.";
    }

    // 권장 접근법
    let recommendedApproach = "";
    if (l5l6MedicalRiskLevel === "critical") {
      recommendedApproach =
        "의료진 자격 강조 + 배우자 동반 설득 + 의료 응급 서비스 강조";
    } else if (l5l6MedicalRiskLevel === "high") {
      recommendedApproach = "의료 신뢰 구축 + 건강 이점 강조 + 시간 제한성";
    } else if (l5l6MedicalRiskLevel === "medium") {
      recommendedApproach = "예방 의료 + 건강 관리 + 가족 건강 강조";
    } else {
      recommendedApproach = "일반 여행 판매 + 건강 관리 팁";
    }

    // Contact 업데이트
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        personalHealthCondition: personalHealthCondition || contact.spouseHealthCondition,
        personalHealthConcern: personalConditions.join(", "),
        spouseHealthCondition,
        spouseHealthConcern: spouseConditions.join(", "),
        compoundHealthRisk,
        selfProjectionScore,
        timingUrgencyScore,
        l5l6CombinedScore,
        l5l6MedicalRiskLevel,
        ageRelevanceScore,
        selfProjectionAssessmentAt: new Date(),
      },
    });

    const assessment: MedicalRiskAssessment = {
      selfProjectionScore,
      timingUrgencyScore,
      l5l6CombinedScore,
      l5l6MedicalRiskLevel,
      ageRelevanceScore,
      compoundHealthRisk,
      psychologyInsight,
      recommendedApproach,
    };

    logger.info("L5+L6 의료 위험 평가 완료", {
      contactId,
      organizationId: auth.organizationId,
      assessment,
    });

    return NextResponse.json({
      success: true,
      assessment,
      contact: {
        id: updatedContact.id,
        l5l6CombinedScore: updatedContact.l5l6CombinedScore,
        l5l6MedicalRiskLevel: updatedContact.l5l6MedicalRiskLevel,
      },
    });
  } catch (error) {
    logger.error("L5+L6 의료 위험 평가 실패", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

