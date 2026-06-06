/**
 * GET /api/contacts/[id]/integrated-risk-score
 * Contact 위험도 점수 및 권장 액션 조회
 */

import { NextResponse } from 'next/server';
import { getAuthContext, buildContactWhere } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { calculateRiskScore, summarizeRiskProfile, categorizeRiskScore } from '@/lib/contact-integrator/risk-calculator';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/contacts/[id]/integrated-risk-score
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;

    // Contact 조회
    const contact = await prisma.contact.findFirst({
      where: buildContactWhere(ctx, { id }),
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        lastContactedAt: true,
        type: true,
        segment: true,
        // L0: 부재중 재활성화
        reactivationSegment: true,
        lastCruiseDate: true,
        cruiseCount: true,
        lastSatisfactionScore: true,
        // L2: 준비 불안도
        anxietyScore: true,
        anxietyCategory: true,
        preparationStage: true,
        visaRequired: true,
        passportDaysLeft: true,
        familyWithKids: true,
        healthConcerns: true,
        // L3: 차별성
        competitorMentioned: true,
        competitorNames: true,
        lastCompetitorMentionAt: true,
        differentiationScore: true,
        differentiationResponseSent: true,
        // L5-L6: 자기투영 + 타이밍
        l5l6CombinedScore: true,
        l5l6MedicalRiskLevel: true,
        timingType: true,
        priceDeadlineDate: true,
        decisionWindowExpiresAt: true,
        seatAvailability: true,
        // L7: 동반자 설득
        familyComposition: true,
        spouseEngagement: true,
        companionPersuasionStage: true,
        familyObjections: true,
        // L8: 재방문 습관화
        ltvTotal: true,
        cruiseReturnInterestLevel: true,
        lastCruiseEndDate: true,
        // L9: 의료/건강
        personalHealthConcern: true,
        spouseHealthConcern: true,
        compoundHealthRisk: true,
        // L10: 클로징
        closingStage: true,
        l10ClosingScore: true,
        tripleChoiceOffered: true,
        urgencyLevel: true,
        // 활동
        leadScore: true,
        lastPaymentStatus: true,
        lastPaymentAt: true,
        lastRefundedAt: true,
        reEngageCount: true,
        // 계산용 필드
        callLogs: {
          select: { id: true },
          take: 1
        }
      }
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Risk Score 계산 (callLogs 배열 → callCount 변환, callLogs 필드 제외)
     
    const { callLogs: _callLogs, ...contactData } = contact;
    const riskProfile = await calculateRiskScore({
      ...contactData,
      callCount: contact.callLogs?.length ?? 0,
    } as Parameters<typeof calculateRiskScore>[0]);

    // Risk Profile 요약
    const summary = summarizeRiskProfile(riskProfile);

    logger.info('[GET /api/contacts/[id]/integrated-risk-score] Success', {
      contactId: id,
      riskScore: riskProfile.riskScore,
      category: categorizeRiskScore(riskProfile.riskScore)
    });

    return NextResponse.json({
      ok: true,
      data: {
        contactId: id,
        riskProfile,
        summary,
        recommendations: riskProfile.recommendedActions,
        generatedAt: new Date()
      }
    });
  } catch (err) {
    logger.error('[GET /api/contacts/[id]/integrated-risk-score] Error', { err });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
