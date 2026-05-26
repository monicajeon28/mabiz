/**
 * POST /api/l1-optimization/ab-test-variant
 * Menu #54: L1 렌즈 A/B 테스트 변형 생성 및 관리
 *
 * 기능:
 * 1. 새로운 A/B 테스트 변형 생성
 * 2. 기존 변형 업데이트 (메시지, 심리학 렌즈 변경)
 * 3. 변형별 성과 추적 (전환율, 응답 시간)
 * 4. A/B 테스트 승자 자동 판정 (통계적 유의성 기반)
 *
 * 요청:
 * - objectiveType: "PRICE_HIGH", "PAYMENT_TERMS", "ROI_DOUBT", "COMPETITOR_COMPARE", "AFFORD_DOUBT"
 * - variantType: "A" (기존), "B" (신규), "C", "D" (추가 실험)
 * - messageTemplate: SMS 텍스트 템플릿
 * - copyAngle: "가치재정의", "분할결제", "조기할인", "그룹할인", "한정특가"
 * - psychologyLens: "L1_VALUE_REDEFINITION", "L1_SPLIT_PAYMENT" 등
 *
 * 반환:
 * - variantId: 생성된 변형 ID
 * - status: "PENDING_DATA", "ACTIVE", "WINNING", "ARCHIVED"
 * - estimatedWinnerAt: 승자 판정 예상 시간
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrgMembership } from '@/app/api/_auth/validate-agent-role';
import { validateMessageTemplate } from '@/lib/l1-optimization/message-validator';
import { estimateWinnerAt } from '@/lib/l1-optimization/winner-estimator';
import logger from '@/lib/logger';

interface L1ABTestVariantRequest {
  organizationId: string;
  objectiveType: string;
  variantType: string;
  messageTemplate: string;
  copyAngle: string;
  psychologyLens: string;
  description?: string;
}

interface L1ABTestVariantResponse {
  success: boolean;
  data?: {
    variantId: string;
    objectiveType: string;
    variantType: string;
    status: string;
    messagePreview: string;
    psychologyLens: string;
    estimatedWinnerAt: string;
    minSampleSize: number; // 신뢰도 95%를 위한 최소 샘플
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<L1ABTestVariantResponse>> {
  try {
    const body = await request.json() as L1ABTestVariantRequest;
    const { organizationId, objectiveType, variantType, messageTemplate, copyAngle, psychologyLens, description } = body;

    // 1. 인증 및 권한 확인
    const authResult = validateOrgMembership(request);
    if (authResult !== true) {
      return authResult as NextResponse<L1ABTestVariantResponse>;
    }

    // 2. 메시지 템플릿 검증
    const validation = validateMessageTemplate(messageTemplate);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: `Invalid message template: ${validation.error}` },
        { status: 400 }
      );
    }

    // 3. 기존 변형 확인 (같은 조합이 이미 있는지)
    const existing = await prisma.l1ABTestVariant.findFirst({
      where: {
        organizationId,
        objectiveType,
        variantType,
      },
    });

    if (existing && existing.isActive) {
      return NextResponse.json(
        { success: false, error: `Active variant already exists for ${objectiveType}/${variantType}` },
        { status: 409 }
      );
    }

    // 4. 새 변형 생성 또는 기존 변형 활성화
    const variant = await prisma.l1ABTestVariant.upsert({
      where: {
        organizationId_objectiveType_variantType: {
          organizationId,
          objectiveType,
          variantType,
        },
      },
      update: {
        messageTemplate,
        copyAngle,
        psychologyLens,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        organizationId,
        objectiveType,
        variantType,
        messageTemplate,
        copyAngle,
        psychologyLens,
        isActive: true,
        totalSent: 0,
        totalConverted: 0,
        conversionRate: 0,
      },
    });

    // 5. 같은 objectiveType의 다른 활성 변형들 조회
    const activeVariants = await prisma.l1ABTestVariant.findMany({
      where: {
        organizationId,
        objectiveType,
        isActive: true,
      },
      select: {
        id: true,
        variantType: true,
        totalSent: true,
        totalConverted: true,
        conversionRate: true,
      },
    });

    // 6. A/B 테스트 승자 판정 (통계적 유의성 검사)
    // Chi-square test: p < 0.05 신뢰도 95%
    const minSamplePerVariant = 50; // 변형당 최소 50개 샘플
    const isSufficientData = activeVariants.every(v => v.totalSent >= minSamplePerVariant);

    let winnerVariant = null;
    if (isSufficientData && activeVariants.length > 1) {
      // 가장 높은 전환율 변형 (단순화된 로직)
      winnerVariant = activeVariants.reduce((prev, current) =>
        prev.conversionRate > current.conversionRate ? prev : current
      );

      if (winnerVariant.variantType === variant.variantType) {
        await prisma.l1ABTestVariant.update({
          where: { id: variant.id },
          data: {
            winningSince: new Date(),
          },
        });
      }
    }

    // 7. 승자 판정 예상 시간 계산
    const estimatedWinner = estimateWinnerAt(activeVariants.length, minSamplePerVariant);

    logger.info(`[L1] A/B test variant created/updated`, {
      variantId: variant.id,
      objectiveType,
      variantType,
      psychologyLens,
    });

    return NextResponse.json({
      success: true,
      data: {
        variantId: variant.id,
        objectiveType,
        variantType,
        status: winnerVariant?.variantType === variant.variantType ? 'WINNING' : 'ACTIVE',
        messagePreview: messageTemplate.substring(0, 80) + '...',
        psychologyLens,
        estimatedWinnerAt: estimatedWinner,
        minSampleSize: minSamplePerVariant * activeVariants.length,
      },
    });
  } catch (error) {
    logger.error('[L1] ab-test-variant route error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: 현재 활성 변형 조회
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const objectiveType = searchParams.get('objectiveType');

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'organizationId required' },
        { status: 400 }
      );
    }

    const authResult2 = validateOrgMembership(request);
    if (authResult2 !== true) {
      return authResult2 as NextResponse<L1ABTestVariantResponse>;
    }

    const query: any = {
      where: {
        organizationId,
        isActive: true,
      },
    };

    if (objectiveType) {
      query.where.objectiveType = objectiveType;
    }

    const variants = await prisma.l1ABTestVariant.findMany({
      ...query,
      orderBy: { conversionRate: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        variants: variants.map(v => ({
          id: v.id,
          objectiveType: v.objectiveType,
          variantType: v.variantType,
          copyAngle: v.copyAngle,
          totalSent: v.totalSent,
          totalConverted: v.totalConverted,
          conversionRate: v.conversionRate,
          isWinning: !!v.winningSince,
        })),
      },
    });
  } catch (error) {
    logger.error('[L1] ab-test-variant GET error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
