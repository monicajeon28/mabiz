/**
 * POST /api/l1-optimization/price-objection
 * Menu #54: L1 렌즈 (가격 이의) 자동 감지 및 대응
 *
 * 기능:
 * 1. 고객의 가격 이의를 감지 (keyword detection)
 * 2. 이의 유형 분류 (PRICE_HIGH, PAYMENT_TERMS, ROI_DOUBT, COMPETITOR_COMPARE, AFFORD_DOUBT)
 * 3. 최적 대응 방식 선택 (VALUE_REDEFINITION, SPLIT_PAYMENT, EARLY_BOOKING, GROUP_DISCOUNT, LIMITED_TIME)
 * 4. A/B 테스트 변형 선택 (A 또는 B)
 * 5. SMS 발송 및 추적
 *
 * 심리학 프레임워크:
 * - L1 손실회피: "지금 결정하지 않으면 놓칠 가치" 강조
 * - PASONA 프레임워크: 가치 재정의 (Solution → Offer)
 * - SPIN 질문: Payoff 강화 (비용 대비 효과)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { detectL1ObjectiveType } from '@/lib/l1-optimization/objective-detector';
import { selectOptimalResponseMethod } from '@/lib/l1-optimization/response-selector';
import { getABTestVariant } from '@/lib/l1-optimization/ab-test-selector';
import { sendL1SMS } from '@/lib/l1-optimization/sms-sender';
import { updateL1OptimizationScore } from '@/lib/l1-optimization/score-updater';
import logger from '@/lib/logger';

interface L1PriceObjectionRequest {
  organizationId: string;
  contactId: string;
  initialResponse: string; // 고객의 이의 내용 또는 음성 텍스트
  channel?: 'SMS' | 'CALL' | 'EMAIL'; // 어디서 감지되었는가
  agentId?: string; // 담당 에이전트
}

interface L1PriceObjectionResponse {
  success: boolean;
  data?: {
    attemptId: string;
    objectiveType: string; // 이의 유형
    responseMethod: string; // 대응 방식
    smsVariant: string; // A 또는 B
    messagePreview: string; // SMS 미리보기
    scheduledSendAt: string; // 발송 예정 시간
    predictedConversionRate: number; // 예상 전환율 (%)
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<L1PriceObjectionResponse>> {
  try {
    const ctx = await getAuthContext().catch(() => null);
    if (!ctx?.userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const organizationId = resolveOrgId(ctx);

    const body = await request.json() as L1PriceObjectionRequest;
    const { contactId, initialResponse, channel = 'SMS', agentId } = body;

    // 2. Contact 확인
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        organizationId: true,
        phone: true,
        name: true,
      },
    });

    if (!contact || contact.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    // 3. L1 이의 유형 감지
    const objectiveType = detectL1ObjectiveType(initialResponse);

    // 4. 최적 대응 방식 선택 (점수 기반)
    const responseMethod = await selectOptimalResponseMethod(organizationId, objectiveType);

    // 5. 해당 방식의 A/B 테스트 변형 선택
    const abTestVariant = await getABTestVariant(organizationId, objectiveType, responseMethod);
    if (!abTestVariant) {
      logger.warn(`[L1] No A/B test variant found for ${objectiveType} / ${responseMethod}`);
      return NextResponse.json(
        { success: false, error: 'No active A/B test variant' },
        { status: 400 }
      );
    }

    // 6. 기존 이의 기록 확인 (재시도 횟수 계산)
    const previousAttempts = await prisma.l1PriceObjectionAttempt.count({
      where: {
        organizationId,
        contactId,
      },
    });
    const attemptNumber = previousAttempts + 1;

    // 7. SMS 발송 및 L1PriceObjectionAttempt 생성
    const smsResult = await sendL1SMS({
      organizationId,
      contactId,
      phoneNumber: contact.phone,
      messageTemplate: abTestVariant.messageTemplate,
      copyAngle: abTestVariant.copyAngle,
    });

    // 8. L1PriceObjectionAttempt 레코드 생성
    const attempt = await prisma.l1PriceObjectionAttempt.create({
      data: {
        organizationId,
        contactId,
        objectiveType,
        attemptNumber,
        initialResponse,
        responseMethod,
        smsVariant: abTestVariant.variantType,
        sentAt: new Date(),
      },
    });

    // 9. L1 최적화 점수 업데이트
    await updateL1OptimizationScore(organizationId, contactId, objectiveType);

    // 10. A/B 테스트 변형 통계 업데이트
    await prisma.l1ABTestVariant.update({
      where: { id: abTestVariant.id },
      data: {
        totalSent: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    logger.info(`[L1] Price objection attempt created`, {
      attemptId: attempt.id,
      objectiveType,
      responseMethod,
      variant: abTestVariant.variantType,
      attemptNumber,
    });

    return NextResponse.json({
      success: true,
      data: {
        attemptId: attempt.id,
        objectiveType,
        responseMethod,
        smsVariant: abTestVariant.variantType,
        messagePreview: abTestVariant.messageTemplate.substring(0, 100) + '...',
        scheduledSendAt: new Date(Date.now() + 2000).toISOString(), // 즉시 발송
        predictedConversionRate: (abTestVariant.conversionRate || 45) * (1 + attemptNumber * 0.05), // 재시도 시 상승
      },
    });
  } catch (error) {
    logger.error('[L1] price-objection route error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
