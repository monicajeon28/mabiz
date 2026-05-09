import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/images/stats
 * 이미지 라이브러리 통계 조회
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // 5개 쿼리 병렬 실행 + aggregate로 전체 로드 제거
    const [sizeResult, totalImages, byCategory, byMime, recentUploads] = await Promise.all([
      prisma.imageAsset.aggregate({
        where: { organizationId: orgId },
        _sum: { fileSize: true },
      }),
      prisma.imageAsset.count({ where: { organizationId: orgId } }),
      prisma.imageAsset.groupBy({
        by: ['category'],
        where: { organizationId: orgId },
        _count: { id: true },
      }),
      prisma.imageAsset.groupBy({
        by: ['mimeType'],
        where: { organizationId: orgId },
        _count: { id: true },
      }),
      prisma.imageAsset.findMany({
        where: { organizationId: orgId },
        orderBy: { uploadedAt: 'desc' },
        take: 5,
        select: { id: true, originalFileName: true, uploadedAt: true },
      }),
    ]);

    const totalSize = Number(sizeResult._sum.fileSize ?? 0);

    logger.info('[GET /api/images/stats] 통계 조회', {
      organizationId: orgId,
      totalImages,
      totalSize: totalSize.toString(),
    });

    return NextResponse.json({
      ok: true,
      data: {
        totalImages,
        totalSize: totalSize.toString(),
        categoryCounts: byCategory.map((c) => ({
          category: c.category || 'Other',
          count: c._count.id,
        })),
        mimeCounts: byMime.map((m) => ({
          mimeType: m.mimeType || 'unknown',
          count: m._count.id,
        })),
        recentUploads: recentUploads.map((u) => ({
          id: u.id,
          fileName: u.originalFileName,
          uploadedAt: u.uploadedAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    logger.error('[GET /api/images/stats]', { err });
    return NextResponse.json(
      { ok: false, message: '조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
