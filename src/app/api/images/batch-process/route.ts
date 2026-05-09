import { NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/drive-client';
import { processImageForLibrary } from '@/lib/image-processor';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const maxDuration = 300; // 5분

/**
 * POST /api/images/batch-process
 * PENDING 상태 이미지에 워터마크 + WebP 변환 후 Drive 업로드
 * Vercel Cron 또는 수동 호출
 */
export async function POST(req: Request) {
  // Cron 호출 인증
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const limit = 20; // 1회 최대 처리 수
  const results = { processed: 0, failed: 0, skipped: 0 };

  try {
    const pending = await prisma.imageAsset.findMany({
      where: { processingStatus: 'PENDING' },
      take: limit,
      orderBy: { uploadedAt: 'asc' },
    });

    if (pending.length === 0) {
      return NextResponse.json({ ok: true, message: '처리할 이미지 없음', results });
    }

    const drive = getDriveClient();

    for (const asset of pending) {
      try {
        // SVG는 워터마크 처리 스킵
        if (asset.mimeType === 'image/svg+xml') {
          await prisma.imageAsset.update({
            where: { id: asset.id },
            data: { processingStatus: 'DONE', processedAt: new Date() },
          });
          results.skipped++;
          continue;
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
        const { Readable } = await import('stream');
        const uploaded = await drive.files.create({
          requestBody: {
            name: webpFileName,
            parents: asset.drivePath ? [asset.drivePath] : [],
          },
          media: {
            mimeType: 'image/webp',
            body: Readable.from(webpBuffer),
          },
          fields: 'id',
          supportsAllDrives: true,
        });

        const webpFileId = uploaded.data.id!;

        await prisma.imageAsset.update({
          where: { id: asset.id },
          data: {
            webpDriveFileId: webpFileId,
            processingStatus: 'DONE',
            processedAt: new Date(),
            width: width,
            height: height,
          },
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
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    logger.error('[POST /api/images/batch-process]', { err });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
