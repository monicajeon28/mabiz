/**
 * PATCH /api/links/ab-tests/[testId]/declare-winner
 *
 * A/B 테스트 우승자 선택
 * 통계적으로 유의미한 결과만 우승자 선택 가능
 *
 * Request body:
 * {
 *   "winner": "A" | "B"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "A가 우승했습니다!",
 *   "test": { ... }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { calculateChiSquare } from '@/lib/ab-test-statistics';

interface DeclareWinnerRequest {
  winner: 'A' | 'B';
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { testId: string } }
): Promise<NextResponse> {
  try {
    const ctx = await getAuthContext().catch(() => null);
    if (!ctx?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { winner } = (await req.json()) as DeclareWinnerRequest;

    if (!['A', 'B'].includes(winner)) {
      return NextResponse.json(
        { error: 'Invalid winner: must be "A" or "B"' },
        { status: 400 }
      );
    }

    // Step 1: 테스트 조회
    const test = await prisma.shortLinkABTest.findUnique({
      where: { id: params.testId }
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Step 2: 권한 확인
    if (ctx.role !== 'GLOBAL_ADMIN' && test.createdBy !== ctx.userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Step 3: 통계 검증 (p-value < 0.05인지 확인)
    const clicksA = await prisma.shortLinkClick.count({
      where: { linkId: test.variantA_id }
    });

    const clicksB = await prisma.shortLinkClick.count({
      where: { linkId: test.variantB_id }
    });

    const impressionsA = await prisma.shortLinkImpression.count({
      where: { shortLinkId: test.variantA_id }
    });

    const impressionsB = await prisma.shortLinkImpression.count({
      where: { shortLinkId: test.variantB_id }
    });

    // 최소 샘플 크기 확인
    const minImpressions = 100;
    if (impressionsA < minImpressions || impressionsB < minImpressions) {
      return NextResponse.json(
        {
          error: `샘플 크기 부족 (목표: ${minImpressions}, 현재: A=${impressionsA}, B=${impressionsB})`
        },
        { status: 400 }
      );
    }

    // Chi-Square 계산 및 p-value 확인
    const { chiSquare } = calculateChiSquare(
      clicksA,
      clicksB,
      impressionsA,
      impressionsB
    );

    const pValue = approximateChiSquarePValue(chiSquare);

    if (pValue >= 0.05) {
      return NextResponse.json(
        {
          error: `통계적으로 유의하지 않습니다 (p-value: ${pValue.toFixed(4)}, 기준: 0.05)`
        },
        { status: 400 }
      );
    }

    // Step 4: 우승자 저장
    const updated = await prisma.shortLinkABTest.update({
      where: { id: params.testId },
      data: {
        status: `WINNER_${winner.toUpperCase()}`,
        winner: winner.toUpperCase(),
        completedAt: new Date(),
        pValue,
      }
    });

    return NextResponse.json({
      success: true,
      message: `${winner}가 우승했습니다!`,
      test: updated
    });
  } catch (error) {
    logger.error('[declare-winner] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: '우승자 선택 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * Chi-Square p-value 근사 함수
 * df=1일 때의 lookup 테이블 사용
 */
function approximateChiSquarePValue(chiSquare: number): number {
  const lookupTable: Array<[number, number]> = [
    [0, 1.0],
    [0.455, 0.5],
    [1.074, 0.3],
    [1.642, 0.2],
    [2.706, 0.1],
    [3.841, 0.05],
    [5.412, 0.02],
    [6.635, 0.01],
    [7.879, 0.005],
    [10.828, 0.001],
  ];

  // 정확한 범위 찾기
  for (let i = 0; i < lookupTable.length - 1; i++) {
    if (chiSquare >= lookupTable[i][0] && chiSquare <= lookupTable[i + 1][0]) {
      const x0 = lookupTable[i][0];
      const y0 = lookupTable[i][1];
      const x1 = lookupTable[i + 1][0];
      const y1 = lookupTable[i + 1][1];

      // 선형 보간
      return y0 + ((chiSquare - x0) / (x1 - x0)) * (y1 - y0);
    }
  }

  // chi-square가 모든 값을 초과하면 매우 작은 p-value
  if (chiSquare > 10.828) {
    return 0.001;
  }

  return 1.0;
}
