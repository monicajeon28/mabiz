/**
 * Menu #57: POST /api/partner/onboarding/progress
 * 온보딩 진행도 업데이트 (주별 완료 상태, 평가 점수 등)
 *
 * Request:
 * {
 *   "onboardingProgressId": "progress_123",
 *   "week": 1,
 *   "status": "Completed",
 *   "weeklySummary": {
 *     "tasksCompleted": 5,
 *     "assessment": "Passed",
 *     "feedback": "Good understanding of products"
 *   },
 *   "rolePlayScores": { "roleplay1": 75, "roleplay2": 82 },
 *   "supervisedCallScores": { "call1": { "opening": "Good", "closing": "Excellent" } }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "week": 2,
 *   "status": "IN_PROGRESS",
 *   "nextWeek": {
 *     "week": 2,
 *     "title": "Week 2: 심리학 렌즈 이해 (L0-L10)",
 *     "materials": [...]
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export const dynamic = 'force-dynamic';

interface ProgressUpdateRequest {
  onboardingProgressId: string;
  week: number;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  weeklySummary?: {
    tasksCompleted: number;
    assessment: "Passed" | "Needs Improvement" | "Failed";
    feedback: string;
  };
  rolePlayScores?: Record<string, number>;
  supervisedCallScores?: Record<string, any>;
}

const WEEK_MATERIALS: Record<
  number,
  { title: string; duration: string; materials: string[] }
> = {
  1: {
    title: "Week 1: 기본 교육 (크루즈 상품 + CRM 기초)",
    duration: "8.5시간",
    materials: [
      "상품 분석 PPT (10장)",
      "CRM 기본 가이드 (5페이지)",
      "고객 세그먼트 분석 (3페이지)",
      "경쟁사 분석 (3페이지)",
      "주간 테스트 + 피드백",
    ],
  },
  2: {
    title: "Week 2: 심리학 렌즈 이해 (L0-L10)",
    duration: "7.5시간",
    materials: [
      "L0-L10 동영상 강의 (6시간)",
      "심리학 렌즈 요약 (5페이지)",
      "실제 콜 사례 분석 (3가지)",
      "이의 처리 롤플레이 (3회)",
    ],
  },
  3: {
    title: "Week 3: 콜 스크립트 실습 (역할극 5회)",
    duration: "4시간",
    materials: [
      "시나리오 1: 신규 인입 (30분)",
      "시나리오 2: 가격 이의 (30분)",
      "시나리오 3: 준비 불안 (30분)",
      "시나리오 4: 차별성 강조 (30분)",
      "시나리오 5: 최종 클로징 (30분)",
      "피드백 및 개선 (30분)",
    ],
  },
  4: {
    title: "Week 4: 실제 고객 콜 감독 (3건)",
    duration: "6시간",
    materials: [
      "감독 콜 1: 신규 골드 관심 (2시간)",
      "감독 콜 2: 재활성화 대상 (2시간)",
      "감독 콜 3: 가격 이의 고객 (2시간)",
      "감독 체크리스트",
    ],
  },
  5: {
    title: "Week 5: 독립 운영 (KPI 모니터링)",
    duration: "35시간 (주당)",
    materials: [
      "일일 콜 목표: 15회",
      "일일 약속 목표: 3-5명",
      "일일 성약 목표: 1-2명",
      "주간 KPI 리포팅",
      "자동 모니터링 시스템 활성화",
    ],
  },
};

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    resolveOrgId(ctx);

    const body: ProgressUpdateRequest = await request.json();
    const {
      onboardingProgressId,
      week,
      status,
      weeklySummary,
      rolePlayScores,
      supervisedCallScores,
    } = body;

    if (!onboardingProgressId || !week || !status) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다" },
        { status: 400 }
      );
    }

    if (week < 1 || week > 5) {
      return NextResponse.json(
        { error: "week는 1-5 사이의 값이어야 합니다" },
        { status: 400 }
      );
    }

    // OnboardingProgress 조회
    const progress = await prisma.onboardingProgress.findUnique({
      where: { id: onboardingProgressId },
    });

    if (!progress) {
      return NextResponse.json(
        { error: "OnboardingProgress를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 주별 완료 시각 결정
    const completedAtField =
      `week${week}CompletedAt` as keyof typeof progress;
    const updateData: any = {
      week,
      status,
    };

    if (status === "COMPLETED") {
      updateData[completedAtField] = new Date();
    }

    // 역할극 점수 업데이트
    if (rolePlayScores) {
      updateData.rolePlayScores = rolePlayScores;
    }

    // 감독 콜 점수 업데이트
    if (supervisedCallScores) {
      updateData.supervisedCallScores = supervisedCallScores;
    }

    // status가 FAILED면 개입 필요 표시
    if (status === "FAILED") {
      updateData.needsIntervention = true;
      updateData.interventionNote = weeklySummary?.feedback || "Week 불합격";
    }

    // 3주 이상 진도 지연 시 weekBehind 표시
    if (week > 3) {
      const createdAt = progress.createdAt;
      const expectedWeek = Math.ceil(
        (new Date().getTime() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      if (week < expectedWeek - 1) {
        updateData.weekBehind = true;
      }
    }

    // OnboardingProgress 업데이트
    const updatedProgress = await prisma.onboardingProgress.update({
      where: { id: onboardingProgressId },
      data: updateData,
    });

    // 상태 변경 시 Partner 정보도 업데이트
    if (status === "COMPLETED" && week === 5) {
      await prisma.partner.update({
        where: { id: progress.partnerId },
        data: {
          onboardingStatus: "COMPLETED",
          incomeLevel: "INTERMEDIATE",
          automationRate: 50,
        },
      });
    }

    // 다음 주 정보 반환
    const nextWeek = week < 5 ? week + 1 : null;
    const nextWeekMaterial = nextWeek ? WEEK_MATERIALS[nextWeek] : null;

    return NextResponse.json({
      success: true,
      currentWeek: week,
      currentStatus: status,
      completedAt:
        updatedProgress[completedAtField as keyof typeof updatedProgress],
      nextWeek: nextWeekMaterial ? { week: nextWeek, ...nextWeekMaterial } : null,
      message:
        status === "COMPLETED"
          ? `Week ${week}를 성공적으로 완료했습니다`
          : `Week ${week} 진행 중입니다`,
      summary: weeklySummary,
    });
  } catch (error) {
    logger.error('[POST /api/partner/onboarding/progress]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "진행도 업데이트 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

