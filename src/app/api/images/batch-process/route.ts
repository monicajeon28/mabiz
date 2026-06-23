import { NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/drive-client';
import { processImageForLibrary } from '@/lib/image-processor';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const maxDuration = 300; // 5분

/**
 * 공통 배치 처리 로직
 * PENDING 상태 이미지에 워터마크 + WebP 변환 후 Drive 업로드
 */
async function processBatchImages(req: Request) {
  // Cron 호출 인증
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logger.error('[batch-process] CRON_SECRET 환경변수 미설정');
    return NextResponse.json({ ok: false, message: 'Server misconfiguration' }, { status: 500 });
  }
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  // 1회 최대 처리 수 (메모리 안전: 3개 동시 × 최대 100MB = 300MB)
  const BATCH_LIMIT = 12;
  const CONCURRENCY = 3;
  const results = { processed: 0, failed: 0, skipped: 0 };

  try {
    const pending = await prisma.imageAsset.findMany({
      where: { processingStatus: 'PENDING' },
      take: BATCH_LIMIT,
      orderBy: { uploadedAt: 'asc' },
    });

    if (pending.length === 0) {
      return NextResponse.json({ ok: true, message: '처리할 이미지 없음', results });
    }

    const drive = getDriveClient();
    const { Readable } = await import('stream');

    /** 단일 asset 처리 */
    const processAsset = async (asset: typeof pending[0]) => {
      try {
        // SVG는 워터마크 처리 스킵
        if (asset.mimeType === 'image/svg+xml') {
          await prisma.imageAsset.update({
            where: { id: asset.id, organizationId: asset.organizationId },
            data: { processingStatus: 'DONE', processedAt: new Date() },
          });
          results.skipped++;
          return;
        }

        // 원본 파일 다운로드
        const fileRes = await drive.files.get(
          { fileId: asset.driveFileId, alt: 'media', supportsAllDrives: true },
          { responseType: 'arraybuffer' }
        );

        const inputBuffer = Buffer.from(fileRes.data as ArrayBuffer);

        // 워터마크 + WebP 변환
        const { webpBuffer, width, height } = await processImageForLibrary(inputBuffer);

        // Drive에 WebP 파일 업로드 (원본과 같은 폴더)
        const webpFileName = asset.originalFileName.replace(/\.[^.]+$/, '') + '_wm.webp';
        const uploaded = await drive.files.create({
          requestBody: {
            name: webpFileName,
            parents: asset.drivePath ? [asset.drivePath] : [],
          },
          media: { mimeType: 'image/webp', body: Readable.from(webpBuffer) },
          fields: 'id',
          supportsAllDrives: true,
        });

        const webpFileId = uploaded.data.id!;

        await prisma.imageAsset.update({
          where: { id: asset.id, organizationId: asset.organizationId },
          data: { webpDriveFileId: webpFileId, processingStatus: 'DONE', processedAt: new Date(), width, height },
        });

        results.processed++;
        logger.info('[batch-process] 처리 완료', { assetId: asset.id, webpFileId });
      } catch (err) {
        logger.error('[batch-process] 처리 실패', { assetId: asset.id, err });
        await prisma.imageAsset.update({
          where: { id: asset.id },
          data: { processingStatus: 'FAILED' },
        });
        results.failed++;
      }
    };

    // CONCURRENCY 단위로 청크 분할 후 병렬 처리 (OOM 방지)
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      await Promise.all(pending.slice(i, i + CONCURRENCY).map(processAsset));
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    logger.error('[batch-process]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * POST /api/images/batch-process
 * Vercel Cron 또는 수동 호출
 */
export async function POST(req: Request) {
  return processBatchImages(req);
}

/**
 * GET /api/images/batch-process
 * Vercel Cron은 항상 GET으로 호출 (Vercel 기본 동작)
 */
export async function GET(req: Request) {
  return processBatchImages(req);
}
