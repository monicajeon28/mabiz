import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { uploadImageToCloudinary, deleteImageFromCloudinary } from '@/lib/cloudinary-service';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import sharp from 'sharp';
import { validateImageMagicBytes } from '@/lib/file-validation';
import { logImageAccess } from '@/lib/image-access-logging';
import { WEBP_CONFIG } from '@/lib/image-optimize';
import { validateCsrfAndRespond } from '@/lib/api-utils';

type UploadErrorContext = {
  message: string;
  code?: string;
};

type ValidationResult = {
  valid: boolean;
  error?: string;
  actualFormat?: string;
};

type UploadSession = {
  originalPublicId: string;
  originalUrl: string;
  webpPublicId?: string;
  webpError?: string;
};

type UploadedImage = {
  id: number;
  url: string;
  size: number;
  webpUrl?: string | null;
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const DB_FIELD_MAX_LENGTH = 255;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const FILE_SIZE_DECIMAL_PLACES = 2;
const MAX_BATCH_SIZE = 10;
// B-P-2: DB 연결 풀 보호 (기본값 10 → 동시 5개로 제한)
const CONCURRENT_UPLOADS = Math.min(
  parseInt(process.env.CONCURRENT_UPLOADS_LIMIT || '5', 10),
  10
);

/**
 * 파일 검증: 크기, 타입, 매직 바이트
 */
async function validateUploadRequest(
  file: File,
  buffer: Buffer
): Promise<{ valid: boolean; error?: string; validation?: ValidationResult }> {
  if (file.size === 0) {
    return { valid: false, error: '파일은 비어있을 수 없습니다.' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `파일 크기는 ${MAX_FILE_SIZE_MB}MB 이하여야 합니다.` };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: '지원하는 이미지 형식: JPG, PNG, WebP, GIF' };
  }

  const validation = await validateImageMagicBytes(buffer, file.type);
  if (!validation.valid) {
    logger.warn('[Product Image Upload] Magic byte validation failed:', {
      fileName: file.name,
      reportedType: file.type,
      actualFormat: validation.actualFormat,
    });
    return { valid: false, error: validation.error || '유효하지 않은 이미지 파일입니다', validation };
  }

  return { valid: true, validation };
}

/**
 * 원본 + WebP 이미지 병렬 업로드
 * B-B-3 수정: WebP 실패 시 metadata에 에러 기록
 */
async function uploadOriginalAndWebP(
  buffer: Buffer,
  fileName: string,
  folder: string,
  actualFormat?: string
): Promise<{ session?: UploadSession; error?: string }> {
  let webpPublicId: string | undefined;
  let webpError: string | undefined;

  // B-B-3: Sharp 예외 처리 추가 (.catch로 안전하게 처리)
  const webpConversionPromise =
    actualFormat !== 'gif'
      ? sharp(buffer)
          .webp(WEBP_CONFIG)
          .toBuffer()
          .catch((err) => {
            logger.warn('[Product Image WebP Conversion] Failed (non-fatal):', {
              error: err instanceof Error ? err.message : String(err),
              fileName,
            });
            return null;
          })
      : Promise.resolve(null);

  const [result, webpBuffer] = await Promise.all([
    uploadImageToCloudinary({
      buffer,
      fileName,
      folder,
    }),
    webpConversionPromise,
  ]);

  if (!result.ok) {
    return { error: result.error || '원본 업로드 실패' };
  }

  if (webpBuffer) {
    try {
      const webpFileName = fileName.replace(/\.[^.]+$/, '.webp');
      const webpResult = await uploadImageToCloudinary({
        buffer: webpBuffer,
        fileName: webpFileName,
        folder,
        format: 'webp',
      });

      if (webpResult.ok) {
        webpPublicId = webpResult.public_id;
      } else {
        webpError = `WebP upload failed: ${webpResult.error}`;
        logger.warn('[Product Image WebP Upload] Failed:', {
          fileName,
          error: webpResult.error,
        });
      }
    } catch (err) {
      webpError = err instanceof Error ? err.message : String(err);
      logger.warn('[Product Image WebP Conversion] Error, continuing with original:', {
        fileName,
        error: webpError,
      });
    }
  }

  return {
    session: {
      originalPublicId: result.public_id!,
      originalUrl: result.url!,
      webpPublicId,
      webpError,
    },
  };
}

/**
 * ProductImage를 데이터베이스에 저장 (Transaction 포함)
 * B-S-1 수정: cruiseProductId 추가 (FK 제약)
 */
