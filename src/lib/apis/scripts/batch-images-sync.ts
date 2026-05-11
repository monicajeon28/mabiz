#!/usr/bin/env node
/**
 * Google Drive -> Cloudinary 이미지 동기화 배치 스크립트
 * 원본: batch-2-images-sync.ts (크루즈닷몰)
 *
 * 사용법: npx tsx src/lib/apis/scripts/batch-images-sync.ts
 *
 * TODO: ImageCache 스키마에 cloudinaryUrl / cloudinarySyncedAt 필드 추가 후 사용 가능
 *       현재는 참조용으로만 보존
 *
 * 환경변수 필요:
 *   - NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
 *   - CLOUDINARY_API_KEY
 *   - CLOUDINARY_API_SECRET
 *   - GOOGLE_API_KEY (Google Drive API)
 *   - DATABASE_URL (Prisma)
 */

import { PrismaClient } from '@prisma/client';
// import cloudinary from 'cloudinary'; // TODO: npm install cloudinary
import { google } from 'googleapis';
import 'dotenv/config';

const prisma = new PrismaClient();

const CONCURRENT = 10; // 동시 업로드 수

async function uploadToDriveAndCloudinary(
  fileId: string,
  _fileName: string,
  _folder: string
): Promise<{ url: string; syncedAt: Date } | null> {
  try {
    // 1. Google Drive에서 파일 스트림으로 다운로드
    const drive = google.drive({
      version: 'v3',
      auth: process.env.GOOGLE_API_KEY,
    });

    const { data } = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    const _buffer = Buffer.from(data as ArrayBuffer);

    // TODO: Cloudinary 업로드 로직 - cloudinary 패키지 설치 후 활성화
    // return new Promise((resolve, reject) => {
    //   const uploadStream = cloudinary.v2.uploader.upload_stream(
    //     { folder: `cruise-images/${folder || 'root'}`, resource_type: 'auto' },
    //     (error, result) => {
    //       if (error) reject(error);
    //       else resolve({ url: result!.secure_url, syncedAt: new Date() });
    //     }
    //   );
    //   uploadStream.end(buffer);
    // });

    console.log(`  [TODO] Cloudinary upload not yet configured`);
    return null;
  } catch (error) {
    console.error(`  [FAIL] upload:`, (error as Error).message);
    return null;
  }
}

async function main() {
  console.log('\n[BatchImagesSync] Google Drive -> Cloudinary 이미지 동기화\n');
  console.log('='.repeat(60));

  // TODO: ImageCache 스키마에 cloudinaryUrl 필드 추가 후 아래 where 조건 활성화
  // where: { folder: { contains: 'Images' }, cloudinaryUrl: null }
  const pendingImages = await prisma.imageCache.findMany({
    where: {
      folder: { contains: 'Images' },
    },
    orderBy: { createdAt: 'asc' },
    take: 100, // 테스트용 제한
  });

  console.log(`\n[INFO] 대상: ${pendingImages.length.toLocaleString()}개 이미지\n`);

  if (pendingImages.length === 0) {
    console.log('[OK] 대상 이미지가 없습니다.\n');
    await prisma.$disconnect();
    return;
  }

  // 배치 처리
  let successCount = 0;
  let failureCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < pendingImages.length; i += CONCURRENT) {
    const batch = pendingImages.slice(i, i + CONCURRENT);

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

        // TODO: DB 업데이트 - cloudinaryUrl 필드 추가 후 활성화
        return { success: true, id: img.id };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    const completed = Math.min(i + CONCURRENT, pendingImages.length);
    const progressPercent = Math.round((completed / pendingImages.length) * 100);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(
      `  ${completed}/${pendingImages.length} (${progressPercent}%) | ` +
        `OK: ${successCount} | FAIL: ${failureCount} | ${elapsedSec}s`
    );
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n[DONE] OK: ${successCount} | FAIL: ${failureCount} | ` +
    `Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('\n[ERROR]:', e);
  process.exit(1);
});
