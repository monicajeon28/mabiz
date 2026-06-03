import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth-middleware';
import { logger } from '@/lib/logger';
import {
  allL10ClosingVariants,
  getVariantById,
  getVariantsByTone,
  getVariantsByTimeFrame,
  getBestVariant,
  getVariantsByConversionRate,
  getTopPerformingVariants,
  getVariantSummary,
  type EmotionalTone,
  type TimeFrame,
} from '@/lib/l10-closing-variants';

/**
 * L10 렌즈 - 클로징 변형 API
 *
 * 30개 변형을 다양한 필터로 조회하고 선택할 수 있음
 */

interface VariantsQuery {
  filter?: 'all' | 'by-tone' | 'by-timeframe' | 'best' | 'top-performing' | 'summary';
  tone?: EmotionalTone;
  timeFrame?: TimeFrame;
  minConversion?: number;
  limit?: number;
  id?: string;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter') || 'all';
    const tone = searchParams.get('tone') as EmotionalTone | null;
    const timeFrame = searchParams.get('timeFrame') as TimeFrame | null;
    const minConversion = searchParams.get('minConversion')
      ? parseInt(searchParams.get('minConversion')!)
      : 0;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 10;
    const variantId = searchParams.get('id');

    let variants = allL10ClosingVariants;

    // 필터 적용
    switch (filter) {
      case 'by-tone':
        if (tone) {
          variants = getVariantsByTone(tone);
        }
        break;
      case 'by-timeframe':
        if (timeFrame) {
          variants = getVariantsByTimeFrame(timeFrame);
        }
        break;
      case 'best':
        // 프로덕션용: tone/timeFrame 조건에 맞는 최고 전환율 변형 반환 (비결정적 random 제거)
        return NextResponse.json({
          success: true,
          variant: getBestVariant(tone ?? undefined, timeFrame ?? undefined),
        });
      case 'top-performing':
        return NextResponse.json({
          success: true,
          variants: getTopPerformingVariants(limit),
          count: getTopPerformingVariants(limit).length,
        });
      case 'summary':
        return NextResponse.json({
          success: true,
          summary: getVariantSummary(),
          allVariants: allL10ClosingVariants.map((v) => ({
            id: v.id,
            tone: v.emotionalTone,
            timeFrame: v.timeFrame,
            conversion: v.estimatedConversion,
          })),
        });
      case 'by-id':
        if (variantId) {
          const variant = getVariantById(variantId);
          if (!variant) {
            return NextResponse.json(
              { error: 'Variant not found' },
              { status: 404 }
            );
          }
          return NextResponse.json({
            success: true,
            variant,
          });
        }
        break;
    }

    // 최소 전환율 필터
    if (minConversion > 0) {
      variants = getVariantsByConversionRate(minConversion);
    }

    // 정렬 (전환율 내림차순)
    variants = variants.sort(
      (a, b) => b.estimatedConversion - a.estimatedConversion
    );

    // 제한 적용
    const paginatedVariants = variants.slice(0, limit);

    return NextResponse.json({
      success: true,
      filter,
      tone: tone || null,
      timeFrame: timeFrame || null,
      minConversion,
      total: variants.length,
      returned: paginatedVariants.length,
      variants: paginatedVariants,
      psychologyInsights: {
        recommendedApproach:
          variants.length > 0
            ? `${variants[0].emotionalTone} tone with ${variants[0].timeFrame} timeframe (${variants[0].estimatedConversion}% conversion)`
            : 'No variants available',
        averageConversion: Math.round(
          variants.reduce((sum, v) => sum + v.estimatedConversion, 0) /
            variants.length
        ),
        bestPerformer:
          variants.length > 0
            ? `${variants[0].id} (${variants[0].estimatedConversion}% conversion)`
            : 'N/A',
      },
    });
  } catch (error) {
    logger.error('[GET /api/l10-closing/variants]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - 특정 변형 사용자에게 제시
 */

interface ApplyVariantRequest {
  contactId: string;
  variantId: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authMiddleware(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ApplyVariantRequest = await request.json();
    const { contactId, variantId } = body;

    if (!contactId || !variantId) {
      return NextResponse.json(
        { error: 'contactId and variantId are required' },
        { status: 400 }
      );
    }

    // 변형 확인
    const variant = getVariantById(variantId);
    if (!variant) {
      return NextResponse.json(
        { error: 'Variant not found' },
        { status: 404 }
      );
    }

    // Contact 조회 (이미 인증되었으므로 생략 가능하지만, 소유권 확인 필요)
    // TODO: Contact 조회 후 organizationId 확인

    return NextResponse.json({
      success: true,
      contactId,
      variantId,
      variant,
      application: {
        tripleChoice: variant.tripleChoice,
        emotionalFinish: variant.emotionalFinish,
        urgencyTrigger: variant.urgencyTrigger,
        estimatedOutcome: `${variant.estimatedConversion}% conversion expected`,
      },
      nextActions: [
        {
          step: 1,
          action: 'Present triple choice offer',
          timing: 'Immediately',
          expectation: `${Math.round(variant.tripleChoice.expectedConversion)}% selection rate`,
        },
        {
          step: 2,
          action: 'Apply emotional finish message',
          timing: 'Upon selection',
          expectation: 'Psychological commitment reinforcement',
        },
        {
          step: 3,
          action: 'Trigger urgency message',
          timing: 'After selection confirmation',
          expectation: 'Final decision acceleration',
        },
      ],
    });
  } catch (error) {
    logger.error('[POST /api/l10-closing/variants]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
