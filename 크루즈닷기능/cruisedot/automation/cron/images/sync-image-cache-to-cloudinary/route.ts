import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { uploadImageToCloudinary } from '@/lib/cloudinary-service';
import { logger } from '@/lib/logger';
import { promises as fs } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * ImageCache (크루즈정보사진)를 Cloudinary로 동기화
 * 매 4시간마다 실행 (vercel.json 설정)
 *
 * 처리:
 * 1. ImageCache에서 cloudinaryUrl이 NULL인 항목 찾기 (배치 20개)
 * 2. Google Drive driveUrl에서 이미지 다운로드
 * 3. Cloudinary에 업로드
 * 4. ImageCache.cloudinaryUrl 업데이트
 *
 * 로깅:
 * - 크론 실행 시작/종료 로그
 * - 배치별 진행 상황 (1번째 배치, 2번째... N번째)
 * - 동기화된 이미지 개수 및 실패한 이미지 상세 정보
 * - 예상 완료 시간
 */

/**
 * 로그 디렉토리 및 파일 설정
 */
const getLogFilePath = () => {
  // 런타임 환경에서 로그 저장 (Vercel에서는 /tmp 사용 가능, 로컬에서는 ./logs 사용)
  const logsDir = process.env.VERCEL ? '/tmp' : join(process.cwd(), 'logs');

  // 날짜 포맷: YYYY-MM-DD
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  return join(logsDir, `sync-image-cache-${dateStr}.log`);
};

/**
 * B0-C3: 로그 버퍼 — 매 호출마다 파일 I/O 하지 않고 in-memory 축적 후 일괄 플러시
 * (크론 특성상 요청당 1회 실행 → 완료 후 한 번에 파일에 쓰기)
 */
const logBuffer: string[] = [];

