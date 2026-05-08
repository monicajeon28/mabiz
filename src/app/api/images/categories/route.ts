import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/images/categories
 * 조직의 모든 이미지 카테고리 및 태그 목록 조회
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // 카테고리 목록 조회
    const categories = await prisma.imageAsset.findMany({
      where: { organizationId: orgId },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });

    // 각 카테고리별 이미지 수 집계
    const categoryStats = await Promise.all(
      categories.map(async (cat) => {
        const count = await prisma.imageAsset.count({
          where: {
            organizationId: orgId,
            category: cat.category,
          },
        });
        return {
          category: cat.category,
          count,
        };
      })
    );

    // 모든 태그 추출 (중복 제거)
    const allAssets = await prisma.imageAsset.findMany({
      where: { organizationId: orgId },
      select: { tags: true },
    });

    const allTags = Array.from(
      new Set(allAssets.flatMap((a) => a.tags))
    ).sort();

    logger.info('[GET /api/images/categories] 카테고리 조회', {
      organizationId: orgId,
      categoryCount: categoryStats.length,
      tagCount: allTags.length,
    });

    return NextResponse.json({
      ok: true,
      data: {
        categories: categoryStats,
        tags: allTags,
      },
    });
  } catch (err) {
    logger.error('[GET /api/images/categories]', { err });
    return NextResponse.json(
      { ok: false, message: '조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
