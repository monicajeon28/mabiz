import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { deleteImageFromCloudinary } from '@/lib/cloudinary-service';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { logImageAccess } from '@/lib/image-access-logging';
import { validateCsrfAndRespond, parseIdParam } from '@/lib/api-utils';
import { productImageUpdateSchema } from '@/lib/schemas/productImageSchema';

export const dynamic = 'force-dynamic';

// DELETE: 이미지 삭제 (소프트 삭제 + Cloudinary 파일 제거)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin, user } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    // CSRF 토큰 검증 (헬퍼 함수 사용)
    const csrfCheck = validateCsrfAndRespond(req, 'Admin Images DELETE');
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    const { id } = await params;
    const idCheck = parseIdParam(id, '유효한 이미지 ID가 아닙니다.');
    if (!idCheck.valid) {
      return idCheck.response!;
    }

    const imageId = idCheck.id!;

    // 이미지 조회
    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      return NextResponse.json(
        { ok: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (image.deletedAt) {
      return NextResponse.json(
        { ok: false, error: '이미 삭제된 이미지입니다.' },
        { status: 410 }
      );
    }

    // IDOR 확인: 관리자만 모든 이미지 삭제 가능
    if (user?.role !== 'admin' && image.uploadedById !== user?.id) {
      return NextResponse.json(
        { ok: false, error: '이 이미지를 삭제할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // Transaction: DB 먼저 업데이트 (atomic) → Cloudinary 파일 비동기 삭제
    const deleted = await prisma.productImage.update({
      where: { id: imageId },
      data: { deletedAt: new Date() },
    });

    // Cloudinary에서 파일 삭제 (비동기, 부분 실패도 모두 처리)
    // DB는 이미 업데이트되었으므로 데이터 일관성 보장됨
    Promise.allSettled([
      deleteImageFromCloudinary(image.cloudinaryPublicId),
      image.webpPublicId ? deleteImageFromCloudinary(image.webpPublicId) : Promise.resolve(),
    ]).then((results) => {
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        logger.warn('[Cloudinary Delete] Partial failure:', {
          imageId,
          cloudinaryPublicId: image.cloudinaryPublicId,
          webpPublicId: image.webpPublicId,
          failedCount: failed.length,
          errors: failed.map(r => (r as PromiseRejectedResult).reason?.message),
        });
      }
      // Cloudinary 삭제 실패는 로깅만 하고 무시 (DB soft delete 유지)
    });

    // 접근 로그 기록
    logImageAccess(imageId, 'DELETE', {
      userId: user?.id,
      request: req,
      metadata: { fileName: image.fileName },
    }).catch(() => {});

    logger.log('[Admin Images DELETE] Image soft-deleted:', {
      imageId,
      fileName: image.fileName,
    });

    return NextResponse.json({
      ok: true,
      message: '이미지가 삭제되었습니다.',
      data: {
        id: deleted.id,
        deletedAt: deleted.deletedAt,
      },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errCode = (error as Record<string, unknown>)?.code;
    logger.error('[Admin Images DELETE] Error:', { message: errMsg, code: errCode });

    return NextResponse.json(
      { ok: false, error: '이미지 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PATCH: 이미지 메타데이터 수정 (tags, folder, metadata)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    // CSRF 토큰 검증 (헬퍼 함수 사용)
    const csrfCheck = validateCsrfAndRespond(req, 'Admin Images PATCH');
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    const { id } = await params;
    const idCheck = parseIdParam(id, '유효한 이미지 ID가 아닙니다.');
    if (!idCheck.valid) {
      return idCheck.response!;
    }

    const imageId = idCheck.id!;

    // JSON 파싱 및 Zod 검증
    let body: unknown;
    try {
      body = await req.json();
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    const validation = productImageUpdateSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      logger.warn('[Admin Images PATCH] Validation failed:', {
        event: 'VALIDATION_ERROR',
        field: firstError.path.join('.'),
        message: firstError.message,
        received: firstError.code,
      });
      return NextResponse.json(
        { ok: false, error: firstError.message || '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    const { tags, folder, metadata } = validation.data;

    // 이미지 조회
    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      return NextResponse.json(
        { ok: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (image.deletedAt) {
      return NextResponse.json(
        { ok: false, error: '삭제된 이미지는 수정할 수 없습니다.' },
        { status: 410 }
      );
    }

    // IDOR 확인: 관리자만 모든 이미지 수정 가능
    const { user: patchUser } = await checkAdminAuth();
    if (patchUser?.role !== 'admin' && image.uploadedById !== patchUser?.id) {
      return NextResponse.json(
        { ok: false, error: '이 이미지를 수정할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 메타데이터 수정
    const baseMetadata = (typeof image.metadata === 'object' && image.metadata) ? (image.metadata as Record<string, unknown>) : {};
    const updated = await prisma.productImage.update({
      where: { id: imageId },
      data: {
        ...(tags !== undefined && { tags }),
        ...(folder !== undefined && { folder }),
        ...(metadata !== undefined && { metadata: { ...baseMetadata, ...metadata } }),
      },
    });

    // 접근 로그 기록
    logImageAccess(imageId, 'UPDATE', {
      userId: patchUser?.id,
      request: req,
      metadata: { updatedFields: Object.keys(body) },
    }).catch(() => {});

    logger.log('[Admin Images PATCH] Image metadata updated:', {
      imageId,
      updatedFields: Object.keys(body),
    });

    return NextResponse.json({
      ok: true,
      data: updated,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errCode = (error as Record<string, unknown>)?.code;
    logger.error('[Admin Images PATCH] Error:', { message: errMsg, code: errCode });

    return NextResponse.json(
      { ok: false, error: '이미지 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
