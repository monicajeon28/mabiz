/**
 * Images 폴더 배치 2/2 Cloudinary 업로드 (병렬 배치 10개)
 *
 * 작업:
 * 1. ImageCache에서 folder LIKE '%Images%' AND cloudinaryUrl IS NULL인 나머지 29개 조회
 * 2. 동일 업로드 로직 (Google Drive → Cloudinary)
 * 3. 동시 업로드: 10개 (병렬)
 * 4. 진행률: "배치 2/2: X/29"
 * 5. 최종 통계: 총 업로드/실패
 *
 * 결과: Images 폴더 모든 이미지 업로드 완료
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { createVercelBatchTimeoutGuard } from '@/lib/utils/timeoutGuard';
import { shouldContinueProcessing, memoryMonitor } from '@/lib/utils/memoryMonitor';
import { uploadImageToCloudinary } from '@/lib/cloudinary-service';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5분

const CONCURRENT = 10; // 동시 업로드 수
const BATCH_LABEL = '배치 2/2'; // 진행률 라벨

interface BatchSyncResponse {
  success: boolean;
  batchLabel: string;
  totalImages: number;
  successCount: number;
  failureCount: number;
  successRate: string;
  durationMs: number;
  durationSec: string;
  message: string;
  timestamp: string;
  failedDetails?: Array<{
    fileName: string;
    folder: string;
    error: string;
  }>;
}

interface ProgressUpdate {
  completed: number;
  total: number;
  percent: number;
  elapsedSec: number;
  estimatedRemainingSec: number;
  successCount: number;
  failureCount: number;
  timestamp: string;
}

async function downloadFromGoogleDrive(driveUrl: string): Promise<Buffer | null> {
  try {
    // Google Drive URL에서 파일 ID 추출
    const fileIdMatch = driveUrl.match(/[?&]id=([^&]+)/);
    if (!fileIdMatch) {
      logger.error('[Batch2Sync] Failed to extract file ID from drive URL:', { driveUrl });
      return null;
    }

    // Google Drive API를 통한 다운로드
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileIdMatch[1]}?alt=media&key=${process.env.GOOGLE_API_KEY}`;

    const response = await fetch(downloadUrl, { timeout: 30000 });

    if (!response.ok) {
      logger.error('[Batch2Sync] Google Drive download failed:', {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer;
  } catch (error) {
    logger.error('[Batch2Sync] Download error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function uploadToDriveAndCloudinary(
  image: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1: Google Drive에서 다운로드
    const buffer = await downloadFromGoogleDrive(image.driveUrl);
    if (!buffer) {
      return { success: false, error: 'Google Drive 다운로드 실패' };
    }

    // Step 2: Cloudinary에 업로드
    const cloudinaryFolder = `cruise-images/${image.folder || 'uncategorized'}`;

    const result = await uploadImageToCloudinary({
      buffer,
      fileName: image.fileName,
      folder: cloudinaryFolder,
      format: image.mimeType === 'image/gif' ? 'gif' : undefined,
    });

    if (!result.ok) {
      return { success: false, error: result.error || 'Cloudinary 업로드 실패' };
    }

    // Step 3: DB 업데이트
    try {
      await prisma.imageCache.update({
        where: { id: image.id },
        data: {
          cloudinaryUrl: result.url,
          cloudinaryPublicId: result.public_id,
          cloudinarySyncedAt: new Date(),
        },
      });

      logger.log('[Batch2Sync] Upload successful:', {
        imageId: image.id,
        fileName: image.fileName,
        publicId: result.public_id,
      });

      return { success: true };
    } catch (dbError) {
      logger.error('[Batch2Sync] DB update failed:', {
        imageId: image.id,
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
      return { success: false, error: 'DB 업데이트 실패' };
    }
  } catch (error) {
    logger.error('[Batch2Sync] Upload process error:', {
      fileName: image.fileName,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function executeSyncOperation(): Promise<BatchSyncResponse> {
  const timeoutGuard = createVercelBatchTimeoutGuard();
  timeoutGuard.start();

  let successCount = 0;
  let failureCount = 0;
  const startTime = Date.now();
  const failedDetails: Array<{ fileName: string; folder: string; error: string }> = [];

  try {
    logger.log(`[Batch2Sync] Starting Cloudinary upload for ${BATCH_LABEL}`);

    // Step 1: Images 폴더의 미동기화 이미지 조회
    const pendingImages = await prisma.imageCache.findMany({
      where: {
        folder: { contains: 'Images' },
        cloudinaryUrl: null,
        driveUrl: { not: null },
      },
      select: {
        id: true,
        fileName: true,
        folder: true,
        driveUrl: true,
        mimeType: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalImages = pendingImages.length;
    logger.log(`[Batch2Sync] Upload target: ${totalImages.toLocaleString()} images`);

    if (totalImages === 0) {
      logger.log('[Batch2Sync] All images in Images folder already synced');

      return {
        success: true,
        batchLabel: BATCH_LABEL,
        totalImages: 0,
        successCount: 0,
        failureCount: 0,
        successRate: '100%',
        durationMs: timeoutGuard.getElapsedMs(),
        durationSec: (timeoutGuard.getElapsedMs() / 1000).toFixed(1),
        message: 'Images 폴더 모든 이미지가 이미 동기화됨',
        timestamp: new Date().toISOString(),
      };
    }

    // Step 2: 배치 처리
    for (let i = 0; i < totalImages; i += CONCURRENT) {
      // 타임아웃 체크
      if (timeoutGuard.hasExceeded()) {
        logger.warn('[Batch2Sync] Timeout exceeded, stopping batch processing', {
          processed: successCount + failureCount,
          total: totalImages,
        });
        break;
      }

      // 메모리 체크
      if (!shouldContinueProcessing(85)) {
        logger.warn('[Batch2Sync] Memory threshold reached, stopping batch processing');
        break;
      }

      const batch = pendingImages.slice(i, i + CONCURRENT);

      // 병렬 업로드
      const results = await Promise.allSettled(
        batch.map(async (img) => {
          const uploadResult = await uploadToDriveAndCloudinary(img);
          return {
            success: uploadResult.success,
            error: uploadResult.error,
            imageId: img.id,
            fileName: img.fileName,
            folder: img.folder,
          };
        })
      );

      // 결과 집계
      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successCount++;
          } else {
            failureCount++;
            failedDetails.push({
              fileName: result.value.fileName,
              folder: result.value.folder || 'uncategorized',
              error: result.value.error || 'Unknown error',
            });
          }
        } else {
          failureCount++;
        }
      }

      // 진행률 표시
      const completed = Math.min(i + CONCURRENT, totalImages);
      const progressPercent = Math.round((completed / totalImages) * 100);
      const elapsedSec = (Date.now() - startTime) / 1000;
      const ratePerSec = (successCount + failureCount) / elapsedSec || 0.1;
      const estimatedRemainingSec = ((totalImages - completed) / ratePerSec) || 0;

      const progressMsg = (
        `${BATCH_LABEL} ${completed}/${totalImages} (${progressPercent}%) | ` +
        `Success: ${successCount} | Failed: ${failureCount} | ` +
        `Elapsed: ${elapsedSec.toFixed(1)}s | ETA: ~${estimatedRemainingSec.toFixed(0)}s`
      );

      logger.log(`[Batch2Sync] ${progressMsg}`);
    }

    // Step 3: 최종 결과
    const totalDuration = Date.now() - startTime;
    const successRate = totalImages > 0 ? ((successCount / totalImages) * 100).toFixed(1) : '0';

    logger.log('[Batch2Sync] Batch sync completed', {
      batchLabel: BATCH_LABEL,
      totalImages,
      successCount,
      failureCount,
      successRate: `${successRate}%`,
      durationSec: (totalDuration / 1000).toFixed(1),
    });

    return {
      success: true,
      batchLabel: BATCH_LABEL,
      totalImages,
      successCount,
      failureCount,
      successRate: `${successRate}%`,
      durationMs: totalDuration,
      durationSec: (totalDuration / 1000).toFixed(1),
      message: `${successCount}개 업로드 성공, ${failureCount}개 실패`,
      timestamp: new Date().toISOString(),
      failedDetails: failedDetails.length > 0 ? failedDetails : undefined,
    };
  } catch (error) {
    logger.error('[Batch2Sync] Fatal error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const totalDuration = Date.now() - startTime;

    return {
      success: false,
      batchLabel: BATCH_LABEL,
      totalImages: 0,
      successCount,
      failureCount,
      successRate: '0%',
      durationMs: totalDuration,
      durationSec: (totalDuration / 1000).toFixed(1),
      message: `오류 발생: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date().toISOString(),
      failedDetails: failedDetails.length > 0 ? failedDetails : undefined,
    };
  } finally {
    timeoutGuard.stop();
  }
}

/**
 * POST /api/batch-2-images-sync
 * Images 폴더 배치 2/2 Cloudinary 업로드 실행
 */
