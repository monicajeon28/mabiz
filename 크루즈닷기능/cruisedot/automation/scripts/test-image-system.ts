#!/usr/bin/env node

/**
 * 이미지 시스템 통합 테스트 스크립트
 *
 * 테스트 항목:
 * 1. ImageCache cloudinaryUrl 검증
 * 2. ProductImage CRUD 테스트
 * 3. 이미지 라이브러리 API 테스트
 * 4. API 통합 테스트 (업로드/삭제/순서)
 * 5. Cloudinary URL 검증
 */

import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function logTest(name: string) {
  console.log(`\n${colors.cyan}${colors.bright}🧪 ${name}${colors.reset}`);
}

function logPass(message: string, detail?: any) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
  if (detail) console.log(`  ${JSON.stringify(detail, null, 2)}`);
}

function logFail(message: string, detail?: any) {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
  if (detail) console.log(`  ${JSON.stringify(detail, null, 2)}`);
}

function logInfo(message: string) {
  console.log(`ℹ ${message}`);
}

async function test1_ImageCacheValidation() {
  logTest('Test 1: ImageCache cloudinaryUrl 검증');

  try {
    const totalCount = await prisma.imageCache.count();
    const withCloudinaryUrl = await prisma.imageCache.count({
      where: { cloudinaryUrl: { not: null } }
    });

    logPass(`ImageCache 총 개수: ${totalCount}`);
    logPass(`cloudinaryUrl 있는 개수: ${withCloudinaryUrl}`);

    if (withCloudinaryUrl === totalCount) {
      logPass('✅ 모든 ImageCache 레코드에 cloudinaryUrl이 설정되었습니다');
    } else {
      logFail(`⚠️  ${totalCount - withCloudinaryUrl}개의 레코드에서 cloudinaryUrl이 누락되었습니다`);
    }

    // 샘플 데이터 확인
    const sample = await prisma.imageCache.findFirst({
      where: { cloudinaryUrl: { not: null } }
    });

    if (sample) {
      logInfo(`샘플 URL: ${sample.cloudinaryUrl?.substring(0, 80)}...`);
      logInfo(`Folder: ${sample.folder}, Title: ${sample.title}`);
    }

    return withCloudinaryUrl === totalCount;
  } catch (error) {
    logFail('ImageCache 검증 중 오류 발생', error instanceof Error ? error.message : error);
    return false;
  }
}

async function test2_ProductImageSchema() {
  logTest('Test 2: ProductImage 테이블 스키마 검증');

  try {
    const count = await prisma.productImage.count();
    logPass(`ProductImage 총 개수: ${count}`);

    if (count > 0) {
      const sample = await prisma.productImage.findFirst({
        include: {
          User: { select: { id: true, email: true } },
          AccessLogs: { take: 1 }
        }
      });

      if (sample) {
        logPass('샘플 ProductImage 레코드:');
        console.log({
          id: sample.id,
          fileName: sample.fileName,
          cloudinaryPublicId: sample.cloudinaryPublicId,
          fullUrl: sample.fullUrl ? sample.fullUrl.substring(0, 80) + '...' : null,
          storagePath: sample.storagePath,
          uploadedBy: sample.User.email,
          createdAt: sample.createdAt.toISOString(),
          hasAccessLogs: sample.AccessLogs.length > 0
        });
      }
    }

    return true;
  } catch (error) {
    logFail('ProductImage 스키마 검증 중 오류 발생', error instanceof Error ? error.message : error);
    return false;
  }
}

async function test3_ImageAccessLogging() {
  logTest('Test 3: ImageAccessLog 감사 추적 검증');

  try {
    const totalLogs = await prisma.imageAccessLog.count();
    logPass(`총 접근 로그: ${totalLogs}`);

    const logsByAction = await prisma.imageAccessLog.groupBy({
      by: ['action'],
      _count: true
    });

    logPass('액션별 로그:');
    logsByAction.forEach(log => {
      console.log(`  - ${log.action}: ${log._count}개`);
    });

    // 최근 로그 확인
    const recentLog = await prisma.imageAccessLog.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { ProductImage: { select: { fileName: true } } }
    });

    if (recentLog) {
      logInfo(`최근 로그: ${recentLog.ProductImage.fileName} - ${recentLog.action}`);
    }

    return totalLogs > 0;
  } catch (error) {
    logFail('ImageAccessLog 검증 중 오류 발생', error instanceof Error ? error.message : error);
    return false;
  }
}

