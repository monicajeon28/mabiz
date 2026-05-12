import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { uploadImageToCloudinary } from '@/lib/cloudinary-service';
import { logger } from '@/lib/logger';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * 로컬 Image 폴더의 이미지를 Cloudinary로 동기화 (배치 1/4: 880개)
 *
 * 처리:
 * 1. ImageCache에서 driveFileId = "local://..." 인 첫 번째 880개 조회
 * 2. 각 파일에 대해:
 *    - /public/local-assets/Image/{folder}/{fileName} 경로에서 읽기
 *    - Cloudinary에 업로드 (folder: "cruise-images/{folder}/")
 *    - cloudinaryUrl = secure_url 저장
 *    - cloudinarySyncedAt = now() 저장
 * 3. 동시 업로드: 10개 (Promise.allSettled)
 * 4. 에러 시 스킵하고 계속 진행
 * 5. 진행률 표시: "배치 1/4: X/880"
 */

const getLogFilePath = () => {
  const logsDir = process.env.VERCEL ? '/tmp' : join(process.cwd(), 'logs');
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  return join(logsDir, `sync-local-images-batch-${dateStr}.log`);
};

const writeLog = async (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logMessage = data
    ? `[${timestamp}] ${message} ${JSON.stringify(data, null, 2)}`
    : `[${timestamp}] ${message}`;

  logger.info(logMessage);

  try {
    const logFilePath = getLogFilePath();
    const logsDir = process.env.VERCEL ? '/tmp' : join(process.cwd(), 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    await fs.appendFile(logFilePath, logMessage + '\n');
  } catch (err) {
    logger.error('로그 파일 쓰기 실패:', err instanceof Error ? err.message : String(err));
  }
};

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  let synced = 0;
  let failed = 0;
  let skipped = 0;
  const failedImages: Array<{
    fileName: string;
    folder: string;
    errorCode: string;
    errorMessage: string;
  }> = [];

  try {
    // CRON_SECRET 검증
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      await writeLog('[Cron SyncLocalImagesBatch] CRON_SECRET 환경변수 미설정');
      return NextResponse.json(
        { ok: false, error: 'CRON_SECRET not configured' },
        { status: 401 }
      );
    }

    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      await writeLog('[Cron SyncLocalImagesBatch] 인증 실패 - 무단 접근 시도');
      return NextResponse.json(
        { ok: false, error: '인증 실패' },
        { status: 401 }
      );
    }

    await writeLog('[Cron SyncLocalImagesBatch] 배치 1/4 시작', {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });

    // ImageCache에서 driveFileId = "local://..." 인 항목 조회 (첫 번째 880개)
    const imagesToSync = await prisma.imageCache.findMany({
      where: {
        driveFileId: {
          startsWith: 'local://',
        },
        cloudinaryUrl: null,
      },
      select: {
        id: true,
        fileName: true,
        folder: true,
        path: true,
        driveFileId: true,
        mimeType: true,
      },
      take: 880,
      orderBy: { createdAt: 'asc' },
    });

    await writeLog('[Cron SyncLocalImagesBatch] 동기화 대상 조회 완료', {
      totalImages: imagesToSync.length,
      uniqueFolders: Array.from(new Set(imagesToSync.map(img => img.folder))).length,
    });

    if (imagesToSync.length === 0) {
      await writeLog('[Cron SyncLocalImagesBatch] 동기화할 이미지 없음 - 작업 종료');
      return NextResponse.json({
        ok: true,
        synced: 0,
        failed: 0,
        skipped: 0,
        remaining: 0,
        message: '동기화할 이미지 없음',
      });
    }

    // 동시 업로드 수: 10개
    const concurrency = 10;
    const totalBatches = Math.ceil(imagesToSync.length / concurrency);

    for (let i = 0; i < imagesToSync.length; i += concurrency) {
      const batchNumber = Math.floor(i / concurrency) + 1;
      const batch = imagesToSync.slice(i, i + concurrency);

      const results = await Promise.allSettled(
        batch.map(async (image) => {
          try {
            // 로컬 파일 경로 구성
            const localBasePath = '/home/userhyeseon28/projects/cruise-guide-app/public/local-assets/Image';
            const filePath = resolve(join(localBasePath, image.folder || '', image.fileName));

            // 파일 읽기
            let buffer: Buffer;
            try {
              buffer = await fs.readFile(filePath);
            } catch (readError) {
              throw new Error(`파일을 읽을 수 없습니다: ${filePath}`);
            }

            if (buffer.length === 0) {
              throw new Error('파일이 비어 있습니다');
            }

            // Cloudinary 폴더 경로
            const cloudinaryFolder = `cruise-images/${image.folder || 'uncategorized'}`;

            // Cloudinary에 업로드
            const result = await uploadImageToCloudinary({
              buffer,
              fileName: image.fileName,
              folder: cloudinaryFolder,
              format: image.mimeType === 'image/gif' ? 'gif' : undefined,
            });

            if (!result.ok) {
              throw new Error(result.error || 'Cloudinary 업로드 실패');
            }

            // DB 업데이트
            await prisma.imageCache.update({
              where: { id: image.id },
              data: {
                cloudinaryUrl: result.url,
                cloudinaryPublicId: result.public_id,
                cloudinarySyncedAt: new Date(),
              },
            });

            logger.info('[SyncLocalImagesBatch] 성공:', {
              imageId: image.id,
              fileName: image.fileName,
              publicId: result.public_id,
            });

            synced++;
            return { success: true };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('[SyncLocalImagesBatch] 실패:', {
              fileName: image.fileName,
              folder: image.folder,
              error: errorMessage,
            });

            failedImages.push({
              fileName: image.fileName,
              folder: image.folder || 'uncategorized',
              errorCode: 'SYNC_ERROR',
              errorMessage,
            });

            failed++;
            return { success: false };
          }
        })
      );

      // 배치 진행률 표시
      const progress = Math.round((batchNumber / totalBatches) * 100);
      await writeLog(`배치 1/4: ${synced + failed}/${imagesToSync.length} (진행률: ${progress}%)`, {
        batchNumber,
        totalBatches,
        syncedInBatch: batch.filter((_, idx) => results[idx]?.status === 'fulfilled').length,
        failedInBatch: batch.filter((_, idx) => results[idx]?.status === 'rejected').length,
      });
    }

    // 남은 이미지 개수
    const remaining = await prisma.imageCache.count({
      where: {
        driveFileId: {
          startsWith: 'local://',
        },
        cloudinaryUrl: null,
      },
    });

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const successRate = imagesToSync.length > 0
      ? ((synced / imagesToSync.length) * 100).toFixed(2)
      : '0.00';

    await writeLog('[Cron SyncLocalImagesBatch] 배치 1/4 완료', {
      totalProcessed: imagesToSync.length,
      synced,
      failed,
      skipped,
      remaining,
      successRate: `${successRate}%`,
      elapsedTime: `${elapsedTime}초`,
      failedImages: failedImages.length > 0 ? failedImages : 'None',
    });

    if (failedImages.length > 0) {
      await writeLog('[Cron SyncLocalImagesBatch] 실패한 이미지 상세', {
        count: failedImages.length,
        details: failedImages.slice(0, 10), // 처음 10개만 표시
      });
    }

    return NextResponse.json({
      ok: true,
      synced,
      failed,
      skipped,
      remaining,
      message: `배치 1/4 완료: ${synced}개 동기화, ${failed}개 실패, ${remaining}개 남음 (소요 시간: ${elapsedTime}초)`,
      successRate: `${successRate}%`,
      failedImages: failedImages.length > 0 ? failedImages.slice(0, 10) : undefined,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    await writeLog('[Cron SyncLocalImagesBatch] 예상치 못한 에러 발생', {
      error: errorMessage,
      elapsedTime: `${elapsedTime}초`,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { ok: false, error: '크론 작업 실패' },
      { status: 500 }
    );
  }
}