export async function POST(req: NextRequest): Promise<NextResponse<BatchSyncResponse>> {
  try {
    // Admin 권한 확인
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      logger.warn('[Batch2Sync] Unauthorized access attempt');

      return NextResponse.json(
        {
          success: false,
          batchLabel: BATCH_LABEL,
          totalImages: 0,
          successCount: 0,
          failureCount: 0,
          successRate: '0%',
          durationMs: 0,
          durationSec: '0',
          message: '관리자 권한이 필요합니다',
          timestamp: new Date().toISOString(),
        } as BatchSyncResponse,
        { status: 403 }
      );
    }

    // 배치 처리 실행
    const result = await executeSyncOperation();

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('[Batch2Sync] API error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        batchLabel: BATCH_LABEL,
        totalImages: 0,
        successCount: 0,
        failureCount: 0,
        successRate: '0%',
        durationMs: 0,
        durationSec: '0',
        message: '서버 오류가 발생했습니다',
        timestamp: new Date().toISOString(),
      } as BatchSyncResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/batch-2-images-sync (상태 확인)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Admin 권한 확인
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // Images 폴더 미동기화 이미지 개수 조회
    const pendingCount = await prisma.imageCache.count({
      where: {
        folder: { contains: 'Images' },
        cloudinaryUrl: null,
        driveUrl: { not: null },
      },
    });

    const memoryStats = memoryMonitor.getMemoryStats();

    return NextResponse.json({
      ok: true,
      service: 'batch-2-images-sync',
      batchLabel: BATCH_LABEL,
      pendingImagesCount: pendingCount,
      status: pendingCount === 0 ? 'complete' : 'pending',
      memory: {
        heapUsedMB: Math.round(memoryStats.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memoryStats.heapTotal / 1024 / 1024),
        heapLimitMB: Math.round(memoryStats.heapLimit / 1024 / 1024),
        usagePercent: Math.round(memoryStats.usagePercent),
        peakMemoryMB: memoryMonitor.getPeakMemoryMB(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
