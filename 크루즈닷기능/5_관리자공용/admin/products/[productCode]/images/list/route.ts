import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAdminAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Zod 검증 스키마
const listImagesQuerySchema = z.object({
  productId: z.string().regex(/^\d+$/, '상품 ID는 숫자여야 합니다.'),
  page: z.coerce.number().int().min(1, '페이지는 1 이상이어야 합니다.').default(1),
  limit: z.coerce.number().int().min(1, '개수는 1 이상이어야 합니다.').max(100, '최대 100개까지 조회 가능합니다.').default(20),
});

type ListImagesQuery = z.infer<typeof listImagesQuerySchema>;
type ProductImageItem = {
  id: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fullUrl: string | null;
  webpUrl: string | null;
  isGif: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata: unknown;
};

/**
 * GET /api/admin/products/[productId]/images/list
 * 상품 이미지 목록 조회 (페이지네이션 지원)
 *
 * @param productId - 상품 ID (URL 파라미터)
 * @query page - 페이지 번호 (기본값: 1)
 * @query limit - 페이지당 항목 수 (기본값: 20, 최대: 100)
 *
 * @response {
 *   ok: true,
 *   product: { id, productCode, packageName },
 *   images: [{ id, fileName, fileSize, mimeType, fullUrl, webpUrl, isGif, createdAt }],
 *   pagination: { page, limit, total, totalPages, hasNextPage, hasPreviousPage }
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const searchParams = req.nextUrl.searchParams;

    // Zod 검증
    const validationResult = listImagesQuerySchema.safeParse({
      productId,
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      logger.warn('[Product Images List] Validation error:', {
        field: firstError.path[0],
        message: firstError.message,
      });
      return NextResponse.json(
        { ok: false, error: firstError.message },
        { status: 400 }
      );
    }

    const { productId: productIdStr, page, limit } = validationResult.data;
    const productIdNum = parseInt(productIdStr);

    // 관리자 권한 확인
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 상품 존재 여부 및 소유권 확인
    const product = await prisma.cruiseProduct.findUnique({
      where: { id: productIdNum },
      select: {
        id: true,
        productCode: true,
        packageName: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 페이지네이션 계산
    const skip = (page - 1) * limit;

    // 이미지 목록 조회 (소프트 삭제 제외, cloudinaryFolder로 필터링)
    const cloudinaryFolder = `products/${product.productCode}`;

    const [imagesRaw, total] = await Promise.all([
      prisma.productImage.findMany({
        where: {
          cloudinaryFolder,
          deletedAt: null,
        },
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          fullUrl: true,
          webpPublicId: true,
          isGif: true,
          createdAt: true,
          updatedAt: true,
          metadata: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.productImage.count({
        where: {
          cloudinaryFolder,
          deletedAt: null,
        },
      }),
    ]);

    // webpUrl 생성
    const images: ProductImageItem[] = imagesRaw.map((img) => ({
      id: img.id,
      fileName: img.fileName,
      fileSize: img.fileSize,
      mimeType: img.mimeType,
      fullUrl: img.fullUrl,
      webpUrl: img.webpPublicId
        ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${img.webpPublicId}`
        : null,
      isGif: img.isGif,
      createdAt: img.createdAt,
      updatedAt: img.updatedAt,
      metadata: img.metadata,
    }));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      ok: true,
      product: {
        id: product.id,
        productCode: product.productCode,
        packageName: product.packageName,
      },
      images,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Product Images List] Error:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { ok: false, error: '이미지 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
