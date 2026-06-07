/**
 * POST /api/links/aa-test-validation
 * Validate statistical engine with A/A test (identical samples)
 *
 * Purpose: Ensure our Chi-Square implementation is correct
 * Expected: Should NOT declare a winner for identical samples
 *
 * Request:
 * {
 *   "sample1": { "clicks": 100, "impressions": 200 },
 *   "sample2": { "clicks": 100, "impressions": 200 }  // Identical to sample 1
 * }
 *
 * Expected Response:
 * {
 *   "ok": true,
 *   "data": {
 *     "isValid": true,  // ✅ Should be true
 *     "pValue": 1.0,    // ✅ Should be 1.0 (identical samples)
 *     "reason": "✅ 엔진 정상: ..."
 *   }
 * }
 *
 * If isValid is false, there's a bug in our statistical engine!
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateStatisticalEngine, declareWinner } from '@/lib/ab-test-statistics';
import { logger } from '@/lib/logger';

interface AATestRequest {
  sample1: { clicks: number; impressions: number };
  sample2: { clicks: number; impressions: number };
}

interface AATestResponse {
  ok: boolean;
  data: {
    isValid: boolean;
    pValue: number;
    chiSquare: number;
    winner: 'A' | 'B' | null;
    explanation: string;
    testResult: string; // ✅ PASS or ❌ FAIL
  } | null;
  error?: string;
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<AATestResponse>> {
  try {
    const body = (await req.json()) as AATestRequest;
    const {
      sample1 = { clicks: 0, impressions: 0 },
      sample2 = { clicks: 0, impressions: 0 },
    } = body;

    // Validate request
    if (
      typeof sample1.clicks !== 'number' ||
      typeof sample1.impressions !== 'number' ||
      typeof sample2.clicks !== 'number' ||
      typeof sample2.impressions !== 'number'
    ) {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: '잘못된 입력: clicks와 impressions은 숫자여야 함',
        },
        { status: 400 }
      );
    }

    // Run validation
    const validation = validateStatisticalEngine(
      sample1.clicks,
      sample1.impressions,
      sample2.clicks,
      sample2.impressions
    );

    // Also run declareWinner to get full stats
    const decision = declareWinner(
      sample1.clicks,
      sample2.clicks,
      sample1.impressions,
      sample2.impressions
    );

    return NextResponse.json(
      {
        ok: true,
        data: {
          isValid: validation.isValid,
          pValue: decision.statistics.pValue,
          chiSquare: decision.statistics.chiSquare,
          winner: decision.winner,
          explanation: validation.explanation,
          testResult: validation.isValid ? '✅ PASS' : '❌ FAIL',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[aa-test-validation] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        ok: false,
        data: null,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/links/aa-test-validation/quick-test
 * Run pre-built test cases
 */
export async function GET(req: NextRequest): Promise<NextResponse<AATestResponse>> {
  const testCase = req.nextUrl.searchParams.get('testCase') || 'identical';

  const testCases: Record<
    string,
    { sample1: { clicks: number; impressions: number }; sample2: { clicks: number; impressions: number } }
  > = {
    // Identical samples (should NOT declare winner)
    identical: {
      sample1: { clicks: 150, impressions: 200 },
      sample2: { clicks: 150, impressions: 200 },
    },
    // Similar samples (should NOT declare winner)
    similar: {
      sample1: { clicks: 148, impressions: 200 },
      sample2: { clicks: 150, impressions: 200 },
    },
    // Clearly different (should declare winner)
    significant: {
      sample1: { clicks: 100, impressions: 200 }, // 50% CTR
      sample2: { clicks: 160, impressions: 200 }, // 80% CTR
    },
    // Small sample (should not declare winner - insufficient data)
    small: {
      sample1: { clicks: 3, impressions: 10 },
      sample2: { clicks: 5, impressions: 10 },
    },
  };

  const selectedCase = testCases[testCase];
  if (!selectedCase) {
    return NextResponse.json(
      {
        ok: false,
        data: null,
        error: `Unknown test case: ${testCase}. Available: ${Object.keys(testCases).join(', ')}`,
      },
      { status: 400 }
    );
  }

  // Run test
  const req2 = new NextRequest('http://localhost/api/links/aa-test-validation', {
    method: 'POST',
    body: JSON.stringify(selectedCase),
  });

  return POST(req2);
}
