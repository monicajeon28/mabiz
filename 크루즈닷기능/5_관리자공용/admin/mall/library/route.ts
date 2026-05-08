import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getEffectiveImageUrl } from '@/lib/cloudinary-service';

export const dynamic = 'force-dynamic';

/**
 * GET: 크루즈정보사진 라이브러리 조회 (공용 이미지)
 * 검색, 폴더 필터링 지원
 */
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const folder = searchParams.get('folder');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const skip = (page - 1) * limit;

    // 검색 조건 구성
    const where: any = {
      OR: [
        { cloudinaryUrl: { not: null } },
        { driveUrl: { not: null } }
      ]
    };

    if (search) {
      where.AND = [
        {
          OR: [
            { fileName: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
            { folder: { contains: search, mode: 'insensitive' } },
            { tags: { hasSome: [search] } },
          ]
        }
      ];
    }

    if (folder) {
      where.AND = where.AND || [];
      where.AND.push({ folder });
    }

    // 이미지 목록 조회
    const [images, total] = await Promise.all([
      prisma.imageCache.findMany({
        where,
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          folder: true,
          tags: true,
          title: true,
          thumbnailUrl: true,
          cloudinaryUrl: true,
          webpUrl: true,
          driveUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.imageCache.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // 응답 형식을 ProductImage와 동일하게 (호환성)
    const formattedImages = images.map((img) => ({
      id: img.id,
      fileName: img.fileName,
      fileSize: img.fileSize || 0,
      mimeType: img.mimeType,
      folder: img.folder,
      tags: img.tags,
      fullUrl: getEffectiveImageUrl(img),
      thumbnailUrl: img.thumbnailUrl || getEffectiveImageUrl(img),
      isGif: img.mimeType === 'image/gif',
      createdAt: img.createdAt,
      source: 'library',
    }));

    logger.log('[Admin Library GET] Success:', {
      count: images.length,
      synced: images.filter((i) => i.cloudinaryUrl).length,
    });

    return NextResponse.json({
      ok: true,
      data: {
        images: formattedImages,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    });
  } catch (error: any) {
    logger.error('[Admin Library GET] Error:', {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { ok: false, error: '라이브러리 목록을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
