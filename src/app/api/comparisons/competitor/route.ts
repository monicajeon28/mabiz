import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { COMPETITORS, COMPETITOR_LIST, L3_CORE_MESSAGE } from '@/lib/l3-competitor-data';
import { logger } from '@/lib/logger';

/**
 * GET /api/comparisons/competitor?competitor=royal|msc|disney
 * L3 렌즈: 경쟁사 비교 테이블 조회
 *
 * 응답:
 * {
 *   ok: true,
 *   competitor: { name, code, metrics, ourAdvantage },
 *   coreMessage: { headline, corePoints },
 *   allCompetitors: [...]
 * }
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const url = new URL(req.url);
    const competitorParam = url.searchParams.get('competitor')?.toLowerCase();

    // 경쟁사 코드 검증
    const competitorCode = competitorParam as keyof typeof COMPETITORS | null;
    if (!competitorCode || !(competitorCode in COMPETITORS)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'competitor 파라미터 필수. 값: royal, msc, disney',
          availableCompetitors: COMPETITOR_LIST.map((c) => c.code),
        },
        { status: 400 }
      );
    }

    const competitor = COMPETITORS[competitorCode];

    logger.log('[L3Comparison] GET 조회', {
      orgId,
      competitor: competitorCode,
    });

    return NextResponse.json({
      ok: true,
      competitor: {
        name: competitor.name,
        code: competitorCode,
        metrics: competitor.metrics,
        ourAdvantage: competitor.ourAdvantage,
      },
      coreMessage: L3_CORE_MESSAGE,
      allCompetitors: COMPETITOR_LIST.map((c) => ({
        code: c.code,
        displayName: c.displayName,
      })),
    });
  } catch (e) {
    logger.log('[L3Comparison] GET 오류', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
