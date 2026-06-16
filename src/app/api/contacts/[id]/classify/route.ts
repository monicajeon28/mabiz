/**
 * POST /api/contacts/[id]/classify
 * Domain A (CRM 거장) P0 엔드포인트
 *
 * 특정 Contact를 렌즈 분류 + Risk Flag + Auto-Segmentation 실행
 * - L0-L10 렌즈 자동 감지
 * - 10가지 Risk Flag 계산
 * - 자동 세그먼트 할당
 * - ContactLensClassification 기록 저장
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { detectContactLens } from '@/lib/contact-lens-detection';
import { calculateContactRiskFlags } from '@/lib/contact-risk-flags';
import { segmentizeContact } from '@/lib/contact-auto-segmentation';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<any>>> {
  try {
    const { id } = await params;
    const ctx = await getAuthContext();

    // GLOBAL_ADMIN은 organizationId가 null이어도 접근 가능
    const orgId = ctx.organizationId ?? null;

    // 1. Contact 조회
    const contact = await prisma.contact.findFirst({
      where: { id, ...(orgId ? { organizationId: orgId } : {}) },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    // GLOBAL_ADMIN의 경우 contact.organizationId 사용
    const effectiveOrgId = orgId ?? contact.organizationId;

    // 2. 렌즈 감지
    const lenses = detectContactLens(contact, contact.adminMemo || undefined);

    // 3. Risk Flag 계산
    const riskSummary = calculateContactRiskFlags(contact, contact.adminMemo || undefined);

    // 4. 자동 세그먼테이션
    const segmentationResult = await segmentizeContact(contact, contact.adminMemo || undefined);

    // 5. ContactLensClassification 저장 + Contact 업데이트를 단일 트랜잭션으로 처리
    const [savedClassifications, updatedContact] = await prisma.$transaction(async (tx) => {
      const classifications = [];
      for (const lens of lenses) {
        const classification = await tx.contactLensClassification.upsert({
          where: { id: `${contact.id}-${lens.lensType}` },
          update: {
            lensLabel: lens.lensLabel,
            confidenceScore: lens.confidenceScore,
            identificationMethod: lens.trigger || 'AUTOMATIC',
            decisionLevel: 1, // Decision Level 기본값
            readinessScore: lens.confidenceScore, // Readiness Score = Confidence Score
          },
          create: {
            id: `${contact.id}-${lens.lensType}`,
            organizationId: effectiveOrgId,
            contactId: contact.id,
            lensType: lens.lensType,
            lensLabel: lens.lensLabel,
            confidenceScore: lens.confidenceScore,
            identificationMethod: lens.trigger || 'AUTOMATIC',
            decisionLevel: 1,
            readinessScore: lens.confidenceScore,
          },
        });
        classifications.push(classification);
      }

      // 6. Contact 업데이트: autoSegment + lensMetadata (트랜잭션 내)
      const updated = await tx.contact.update({
        where: { id: contact.id },
        data: {
          autoSegment: segmentationResult.autoSegment.primaryLens,
          segmentOverride: segmentationResult.autoSegment.segmentId,
          lensMetadata: {
            detectedLenses: lenses.map(l => ({ type: l.lensType, confidence: l.confidenceScore })),
            riskScore: riskSummary.totalRiskScore,
            riskLevel: riskSummary.riskLevel,
            segment: segmentationResult.autoSegment.segmentId,
            calculatedAt: new Date().toISOString(),
          },
          segmentUpdatedAt: new Date(),
        },
      });

      return [classifications, updated] as const;
    });

    logger.log('[POST /api/contacts/[id]/classify]', {
      contactId: contact.id,
      organizationId: ctx.organizationId,
      lensDetected: lenses.length,
      riskScore: riskSummary.totalRiskScore,
      segment: segmentationResult.autoSegment.segmentId,
      userId: ctx.userId,
    });

    return NextResponse.json({
      success: true,
      data: {
        contactId: contact.id,
        lenses: lenses.map(l => ({
          type: l.lensType,
          label: l.lensLabel,
          confidence: l.confidenceScore,
          trigger: l.trigger,
        })),
        riskSummary: {
          totalRiskScore: riskSummary.totalRiskScore,
          riskLevel: riskSummary.riskLevel,
          flags: riskSummary.flags.map(f => ({
            type: f.flagType,
            code: f.flagCode,
            severity: f.severity,
            score: f.riskScore,
          })),
        },
        segment: {
          id: segmentationResult.autoSegment.segmentId,
          primaryLens: segmentationResult.autoSegment.primaryLens,
          riskLevel: segmentationResult.autoSegment.riskLevel,
          demographic: segmentationResult.autoSegment.demographicSegment,
          value: segmentationResult.autoSegment.valueSegment,
          description: segmentationResult.autoSegment.description,
          recommendedActions: segmentationResult.autoSegment.recommendedActions,
          nextActionScheduledAt: segmentationResult.autoSegment.nextActionScheduledAt,
        },
        savedClassifications: savedClassifications.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[POST /api/contacts/[id]/classify]', { message: msg });

    return NextResponse.json(
      { success: false, error: '분류 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