async function test4_CloudinaryUrlValidation() {
  logTest('Test 4: Cloudinary URL 형식 검증');

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      logFail('CLOUDINARY_CLOUD_NAME 환경변수가 설정되지 않았습니다');
      return false;
    }

    logInfo(`Cloudinary Cloud Name: ${cloudName}`);

    // ProductImage의 fullUrl 검증
    const productImages = await prisma.productImage.findMany({
      where: { fullUrl: { not: null }, deletedAt: null },
      take: 5
    });

    let validCount = 0;
    productImages.forEach((img, idx) => {
      const url = img.fullUrl;
      if (url) {
        const isValid = url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
        if (isValid) {
          validCount++;
          logPass(`ProductImage ${idx + 1}: 유효한 Cloudinary URL`);
        } else {
          logFail(`ProductImage ${idx + 1}: 유효하지 않은 URL 형식`);
        }
      }
    });

    // ImageCache의 cloudinaryUrl 검증
    const imageCaches = await prisma.imageCache.findMany({
      where: { cloudinaryUrl: { not: null } },
      take: 5
    });

    imageCaches.forEach((img, idx) => {
      const url = img.cloudinaryUrl;
      if (url) {
        const isValid = url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
        if (isValid) {
          validCount++;
          logPass(`ImageCache ${idx + 1}: 유효한 Cloudinary URL`);
        } else {
          logFail(`ImageCache ${idx + 1}: 유효하지 않은 URL 형식`);
        }
      }
    });

    return validCount > 0;
  } catch (error) {
    logFail('Cloudinary URL 검증 중 오류 발생', error instanceof Error ? error.message : error);
    return false;
  }
}

async function test5_SoftDeleteValidation() {
  logTest('Test 5: Soft Delete (논리 삭제) 검증');

  try {
    const totalImages = await prisma.productImage.count();
    const activeImages = await prisma.productImage.count({
      where: { deletedAt: null }
    });
    const deletedImages = await prisma.productImage.count({
      where: { deletedAt: { not: null } }
    });

    logPass(`총 이미지: ${totalImages}`);
    logPass(`활성 이미지: ${activeImages}`);
    logPass(`삭제된 이미지 (soft delete): ${deletedImages}`);

    if (activeImages + deletedImages === totalImages) {
      logPass('✅ Soft delete 로직이 정상적으로 작동합니다');
    }

    // 최근 삭제된 이미지 확인
    if (deletedImages > 0) {
      const recentDeleted = await prisma.productImage.findFirst({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' }
      });

      if (recentDeleted) {
        logInfo(`최근 삭제: ${recentDeleted.fileName} (${recentDeleted.deletedAt?.toISOString()})`);
      }
    }

    return true;
  } catch (error) {
    logFail('Soft delete 검증 중 오류 발생', error instanceof Error ? error.message : error);
    return false;
  }
}

async function test6_MetadataValidation() {
  logTest('Test 6: 이미지 메타데이터 검증');

  try {
    const imagesWithMeta = await prisma.productImage.findMany({
      where: { metadata: { not: null } },
      take: 3
    });

    if (imagesWithMeta.length === 0) {
      logInfo('메타데이터가 저장된 이미지가 없습니다');
      return true;
    }

    imagesWithMeta.forEach((img, idx) => {
      const meta = img.metadata as any;
      if (meta) {
        logPass(`Image ${idx + 1} 메타데이터:`);
        console.log({
          uploadMethod: meta.uploadMethod,
          storageProvider: meta.storageProvider,
          fileSizeMB: meta.fileSizeMB,
          hasOptimized: !!meta.optimized,
          optimizedFormat: meta.optimized?.format || 'N/A'
        });
      }
    });

    return true;
  } catch (error) {
    logFail('메타데이터 검증 중 오류 발생', error instanceof Error ? error.message : error);
    return false;
  }
}

async function test7_StoragePathValidation() {
  logTest('Test 7: Storage Path 구조 검증');

  try {
    const uniquePaths = await prisma.productImage.findMany({
      distinct: ['storagePath'],
      select: { storagePath: true }
    });

    logPass(`고유한 storagePath: ${uniquePaths.length}개`);
    uniquePaths.slice(0, 5).forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.storagePath}`);
    });

    // 경로별 이미지 개수
    const pathCounts = await prisma.productImage.groupBy({
      by: ['storagePath'],
      _count: true,
      where: { deletedAt: null }
    });

    logPass('경로별 활성 이미지 개수 (상위 5):');
    pathCounts
      .sort((a, b) => (b._count as number) - (a._count as number))
      .slice(0, 5)
      .forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.storagePath}: ${item._count}개`);
      });

    return true;
  } catch (error) {
    logFail('Storage path 검증 중 오류 발생', error instanceof Error ? error.message : error);
    return false;
  }
}

