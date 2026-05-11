#!/usr/bin/env node
/**
 * ImageCache 대량 Cloudinary 업로드 배치 스크립트
 * 원본: batch-4-upload.ts (크루즈닷몰)
 *
 * 사용법: npx tsx src/lib/apis/scripts/batch-upload.ts [start] [end]
 * 예시:   npx tsx src/lib/apis/scripts/batch-upload.ts 0 1000
 *
 * TODO: ImageCache 스키마에 cloudinaryUrl / cloudinarySyncedAt / localPath 필드 추가 후 사용 가능
 *       현재는 참조용으로만 보존
 *
 * 환경변수 필요:
 *   - NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
 *   - CLOUDINARY_API_KEY
 *   - CLOUDINARY_API_SECRET
 *   - DATABASE_URL (Prisma)
 */

import { PrismaClient } from '@prisma/client';
// import cloudinary from 'cloudinary'; // TODO: npm install cloudinary
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const prisma = new PrismaClient();

const CONCURRENT = 10;

// CLI args로 범위 지정 가능 (기본: 0~1000)
const BATCH_START = parseInt(process.argv[2] || '0', 10);
const BATCH_END = parseInt(process.argv[3] || '1000', 10);
const BATCH_SIZE = BATCH_END - BATCH_START + 1;

async function uploadImageToCloudinary(
  filePath: string,
  _fileName: string,
  _folder: string
): Promise<{ url: string; syncedAt: Date } | null> {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`  [SKIP] File not found: ${filePath}`);
      return null;
    }

    // 파일 크기 확인 (100MB 이상 스킵)
    const stats = fs.statSync(filePath);
    if (stats.size > 100 * 1024 * 1024) {
      console.error(`  [SKIP] File too large (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
      return null;
    }

    const _fileBuffer = fs.readFileSync(filePath);

    // TODO: Cloudinary 업로드 로직 - cloudinary 패키지 설치 후 활성화
    console.log(`  [TODO] Cloudinary upload not yet configured`);
    return null;
  } catch (error) {
    console.error(`  [FAIL]:`, (error as Error).message);
    return null;
  }
}

async function main() {
  console.log('\n[BatchUpload] ImageCache -> Cloudinary 업로드\n');
  console.log('='.repeat(70));
  console.log(`Range: ${BATCH_START.toLocaleString()} ~ ${BATCH_END.toLocaleString()}`);
  console.log(`Size:  ${BATCH_SIZE.toLocaleString()} images`);
  console.log('='.repeat(70) + '\n');

  // TODO: ImageCache 스키마에 cloudinaryUrl 필드 추가 후 where 조건 활성화
  // where: { cloudinaryUrl: null }
  const pendingImages = await prisma.imageCache.findMany({
    orderBy: { id: 'asc' },
    skip: BATCH_START,
    take: BATCH_SIZE,
  });

  console.log(`[INFO] Found: ${pendingImages.length.toLocaleString()} images\n`);

  if (pendingImages.length === 0) {
    console.log('[OK] No images to upload.\n');
    await prisma.$disconnect();
    return;
  }

  // 배치 처리
  let successCount = 0;
  let failureCount = 0;
  let skipCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < pendingImages.length; i += CONCURRENT) {
    const batch = pendingImages.slice(i, i + CONCURRENT);

    const results = await Promise.allSettled(
      batch.map(async (img) => {
        // TODO: localPath 필드 추가 후 img.localPath 사용
        const filePath = path.join(
          process.cwd(),
          'public/local-assets/Image',
          img.path || ''
        );

        const uploadResult = await uploadImageToCloudinary(filePath, img.fileName, img.folder || '');

        if (!uploadResult) {
          return { success: false, skip: !fs.existsSync(filePath), id: img.id, folder: img.folder };
        }

        // TODO: DB 업데이트 - cloudinaryUrl 필드 추가 후 활성화
        return { success: true, skip: false, id: img.id, folder: img.folder };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successCount++;
        } else if (result.value.skip) {
          skipCount++;
        } else {
          failureCount++;
        }
      } else {
        failureCount++;
      }
    }

    const completed = Math.min(i + CONCURRENT, pendingImages.length);
    const progressPercent = Math.round((completed / pendingImages.length) * 100);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(
      `  ${completed.toLocaleString()}/${pendingImages.length.toLocaleString()} ` +
        `(${progressPercent}%) | OK: ${successCount} | FAIL: ${failureCount} | SKIP: ${skipCount} | ${elapsedSec}s`
    );
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n[DONE] OK: ${successCount} | FAIL: ${failureCount} | SKIP: ${skipCount} | ` +
    `Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('\n[ERROR]:', e);
  process.exit(1);
});
