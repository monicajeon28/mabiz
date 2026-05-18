export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import {
  calculateChiSquare,
  calculateCramersV,
  calculateSuccessRate,
  determineConfidenceLevel,
  generateInterpretation,
  getSampleSizeRecommendation,
} from '@/lib/variant-stats';

/**
 * GET /api/campaigns/[id]/variants/stats
 *
 * A/B Variant의 성과를 통계적으로 분석하고 비교합니다.
 *
 * 응답 예시:
 * {
 *   "ok": true,
 *   "campaign": {
 *     "id": "cmp_123",
 *     "title": "봄 크루즈 캠페인",
 *     "status": "SENT"
 *   },
 *   "variants": {
 *     "A": {
 *       "sent": 1000,
 *       "success": 850,
 *       "failure": 150,
 *       "successRate": 0.85
 *     },
 *     "B": {
 *       "sent": 1000,
 *       "success": 700,
 *       "failure": 300,
 *       "successRate": 0.70
 *     }
 *   },
 *   "analysis": {
 *     "chiSquare": {
 *       "chi2": 28.5714,
 *       "pValue": 0.0001,
 *       "isSignificant": true,
 *       "degreesOfFreedom": 1
 *     },
 *     "cramersV": 0.1268,
 *     "recommendation": "A",
 *     "confidence": "HIGH",
 *     "interpretation": "A Variant이 통계적으로 유의미하게 더 좋습니다 (p=0.0001, 높은 신뢰도(95% 이상))"
 *   },
 *   "metadata": {
 *     "calculatedAt": "2026-05-20T12:00:00Z",
 *     "sampleSizeRecommendation": null
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 인증 확인
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // 2. IDOR 방지: Campaign의 organizationId 확인
    const campaign = await prisma.crmMarketingCampaign.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        organizationId: true,
        title: true,
        status: true,
      },
    });

    if (!campaign || campaign.organizationId !== orgId) {
      logger.warn('[GET /variants/stats] Campaign not found or unauthorized', {
        campaignId: params.id,
        orgId,
      });
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // 3. SendingHistory에서 variantKey, status별 집계
    const stats = await prisma.sendingHistory.groupBy({
      by: ['variantKey', 'status'],
      where: { campaignId: params.id },
      _count: { id: true },
    });

    logger.debug('[GET /variants/stats] Raw stats', { stats });

    // 4. Variant별 발송/성공/실패 계산
    const variantData: Record<
      string,
      {
        sent: number;
        success: number;
        failure: number;
        successRate: number;
      }
    > = {};

    for (const stat of stats) {
      // null variantKey는 "SINGLE" (단일 메시지)로 표현
      const variantKey = stat.variantKey ?? 'SINGLE';

      if (!variantData[variantKey]) {
        variantData[variantKey] = {
          sent: 0,
          success: 0,
          failure: 0,
          successRate: 0,
        };
      }

      const count = stat._count.id;
      variantData[variantKey].sent += count;

      // 성공 상태: SENT, DELIVERED
      if (['SENT', 'DELIVERED'].includes(stat.status)) {
        variantData[variantKey].success += count;
      }
      // 실패 상태: FAILED, ABANDONED
      else if (['FAILED', 'ABANDONED'].includes(stat.status)) {
        variantData[variantKey].failure += count;
      }
      // PENDING, SKIPPED는 아직 결과 없음 (미포함)
    }

    // 5. 성공률 계산
    Object.entries(variantData).forEach(([key, data]) => {
      data.successRate = calculateSuccessRate(data.success, data.sent);
    });

    logger.debug('[GET /variants/stats] Computed variants', { variantData });

    // 6. A/B 비교 (두 Variant이 모두 있을 경우만)
    const variantA = variantData['A'];
    const variantB = variantData['B'];

    let chiSquareResult = null;
    let cramersV = 0;
    let recommendation: "A" | "B" | null = null;
    let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";

    if (variantA && variantB && variantA.sent > 0 && variantB.sent > 0) {
      // Chi-square 검정
      chiSquareResult = calculateChiSquare(
        variantA.success,
        variantA.failure,
        variantB.success,
        variantB.failure
      );

      // 효과 크기 (Cramer's V)
      cramersV = calculateCramersV(
        variantA.success,
        variantA.failure,
        variantB.success,
        variantB.failure
      );

      // 신뢰도 판정
      confidence = determineConfidenceLevel(
        chiSquareResult.isSignificant,
        cramersV
      );

      // 추천 (성공률이 높은 쪽)
      if (variantA.successRate > variantB.successRate) {
        recommendation = 'A';
      } else if (variantB.successRate > variantA.successRate) {
        recommendation = 'B';
      }
      // 동등한 경우 recommendation = null
    }

    // 7. 해석 문구 생성
    const interpretation = generateInterpretation(
      recommendation,
      chiSquareResult?.isSignificant ?? false,
      chiSquareResult?.pValue ?? 1,
      confidence
    );

    // 8. 샘플 크기 권장사항
    const sampleSizeRecommendation =
      variantA && variantB
        ? getSampleSizeRecommendation(variantA.sent, variantB.sent)
        : null;

    // 9. 응답 구성
    const response = {
      ok: true,
      campaign: {
        id: params.id,
        title: campaign.title,
        status: campaign.status,
      },
      variants: variantData,
      analysis: {
        chiSquare: chiSquareResult,
        cramersV: Number(cramersV.toFixed(4)),
        recommendation,
        confidence,
        interpretation,
      },
      metadata: {
        calculatedAt: new Date().toISOString(),
        sampleSizeRecommendation,
      },
    };

    logger.info('[GET /variants/stats] Analysis complete', {
      campaignId: params.id,
      variantCount: Object.keys(variantData).length,
      recommendation,
      significance: chiSquareResult?.isSignificant,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[GET /variants/stats] Error', {
      error,
      campaignId: params.id,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
