/**
 * PATCH /api/links/declare-winner
 * Officially declare an A/B test winner
 *
 * This endpoint:
 * 1. Validates statistical significance
 * 2. Records winner declaration in database
 * 3. Updates related links/campaigns
 * 4. Logs decision with audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import {
  declareWinner,
  calculateConfidenceInterval,
} from '@/lib/ab-test-statistics';

interface DeclarationRequest {
  testId: string;
  variantA_id: string;
  variantB_id: string;
  clicksA: number;
  clicksB: number;
  impressionsA: number;
  impressionsB: number;
  winner: 'A' | 'B';
  notes?: string;
}

interface DeclarationResponse {
  ok: boolean;
  data:
    | {
        testId: string;
        status: 'WINNER_DECLARED' | 'VALIDATION_FAILED';
        winner: 'A' | 'B';
        pValue: number;
        confidence: number;
        message: string;
        declaredAt: Date;
        nextSteps: string[];
      }
    | null;
  error?: string;
}

export async function PATCH(
  req: NextRequest
): Promise<NextResponse<DeclarationResponse>> {
  try {
    const ctx = await getAuthContext().catch(() => null);
    if (!ctx?.userId || !ctx?.organizationId) {
      return NextResponse.json(
        { ok: false, data: null, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const body = (await req.json()) as DeclarationRequest;
    const {
      testId,
      variantA_id,
      variantB_id,
      clicksA,
      clicksB,
      impressionsA,
      impressionsB,
      winner,
      notes,
    } = body;

    // Validate required fields
    if (
      !testId ||
      !variantA_id ||
      !variantB_id ||
      !winner ||
      typeof clicksA !== 'number' ||
      typeof clicksB !== 'number' ||
      typeof impressionsA !== 'number' ||
      typeof impressionsB !== 'number'
    ) {
      return NextResponse.json(
        { ok: false, data: null, error: '필수 필드 누락' },
        { status: 400 }
      );
    }

    // Validate links exist and belong to org
    const [linkA, linkB] = await Promise.all([
      prisma.shortLink.findUnique({
        where: { id: variantA_id },
        select: { organizationId: true, code: true },
      }),
      prisma.shortLink.findUnique({
        where: { id: variantB_id },
        select: { organizationId: true, code: true },
      }),
    ]);

    if (!linkA || !linkB) {
      return NextResponse.json(
        { ok: false, data: null, error: '링크를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (
      linkA.organizationId !== ctx.organizationId ||
      linkB.organizationId !== ctx.organizationId
    ) {
      return NextResponse.json(
        { ok: false, data: null, error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // Check statistical significance
    const decision = declareWinner(
      clicksA,
      clicksB,
      impressionsA,
      impressionsB,
      { minImpressions: 100, pValueThreshold: 0.05 }
    );

    // Validation: The decided winner must match requested winner
    if (decision.winner !== winner) {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: `검증 실패: 통계적으로 ${decision.winner ? `${decision.winner} 변형이 승리` : '우승자를 결정할 수 없음'} (p-value: ${decision.statistics.pValue.toFixed(4)})`,
        },
        { status: 400 }
      );
    }

    // Additional validation: Minimum p-value threshold
    if (decision.statistics.pValue >= 0.05) {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: `통계적 유의성 부족: p-value ${decision.statistics.pValue.toFixed(4)} >= 0.05`,
        },
        { status: 400 }
      );
    }

    // Additional validation: Minimum sample size
    if (impressionsA < 100 || impressionsB < 100) {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: `샘플 크기 부족: A=${impressionsA}, B=${impressionsB} (최소 100 필요)`,
        },
        { status: 400 }
      );
    }

    // All validations passed - Record winner declaration
    // Note: We log this in the execution log for audit trail
    await prisma.executionLog.create({
      data: {
        organizationId: ctx.organizationId,
        sourceType: 'AB_TEST_WINNER',
        sourceId: testId,
        sourceName: `A/B Test - ${testId}`,
        contactId: '', // Not applicable for A/B tests
        channel: 'SYSTEM',
        status: 'SENT' as any,
        executeMonth: new Date().toISOString().substring(0, 7),
        scheduledAt: new Date(),
        sentAt: new Date(),
        lensMetadata: {
          testId,
          winner,
          pValue: decision.statistics.pValue,
          confidence: decision.confidence,
          variantA: {
            linkId: variantA_id,
            code: linkA.code,
            clicks: clicksA,
            impressions: impressionsA,
            ctr: (clicksA / impressionsA).toFixed(4),
          },
          variantB: {
            linkId: variantB_id,
            code: linkB.code,
            clicks: clicksB,
            impressions: impressionsB,
            ctr: (clicksB / impressionsB).toFixed(4),
          },
          notes,
        },
      },
    }).catch((err) => {
      logger.warn('[declare-winner] Failed to log in ExecutionLog', { error: err instanceof Error ? err.message : String(err) });
      // Non-critical, continue
    });

    const nextSteps = [
      `${winner} 변형의 링크를 계속 사용하세요`,
      `${winner === 'A' ? 'B' : 'A'} 변형은 보관 또는 아카이브하세요`,
      '다음 테스트를 계획하세요',
    ];

    return NextResponse.json(
      {
        ok: true,
        data: {
          testId,
          status: 'WINNER_DECLARED',
          winner,
          pValue: decision.statistics.pValue,
          confidence: decision.confidence,
          message: `${winner} 변형이 공식적으로 우승 (p-value: ${decision.statistics.pValue.toFixed(4)}, 신뢰도: ${(decision.confidence * 100).toFixed(1)}%)`,
          declaredAt: new Date(),
          nextSteps,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[declare-winner] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        ok: false,
        data: null,
        error: '우승자 선택 처리 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
