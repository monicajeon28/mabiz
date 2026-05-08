import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { deleteImageFromCloudinary } from '@/lib/cloudinary-service';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { validateCsrfAndRespond } from '@/lib/api-utils';
import { productImageUpdateSchema } from '@/lib/schemas/productImageSchema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * DELETE /api/admin/products/[productId]/images/[imageId]
 * 상품 이미지 삭제 (소프트 삭제 + Cloudinary 제거)
 *
 * @param productId - 상품 ID
 * @param imageId - ProductImage ID
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string; imageId: string }> }
) {
  try {
    const { productId, imageId } = await params;

    // 관리자 권한 확인
    const { isAdmin, user } = await checkAdminAuth();
    if (!isAdmin || !user) {
      return NextResponse.json(
        { ok: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    // CSRF 토큰 검증
    const csrfCheck = validateCsrfAndRespond(req, 'Product Image Delete');
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // 파라미터 검증
    const imageIdNum = parseInt(imageId);
    const productIdNum = parseInt(productId);

    if (isNaN(imageIdNum) || imageIdNum <= 0 || isNaN(productIdNum) || productIdNum <= 0) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 파라미터입니다.' },
        { status: 400 }
      );
    }

    // 상품 존재 여부 확인
    const product = await prisma.cruiseProduct.findUnique({
      where: { id: productIdNum },
      select: { id: true, productCode: true },
    });

    if (!product) {
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ProductImage 조회 (소프트 삭제되지 않은 것만, cloudinaryFolder로 IDOR 방지)
    const cloudinaryFolder = `products/${product.productCode}`;

    const productImage = await prisma.productImage.findUnique({
      where: { id: imageIdNum },
      select: {
        id: true,
        cloudinaryPublicId: true,
        webpPublicId: true,
        cloudinaryFolder: true,
        deletedAt: true,
      },
    });

    if (!productImage) {
      return NextResponse.json(
        { ok: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // IDOR 방지: 이미지가 해당 상품 폴더에 속하는지 확인
    if (productImage.cloudinaryFolder !== cloudinaryFolder) {
      logger.warn('[Product Image Deletion] IDOR attempt detected:', {
        imageId: imageIdNum,
        productId: productIdNum,
        expectedFolder: cloudinaryFolder,
        actualFolder: productImage.cloudinaryFolder,
        adminId: user.id,
      });
      return NextResponse.json(
        { ok: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 삭제된 경우
    if (productImage.deletedAt) {
      return NextResponse.json(
        { ok: false, error: '이미 삭제된 이미지입니다.' },
        { status: 404 }
      );
    }

    // Cloudinary에서 이미지 삭제 (병렬 처리)
    await Promise.allSettled([
      deleteImageFromCloudinary(productImage.cloudinaryPublicId),
      productImage.webpPublicId
        ? deleteImageFromCloudinary(productImage.webpPublicId)
        : Promise.resolve(),
    ]).then((results) => {
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        logger.warn('[Product Image Deletion] Cloudinary cleanup partial failure:', {
          imageId: imageIdNum,
          publicId: productImage.cloudinaryPublicId,
          webpPublicId: productImage.webpPublicId,
          failedCount: failed.length,
        });
      }
    });

    // DB에서 소프트 삭제
    const deletedImage = await prisma.productImage.update({
      where: { id: imageIdNum },
      data: {
        deletedAt: new Date(),
      },
      select: {
        id: true,
        fileName: true,
      },
    });

    logger.log('[Product Image Deletion] Success:', {
      imageId: imageIdNum,
      productId: productIdNum,
      adminId: user.id,
      fileName: deletedImage.fileName,
    });

    return NextResponse.json({
      ok: true,
      message: '이미지가 삭제되었습니다.',
      imageId: deletedImage.id,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Product Image Deletion] Error:', {
      message: errorMessage,
    });

    return NextResponse.json(
      { ok: false, error: '이미지 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/products/[productId]/images/[imageId]
 * 상품 이미지 메타데이터 수정 (tags, folder, metadata)
 *
 * @param productId - 상품 ID
 * @param imageId - ProductImage ID
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string; imageId: string }> }
) {
  try {
    const { productId, imageId } = await params;

    // 관리자 권한 확인
    const { isAdmin, user } = await checkAdminAuth();
    if (!isAdmin || !user) {
      return NextResponse.json(
        { ok: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    // CSRF 토큰 검증
    const csrfCheck = validateCsrfAndRespond(req, 'Product Image Update');
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // 파라미터 검증
    const imageIdNum = parseInt(imageId);
    const productIdNum = parseInt(productId);

    if (isNaN(imageIdNum) || imageIdNum <= 0 || isNaN(productIdNum) || productIdNum <= 0) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 파라미터입니다.' },
        { status: 400 }
      );
    }

    // 상품 존재 여부 확인
    const product = await prisma.cruiseProduct.findUnique({
      where: { id: productIdNum },
      select: { id: true, productCode: true },
    });

    if (!product) {
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 요청 본문 파싱
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'JSON 파싱 실패' },
        { status: 400 }
      );
    }

    // Zod 스키마로 검증
    const validation = productImageUpdateSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      logger.warn('[Product Image Update] Validation failed:', {
        errors,
        imageId: imageIdNum,
        productId: productIdNum,
      });
      return NextResponse.json(
        { ok: false, error: `입력 검증 실패: ${errors}` },
        { status: 400 }
      );
    }

    // ProductImage 조회 (cloudinaryFolder로 IDOR 방지)
    const cloudinaryFolder = `products/${product.productCode}`;

    const productImage = await prisma.productImage.findUnique({
      where: { id: imageIdNum },
      select: {
        id: true,
        cloudinaryFolder: true,
        deletedAt: true,
        fileName: true,
        tags: true,
        folder: true,
        metadata: true,
      },
    });

    if (!productImage) {
      return NextResponse.json(
        { ok: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // IDOR 방지: 이미지가 해당 상품 폴더에 속하는지 확인
    if (productImage.cloudinaryFolder !== cloudinaryFolder) {
      logger.warn('[Product Image Update] IDOR attempt detected:', {
        imageId: imageIdNum,
        productId: productIdNum,
        expectedFolder: cloudinaryFolder,
        actualFolder: productImage.cloudinaryFolder,
        adminId: user.id,
      });
      return NextResponse.json(
        { ok: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 소프트 삭제된 이미지인 경우
    if (productImage.deletedAt) {
      return NextResponse.json(
        { ok: false, error: '삭제된 이미지입니다.' },
        { status: 404 }
      );
    }

    // 업데이트할 데이터 구성
    const updateData: any = {};
    if (validation.data.tags !== undefined) {
      updateData.tags = validation.data.tags;
    }
    if (validation.data.folder !== undefined) {
      updateData.folder = validation.data.folder;
    }
    if (validation.data.metadata !== undefined) {
      updateData.metadata = validation.data.metadata;
    }

    // 변경사항이 없으면 에러 반환
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { ok: false, error: '변경할 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    // 이미지 메타데이터 업데이트
    const updatedImage = await prisma.productImage.update({
      where: { id: imageIdNum },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        fullUrl: true,
        tags: true,
        folder: true,
        metadata: true,
        position: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.log('[Product Image Update] Success:', {
      imageId: imageIdNum,
      productId: productIdNum,
      adminId: user.id,
      updatedFields: Object.keys(updateData),
    });

    return NextResponse.json({
      ok: true,
      image: updatedImage,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Product Image Update] Error:', {
      message: errorMessage,
    });

    return NextResponse.json(
      { ok: false, error: '이미지 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/products/[productId]/images/[imageId]
 * 상품 이미지 상세 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string; imageId: string }> }
) {
  try {
    const { productId, imageId } = await params;

    // 관리자 권한 확인
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    const imageIdNum = parseInt(imageId);
    const productIdNum = parseInt(productId);

    if (isNaN(imageIdNum) || imageIdNum <= 0 || isNaN(productIdNum) || productIdNum <= 0) {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 파라미터입니다.' },
        { status: 400 }
      );
    }

    // 상품 존재 여부 확인
    const product = await prisma.cruiseProduct.findUnique({
      where: { id: productIdNum },
      select: { id: true, productCode: true },
    });

    if (!product) {
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ProductImage 조회 (cloudinaryFolder로 IDOR 방지)
    const cloudinaryFolder = `products/${product.productCode}`;

    const productImage = await prisma.productImage.findUnique({
      where: { id: imageIdNum },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        fullUrl: true,
        cloudinaryFolder: true,
        isGif: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        metadata: true,
      },
    });

    if (!productImage) {
      return NextResponse.json(
        { ok: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // IDOR 방지: 이미지가 해당 상품 폴더에 속하는지 확인
    if (productImage.cloudinaryFolder !== cloudinaryFolder) {
      logger.warn('[Product Image Get] IDOR attempt detected:', {
        imageId: imageIdNum,
        productId: productIdNum,
        expectedFolder: cloudinaryFolder,
        actualFolder: productImage.cloudinaryFolder,
      });
      return NextResponse.json(
        { ok: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 소프트 삭제된 이미지인 경우
    if (productImage.deletedAt) {
      return NextResponse.json(
        { ok: false, error: '삭제된 이미지입니다.' },
        { status: 404 }
      );
    }

    // 응답 준비
    const safeImage = productImage;

    return NextResponse.json({
      ok: true,
      image: safeImage,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Product Image Get] Error:', {
      message: errorMessage,
    });

    return NextResponse.json(
      { ok: false, error: '이미지 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
