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

    // 전체 이미지 수
    const totalImages = await prisma.imageAsset.count({
      where: { organizationId: orgId },
    });

    // 전체 저장소 크기
    const assets = await prisma.imageAsset.findMany({
      where: { organizationId: orgId },
      select: { fileSize: true },
    });

    const totalSize = assets.reduce((sum, a) => sum + (a.fileSize || 0n), 0n);

    // 카테고리별 이미지 수
    const byCategory = await prisma.imageAsset.groupBy({
      by: ['category'],
      where: { organizationId: orgId },
      _count: {
        id: true,
      },
    });

    // MIME 타입별 이미지 수
    const byMime = await prisma.imageAsset.groupBy({
      by: ['mimeType'],
      where: { organizationId: orgId },
      _count: {
        id: true,
      },
    });

    // 최근 업로드 이미지
    const recentUploads = await prisma.imageAsset.findMany({
      where: { organizationId: orgId },
      orderBy: { uploadedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        originalFileName: true,
        uploadedAt: true,
      },
    });

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
