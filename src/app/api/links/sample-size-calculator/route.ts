/**
 * GET /api/links/sample-size-calculator
 * Calculate recommended sample size for A/B test
 *
 * Query parameters:
 *   - baselineRate: Current conversion rate (default 0.75)
 *   - mde: Minimum detectable effect as % (default 0.05 = 5%)
 *   - power: Statistical power (default 0.8)
 *   - alpha: Significance level (default 0.05)
 *
 * Example:
 * GET /api/links/sample-size-calculator?baselineRate=0.75&mde=0.10
 *
 * Response:
 * {
 *   "ok": true,
 *   "data": {
 *     "perVariant": 154,
 *     "total": 308,
 *     "baselineRate": 0.75,
 *     "targetRate": 0.8475,
 *     "expectedImprovement": "13%",
 *     "assumptions": {
 *       "power": 0.8,
 *       "alpha": 0.05,
 *       "twoTailed": true
 *     },
 *     "interpretation": "각 변형(A, B)당 최소 154 노출이 필요합니다. 총 308회"
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { recommendedSampleSize } from '@/lib/ab-test-statistics';

interface SampleSizeResponse {
  ok: boolean;
  data: {
    perVariant: number;
    total: number;
    baselineRate: number;
    targetRate: number;
    expectedImprovement: string;
    assumptions: {
      power: number;
      alpha: number;
      twoTailed: boolean;
    };
    interpretation: string;
    estimatedDuration: {
      atDaily100Impressions: string;
      atDaily1000Impressions: string;
    };
  } | null;
  error?: string;
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<SampleSizeResponse>> {
  try {
    const searchParams = req.nextUrl.searchParams;

    // Parse query parameters
    const baselineRateStr = searchParams.get('baselineRate');
    const mdeStr = searchParams.get('mde');
    const powerStr = searchParams.get('power');
    const alphaStr = searchParams.get('alpha');

    const baselineRate = baselineRateStr ? parseFloat(baselineRateStr) : 0.75;
    const mde = mdeStr ? parseFloat(mdeStr) : 0.05;
    const power = powerStr ? parseFloat(powerStr) : 0.8;
    const alpha = alphaStr ? parseFloat(alphaStr) : 0.05;

    // Validate ranges
    if (baselineRate <= 0 || baselineRate >= 1) {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: 'baselineRate must be between 0 and 1',
        },
        { status: 400 }
      );
    }

    if (mde <= 0 || mde >= 1) {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: 'mde must be between 0 and 1',
        },
        { status: 400 }
      );
    }

    const result = recommendedSampleSize(baselineRate, mde, power, alpha);

    // Calculate target rate
    const targetRate = baselineRate * (1 + mde);
    const improvement = (mde * 100).toFixed(1);

    // Estimate duration
    const atDaily100 = Math.ceil(result.total / 100);
    const atDaily1000 = Math.ceil(result.total / 1000);

    const data: SampleSizeResponse['data'] = {
      perVariant: result.perVariant,
      total: result.total,
      baselineRate: Math.round(baselineRate * 10000) / 100,
      targetRate: Math.round(targetRate * 10000) / 100,
      expectedImprovement: `${improvement}%`,
      assumptions: {
        power,
        alpha,
        twoTailed: true,
      },
      interpretation: result.explanation,
      estimatedDuration: {
        atDaily100Impressions: `약 ${atDaily100}일`,
        atDaily1000Impressions: `약 ${atDaily1000}일`,
      },
    };

    return NextResponse.json(
      { ok: true, data },
      { status: 200 }
    );
  } catch (error) {
    console.error('[sample-size-calculator] Error:', error);
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
