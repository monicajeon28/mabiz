export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getMabizSession } from '@/lib/auth';

/**
 * GET /api/admin/loop5/ab-test-results?days=14
 *
 * Loop 5-C A/B 테스트 결과 조회
 * 변형별 성과 메트릭 계산 (완성율, 신뢰도 등)
 */

interface TestResult {
  variant: string;
  visitors: number;
  completions: number;
  completionRate: number;
  avgCompletionTimeMs: number;
  confidence: number;
  isWinner: boolean;
  segments: Record<string, { visitors: number; completions: number; rate: number }>;
}

// Chi-Square 검정을 위한 p-value 계산 (근사)
function calculateChiSquareSignificance(controlRate: number, variantRate: number, controlN: number, variantN: number): number {
  if (controlN < 30 || variantN < 30) return 0; // 표본 부족

  const controlSuccess = Math.round(controlRate * controlN);
  const variantSuccess = Math.round(variantRate * variantN);
  const controlFail = controlN - controlSuccess;
  const variantFail = variantN - variantSuccess;

  const total = controlN + variantN;
  const expectedSuccess = ((controlSuccess + variantSuccess) / total) * variantN;
  const expectedFail = ((controlFail + variantFail) / total) * variantN;

  const chiSquare =
    Math.pow(variantSuccess - expectedSuccess, 2) / expectedSuccess +
    Math.pow(variantFail - expectedFail, 2) / expectedFail;

  // 간단한 p-value 추정 (χ²(1) = 3.841 at p=0.05)
  return chiSquare > 3.841 ? 95 : 0;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx || !['OWNER', 'GLOBAL_ADMIN'].includes(ctx.role)) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    // 쿼리 파라미터
    const searchParams = new URL(req.url).searchParams;
    const days = parseInt(searchParams.get('days') || '14', 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // FormSubmission 데이터 조회
    const submissions = await prisma.formSubmission.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        variant: true,
        segment: true,
        completionTimeMs: true,
        ageRange: true,
        preferenceType: true,
        createdAt: true,
      },
    });

    // 변형별 집계
    const variantStats: Record<string, { visitors: number; times: number[] }> = {
      a: { visitors: 0, times: [] },
      b: { visitors: 0, times: [] },
      c: { visitors: 0, times: [] },
    };

    const segmentStats: Record<string, Record<string, { visitors: number; times: number[] }>> = {
      a: {},
      b: {},
      c: {},
    };

    for (const sub of submissions) {
      const variant = sub.variant as 'a' | 'b' | 'c';
      variantStats[variant].visitors++;
      variantStats[variant].times.push(sub.completionTimeMs);

      if (!segmentStats[variant][sub.segment]) {
        segmentStats[variant][sub.segment] = { visitors: 0, times: [] };
      }
      segmentStats[variant][sub.segment].visitors++;
      segmentStats[variant][sub.segment].times.push(sub.completionTimeMs);
    }

    // 완성율 계산 (전체 방문 = 3배의 제출 수, Step 1 방문자)
    // 가정: 각 variant별 진입자가 동등하게 배분
    const totalSubmissions = submissions.length;
    const estimatedTotalVisitors = totalSubmissions > 0 ? Math.ceil((totalSubmissions / 3) * 1.33) : 0;

    // 결과 생성
    const results: TestResult[] = [];

    for (const [variant, stats] of Object.entries(variantStats)) {
      const completionRate = estimatedTotalVisitors > 0 ? stats.visitors / estimatedTotalVisitors : 0;
      const avgCompletionTimeMs = stats.times.length > 0
        ? Math.round(stats.times.reduce((a, b) => a + b, 0) / stats.times.length)
        : 0;

      results.push({
        variant: variant.toUpperCase(),
        visitors: estimatedTotalVisitors,
        completions: stats.visitors,
        completionRate,
        avgCompletionTimeMs,
        confidence: 0, // 아래에서 계산
        isWinner: false, // 아래에서 결정
        segments: Object.entries(segmentStats[variant as 'a' | 'b' | 'c']).reduce(
          (acc, [seg, data]) => {
            acc[seg] = {
              visitors: data.visitors,
              completions: data.visitors,
              rate: 1, // 모두 완성으로 간주
            };
            return acc;
          },
          {} as Record<string, { visitors: number; completions: number; rate: number }>
        ),
      });
    }

    // 신뢰도 계산 (Control vs 다른 변형)
    if (results.length >= 2) {
      const controlResult = results[0]; // Variant A (Control)

      for (let i = 1; i < results.length; i++) {
        const variantResult = results[i];
        const confidence = calculateChiSquareSignificance(
          controlResult.completionRate,
          variantResult.completionRate,
          controlResult.visitors,
          variantResult.visitors
        );
        variantResult.confidence = confidence;
        results[i] = variantResult;
      }

      // 승자 판정: 완성율이 높고 신뢰도 >= 95%
      const maxCompletionRate = Math.max(...results.map(r => r.completionRate));
      const winner = results.find(r => r.completionRate === maxCompletionRate && r.confidence >= 95);
      if (winner) {
        winner.isWinner = true;
      }
    }

    logger.log('[ABTestResults]', {
      days,
      totalSubmissions,
      variants: results.map(r => ({ variant: r.variant, completions: r.completions })),
    });

    return NextResponse.json({
      ok: true,
      testPeriod: { startDate: startDate.toISOString(), endDate: new Date().toISOString(), days },
      variants: results,
      metadata: {
        totalSubmissions,
        estimatedTotalVisitors,
        testStatus: results.some(r => r.completions >= 300) ? 'ONGOING' : 'WARMING_UP',
        minSampleRequired: 300,
        minConfidenceRequired: 95,
      },
    });
  } catch (err) {
    logger.error('[ABTestResults] Error', {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
