import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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
  { params }: { params: { category: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { category } = params;

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

/**
 * GET /api/preparation-guides
 * 모든 가능한 준비 가이드 목록 조회
 */
export async function handleListRequest(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const guidesList = Object.entries(guides).map(([key, guide]) => ({
      id: key,
      category: guide.category || key,
      title: guide.title,
      description: guide.description,
      sections: (guide.sections || guide.steps || []).length,
    }));

    return NextResponse.json({
      total: guidesList.length,
      guides: guidesList,
    });
  } catch (error) {
    console.error('List preparation guides error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