async function saveProductImageToDB(
  userId: string,
  file: File,
  folder: string,
  session: UploadSession,
  isGif: boolean,
  cruiseProductId: number
): Promise<{ id?: number; error?: string }> {
  try {
    if (!session.originalPublicId) {
      throw new Error('Cloudinary public_id가 없습니다');
    }
    if (!file.name) {
      throw new Error('파일명이 없습니다');
    }

    const productImage = await prisma.productImage.create({
      data: {
        cruiseProductId,
        cloudinaryPublicId: session.originalPublicId,
        fileName: file.name.substring(0, DB_FIELD_MAX_LENGTH),
        fileSize: file.size,
        mimeType: file.type,
        webpPublicId: session.webpPublicId || null,
        storagePath: folder.substring(0, DB_FIELD_MAX_LENGTH),
        uploadedById: parseInt(userId),
        purpose: 'product',
        isGif: isGif,
        cloudinaryFolder: folder,
        fullUrl: session.originalUrl,
        metadata: {
          uploadedAt: new Date().toISOString(),
          uploadMethod: 'admin-product-upload',
          storageProvider: 'cloudinary',
          sourceFileName: file.name,
          webpConversionStatus: isGif ? 'skipped' : (session.webpPublicId ? 'success' : 'failed'),
          webpConversionError: session.webpError || null,
          fileSizeMB: (file.size / 1024 / 1024).toFixed(FILE_SIZE_DECIMAL_PLACES),
        },
      },
    });

    return { id: productImage.id };
  } catch (err) {
    logger.error('[Product Image Save] Error:', {
      publicId: session.originalPublicId,
      webpPublicId: session.webpPublicId,
      error: err instanceof Error ? err.message : err,
    });

    await Promise.allSettled([
      deleteImageFromCloudinary(session.originalPublicId),
      session.webpPublicId ? deleteImageFromCloudinary(session.webpPublicId) : Promise.resolve(),
    ]).then((results) => {
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        logger.error('[Product Image Save Rollback] Partial failure - orphan files possible:', {
          originalPublicId: session.originalPublicId,
          webpPublicId: session.webpPublicId,
          failedCount: failed.length,
        });
      }
    });

    return { error: '이미지 정보 저장 중 오류가 발생했습니다.' };
  }
}

/**
 * 상품 ID와 권한 검증
 */
