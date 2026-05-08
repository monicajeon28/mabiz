import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// GET: 이미지 목록 (검색, 필터)
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
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { folder: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    if (folder) {
      where.folder = folder;
    }

    // 현재 관리자만 모든 이미지 조회 가능
    const { user } = await checkAdminAuth();

    // 이미지 목록 조회
    const [images, total] = await Promise.all([
      prisma.productImage.findMany({
        where,
        select: {
          id: true,
          cloudinaryPublicId: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          webpPublicId: true,
          folder: true,
          tags: true,
          thumbnailUrl: true,
          fullUrl: true,
          isGif: true,
          createdAt: true,
          uploadedById: true,
          User: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.productImage.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      ok: true,
      data: {
        images,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    });
  } catch (error: any) {
    logger.error('[Admin Images GET] Error:', {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { ok: false, error: '이미지 목록을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
