#!/usr/bin/env node
// Images 폴더 배치 2/2 업로드 스크립트 (병렬)

import { PrismaClient } from '@prisma/client';
import cloudinary from 'cloudinary';
import { google } from 'googleapis';
import 'dotenv/config';

const prisma = new PrismaClient();

// Cloudinary 설정
cloudinary.v2.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CONCURRENT = 10; // 동시 업로드 수 (배치 2/2)
const BATCH_LABEL = '배치 2/2'; // 진행률 라벨

async function uploadToDriveAndCloudinary(
  fileId: string,
  fileName: string,
  folder: string
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

    const buffer = Buffer.from(data as ArrayBuffer);

    // 2. Cloudinary에 업로드
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        {
          folder: `cruise-images/${folder || 'root'}`,
          resource_type: 'auto',
          eager: [{ fetch_format: 'auto' }],
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

      uploadStream.end(buffer);
    });
  } catch (error) {
    console.error(`  ❌ ${fileName}:`, (error as Error).message);
    return null;
  }
}

async function main() {
  console.log('\n🚀 Images 폴더 배치 2/2 Cloudinary 업로드\n');
  console.log('━'.repeat(60));

  // 1. Images 폴더의 미동기화 이미지 조회
  const pendingImages = await prisma.imageCache.findMany({
    where: {
      folder: { contains: 'Images' },
      cloudinaryUrl: null,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n📊 업로드 대상: ${pendingImages.length.toLocaleString()}개 이미지\n`);

  if (pendingImages.length === 0) {
    console.log('✅ Images 폴더 모든 이미지가 이미 동기화되었습니다!\n');
    await prisma.$disconnect();
    return;
  }

  // 2. 배치 처리
  let successCount = 0;
  let failureCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < pendingImages.length; i += CONCURRENT) {
    const batch = pendingImages.slice(i, i + CONCURRENT);

    // 병렬 업로드
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

        // DB 업데이트
        try {
          await prisma.imageCache.update({
            where: { id: img.id },
            data: {
              cloudinaryUrl: uploadResult.url,
              cloudinarySyncedAt: uploadResult.syncedAt,
            },
          });
          return { success: true, id: img.id };
        } catch (e) {
          console.error(`  DB 업데이트 실패 [${img.id}]:`, (e as Error).message);
          return { success: false, id: img.id };
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
    const completed = Math.min(i + CONCURRENT, pendingImages.length);
    const progressPercent = Math.round((completed / pendingImages.length) * 100);

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    const ratePerSec = (successCount / (Date.now() - startTime)) * 1000;
    const estimatedRemainingSec = (
      ((pendingImages.length - completed) / ratePerSec) * 1000
    ).toFixed(0);

    console.log(
      `  ${BATCH_LABEL} ${completed}/${pendingImages.length} (${progressPercent}%) | ` +
        `✅ ${successCount} | ❌ ${failureCount} | ` +
        `⏱️  ${elapsedSec}s | 🕐 남은 시간: ~${estimatedRemainingSec}s`
    );
  }

  // 3. 최종 결과
  console.log('\n' + '━'.repeat(60));
  console.log('\n✅ Images 폴더 업로드 완료!\n');
  console.log(`  ✓ 성공: ${successCount.toLocaleString()}개`);
  console.log(`  ✗ 실패: ${failureCount.toLocaleString()}개`);
  console.log(`  ⏱️  소요 시간: ${((Date.now() - startTime) / 1000).toFixed(1)}초`);
  console.log(`  📊 성공률: ${((successCount / pendingImages.length) * 100).toFixed(1)}%`);
  console.log('\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('\n❌ 오류 발생:', e);
  process.exit(1);
});