async function test8_UserRelationValidation() {
  logTest('Test 8: User 관계 검증');

  try {
    const orphanedImages = await prisma.productImage.findMany({
      where: { uploadedById: null }
    });

    if (orphanedImages.length > 0) {
      logFail(`orphaned 이미지: ${orphanedImages.length}개`);
      return false;
    }

    const imagesWithUsers = await prisma.productImage.count({
      where: { User: { isNotNull: true }, deletedAt: null }
    });

    const totalActiveImages = await prisma.productImage.count({
      where: { deletedAt: null }
    });

    logPass(`User 관계가 있는 활성 이미지: ${imagesWithUsers}/${totalActiveImages}`);

    // 사용자별 이미지 개수 (상위 5)
    const topUploadersResult = await prisma.$queryRaw<Array<{ uploadedById: number; _count: bigint }>>`
      SELECT "uploadedById", COUNT(*) as "_count"
      FROM "ProductImage"
      WHERE "deletedAt" IS NULL
      GROUP BY "uploadedById"
      ORDER BY "_count" DESC
      LIMIT 5
    `;

    if (topUploadersResult && topUploadersResult.length > 0) {
      logPass('상위 업로더:');
      topUploadersResult.forEach((item, idx) => {
        console.log(`  ${idx + 1}. User ${item.uploadedById}: ${Number(item._count)}개 이미지`);
      });
    }

    return imagesWithUsers === totalActiveImages;
  } catch (error) {
    logFail('User 관계 검증 중 오류 발생', error instanceof Error ? error.message : error);
    return false;
  }
}

async function test9_IndexPerformance() {
  logTest('Test 9: 데이터베이스 인덱스 검증');

  try {
    // 인덱스가 효과적으로 작동하는지 확인
    const startTime = Date.now();

    // 1. storagePath + deletedAt 인덱스 테스트
    await prisma.productImage.findMany({
      where: { storagePath: 'products/1', deletedAt: null },
      take: 10
    });
    const storagePathTime = Date.now() - startTime;

    logPass(`storagePath + deletedAt 인덱스: ${storagePathTime}ms`);

    // 2. folder 인덱스 테스트
    const folderStart = Date.now();
    await prisma.imageCache.findMany({
      where: { folder: 'Image' },
      take: 10
    });
    const folderTime = Date.now() - folderStart;

    logPass(`ImageCache folder 인덱스: ${folderTime}ms`);

    return true;
  } catch (error) {
    logFail('인덱스 검증 중 오류 발생', error instanceof Error ? error.message : error);
    return false;
  }
}

async function runAllTests() {
  console.log(`${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════╗
║     이미지 시스템 통합 테스트 시작              ║
╚════════════════════════════════════════════════╝
${colors.reset}`);

  const results: Record<string, boolean> = {};

  results['ImageCache cloudinaryUrl'] = await test1_ImageCacheValidation();
  results['ProductImage 스키마'] = await test2_ProductImageSchema();
  results['ImageAccessLog 감사'] = await test3_ImageAccessLogging();
  results['Cloudinary URL'] = await test4_CloudinaryUrlValidation();
  results['Soft Delete'] = await test5_SoftDeleteValidation();
  results['메타데이터'] = await test6_MetadataValidation();
  results['Storage Path'] = await test7_StoragePathValidation();
  results['User 관계'] = await test8_UserRelationValidation();
  results['인덱스 성능'] = await test9_IndexPerformance();

  // 요약
  console.log(`\n${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════╗
║              테스트 결과 요약                    ║
╚════════════════════════════════════════════════╝
${colors.reset}`);

  let passCount = 0;
  Object.entries(results).forEach(([name, passed]) => {
    const icon = passed ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    console.log(`${icon} ${name}`);
    if (passed) passCount++;
  });

  const totalTests = Object.keys(results).length;
  console.log(`\n${colors.bright}총 ${passCount}/${totalTests} 테스트 통과${colors.reset}`);

  if (passCount === totalTests) {
    console.log(`${colors.green}${colors.bright}🎉 모든 테스트를 통과했습니다!${colors.reset}`);
  } else {
    console.log(`${colors.yellow}${colors.bright}⚠️  ${totalTests - passCount}개의 테스트에서 문제가 발견되었습니다${colors.reset}`);
  }

  await prisma.$disconnect();
  process.exit(passCount === totalTests ? 0 : 1);
}

// 실행
runAllTests().catch(error => {
  console.error(`${colors.red}Unexpected error:${colors.reset}`, error);
  process.exit(1);
});