const flushLogBuffer = async () => {
  if (logBuffer.length === 0) return;
  const content = logBuffer.join('\n') + '\n';
  logBuffer.length = 0; // 버퍼 클리어
  try {
    const logFilePath = getLogFilePath();
    const logsDir = process.env.VERCEL ? '/tmp' : join(process.cwd(), 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    await fs.appendFile(logFilePath, content);
  } catch (err) {
    logger.error('로그 파일 쓰기 실패:', err instanceof Error ? err.message : String(err));
  }
};

/**
 * 로그 메시지 작성 (콘솔 즉시 출력 + 파일 버퍼에 추가)
 */
const writeLog = async (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logMessage = data
    ? `[${timestamp}] ${message} ${JSON.stringify(data, null, 2)}`
    : `[${timestamp}] ${message}`;

  // 콘솔 출력 (서버 로그 — 즉시)
  logger.info(logMessage);

  // B0-C3: 파일 I/O 블로킹 방지 — 버퍼에만 추가 (flushLogBuffer로 일괄 처리)
  logBuffer.push(logMessage);
};

/**
 * 배치별 진행 상황 로그
 */
const writeBatchLog = async (batchNumber: number, batchSize: number, totalBatches: number, synced: number, failed: number) => {
  const progress = Math.round((batchNumber / totalBatches) * 100);
  await writeLog(`배치 ${batchNumber}/${totalBatches} 완료 (진행률: ${progress}%)`, {
    batchSize,
    currentSynced: synced,
    currentFailed: failed,
    timeRemaining: `약 ${(totalBatches - batchNumber) * 3}초`, // 배치당 평균 3초 예상
  });
};

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  let synced = 0;
  let failed = 0;
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
      await writeLog('[Cron SyncImageCacheToCloudinary] CRON_SECRET 환경변수 미설정');
      return NextResponse.json(
        { ok: false, error: 'CRON_SECRET not configured' },
        { status: 401 }
      );
    }

    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      await writeLog('[Cron SyncImageCacheToCloudinary] 인증 실패 - 무단 접근 시도');
      return NextResponse.json(
        { ok: false, error: '인증 실패' },
        { status: 401 }
      );
    }

    // 크론 실행 시작 로그
    await writeLog('[Cron SyncImageCacheToCloudinary] 크론 작업 시작', {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });

    // ImageCache에서 cloudinaryUrl이 NULL인 항목 조회 (배치 20개)
    const imagesToSync = await prisma.imageCache.findMany({
      where: {
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
      take: 20,
      orderBy: { createdAt: 'asc' },
    });

    // 고유 폴더 추출
    const uniqueFolders = Array.from(new Set(imagesToSync.map(img => img.folder)));

    await writeLog('[Cron SyncImageCacheToCloudinary] 동기화 대상 조회 완료', {
      totalImages: imagesToSync.length,
      folders: uniqueFolders,
    });

    if (imagesToSync.length === 0) {
      await writeLog('[Cron SyncImageCacheToCloudinary] 동기화할 이미지 없음 - 작업 종료');
      await flushLogBuffer(); // B0-C3: early-exit 전 버퍼 플러시
      return NextResponse.json({
        ok: true,
        synced: 0,
        failed: 0,
        remaining: 0,
        message: '동기화할 이미지 없음',
      });
    }

    // 배치 처리
    const batchSize = 5;
    const totalBatches = Math.ceil(imagesToSync.length / batchSize);

    for (let i = 0; i < imagesToSync.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      const batch = imagesToSync.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (image) => {
          try {
            if (!image.driveUrl) {
              throw new Error('driveUrl이 없습니다');
            }

            // Google Drive URL에서 파일 ID 추출
            const fileIdMatch = image.driveUrl.match(/[?&]id=([^&]+)/);
            if (!fileIdMatch) {
              throw new Error('파일 ID를 추출할 수 없습니다');
            }

            // Google Drive에서 이미지 다운로드 (스트림)
            const driveDownloadUrl = `https://www.googleapis.com/drive/v3/files/${fileIdMatch[1]}?alt=media&key=${process.env.GOOGLE_API_KEY}`;

            const response = await fetch(driveDownloadUrl);

            if (!response.ok) {
              throw new Error(`Google Drive 다운로드 실패 (HTTP ${response.status})`);
            }

            // B0-C2: 메모리 누적 방지 — Content-Length 사전 검사 (20MB 초과 거부)
            const MAX_BYTES = 20 * 1024 * 1024; // 20MB
            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
              throw new Error(`이미지 크기 초과 (${contentLength} bytes, 최대 ${MAX_BYTES})`);
            }

            // Buffer로 변환 (스트림 청크 축적 → GC 가능하도록 arrayBuffer 즉시 소비)
            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength > MAX_BYTES) {
              throw new Error(`이미지 크기 초과 (${arrayBuffer.byteLength} bytes, 최대 ${MAX_BYTES})`);
            }
            const buffer = Buffer.from(arrayBuffer);

            // Cloudinary 폴더 경로: cruise-images/폴더명
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

            logger.info('[SyncImageCacheToCloudinary] 성공:', {
              imageId: image.id,
              fileName: image.fileName,
              publicId: result.public_id,
            });

            synced++;
            return { success: true };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('[SyncImageCacheToCloudinary] 실패:', {
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

      // B0-C1: 내부 catch에서 이미 failed++ 처리됨 — 이중 카운팅 제거
      // Promise.allSettled의 fulfilled/rejected는 내부 try/catch가 모두 잡으므로
      // 'rejected' 상태는 절대 발생하지 않음 → 별도 집계 불필요
      void results;

      // 배치별 진행 상황 로그
      await writeBatchLog(batchNumber, batch.length, totalBatches, synced, failed);
    }

    // 남은 이미지 개수
    const remaining = await prisma.imageCache.count({
      where: {
        cloudinaryUrl: null,
        driveUrl: { not: null },
      },
    });

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const successRate = imagesToSync.length > 0
      ? ((synced / imagesToSync.length) * 100).toFixed(2)
      : '0.00';

    // 크론 작업 완료 로그
    await writeLog('[Cron SyncImageCacheToCloudinary] 크론 작업 완료', {
      totalProcessed: imagesToSync.length,
      synced,
      failed,
      remaining,
      successRate: `${successRate}%`,
      elapsedTime: `${elapsedTime}초`,
      failedImages: failedImages.length > 0 ? failedImages : 'None',
    });

    // 실패한 이미지가 있으면 상세 로그
    if (failedImages.length > 0) {
      await writeLog('[Cron SyncImageCacheToCloudinary] 실패한 이미지 상세', {
        count: failedImages.length,
        details: failedImages,
      });
    }

    await flushLogBuffer(); // B0-C3: 성공 경로 버퍼 플러시 (모든 로그 한 번에 I/O)

    return NextResponse.json({
      ok: true,
      synced,
      failed,
      remaining,
      message: `${synced}개 동기화, ${failed}개 실패, ${remaining}개 남음 (소요 시간: ${elapsedTime}초)`,
      successRate: `${successRate}%`,
      failedImages: failedImages.length > 0 ? failedImages : undefined,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    await writeLog('[Cron SyncImageCacheToCloudinary] 예상치 못한 에러 발생', {
      error: errorMessage,
      elapsedTime: `${elapsedTime}초`,
      stack: error instanceof Error ? error.stack : undefined,
    });

    await flushLogBuffer(); // B0-C3: 에러 경로 버퍼 플러시

    return NextResponse.json(
      { ok: false, error: '크론 작업 실패' },
      { status: 500 }
    );
  }
}