async function validateProductAndAuth(
  productId: string
): Promise<{ valid: boolean; error?: string; statusCode?: number; productCode?: string }> {
  try {
    const productIdNum = parseInt(productId);
    if (isNaN(productIdNum) || productIdNum <= 0) {
      return { valid: false, error: '유효하지 않은 상품 ID입니다.', statusCode: 400 };
    }

    const product = await prisma.cruiseProduct.findUnique({
      where: { id: productIdNum },
      select: { id: true, productCode: true },
    });

    if (!product) {
      return { valid: false, error: '상품을 찾을 수 없습니다.', statusCode: 404 };
    }

    return { valid: true, productCode: product.productCode };
  } catch (err) {
    logger.error('[Product Validation] Error:', {
      productId,
      error: err instanceof Error ? err.message : err,
    });
    return { valid: false, error: '상품 검증 중 오류가 발생했습니다.', statusCode: 500 };
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    // URL 파라미터 추출
    const { productId } = await params;

    // 관리자 권한 확인
    const { isAdmin, user } = await checkAdminAuth();
    if (!isAdmin || !user) {
      return NextResponse.json(
        { ok: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    // CSRF 토큰 검증
    const csrfCheck = validateCsrfAndRespond(req, 'Product Image Upload');
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // Cloudinary 설정 확인
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      logger.error('[Product Image Upload] Cloudinary environment variables missing');
      return NextResponse.json(
        { ok: false, error: 'Cloudinary 설정 오류' },
        { status: 503 }
      );
    }

    // 상품 ID와 권한 검증
    const productValidation = await validateProductAndAuth(productId);
    if (!productValidation.valid) {
      return NextResponse.json(
        { ok: false, error: productValidation.error },
        { status: productValidation.statusCode || 500 }
      );
    }

    const productCode = productValidation.productCode!;

    // FormData에서 파일 추출
    const formData = await req.formData();
    const files: File[] = [];

    // 여러 파일 추출: file, file[0], file[1], ... 또는 files[]
    const fileEntry = formData.get('file');
    if (fileEntry instanceof File) {
      files.push(fileEntry);
    }

    // file[0], file[1], ... 형식 추출
    for (let i = 0; i < MAX_BATCH_SIZE; i++) {
      const f = formData.get(`file[${i}]`);
      if (f instanceof File) {
        files.push(f);
      }
    }

    // files[] 형식 추출
    if (files.length === 0) {
      const filesEntry = formData.getAll('files[]');
      for (const f of filesEntry) {
        if (f instanceof File) {
          files.push(f);
        }
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, error: '업로드할 파일이 없습니다.' },
        { status: 400 }
      );
    }

    if (files.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { ok: false, error: `한 번에 최대 ${MAX_BATCH_SIZE}개 파일만 업로드할 수 있습니다.` },
        { status: 400 }
      );
    }

    // Cloudinary 폴더: "products/{productCode}"
    const cloudinaryFolder = `products/${productCode}`;

    // 각 파일 병렬 업로드 처리
    const uploadPromises = files.map(async (file) => {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        // 파일 검증
        const validationResult = await validateUploadRequest(file, buffer);
        if (!validationResult.valid) {
          return {
            success: false,
            error: validationResult.error,
            fileName: file.name,
          };
        }

        const isGif = validationResult.validation?.actualFormat === 'gif';

        // 원본 + WebP 병렬 업로드
        const uploadResult = await uploadOriginalAndWebP(
          buffer,
          file.name,
          cloudinaryFolder,
          validationResult.validation?.actualFormat
        );

        if (uploadResult.error || !uploadResult.session) {
          return {
            success: false,
            error: uploadResult.error || '업로드 실패',
            fileName: file.name,
          };
        }

        // DB에 저장 (B-S-1: cruiseProductId 전달)
        const saveResult = await saveProductImageToDB(
          user.id.toString(),
          file,
          cloudinaryFolder,
          uploadResult.session,
          isGif!,
          parseInt(productId, 10)
        );

        if (saveResult.error) {
          return {
            success: false,
            error: saveResult.error,
            fileName: file.name,
          };
        }

        const productImageId = saveResult.id!;

        // 접근 로그 기록 (비동기, 실패해도 무시)
        logImageAccess(productImageId, 'UPLOAD', {
          userId: user.id,
          request: req,
          metadata: { fileName: file.name, fileSize: file.size, productId, productCode },
        }).catch(() => {});

        return {
          success: true,
          id: productImageId,
          url: uploadResult.session.originalUrl,
          size: file.size,
          webpUrl: uploadResult.session.webpPublicId
            ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${uploadResult.session.webpPublicId}`
            : null,
          fileName: file.name,
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[Product Image Upload] File processing error:', {
          fileName: file.name,
          error: errorMessage,
        });
        return {
          success: false,
          error: '파일 처리 중 오류가 발생했습니다.',
          fileName: file.name,
        };
      }
    });

    const results = await Promise.all(uploadPromises);

    // 전체 결과 집계
    const successfulUploads: UploadedImage[] = [];
    const failedUploads: Array<{ fileName: string; error: string }> = [];

    for (const result of results) {
      if (result.success) {
        successfulUploads.push({
          id: (result as any).id,
          url: (result as any).url,
          size: (result as any).size,
          webpUrl: (result as any).webpUrl,
        });
      } else {
        failedUploads.push({
          fileName: result.fileName,
          error: result.error,
        });
      }
    }

    // 모든 업로드 실패 시
    if (successfulUploads.length === 0) {
      const errorMsg = failedUploads.length === 1
        ? failedUploads[0].error
        : `${failedUploads.length}개 파일 모두 업로드 실패`;
      return NextResponse.json(
        { ok: false, error: errorMsg },
        { status: 400 }
      );
    }

    // 부분 성공 또는 완전 성공
    return NextResponse.json({
      ok: true,
      images: successfulUploads,
      failed: failedUploads.length > 0 ? failedUploads : undefined,
      message:
        failedUploads.length > 0
          ? `${successfulUploads.length}개 파일 업로드 성공, ${failedUploads.length}개 실패`
          : `${successfulUploads.length}개 파일 모두 업로드 성공`,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorContext = error as UploadErrorContext | undefined;
    logger.error('[Product Image Upload] Critical error:', {
      message: errorMessage,
      code: errorContext?.code,
    });

    return NextResponse.json(
      { ok: false, error: '업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
