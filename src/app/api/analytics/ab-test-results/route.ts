/**
 * GET /api/analytics/ab-test-results?testId=xxx
 *
 * UI용 A/B 테스트 통계 결과 API
 * Team 2 통계 엔진의 결과를 받아서 UI가 이해할 수 있는 형태로 변환
 *
 * Response:
 * {
 *   "testId": "test-123",
 *   "testName": "6월 배너 테스트",
 *   "status": "ACTIVE" | "WINNER_A" | "WINNER_B" | "PAUSED",
 *   "summary": {
 *     "statusMessage": "우승자 판정 가능! 신뢰도 98%",
 *     "statusType": "significant" | "pending",
 *     "confidence": 98,
 *     "pValue": 0.023
 *   },
 *   "details": {
 *     "variantA": { code, title, impressions, clicks, ctr },
 *     "variantB": { code, title, impressions, clicks, ctr },
 *     "statistics": { chiSquare, pValue, isSignificant }
 *   },
 *   "nextAction": "declare_winner" | "continue_collecting" | "test_completed" | "test_paused"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { calculateChiSquare } from '@/lib/ab-test-statistics';

interface ABTestResultResponse {
  testId: string;
  testName: string;
  status: string;
  summary: {
    statusMessage: string;
    statusType: 'pending' | 'significant';
    confidence: number;
    pValue: number;
  };
  details: {
    variantA: {
      code: string;
      title: string | null;
      impressions: number;
      clicks: number;
      ctr: string;
    };
    variantB: {
      code: string;
      title: string | null;
      impressions: number;
      clicks: number;
      ctr: string;
    };
    statistics: {
      chiSquare: number;
      pValue: number;
      isSignificant: boolean;
    };
  };
  nextAction: 'declare_winner' | 'continue_collecting' | 'test_completed' | 'test_paused';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await getAuthContext().catch(() => null);
    if (!ctx?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const testId = searchParams.get('testId');

    if (!testId) {
      return NextResponse.json(
        { error: 'testId is required' },
        { status: 400 }
      );
    }

    // Step 1: A/B 테스트 조회
    const test = await prisma.shortLinkABTest.findUnique({
      where: { id: testId },
      include: {
        variantA: { select: { id: true, code: true, title: true } },
        variantB: { select: { id: true, code: true, title: true } },
      }
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    // Step 2: 권한 확인 (자신의 테스트인가?)
    if (ctx.role !== 'GLOBAL_ADMIN' && test.createdBy !== ctx.userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Step 3: 클릭 데이터 수집 [P0 FIX #2] 테스트 시작 이후 데이터만 카운팅
    const clicksA = await prisma.shortLinkClick.count({
      where: {
        linkId: test.variantA_id,
        clickedAt: { gte: test.createdAt } // ← 테스트 시작 이후만
      }
    });

    const clicksB = await prisma.shortLinkClick.count({
      where: {
        linkId: test.variantB_id,
        clickedAt: { gte: test.createdAt } // ← 테스트 시작 이후만
      }
    });

    // Step 4: 노출 데이터 수집 [P0 FIX #2] 테스트 시작 이후 데이터만 카운팅
    const impressionsA = await prisma.shortLinkImpression.count({
      where: {
        shortLinkId: test.variantA_id,
        sentAt: { gte: test.createdAt } // ← 테스트 시작 이후만
      }
    });

    const impressionsB = await prisma.shortLinkImpression.count({
      where: {
        shortLinkId: test.variantB_id,
        sentAt: { gte: test.createdAt } // ← 테스트 시작 이후만
      }
    });

    // Step 5: 통계 계산 (Team 2 엔진)
    const { chiSquare } = calculateChiSquare(
      clicksA,
      clicksB,
      impressionsA,
      impressionsB
    );

    // p-value 계산 (Chi-Square 분포 테이블 사용)
    const pValue = approximateChiSquarePValue(chiSquare);

    // [P0 FIX #1] 반올림 일관성: summary와 details에서 동일한 반올림된 값 사용
    const pValueRounded = Math.round(pValue * 10000) / 10000; // 4자리까지만
    const chiSquareRounded = Math.round(chiSquare * 100) / 100;

    const ctrA = impressionsA > 0 ? clicksA / impressionsA : 0;
    const ctrB = impressionsB > 0 ? clicksB / impressionsB : 0;

    // Step 6: UI용 메시지 생성
    let statusMessage = '';
    let statusType: 'pending' | 'significant' = 'pending';
    let confidence = 0;

    if (pValue < 0.05) {
      // 통계적으로 유의미 (원본 pValue로 판정, 반올림 전)
      statusType = 'significant';
      confidence = Math.round((1 - pValue) * 100);
      statusMessage = `우승자 판정 가능! 신뢰도 ${confidence}%`;
    } else {
      // 아직 부족
      statusType = 'pending';
      confidence = 0;

      const minRequired = 100;
      const currentSample = Math.max(impressionsA, impressionsB);

      if (currentSample < minRequired) {
        const minNeeded = minRequired - currentSample;
        statusMessage = `더 수집 중... (${minNeeded}회 더 필요)`;
      } else {
        statusMessage = `아직 명확하지 않습니다 (계속 기다려주세요)`;
      }
    }

    // Step 7: 응답 구성
    const response: ABTestResultResponse = {
      testId,
      testName: test.testName,
      status: test.status,

      // UI에 표시할 간단한 정보
      summary: {
        statusMessage,
        statusType,
        confidence,
        pValue: pValueRounded, // [P0 FIX #1] 일관성: 반올림된 값
      },

      // 세부 통계 (클릭 시 "더보기")
      details: {
        variantA: {
          code: test.variantA.code,
          title: test.variantA.title,
          impressions: impressionsA,
          clicks: clicksA,
          ctr: impressionsA > 0
            ? (Math.round(ctrA * 10000) / 100).toFixed(2) + '%'
            : '0%',
        },
        variantB: {
          code: test.variantB.code,
          title: test.variantB.title,
          impressions: impressionsB,
          clicks: clicksB,
          ctr: impressionsB > 0
            ? (Math.round(ctrB * 10000) / 100).toFixed(2) + '%'
            : '0%',
        },
        statistics: {
          chiSquare: chiSquareRounded,
          pValue: pValueRounded, // [P0 FIX #1] 일관성: summary와 동일한 값
          isSignificant: pValue < 0.05,
        },
      },

      // 다음 액션
      nextAction: test.status === 'ACTIVE' ? (
        pValue < 0.05 && impressionsA >= 100 && impressionsB >= 100
          ? 'declare_winner'
          : 'continue_collecting'
      ) : test.status === 'WINNER_A' || test.status === 'WINNER_B'
        ? 'test_completed'
        : 'test_paused',
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[ab-test-results] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
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
