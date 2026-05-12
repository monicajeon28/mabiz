#!/usr/bin/env node
// 배치 4: ImageCache 2640-3515 Cloudinary 업로드 (병렬)

import { PrismaClient } from '@prisma/client';
import cloudinary from 'cloudinary';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const prisma = new PrismaClient();

// Cloudinary 설정
cloudinary.v2.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CONCURRENT = 10; // 동시 업로드 수
const BATCH_START = 2640;
const BATCH_END = 3515;
const BATCH_SIZE = BATCH_END - BATCH_START + 1;

async function uploadImageToCloudinary(
  filePath: string,
  fileName: string,
  folder: string
): Promise<{ url: string; syncedAt: Date } | null> {
  try {
    // 파일이 존재하는지 확인
    if (!fs.existsSync(filePath)) {
      console.error(`  ⚠️  파일 없음: ${filePath}`);
      return null;
    }

    // 파일 크기 확인 (100MB 이상 스킵)
    const stats = fs.statSync(filePath);
    if (stats.size > 100 * 1024 * 1024) {
      console.error(`  ⚠️  파일 크기 초과 (${(stats.size / 1024 / 1024).toFixed(1)}MB): ${fileName}`);
      return null;
    }

    // 파일 읽기 및 업로드
    const fileBuffer = fs.readFileSync(filePath);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        {
          folder: `cruise-images/${folder || 'root'}`,
          resource_type: 'auto',
          eager: [{ fetch_format: 'auto' }],
          timeout: 60000,
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

      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    console.error(`  ❌ ${fileName}:`, (error as Error).message);
    return null;
  }
}

async function main() {
  console.log('\n🚀 배치 4/4: Image 폴더 이미지 → Cloudinary 업로드\n');
  console.log('━'.repeat(70));
  console.log(`배치 범위: ${BATCH_START.toLocaleString()} ~ ${BATCH_END.toLocaleString()}`);
  console.log(`배치 크기: ${BATCH_SIZE.toLocaleString()}개 이미지`);
  console.log('━'.repeat(70) + '\n');

  // 1. 배치 4 조회 (cloudinaryUrl IS NULL)
  const pendingImages = await prisma.imageCache.findMany({
    where: {
      cloudinaryUrl: null,
    },
    orderBy: { id: 'asc' },
    skip: BATCH_START,
    take: BATCH_SIZE,
  });

  console.log(`📊 조회된 이미지: ${pendingImages.length.toLocaleString()}개\n`);

  if (pendingImages.length === 0) {
    console.log('✅ 업로드할 이미지가 없습니다!\n');
    await prisma.$disconnect();
    return;
  }

  // 2. 배치 처리
  let successCount = 0;
  let failureCount = 0;
  let skipCount = 0;
  const startTime = Date.now();
  const uploadStats: { folder: string; success: number; failure: number }[] = [];

  for (let i = 0; i < pendingImages.length; i += CONCURRENT) {
    const batch = pendingImages.slice(i, i + CONCURRENT);
    const currentIndex = BATCH_START + i;

    // 병렬 업로드
    const results = await Promise.allSettled(
      batch.map(async (img) => {
        // 로컬 파일 경로 구성
        const filePath = path.join(
          '/home/userhyeseon28/projects/cruise-guide-app/public/local-assets/Image',
          img.localPath || ''
        );

        const uploadResult = await uploadImageToCloudinary(filePath, img.fileName, img.folder || '');

        if (!uploadResult) {
          return { success: false, skip: !fs.existsSync(filePath), id: img.id, folder: img.folder };
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
          return { success: true, skip: false, id: img.id, folder: img.folder };
        } catch (e) {
          console.error(`  DB 업데이트 실패 [${img.id}]:`, (e as Error).message);
          return { success: false, skip: false, id: img.id, folder: img.folder };
        }
      })
    );

    // 결과 집계
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successCount++;
          // 폴더별 통계
          const folder = result.value.folder || 'root';
          const stat = uploadStats.find((s) => s.folder === folder);
          if (stat) {
            stat.success++;
          } else {
            uploadStats.push({ folder, success: 1, failure: 0 });
          }
        } else {
          if (result.value.skip) {
            skipCount++;
          } else {
            failureCount++;
            // 폴더별 실패 통계
            const folder = result.value.folder || 'root';
            const stat = uploadStats.find((s) => s.folder === folder);
            if (stat) {
              stat.failure++;
            } else {
              uploadStats.push({ folder, success: 0, failure: 1 });
            }
          }
        }
      } else {
        failureCount++;
      }
    }

    // 진행률 표시
    const completed = Math.min(i + CONCURRENT, pendingImages.length);
    const progressPercent = Math.round((completed / pendingImages.length) * 100);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    const ratePerSec = (successCount / (Date.now() - startTime)) * 1000;
    const estimatedRemainingSec = ratePerSec > 0
      ? (((pendingImages.length - completed) / ratePerSec) * 1000).toFixed(0)
      : '?';

    console.log(
      `배치 4/4: ${completed.toLocaleString()}/${pendingImages.length.toLocaleString()} ` +
        `(${progressPercent}%) | ✅ ${successCount} | ❌ ${failureCount} | ⏭️  ${skipCount} | ` +
        `⏱️  ${elapsedSec}s | 🕐 남은 시간: ~${estimatedRemainingSec}s`
    );
  }

  // 3. 최종 결과
  console.log('\n' + '━'.repeat(70));
  console.log('\n✅ 배치 4 업로드 완료!\n');
  console.log(`  ✓ 성공: ${successCount.toLocaleString()}개`);
  console.log(`  ✗ 실패: ${failureCount.toLocaleString()}개`);
  console.log(`  ⏭️  파일없음: ${skipCount.toLocaleString()}개`);
  console.log(`  ⏱️  소요 시간: ${((Date.now() - startTime) / 1000).toFixed(1)}초`);
  console.log(
    `  📊 성공률: ${((successCount / (pendingImages.length - skipCount)) * 100).toFixed(1)}%`
  );

  // 폴더별 통계
  if (uploadStats.length > 0) {
    console.log('\n📁 폴더별 통계:');
    uploadStats.forEach((stat) => {
      console.log(`  ${stat.folder || 'root'}: ${stat.success}개 ✓, ${stat.failure}개 ✗`);
    });
  }

  console.log('\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('\n❌ 오류 발생:', e);
  process.exit(1);
});
