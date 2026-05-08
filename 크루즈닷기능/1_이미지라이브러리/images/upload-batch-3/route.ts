import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { uploadImageToCloudinary } from '@/lib/cloudinary-service';
import { logger } from '@/lib/logger';
import { readFileSync } from 'fs';
import { join } from 'path';

export const maxDuration = 300;
export const runtime = 'nodejs';

const IMAGES_BASE_PATH = join(
  process.cwd(),
  'public/local-assets/Images/Images'
);
const BATCH_3_OFFSET = 1760;
const BATCH_3_LIMIT = 880;
const PARALLEL_UPLOADS = 10;

/**
 * 배치 3/4: Images 폴더 이미지 Cloudinary 업로드
 *
 * 처리:
 * 1. ImageCache에서 cloudinaryUrl IS NULL인 레코드 중 배치 3 (1760-2640) 조회
 * 2. 각 파일을 로컬 경로에서 읽기 (/public/local-assets/Images/Images/폴더명/파일명)
 * 3. Cloudinary에 업로드 (folder: "cruise-images/폴더명")
 * 4. cloudinaryUrl + cloudinarySyncedAt 저장
 * 5. 동시 업로드: 10개
 * 6. 진행률: "배치 3/4: X/880"
 */

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  let uploaded = 0;
  let failed = 0;
  const failedImages: Array<{
    fileName: string;
    folder: string;
    errorMessage: string;
  }> = [];

  try {
    // 관리자 인증 (CRON_SECRET 또는 Authorization 헤더)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      logger.warn('[UploadImagesBatch3] 인증 실패 - 무단 접근 시도');
      return NextResponse.json(
        { ok: false, error: '인증 실패' },
        { status: 401 }
      );
    }

    logger.log('[UploadImagesBatch3] 배치 3/4 시작', {
      timestamp: new Date().toISOString(),
      offset: BATCH_3_OFFSET,
      limit: BATCH_3_LIMIT,
      parallelUploads: PARALLEL_UPLOADS,
    });

    // 1. ImageCache에서 cloudinaryUrl IS NULL인 레코드 중 배치 3 (offset: 1760, limit: 880) 조회
    const imagesToSync = await prisma.imageCache.findMany({
      where: {
        cloudinaryUrl: null,
      },
      select: {
        id: true,
        fileName: true,
        folder: true,
        path: true,
        mimeType: true,
      },
      skip: BATCH_3_OFFSET,
      take: BATCH_3_LIMIT,
      orderBy: { createdAt: 'asc' },
    });

    const uniqueFolders = Array.from(new Set(imagesToSync.map(img => img.folder)));

    logger.log('[UploadImagesBatch3] 업로드 대상 조회 완료', {
      totalImages: imagesToSync.length,
      folders: uniqueFolders,
      offset: BATCH_3_OFFSET,
      limit: BATCH_3_LIMIT,
    });

    if (imagesToSync.length === 0) {
      logger.log('[UploadImagesBatch3] 업로드할 이미지 없음 - 작업 종료');
      return NextResponse.json({
        ok: true,
        uploaded: 0,
        failed: 0,
        batchNumber: '3/4',
        message: '업로드할 이미지 없음',
      });
    }

    // 2. 동시 업로드 (10개씩) + P1-17: 배치 DB 업데이트
    const batches = Math.ceil(imagesToSync.length / PARALLEL_UPLOADS);
    const updateBatch: Array<{ imageId: number; url: string; publicId: string }> = [];

    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const start = batchIndex * PARALLEL_UPLOADS;
      const end = Math.min(start + PARALLEL_UPLOADS, imagesToSync.length);
      const batch = imagesToSync.slice(start, end);

      const progressPercent = Math.round((end / imagesToSync.length) * 100);
      logger.log(
        `[UploadImagesBatch3] 배치 3/4: ${end}/${imagesToSync.length} (${progressPercent}%) 업로드 중...`
      );

      // 병렬 업로드
      const results = await Promise.allSettled(
        batch.map(async image => {
          try {
            // 로컬 파일 읽기
            const filePath = join(IMAGES_BASE_PATH, image.folder, image.fileName);
            const fileBuffer = readFileSync(filePath);

            // Cloudinary 폴더 경로: cruise-images/폴더명
            const cloudinaryFolder = `cruise-images/${image.folder}`;

            // Cloudinary 업로드
            const result = await uploadImageToCloudinary({
              buffer: fileBuffer,
              fileName: image.fileName,
              folder: cloudinaryFolder,
              format: image.mimeType === 'image/gif' ? 'gif' : undefined,
            });

            if (!result.ok) {
              throw new Error(result.error || 'Cloudinary 업로드 실패');
            }

            logger.log('[UploadImagesBatch3] 성공:', {
              imageId: image.id,
              fileName: image.fileName,
              publicId: result.public_id,
              folder: image.folder,
            });

            uploaded++;
            // DB 업데이트는 배치로 수집 (후처리)
            updateBatch.push({
              imageId: image.id,
              url: result.url,
              publicId: result.public_id,
            });
            return { success: true };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('[UploadImagesBatch3] 실패:', {
              fileName: image.fileName,
              folder: image.folder,
              error: errorMessage,
            });

            failedImages.push({
              fileName: image.fileName,
              folder: image.folder,
              errorMessage,
            });

            failed++;
            return { success: false };
          }
        })
      );

    }

    // P1-17: 배치 DB 업데이트 (병렬 처리)
    if (updateBatch.length > 0) {
      await Promise.all(
        updateBatch.map((item) =>
          prisma.imageCache.update({
            where: { id: item.imageId },
            data: {
              cloudinaryUrl: item.url,
              cloudinaryPublicId: item.publicId,
              cloudinarySyncedAt: new Date(),
            },
          })
        )
      );
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const successRate = imagesToSync.length > 0
      ? ((uploaded / imagesToSync.length) * 100).toFixed(2)
      : '0.00';

    // 배치 3/4 완료 로그
    logger.log('[UploadImagesBatch3] 배치 3/4 완료', {
      batchNumber: '3/4',
      totalProcessed: imagesToSync.length,
      uploaded,
      failed,
      successRate: `${successRate}%`,
      elapsedTime: `${elapsedTime}초`,
      failedImages: failedImages.length > 0 ? failedImages : 'None',
    });

    return NextResponse.json({
      ok: true,
      batchNumber: '3/4',
      uploaded,
      failed,
      totalProcessed: imagesToSync.length,
      successRate: `${successRate}%`,
      elapsedTime: `${elapsedTime}초`,
      message: `배치 3/4 완료: ${uploaded}/${imagesToSync.length} 업로드, ${failed}개 실패`,
      failedImages: failedImages.length > 0 ? failedImages : undefined,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    logger.error('[UploadImagesBatch3] 예상치 못한 에러', {
      error: errorMessage,
      elapsedTime: `${elapsedTime}초`,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { ok: false, error: '배치 업로드 실패' },
      { status: 500 }
    );
  }
}
