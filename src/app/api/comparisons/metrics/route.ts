import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/comparisons/metrics
 * L3 렌즈 대시보드: 경쟁사 언급/차별성 메시지 성과 KPI
 *
 * 응답:
 * {
 *   ok: true,
 *   metrics: {
 *     totalCompetitorMentions: number,
 *     byCompetitor: { Royal: number, MSC: number, Disney: number },
 *     differentiationMessagesSent: number,
 *     conversionRate: number,      // 경쟁사 언급 고객 중 구매율
 *     avgDifferentiationScore: number,
 *     byExperienceLevel: {}
 *   }
 * }
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // 경쟁사 언급 고객 통계
    const competitorMentionedCount = await prisma.contact.count({
      where: { organizationId: orgId, competitorMentioned: true },
    });

    // 경쟁사별 언급 통계
    const royalMentions = await prisma.contact.count({
      where: {
        organizationId: orgId,
        lastCompetitorName: { equals: 'Royal Caribbean' },
      },
    });

    const mscMentions = await prisma.contact.count({
      where: {
        organizationId: orgId,
        lastCompetitorName: { equals: 'MSC Cruises' },
      },
    });

    const disneyMentions = await prisma.contact.count({
      where: {
        organizationId: orgId,
        lastCompetitorName: { equals: 'Disney Cruise Line' },
      },
    });

    // 차별성 메시지 발송 통계
    const differentiationSentCount = await prisma.contact.count({
      where: { organizationId: orgId, differentiationResponseSent: true },
    });

    // 경쟁사 언급 고객 중 전환율 (purchasedAt이 마지막 경쟁사 언급 이후)
    // 최근 1년 이내 구매만 계산 (하드코딩 날짜 제거)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const competitorMentionedWithPurchase = await prisma.contact.count({
      where: {
        organizationId: orgId,
        competitorMentioned: true,
        purchasedAt: {
          gte: oneYearAgo,
        },
      },
    });

    const conversionRate =
      competitorMentionedCount > 0
        ? (competitorMentionedWithPurchase / competitorMentionedCount) * 100
        : 0;

    // 평균 차별성 점수
    const differentiationScores = await prisma.contact.findMany({
      where: { organizationId: orgId, differentiationResponseSent: true },
      select: { differentiationScore: true },
    });

    const avgDifferentiationScore =
      differentiationScores.length > 0
        ? differentiationScores.reduce((sum, c) => sum + c.differentiationScore, 0) /
          differentiationScores.length
        : 0;

    // 호텔 경험도별 분포
    const byExperienceLevel = await prisma.contact.groupBy({
      by: ['hotelExperienceLevel'],
      where: { organizationId: orgId, differentiationResponseSent: true },
      _count: { id: true },
    });

    const experienceLevelMap = Object.fromEntries(
      byExperienceLevel.map((item) => [
        item.hotelExperienceLevel || 'unknown',
        item._count.id,
      ])
    );

    logger.log('[L3Metrics] 조회', {
      orgId,
      competitorMentions: competitorMentionedCount,
      differentiationSent: differentiationSentCount,
      conversionRate: conversionRate.toFixed(2),
    });

    return NextResponse.json({
      ok: true,
      metrics: {
        totalCompetitorMentions: competitorMentionedCount,
        byCompetitor: {
          'Royal Caribbean': royalMentions,
          'MSC Cruises': mscMentions,
          'Disney Cruise Line': disneyMentions,
        },
        differentiationMessagesSent: differentiationSentCount,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        avgDifferentiationScore: parseFloat(avgDifferentiationScore.toFixed(1)),
        byExperienceLevel: experienceLevelMap,
      },
    });
  } catch (e) {
    logger.error('[L3Metrics] 오류', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
