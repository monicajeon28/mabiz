import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import prisma from '@/lib/prisma';
import { uploadFileToDrive, getDriveFileUrl } from '@/lib/google-drive';
import { logger } from '@/lib/logger';

export const maxDuration = 300;
export const runtime = 'nodejs';

const REVIEWS_FOLDER_ID = process.env.GOOGLE_DRIVE_UPLOADS_REVIEWS_FOLDER_ID!;
const REVIEWS_LOCAL_PATH = join(process.cwd(), 'public/크루즈정보사진/고객 후기 자료');

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: '인증 실패' }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get('dry') === '1';

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const results: { name: string; status: string; driveUrl?: string }[] = [];

  try {
    const allFiles = readdirSync(REVIEWS_LOCAL_PATH);
    const webpFiles = allFiles.filter(f => f.endsWith('.webp'));

    logger.log('[UploadReviewImages] 시작', { total: webpFiles.length, dryRun });

    for (const fileName of webpFiles) {
      // 이미 DB에 있으면 스킵
      const existing = await prisma.imageCache.findFirst({
        where: {
          fileName,
          folder: '고객 후기 자료',
          deletedAt: null,
        },
      });

      if (existing) {
        skipped++;
        results.push({ name: fileName, status: 'skipped' });
        continue;
      }

      if (dryRun) {
        results.push({ name: fileName, status: 'would_upload' });
        continue;
      }

      try {
        const filePath = join(REVIEWS_LOCAL_PATH, fileName);
        const buffer = readFileSync(filePath);

        const uploadResult = await uploadFileToDrive({
          folderId: REVIEWS_FOLDER_ID,
          fileName,
          mimeType: 'image/webp',
          buffer,
          makePublic: true,
        });

        if (!uploadResult.ok || !uploadResult.fileId) {
          failed++;
          results.push({ name: fileName, status: `failed: ${uploadResult.error}` });
          continue;
        }

        const driveUrl = getDriveFileUrl(uploadResult.fileId, true);

        await prisma.imageCache.create({
          data: {
            driveFileId: uploadResult.fileId,
            path: `크루즈정보사진/고객 후기 자료/${fileName}`,
            fileName,
            folder: '고객 후기 자료',
            title: fileName.replace(/\.webp$/, ''),
            tags: ['후기', '고객후기', '실제후기'],
            mimeType: 'image/webp',
            fileSize: buffer.length,
            driveUrl,
            webpUrl: driveUrl,
            syncedAt: new Date(),
          },
        });

        uploaded++;
        results.push({ name: fileName, status: 'uploaded', driveUrl });
        logger.log('[UploadReviewImages] 업로드 완료', { fileName, driveUrl });
      } catch (err) {
        failed++;
        results.push({ name: fileName, status: `error: ${(err as Error).message}` });
        logger.error('[UploadReviewImages] 파일 업로드 실패', { fileName, error: err });
      }
    }

    return NextResponse.json({
      ok: true,
      summary: { total: webpFiles.length, uploaded, skipped, failed, dryRun },
      results,
    });
  } catch (err) {
    logger.error('[UploadReviewImages] 전체 오류', { error: err });
    return NextResponse.json({ ok: false, error: '업로드 중 오류 발생' }, { status: 500 });
  }
}
