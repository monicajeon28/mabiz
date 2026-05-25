/**
 * Menu #57: POST /api/partner/onboarding/create
 * 신입 파트너의 온보딩 프로세스 시작
 *
 * Request:
 * {
 *   "partnerId": "partner_123",
 *   "action": "initialize"  // "initialize" | "restart"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "onboardingProgressId": "progress_123",
 *   "week": 1,
 *   "startDate": "2026-05-25",
 *   "expectedCompletionDate": "2026-06-29",
 *   "message": "온보딩 프로세스가 시작되었습니다"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface CreateOnboardingRequest {
  partnerId: string;
  action: "initialize" | "restart";
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateOnboardingRequest = await request.json();
    const { partnerId, action } = body;

    if (!partnerId || !action) {
      return NextResponse.json(
        { error: "partnerId와 action은 필수입니다" },
        { status: 400 }
      );
    }

    // 파트너 존재 여부 확인
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: { onboardingProgress: true },
    });

    if (!partner) {
      return NextResponse.json(
        { error: "파트너를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // action === "restart" 이면 기존 OnboardingProgress 삭제
    if (action === "restart" && partner.onboardingProgress) {
      await prisma.onboardingProgress.delete({
        where: { partnerId },
      });
    }

    // 새로운 OnboardingProgress 생성
    const startDate = new Date();
    const expectedCompletionDate = new Date(startDate);
    expectedCompletionDate.setDate(expectedCompletionDate.getDate() + 35); // 5주 = 35일

    const onboardingProgress = await prisma.onboardingProgress.create({
      data: {
        partnerId,
        week: 1,
        status: "IN_PROGRESS",
        weekBehind: false,
        needsIntervention: false,
      },
    });

    // Partner 모델의 onboardingStatus와 onboardingStartedAt 업데이트
    await prisma.partner.update({
      where: { id: partnerId },
      data: {
        onboardingStatus: "IN_PROGRESS",
        onboardingStartedAt: startDate,
        incomeLevel: "BEGINNER",
        monthlyIncomeGoal: BigInt(5000000), // 신입 목표: 500만원
        automationRate: 30, // 초기값: 30%
      },
    });

    return NextResponse.json({
      success: true,
      onboardingProgressId: onboardingProgress.id,
      partnerId,
      week: 1,
      startDate: startDate.toISOString().split("T")[0],
      expectedCompletionDate: expectedCompletionDate.toISOString().split("T")[0],
      message: "온보딩 프로세스가 시작되었습니다",
      nextStep: "Week 1: 기본 교육 (크루즈 상품, CRM 기초)",
    });
  } catch (error) {
    logger.error('[POST /api/partner/onboarding/create]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "온보딩 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
