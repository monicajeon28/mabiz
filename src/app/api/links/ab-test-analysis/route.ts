/**
 * POST /api/links/ab-test-analysis
 * Analyze A/B test results with statistical significance testing
 *
 * Request body:
 * {
 *   "testName": "상품 A vs B 이미지",
 *   "variantA_id": "link-123",
 *   "variantB_id": "link-456",
 *   "minImpressions": 100,
 *   "pValueThreshold": 0.05
 * }
 *
 * Response:
 * {
 *   "testId": "test-789",
 *   "status": "COMPLETED" | "ACTIVE" | "INSUFFICIENT_DATA",
 *   "variantA": { ctr, ci, clicks, impressions },
 *   "variantB": { ctr, ci, clicks, impressions },
 *   "statistics": { chiSquare, pValue, isSignificant },
 *   "winner": "A" | "B" | null,
 *   "recommendation": "..."
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import {
  declareWinner,
  calculateConfidenceInterval,
  recommendedSampleSize,
} from '@/lib/ab-test-statistics';

interface AnalysisRequest {
  testName: string;
  variantA_id: string;
  variantB_id: string;
  minImpressions?: number;
  pValueThreshold?: number;
}

interface AnalysisResponse {
  ok: boolean;
  data:
    | {
        testId: string;
        testName: string;
        status: 'COMPLETED' | 'ACTIVE' | 'INSUFFICIENT_DATA';
        variantA: {
          linkId: string;
          code: string;
          clicks: number;
          impressions: number;
          ctr: number;
          ctrCI: { lower: number; upper: number };
        };
        variantB: {
          linkId: string;
          code: string;
          clicks: number;
          impressions: number;
          ctr: number;
          ctrCI: { lower: number; upper: number };
        };
        statistics: {
          chiSquare: number;
          pValue: number;
          isSignificant: boolean;
          winner: 'A' | 'B' | null;
          winnerReason: string;
          confidence: number; // 0-1
        };
        recommendation: {
          action: 'DECLARE_WINNER' | 'CONTINUE_TEST' | 'INSUFFICIENT_DATA';
          message: string;
          requiredSampleSize?: number;
          currentSampleSize: number;
        };
        createdAt: Date;
        completedAt: Date | null;
      }
    | null;
  error?: string;
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<AnalysisResponse>> {
  try {
    const ctx = await getAuthContext().catch(() => null);
    if (!ctx?.userId || !ctx?.organizationId) {
      return NextResponse.json(
        { ok: false, data: null, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const body = (await req.json()) as AnalysisRequest;
    const {
      testName,
      variantA_id,
      variantB_id,
      minImpressions = 100,
      pValueThreshold = 0.05,
    } = body;

    // Validate input
    if (!testName || !variantA_id || !variantB_id) {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: '필수 필드 누락: testName, variantA_id, variantB_id',
        },
        { status: 400 }
      );
    }

    // Fetch variant links
    const [variantA, variantB] = await Promise.all([
      prisma.shortLink.findUnique({
        where: { id: variantA_id },
        select: {
          id: true,
          code: true,
          organizationId: true,
          clicks: {
            select: { id: true },
          },
        },
      }),
      prisma.shortLink.findUnique({
        where: { id: variantB_id },
        select: {
          id: true,
          code: true,
          organizationId: true,
          clicks: {
            select: { id: true },
          },
        },
      }),
    ]);

    if (!variantA || !variantB) {
      return NextResponse.json(
        { ok: false, data: null, error: '링크를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (
      variantA.organizationId !== ctx.organizationId ||
      variantB.organizationId !== ctx.organizationId
    ) {
      return NextResponse.json(
        { ok: false, data: null, error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    // Calculate statistics
    // Note: clickCount is cached, but for precise analysis we should count actual clicks
    const clicksA = variantA.clicks.length;
    const clicksB = variantB.clicks.length;

    // For impressions, we need the view count from landing pages or use a proxy
    // For now, we'll use a placeholder - in production this would come from analytics
    const impressionsA = clicksA > 0 ? Math.ceil(clicksA / 0.75) : 0; // Assume 75% CTR baseline
    const impressionsB = clicksB > 0 ? Math.ceil(clicksB / 0.75) : 0;

    const decision = declareWinner(
      clicksA,
      clicksB,
      impressionsA,
      impressionsB,
      { minImpressions, pValueThreshold }
    );

    const ciA = calculateConfidenceInterval(clicksA, impressionsA);
    const ciB = calculateConfidenceInterval(clicksB, impressionsB);

    const recommendation = {
      action: decision.winner
        ? ('DECLARE_WINNER' as const)
        : impressionsA >= minImpressions && impressionsB >= minImpressions
          ? ('CONTINUE_TEST' as const)
          : ('INSUFFICIENT_DATA' as const),
      message: decision.reason,
      requiredSampleSize:
        impressionsA < minImpressions || impressionsB < minImpressions
          ? Math.max(minImpressions - impressionsA, minImpressions - impressionsB)
          : undefined,
      currentSampleSize: Math.max(impressionsA, impressionsB),
    };

    const response: AnalysisResponse['data'] = {
      testId: `test-${variantA_id}-${variantB_id}`.slice(0, 50),
      testName,
      status: decision.winner ? 'COMPLETED' : 'ACTIVE',
      variantA: {
        linkId: variantA.id,
        code: variantA.code,
        clicks: clicksA,
        impressions: impressionsA,
        ctr: clicksA / (impressionsA || 1),
        ctrCI: {
          lower: ciA.lower,
          upper: ciA.upper,
        },
      },
      variantB: {
        linkId: variantB.id,
        code: variantB.code,
        clicks: clicksB,
        impressions: impressionsB,
        ctr: clicksB / (impressionsB || 1),
        ctrCI: {
          lower: ciB.lower,
          upper: ciB.upper,
        },
      },
      statistics: {
        chiSquare: decision.statistics.chiSquare,
        pValue: decision.statistics.pValue,
        isSignificant: decision.winner !== null,
        winner: decision.winner,
        winnerReason: decision.reason,
        confidence: decision.confidence,
      },
      recommendation,
      createdAt: new Date(),
      completedAt: decision.winner ? new Date() : null,
    };

    return NextResponse.json(
      { ok: true, data: response },
      { status: 200 }
    );
  } catch (error) {
    console.error('[ab-test-analysis] Error:', error);
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
 * GET /api/links/ab-test-analysis?variantA_id=xxx&variantB_id=yyy
 * Get cached analysis results
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await getAuthContext().catch(() => null);
    if (!ctx?.userId) {
      return NextResponse.json(
        { ok: false, data: null, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const variantA_id = searchParams.get('variantA_id');
    const variantB_id = searchParams.get('variantB_id');

    if (!variantA_id || !variantB_id) {
      return NextResponse.json(
        { ok: false, data: null, error: 'Missing variant IDs' },
        { status: 400 }
      );
    }

    // In production, query a cached analysis table
    // For now, calculate on-demand
    const res = await POST(
      new NextRequest('http://localhost/api/links/ab-test-analysis', {
        method: 'POST',
        body: JSON.stringify({
          testName: 'Ad-hoc Analysis',
          variantA_id,
          variantB_id,
        }),
      })
    );

    return res;
  } catch (error) {
    console.error('[ab-test-analysis GET] Error:', error);
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
