/**
 * Image 폴더 배치 1 Cloudinary 업로드 API
 * public/local-assets/Image/Image 폴더의 3,515개 이미지를 Cloudinary로 업로드
 *
 * Features:
 * - 동시 업로드 10개 (병렬 배치)
 * - 진행률 실시간 표시
 * - 최종 통계 (업로드 수/실패 수)
 * - 로컬 파일 시스템에서 직접 읽음 (fs.readFile)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { createVercelBatchTimeoutGuard } from '@/lib/utils/timeoutGuard';
import { shouldContinueProcessing, memoryMonitor } from '@/lib/utils/memoryMonitor';
import prisma from '@/lib/prisma';
import cloudinary from 'cloudinary';
import fs from 'fs/promises';
import path from 'path';

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
const BATCH_LABEL = '배치 1/1 (로컬 Image 폴더)';
const LOCAL_IMAGES_DIR = '/home/userhyeseon28/projects/cruise-guide-app/public/local-assets/Image/Image';

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

async function uploadLocalImageToCloudinary(
  filePath: string,
  fileName: string,
  folder: string = 'images'
): Promise<{ url: string; publicId: string; syncedAt: Date } | null> {
  try {
    // 1. 로컬 파일 읽기
    const buffer = await fs.readFile(filePath);

    // 2. Cloudinary에 업로드
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        {
          folder: `cruise-images/${folder}`,
          resource_type: 'auto',
          public_id: path.parse(fileName).name, // 파일명을 public_id로 사용
          eager: [{ fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              url: result!.secure_url,
              publicId: result!.public_id,
              syncedAt: new Date(),
            });
          }
        }
      );

      uploadStream.end(buffer);
    });
  } catch (error) {
    logger.error('[Batch1Sync] Upload failed:', {
      fileName,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function getLocalImageFiles(): Promise<Array<{ filePath: string; fileName: string }>> {
  try {
    const files = await fs.readdir(LOCAL_IMAGES_DIR);
    return files
      .filter((f) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(f))
      .map((fileName) => ({
        filePath: path.join(LOCAL_IMAGES_DIR, fileName),
        fileName,
      }));
  } catch (error) {
    logger.error('[Batch1Sync] Failed to read local directory:', {
      directory: LOCAL_IMAGES_DIR,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
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
    // Step 1: 로컬 이미지 파일 목록 조회
    logger.info(`[Batch1Sync] Starting Cloudinary upload for ${BATCH_LABEL}`);

    const localFiles = await getLocalImageFiles();
    const totalImages = localFiles.length;

    logger.info(`[Batch1Sync] Upload target: ${totalImages.toLocaleString()} images`);

    if (totalImages === 0) {
      logger.warn('[Batch1Sync] No images found in local directory');
      return {
        success: false,
        batchLabel: BATCH_LABEL,
        totalImages: 0,
        successCount: 0,
        failureCount: 0,
        successRate: '0%',
        durationMs: timeoutGuard.getElapsedMs(),
        durationSec: ((timeoutGuard.getElapsedMs()) / 1000).toFixed(1),
        progress: progressLog,
      };
    }

    // Step 2: 배치 처리
    for (let i = 0; i < totalImages; i += CONCURRENT) {
      // 타임아웃 체크
      if (timeoutGuard.hasExceeded()) {
        logger.warn('[Batch1Sync] Timeout threshold exceeded, stopping processing');
        break;
      }

      if (!shouldContinueProcessing(85)) {
        logger.warn('[Batch1Sync] Memory threshold reached, stopping processing');
        break;
      }

      const batch = localFiles.slice(i, i + CONCURRENT);

      // 병렬 업로드
      const results = await Promise.allSettled(
        batch.map(async (file) => {
          const uploadResult = await uploadLocalImageToCloudinary(
            file.filePath,
            file.fileName,
            'images'
          );

          if (!uploadResult) {
            return { success: false, fileName: file.fileName };
          }

          // DB에 ImageCache 레코드 저장 또는 업데이트
          try {
            // 기존 레코드 확인 (fileName으로 검색)
            const existing = await prisma.imageCache.findFirst({
              where: { fileName: file.fileName },
            });

            if (existing) {
              // 기존 레코드 업데이트
              await prisma.imageCache.update({
                where: { id: existing.id },
                data: {
                  cloudinaryUrl: uploadResult.url,
                  cloudinaryPublicId: uploadResult.publicId,
                  cloudinarySyncedAt: uploadResult.syncedAt,
                },
              });
            } else {
              // 새 레코드 생성
              await prisma.imageCache.create({
                data: {
                  driveFileId: `local-${file.fileName}`, // 고유성 보장
                  path: file.filePath,
                  fileName: file.fileName,
                  folder: 'Image',
                  title: file.fileName,
                  tags: [],
                  mimeType: getMimeType(file.fileName),
                  cloudinaryUrl: uploadResult.url,
                  cloudinaryPublicId: uploadResult.publicId,
                  cloudinarySyncedAt: uploadResult.syncedAt,
                },
              });
            }

            return { success: true, fileName: file.fileName };
          } catch (e) {
            logger.error('[Batch1Sync] DB update failed:', {
              fileName: file.fileName,
              error: e instanceof Error ? e.message : String(e),
            });
            return { success: false, fileName: file.fileName };
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

      const progressMsg = (
        `${BATCH_LABEL} ${completed}/${totalImages} (${progressPercent}%) | ` +
        `Success: ${successCount} | Failed: ${failureCount} | ` +
        `Elapsed: ${elapsedSec}s | ETA: ~${estimatedRemainingSec}s`
      );

      logger.info(`[Batch1Sync] ${progressMsg}`);
      progressLog.push({ completed, total: totalImages, percent: progressPercent, timestamp });
    }

    // Step 3: 최종 결과
    const totalDuration = Date.now() - startTime;
    const successRate = totalImages > 0 ? ((successCount / totalImages) * 100).toFixed(1) : '0';

    logger.info('[Batch1Sync] Upload complete', {
      success: successCount,
      failed: failureCount,
      durationSec: (totalDuration / 1000).toFixed(1),
      successRate: `${successRate}%`,
    });

    return {
      success: successCount > 0,
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
    logger.error('[Batch1Sync] Fatal error:', {
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

function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
  };
  return mimeTypes[ext] || 'image/jpeg';
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
    logger.error('[Batch1Sync] API error:', {
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
