import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/menu-48/metrics/breakdown
 *
 * 준비 단계별 분포
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const organizationId = requireOrgId(ctx);

    const prepStageDistribution = await prisma.contact.groupBy({
      by: ['preparationStage'],
      where: { organizationId, anxietyAssessmentAt: { not: null } },
      _count: { id: true },
    });

    const stages = prepStageDistribution.map((item) => ({
      stage: item.preparationStage || 'unknown',
      count: item._count.id,
    }));

    return NextResponse.json({ stages });
  } catch (error) {
    logger.error('[GET /api/menu-48/metrics/breakdown]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
