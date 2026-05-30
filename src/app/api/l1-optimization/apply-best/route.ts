/**
 * POST /api/l1-optimization/apply-best
 * Menu #54: L1 렌즈 최적 A/B 변형 자동 적용
 *
 * 기능:
 * 1. 특정 Contact/Segment에 최적 변형 자동 선택
 * 2. Contact 레벨: 해당 Contact의 과거 성공률 기반
 * 3. Segment 레벨: 이의 유형별 평균 전환율 기반
 * 4. 조직 기본값 레벨: 해당 조직의 전사 최고 성과 변형
 * 5. 자동 SMS 발송 (필요 시)
 *
 * 의사결정 알고리즘 (우선순위):
 * 1. Contact의 과거 성공 변형 (L1OptimizationScore.bestVariant) - 개인화
 * 2. 같은 objectiveType의 최고 성과 변형 - 데이터 기반
 * 3. 같은 조직의 전사 최고 성과 변형 (fallback)
 *
 * 반환:
 * - selectedVariant: A/B 변형
 * - expectedConversionRate: 예상 전환율
 * - reasonForSelection: 선택 이유
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateOrgMembership } from '@/app/api/_auth/validate-agent-role';
import { sendL1SMS } from '@/lib/l1-optimization/sms-sender';
import logger from '@/lib/logger';

interface L1ApplyBestRequest {
  organizationId: string;
  contactId: string;
  objectiveType: string;
  autoSendSMS?: boolean; // 최적 변형으로 자동 SMS 발송 여부
  segmentId?: string; // 세그먼트 기반 최적화 (optional)
}

interface L1ApplyBestResponse {
  success: boolean;
  data?: {
    selectedVariantId: string;
    selectedVariantType: string;
    copyAngle: string;
    psychologyLens: string;
    messageTemplate: string;
    expectedConversionRate: number;
    reasonForSelection: string; // "PERSONALIZED" | "DATA_DRIVEN" | "ORGANIZATION_BASELINE"
    smsSentAt?: string; // 자동 발송한 경우
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<L1ApplyBestResponse>> {
  try {
    const body = await request.json() as L1ApplyBestRequest;
    const { organizationId, contactId, objectiveType, autoSendSMS = false, segmentId } = body;

    // 1. 인증 및 권한 확인
    const authResult = validateOrgMembership(request);
    if (authResult !== true) {
      return authResult as unknown as NextResponse;
    }

    // 2. Contact 확인
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        organizationId: true,
        phone: true,
      },
    });

    if (!contact || contact.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    // 3. Contact 레벨 최적화 점수 조회
    const optimizationScore = await prisma.l1OptimizationScore.findUnique({
      where: { organizationId_contactId: { organizationId, contactId } },
    });

    let selectedVariant = null;
    let reasonForSelection = 'ORGANIZATION_BASELINE';

    // Phase 1: Contact 개인화 (bestVariant 있는 경우)
    if (optimizationScore?.bestVariant) {
      selectedVariant = await prisma.l1ABTestVariant.findFirst({
        where: {
          organizationId,
          objectiveType,
          variantType: optimizationScore.bestVariant,
          isActive: true,
        },
      });

      if (selectedVariant) {
        reasonForSelection = 'PERSONALIZED';
      }
    }

    // Phase 2: 데이터 기반 (같은 objectiveType의 최고 성과)
    if (!selectedVariant) {
      selectedVariant = await prisma.l1ABTestVariant.findFirst({
        where: {
          organizationId,
          objectiveType,
          isActive: true,
        },
        orderBy: { conversionRate: 'desc' },
      });

      if (selectedVariant) {
        reasonForSelection = 'DATA_DRIVEN';
      }
    }

    // Phase 3: 조직 기본값 (전사 최고 성과)
    if (!selectedVariant) {
      selectedVariant = await prisma.l1ABTestVariant.findFirst({
        where: {
          organizationId,
          isActive: true,
        },
        orderBy: { conversionRate: 'desc' },
      });

      if (selectedVariant) {
        reasonForSelection = 'ORGANIZATION_BASELINE';
      }
    }

    if (!selectedVariant) {
      return NextResponse.json(
        { success: false, error: 'No active variant found' },
        { status: 404 }
      );
    }

    // 4. L1OptimizationScore 업데이트 (bestVariant 반영)
    if (!optimizationScore) {
      await prisma.l1OptimizationScore.create({
        data: {
          organizationId,
          contactId,
          currentScore: 0,
          bestVariant: selectedVariant.variantType,
          totalAttempts: 0,
          successCount: 0,
        },
      });
    } else if (reasonForSelection !== 'ORGANIZATION_BASELINE') {
      // 개인화된 선택만 bestVariant로 저장
      await prisma.l1OptimizationScore.update({
        where: { id: optimizationScore.id },
        data: {
          bestVariant: selectedVariant.variantType,
          lastUpdated: new Date(),
        },
      });
    }

    // 5. 자동 SMS 발송 (필요 시)
    let smsSentAt: string | undefined;
    if (autoSendSMS && contact.phone) {
      const smsResult = await sendL1SMS({
        organizationId,
        contactId,
        phoneNumber: contact.phone,
        messageTemplate: selectedVariant.messageTemplate,
        copyAngle: selectedVariant.copyAngle,
      });

      if (smsResult.success) {
        smsSentAt = new Date().toISOString();

        // L1PriceObjectionAttempt 레코드 생성 (자동 발송)
        await prisma.l1PriceObjectionAttempt.create({
          data: {
            organizationId,
            contactId,
            objectiveType,
            responseMethod: selectedVariant.copyAngle as string,
            smsVariant: selectedVariant.variantType,
            sentAt: new Date(),
          },
        });
      }
    }

    logger.info(`[L1] Best variant applied`, {
      contactId,
      variantId: selectedVariant.id,
      variantType: selectedVariant.variantType,
      reason: reasonForSelection,
      autoSendSMS,
    });

    return NextResponse.json({
      success: true,
      data: {
        selectedVariantId: selectedVariant.id,
        selectedVariantType: selectedVariant.variantType,
        copyAngle: selectedVariant.copyAngle,
        psychologyLens: selectedVariant.psychologyLens,
        messageTemplate: selectedVariant.messageTemplate,
        expectedConversionRate: selectedVariant.conversionRate || 0,
        reasonForSelection,
        smsSentAt,
      },
    });
  } catch (error) {
    logger.error('[L1] apply-best route error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
