/**
 * Images 폴더 배치 2/2 Cloudinary 업로드 API
 * folder LIKE '%Images%' AND cloudinaryUrl IS NULL인 나머지 29개 이미지 업로드
 *
 * Features:
 * - 동시 업로드 10개 (병렬 배치)
 * - 진행률 실시간 표시
 * - 최종 통계 (업로드 수/실패 수)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { createVercelBatchTimeoutGuard } from '@/lib/utils/timeoutGuard';
import { shouldContinueProcessing, memoryMonitor } from '@/lib/utils/memoryMonitor';
import prisma from '@/lib/prisma';
import cloudinary from 'cloudinary';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5분

// Cloudinary 설정
cloudinary.v2.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CONCURRENT = 10; // 동시 업로드 수
const BATCH_LABEL = '배치 2/2';

interface SyncResponse {
  success: boolean;
  batchLabel: string;
  totalImages: number;
  successCount: number;
  failureCount: number;
  successRate: string;
  durationMs: number;
  durationSec: string;
  progress: Array<{
    completed: number;
    total: number;
    percent: number;
    timestamp: string;
  }>;
}

async function uploadToDriveAndCloudinary(
  fileId: string,
  fileName: string,
  folder: string
): Promise<{ url: string; syncedAt: Date } | null> {
  try {
    // 1. Google Drive에서 파일 다운로드
    const drive = google.drive({
      version: 'v3',
      auth: process.env.GOOGLE_API_KEY,
    });

    const { data } = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    const buffer = Buffer.from(data as ArrayBuffer);

    // 2. Cloudinary에 업로드
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        {
          folder: `cruise-images/${folder || 'root'}`,
          resource_type: 'auto',
          eager: [{ fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              url: result!.secure_url,
              syncedAt: new Date(),
            });
          }
        }
      );

      uploadStream.end(buffer);
    });
  } catch (error) {
    logger.error('[BatchSync] Upload failed:', {
      fileName,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function executeSyncOperation(): Promise<SyncResponse> {
  const timeoutGuard = createVercelBatchTimeoutGuard();
  timeoutGuard.start();

  let successCount = 0;
  let failureCount = 0;
  const startTime = Date.now();
  const progressLog: Array<{ completed: number; total: number; percent: number; timestamp: string }> = [];

  try {
    // Step 1: Images 폴더의 미동기화 이미지 조회
    logger.info('[BatchSync] 배치 시작', {
      batchLabel: BATCH_LABEL,
    });

    const pendingImages = await prisma.imageCache.findMany({
      where: {
        folder: { contains: 'Images' },
        cloudinaryUrl: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalImages = pendingImages.length;
    logger.info('[BatchSync] 업로드 대상 조회 완료', {
      batchLabel: BATCH_LABEL,
      totalImages,
    });

    if (totalImages === 0) {
      logger.info('[BatchSync] 업로드할 이미지 없음');
      return {
        success: true,
        batchLabel: BATCH_LABEL,
        totalImages: 0,
        successCount: 0,
        failureCount: 0,
        successRate: '100%',
        durationMs: timeoutGuard.getElapsedMs(),
        durationSec: ((timeoutGuard.getElapsedMs()) / 1000).toFixed(1),
        progress: progressLog,
      };
    }

    // Step 2: 배치 처리
    for (let i = 0; i < totalImages; i += CONCURRENT) {
      // 타임아웃 체크
      if (timeoutGuard.hasExceeded()) {
        logger.warn('[BatchSync] 타임아웃 근접, 처리 중단', {
          completed: Math.min(i + CONCURRENT, totalImages),
          total: totalImages,
        });
        break;
      }

      if (!shouldContinueProcessing(85)) {
        logger.warn('[BatchSync] 메모리 임계값 도달, 처리 중단', {
          completed: Math.min(i + CONCURRENT, totalImages),
          total: totalImages,
        });
        break;
      }

      const batch = pendingImages.slice(i, i + CONCURRENT);

      // 병렬 업로드
      const results = await Promise.allSettled(
        batch.map(async (img) => {
          const uploadResult = await uploadToDriveAndCloudinary(
            img.driveFileId,
            img.fileName,
            img.folder || ''
          );

          if (!uploadResult) {
            return { success: false, id: img.id };
          }

          // DB 업데이트
          try {
            await prisma.imageCache.update({
              where: { id: img.id },
              data: {
                cloudinaryUrl: uploadResult.url,
                cloudinarySyncedAt: uploadResult.syncedAt,
              },
            });
            return { success: true, id: img.id };
          } catch (e) {
            logger.error('[BatchSync] DB update failed:', {
              imageId: img.id,
              error: e instanceof Error ? e.message : String(e),
            });
            return { success: false, id: img.id };
          }
        })
      );

      // 결과 집계
      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } else {
          failureCount++;
        }
      }

      // 진행률 표시
      const completed = Math.min(i + CONCURRENT, totalImages);
      const progressPercent = Math.round((completed / totalImages) * 100);
      const timestamp = new Date().toISOString();

      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const ratePerSec = (successCount / (Date.now() - startTime)) * 1000 || 0.1;
      const estimatedRemainingSec = (
        ((totalImages - completed) / ratePerSec) * 1000
      ).toFixed(0);

      logger.info('[BatchSync] 진행률 업데이트', {
        batchLabel: BATCH_LABEL,
        completed,
        total: totalImages,
        percent: progressPercent,
        successCount,
        failureCount,
        elapsedSec: parseFloat(elapsedSec),
        estimatedRemainingSec: parseInt(estimatedRemainingSec),
      });
      progressLog.push({ completed, total: totalImages, percent: progressPercent, timestamp });
    }

    // Step 3: 최종 결과
    const totalDuration = Date.now() - startTime;
    const successRate = totalImages > 0 ? ((successCount / totalImages) * 100).toFixed(1) : '0';

    logger.info('[BatchSync] 배치 완료', {
      batchLabel: BATCH_LABEL,
      totalImages,
      successCount,
      failureCount,
      successRate: parseFloat(successRate),
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
      progress: progressLog,
    };
  } catch (error) {
    logger.error('[BatchSync] Fatal error:', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      batchLabel: BATCH_LABEL,
      totalImages: 0,
      successCount,
      failureCount,
      successRate: '0%',
      durationMs: timeoutGuard.getElapsedMs(),
      durationSec: (timeoutGuard.getElapsedMs() / 1000).toFixed(1),
      progress: progressLog,
    };
  } finally {
    timeoutGuard.stop();
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<SyncResponse>> {
  try {
    // Admin 권한 확인
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
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
          progress: [],
        } as SyncResponse,
        { status: 403 }
      );
    }

    // 배치 처리 실행
    const result = await executeSyncOperation();

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('[BatchSync] API error:', {
      error: error instanceof Error ? error.message : String(error),
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
        progress: [],
      } as SyncResponse,
      { status: 500 }
    );
  }
}
