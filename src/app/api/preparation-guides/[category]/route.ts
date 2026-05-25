import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import * as visaGuide from '@/lib/preparation-guides/visa-guide.json';
import * as passportGuide from '@/lib/preparation-guides/passport-guide.json';
import * as healthGuide from '@/lib/preparation-guides/health-guide.json';
import * as customsGuide from '@/lib/preparation-guides/customs-guide.json';

type GuideName = 'visa' | 'passport' | 'health' | 'customs' | 'passport_renewal';

const guides: Record<GuideName, any> = {
  visa: visaGuide,
  passport: passportGuide,
  passport_renewal: passportGuide,
  health: healthGuide,
  customs: customsGuide,
};

interface PrepGuideResponse {
  category: string;
  title: string;
  description: string;
  content: any;
  lastUpdated: string;
  estimatedReadTime: number; // 분 단위
}

/**
 * GET /api/preparation-guides/[category]
 *
 * 준비 카테고리별 가이드 조회
 * Categories: visa, passport_renewal, health, customs
 *
 * SPIN 프레임워크 적용:
 * - Situation: 고객의 준비 상황 파악
 * - Problem: 준비 복잡도 확인
 * - Implication: 미준비 시 후속 영향 설명
 * - Need: 필요한 정보 제공
 * - Reward: 체계적 준비로 인한 이득 강조
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const authContext = await getMabizSession();
    if (!authContext) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { category } = await params;

    if (!guides[category as GuideName]) {
      return NextResponse.json(
        {
          error: 'Guide category not found',
          available: ['visa', 'passport_renewal', 'health', 'customs'],
        },
        { status: 404 }
      );
    }

    const guide = guides[category as GuideName];

    // 예상 읽기 시간 계산 (단어 기준)
    const jsonStr = JSON.stringify(guide);
    const wordCount = jsonStr.split(/\s+/).length;
    const estimatedReadTime = Math.ceil(wordCount / 200); // 분 당 200 단어

    const response: PrepGuideResponse = {
      category: guide.category || category,
      title: guide.title,
      description: guide.description,
      content: guide,
      lastUpdated: new Date().toISOString().split('T')[0],
      estimatedReadTime: Math.max(3, estimatedReadTime),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get preparation guide error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
