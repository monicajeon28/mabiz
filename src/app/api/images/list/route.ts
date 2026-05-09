import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/images/list?category=배너&tags=태그1&search=검색어
 * 이미지 목록 조회 (검색, 필터)
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const tags = searchParams.getAll('tags');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '60'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // WHERE 조건 구성
    const where = {
      organizationId: orgId,
      ...(category && { category }),
      ...(tags.length > 0 && { tags: { hasSome: tags } }),
      ...(search && {
        OR: [
          { originalFileName: { contains: search, mode: 'insensitive' as const } },
          { tags: { hasSome: [search] } },
        ],
      }),
    };

    // 조회
    const [assets, total] = await Promise.all([
      prisma.imageAsset.findMany({
        where,
        orderBy: { uploadedAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          originalFileName: true,
          driveFileId: true,
          drivePath: true,
          mimeType: true,
          fileSize: true,
          width: true,
          height: true,
          tags: true,
          category: true,
          uploadedAt: true,
          lastAccessedAt: true,
          webpDriveFileId: true,
          processingStatus: true,
          processedAt: true,
        },
      }),
      prisma.imageAsset.count({ where }),
    ]);

    logger.info('[GET /api/images/list] 이미지 목록 조회', {
      organizationId: orgId,
      count: assets.length,
      total,
    });

    return NextResponse.json({
      ok: true,
      data: {
        assets: assets.map((a) => ({
          id: a.id,
          fileName: a.originalFileName,
          driveFileId: a.driveFileId,
          category: a.category,
          tags: a.tags,
          mimeType: a.mimeType,
          fileSize: a.fileSize?.toString(),
          width: a.width,
          height: a.height,
          uploadedAt: a.uploadedAt.toISOString(),
          lastAccessedAt: a.lastAccessedAt?.toISOString(),
          // Google Drive 미리보기 URL
          thumbnailUrl: `https://drive.google.com/thumbnail?id=${a.driveFileId}`,
          driveUrl: `https://drive.google.com/file/d/${a.driveFileId}`,
          webpDriveFileId: a.webpDriveFileId,
          processingStatus: a.processingStatus,
          processedAt: a.processedAt?.toISOString(),
        })),
        total,
        offset,
        limit,
      },
    });
  } catch (err) {
    logger.error('[GET /api/images/list]', { err });
    return NextResponse.json(
      { ok: false, message: '조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
