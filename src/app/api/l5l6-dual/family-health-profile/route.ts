import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { validateAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface FamilyMember {
  name: string;
  relation: "spouse" | "child" | "parent" | "sibling";
  age?: number;
  healthConditions?: string[];
  healthRiskScore?: number;
}

interface FamilyHealthProfileInput {
  contactId: string;
  spouse?: FamilyMember;
  children?: FamilyMember[];
  parents?: FamilyMember[];
  companyingPersons?: FamilyMember[]; // 배우자 외 동반자 (부모, 친구)
}

interface FamilyHealthProfileResponse {
  organizationId: string;
  contactId: string;
  familyHealthProfile: {
    spouse?: FamilyMember;
    children: FamilyMember[];
    parents: FamilyMember[];
    companyingPersons: FamilyMember[];
    totalFamilyRiskScore: number;
    criticalMemberCount: number;
    medicalSupportNeeded: boolean;
    selfProjectionStrength: "weak" | "moderate" | "strong" | "critical";
  };
  recommendedCruiseType: string;
  medicalSupportServices: string[];
}

// 자기투영 강도 판정
function assessSelfProjectionStrength(
  familyProfile: any
): "weak" | "moderate" | "strong" | "critical" {
  const criticalCount =
    (familyProfile.spouse && familyProfile.spouse.healthRiskScore >= 70 ? 1 : 0) +
    (familyProfile.children?.filter((c: any) => c.healthRiskScore >= 70).length || 0) +
    (familyProfile.parents?.filter((p: any) => p.healthRiskScore >= 70).length || 0);

  if (criticalCount >= 2) return "critical";
  if (criticalCount === 1) return "strong";
  if ((familyProfile.totalFamilyRiskScore || 0) >= 50) return "moderate";
  return "weak";
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

    const body = (await req.json()) as FamilyHealthProfileInput;
    const { contactId, spouse, children = [], parents = [], companyingPersons = [] } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 }
      );
    }

    // Contact 조회
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { organizationId: true },
    });

    if (!contact || contact.organizationId !== auth.organizationId) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // 건강 위험 점수 계산 함수
    const calculateMemberRiskScore = (member: FamilyMember): number => {
      if (member.healthRiskScore !== undefined) return member.healthRiskScore;

      const HEALTH_SCORES: Record<string, number> = {
        배멀미: 35,
        당뇨: 55,
        고혈압: 50,
        천식: 40,
        심장질환: 75,
        암: 65,
        척추: 45,
      };

      let score = 0;
      (member.healthConditions || []).forEach((condition) => {
        const baseScore = Object.entries(HEALTH_SCORES).find(([key]) =>
          condition.includes(key)
        )?.[1] || 25;
        score += baseScore;
      });

      // 평균 처리
      if (member.healthConditions && member.healthConditions.length > 0) {
        score = score / member.healthConditions.length;
      }

      // 나이 가중치
      if (member.age) {
        if (member.age >= 70) score *= 1.3;
        else if (member.age >= 60) score *= 1.2;
      }

      return Math.min(100, Math.round(score));
    };

    // 모든 가족 구성원 점수 계산
    const allMembers = [
      ...(spouse ? [{ ...spouse, healthRiskScore: calculateMemberRiskScore(spouse) }] : []),
      ...children.map((c) => ({ ...c, healthRiskScore: calculateMemberRiskScore(c) })),
      ...parents.map((p) => ({ ...p, healthRiskScore: calculateMemberRiskScore(p) })),
      ...companyingPersons.map((cp) => ({ ...cp, healthRiskScore: calculateMemberRiskScore(cp) })),
    ];

    // 통계 계산
    const totalFamilyRiskScore =
      allMembers.length > 0
        ? Math.round(
            allMembers.reduce((sum, m) => sum + (m.healthRiskScore || 0), 0) /
              allMembers.length
          )
        : 0;

    const criticalMemberCount = allMembers.filter((m) => (m.healthRiskScore || 0) >= 70).length;
    const medicalSupportNeeded = criticalMemberCount >= 1;

    // 자기투영 강도
    const selfProjectionStrength = assessSelfProjectionStrength({
      spouse: spouse ? { ...spouse, healthRiskScore: calculateMemberRiskScore(spouse) } : undefined,
      children: children.map((c) => ({ ...c, healthRiskScore: calculateMemberRiskScore(c) })),
      parents: parents.map((p) => ({ ...p, healthRiskScore: calculateMemberRiskScore(p) })),
      totalFamilyRiskScore,
    });

    // 추천 크루즈 유형
    let recommendedCruiseType = "General Cruise";
    if (selfProjectionStrength === "critical") {
      recommendedCruiseType = "Medical Support + Wellness Cruise";
    } else if (selfProjectionStrength === "strong") {
      recommendedCruiseType = "Health & Wellness Cruise";
    } else if (selfProjectionStrength === "moderate") {
      recommendedCruiseType = "Family Health Focus Cruise";
    }

    // 의료 지원 서비스
    const medicalSupportServices: string[] = [];
    if (criticalMemberCount >= 1) {
      medicalSupportServices.push("24시간 의료 스태프 상시 대기");
      medicalSupportServices.push("의약품 보관 냉장고");
      medicalSupportServices.push("긴급 헬리콥터 후송 보험");
    }
    if (allMembers.some((m) => m.healthConditions?.some((c) => c.includes("당뇨")))) {
      medicalSupportServices.push("영양사 상담");
      medicalSupportServices.push("식단 관리 서비스");
    }
    if (allMembers.some((m) => m.age && m.age >= 60)) {
      medicalSupportServices.push("휠체어 및 이동 지원");
      medicalSupportServices.push("노인 활동 프로그램");
    }

    // Contact에 가족 건강 프로필 저장
    const familyProfile = {
      spouse: spouse ? { ...spouse, healthRiskScore: calculateMemberRiskScore(spouse) } : undefined,
      children: children.map((c) => ({ ...c, healthRiskScore: calculateMemberRiskScore(c) })),
      parents: parents.map((p) => ({ ...p, healthRiskScore: calculateMemberRiskScore(p) })),
      companyingPersons: companyingPersons.map((cp) => ({
        ...cp,
        healthRiskScore: calculateMemberRiskScore(cp),
      })),
      totalFamilyRiskScore,
      criticalMemberCount,
      medicalSupportNeeded,
      selfProjectionStrength,
    };

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        familyHealthProfile: familyProfile as Prisma.InputJsonValue,
        selfProjectionScore: totalFamilyRiskScore,
        compoundHealthRisk: criticalMemberCount >= 1,
        selfProjectionSequenceStartedAt: new Date(),
      },
    });

    const response: FamilyHealthProfileResponse = {
      organizationId: auth.organizationId,
      contactId,
      familyHealthProfile: familyProfile,
      recommendedCruiseType,
      medicalSupportServices,
    };

    logger.info("L5 가족 건강 프로필 생성 완료", {
      contactId,
      organizationId: auth.organizationId,
      selfProjectionStrength,
    });

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error("L5 가족 건강 프로필 생성 실패", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

