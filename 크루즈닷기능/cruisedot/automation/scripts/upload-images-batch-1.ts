#!/usr/bin/env node

/**
 * Images 폴더 배치 1/2 이미지 업로드 스크립트
 *
 * 사용:
 * npx ts-node scripts/upload-images-batch-1.ts
 *
 * 동작:
 * 1. ImageCache에서 folder LIKE '%Images%' AND cloudinaryUrl IS NULL인 첫 29개 조회
 * 2. 각 파일을 로컬에서 읽기
 * 3. Cloudinary에 병렬 업로드 (10개씩)
 * 4. DB 업데이트
 * 5. 진행률 출력: "배치 1/2: X/29"
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import prisma from '../lib/prisma';
import { uploadImageToCloudinary } from '../lib/cloudinary-service';
import { logger } from '../lib/logger';

const IMAGES_BASE_PATH = join(process.cwd(), 'public/local-assets/Images/Images');
const BATCH_SIZE = 29;
const PARALLEL_UPLOADS = 10;

async function uploadImagesBatch1() {
  const startTime = Date.now();
  let uploaded = 0;
  let failed = 0;
  const failedImages: Array<{ fileName: string; folder: string; error: string }> = [];

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   배치 1/2: Images 폴더 이미지 Cloudinary 업로드   ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  try {
    // 1. ImageCache 조회
    console.log('📊 1단계: ImageCache 조회 중...');
    const imagesToSync = await prisma.imageCache.findMany({
      where: {
        folder: { contains: 'Images' },
        cloudinaryUrl: null,
      },
      select: {
        id: true,
        fileName: true,
        folder: true,
        path: true,
        mimeType: true,
      },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
    });

    console.log(`✓ 조회 완료: ${imagesToSync.length}/${BATCH_SIZE} 이미지\n`);

    const uniqueFolders = Array.from(new Set(imagesToSync.map(img => img.folder)));
    console.log(`📁 포함된 폴더 (${uniqueFolders.length}개):`);
    uniqueFolders.forEach(folder => {
      const count = imagesToSync.filter(img => img.folder === folder).length;
      console.log(`   - ${folder}: ${count}개`);
    });
    console.log('');

    if (imagesToSync.length === 0) {
      console.log('⚠️  업로드할 이미지가 없습니다.');
      return { success: true, uploaded: 0, failed: 0 };
    }

    // 2. 병렬 업로드 (10개씩)
    console.log(`🚀 2단계: Cloudinary 병렬 업로드 시작 (동시: ${PARALLEL_UPLOADS}개)\n`);

    const batches = Math.ceil(imagesToSync.length / PARALLEL_UPLOADS);

    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const start = batchIndex * PARALLEL_UPLOADS;
      const end = Math.min(start + PARALLEL_UPLOADS, imagesToSync.length);
      const batch = imagesToSync.slice(start, end);

      const progressPercent = Math.round((end / imagesToSync.length) * 100);
      console.log(`⏳ 배치 ${batchIndex + 1}/${batches}: ${end}/${imagesToSync.length} (${progressPercent}%)`);

      const results = await Promise.allSettled(
        batch.map(async (image) => {
          try {
            const filePath = join(IMAGES_BASE_PATH, image.folder, image.fileName);
            const fileBuffer = readFileSync(filePath);

            const cloudinaryFolder = `cruise-images/기항지/${image.folder}`;

            const result = await uploadImageToCloudinary({
              buffer: fileBuffer,
              fileName: image.fileName,
              folder: cloudinaryFolder,
              format: image.mimeType === 'image/gif' ? 'gif' : undefined,
            });

            if (!result.ok) {
              throw new Error(result.error || '업로드 실패');
            }

            await prisma.imageCache.update({
              where: { id: image.id },
              data: {
                cloudinaryUrl: result.url,
                cloudinaryPublicId: result.public_id,
                cloudinarySyncedAt: new Date(),
              },
            });

            console.log(`   ✓ ${image.fileName}`);
            uploaded++;
            return { success: true };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`   ✗ ${image.fileName}: ${errorMessage}`);

            failedImages.push({
              fileName: image.fileName,
              folder: image.folder,
              error: errorMessage,
            });

            failed++;
            return { success: false };
          }
        })
      );

      results.forEach((result) => {
        if (result.status === 'rejected') {
          failed++;
        }
      });
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const successRate = imagesToSync.length > 0
      ? ((uploaded / imagesToSync.length) * 100).toFixed(1)
      : '0.0';

    // 결과 출력
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║           배치 1/2 완료                            ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    console.log(`📊 결과:`);
    console.log(`   ✓ 업로드: ${uploaded}/${imagesToSync.length}`);
    console.log(`   ✗ 실패: ${failed}/${imagesToSync.length}`);
    console.log(`   성공률: ${successRate}%`);
    console.log(`   소요시간: ${elapsedTime}초\n`);

    if (failedImages.length > 0) {
      console.log('❌ 실패 목록:');
      failedImages.forEach(img => {
        console.log(`   - ${img.folder}/${img.fileName}`);
        console.log(`     └─ ${img.error}`);
      });
      console.log('');
    }

    logger.info('[UploadImagesBatch1] 배치 1/2 완료', {
      batchNumber: '1/2',
      totalProcessed: imagesToSync.length,
      uploaded,
      failed,
      successRate: `${successRate}%`,
      elapsedTime: `${elapsedTime}초`,
    });

    return { success: true, uploaded, failed };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n❌ 에러:', errorMessage);
    logger.error('[UploadImagesBatch1] 에러', { error: errorMessage });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

uploadImagesBatch1();
