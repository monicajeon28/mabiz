import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * ImageCache Cloudinary 동기화 진행률 모니터링
 * 용도: Phase 3 배치 업로드 진행 상황 추적 (Cron 작동 확인)
 * 실행: npx ts-node scripts/check-image-sync-progress.ts
 */
async function checkImageSyncProgress() {
  try {
    logger.log('[ImageSync] ImageCache 동기화 통계 조회 시작...');

    // 총 이미지 수
    const total = await prisma.imageCache.count();
    logger.log(`[ImageSync] 총 ImageCache 레코드: ${total}개`);

    if (total === 0) {
      logger.log('[ImageSync] ⚠️  ImageCache에 레코드가 없습니다.');
      return;
    }

    // 동기화 완료 (cloudinaryUrl이 설정된 레코드)
    const synced = await prisma.imageCache.count({
      where: { cloudinaryUrl: { not: null } },
    });

    // 동기화 대기 (cloudinaryUrl이 NULL인 레코드)
    const pending = await prisma.imageCache.count({
      where: { cloudinaryUrl: null },
    });

    // 진행률 계산
    const syncProgress = ((synced / total) * 100).toFixed(2);

    // 최근 동기화 이미지 (마지막 5개)
    const recentSynced = await prisma.imageCache.findMany({
      where: { cloudinaryUrl: { not: null } },
      orderBy: { cloudinarySyncedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        fileName: true,
        cloudinarySyncedAt: true,
        cloudinaryPublicId: true,
      },
    });

    // 최근 대기 중인 이미지 (첫 5개)
    const recentPending = await prisma.imageCache.findMany({
      where: { cloudinaryUrl: null },
      orderBy: { createdAt: 'asc' },
      take: 5,
      select: {
        id: true,
        fileName: true,
        createdAt: true,
        folder: true,
      },
    });

    // 폴더별 동기화 상태
    const folderStats = await prisma.imageCache.groupBy({
      by: ['folder'],
      _count: {
        id: true,
      },
      where: {
        cloudinaryUrl: { not: null },
      },
    });

    // 결과 출력
    logger.log('');
    logger.log('╔═══════════════════════════════════════════════════╗');
    logger.log('║     📊 ImageCache Cloudinary 동기화 통계           ║');
    logger.log('╚═══════════════════════════════════════════════════╝');
    logger.log('');
    logger.log(`✅ 동기화 완료: ${synced}개`);
    logger.log(`⏳ 동기화 대기: ${pending}개`);
    logger.log(`📈 총 이미지:  ${total}개`);
    logger.log(`🎯 진행률:     ${syncProgress}%`);
    logger.log('');

    if (recentSynced.length > 0) {
      logger.log('🔄 최근 동기화된 이미지 (마지막 5개):');
      recentSynced.forEach((img, idx) => {
        const syncDate = img.cloudinarySyncedAt
          ? new Date(img.cloudinarySyncedAt).toLocaleString('ko-KR')
          : 'N/A';
        logger.log(`   ${idx + 1}. [ID:${img.id}] ${img.fileName}`);
        logger.log(`      └─ PublicId: ${img.cloudinaryPublicId}, Synced: ${syncDate}`);
      });
      logger.log('');
    }

    if (recentPending.length > 0) {
      logger.log('⏳ 동기화 대기 중인 이미지 (첫 5개):');
      recentPending.forEach((img, idx) => {
        const createdDate = new Date(img.createdAt).toLocaleString('ko-KR');
        logger.log(`   ${idx + 1}. [ID:${img.id}] ${img.fileName}`);
        logger.log(`      └─ Folder: ${img.folder}, Created: ${createdDate}`);
      });
      logger.log('');
    }

    if (folderStats.length > 0) {
      logger.log('📁 폴더별 동기화 완료 현황:');
      folderStats.forEach((stat) => {
        logger.log(`   ${stat.folder}: ${stat._count.id}개`);
      });
      logger.log('');
    }

    // 동기화 상태 판정
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (syncProgress === '100.00') {
      logger.log('✨ 동기화 완료! 모든 이미지가 Cloudinary에 업로드되었습니다.');
    } else if (parseInt(syncProgress) >= 75) {
      logger.log('🚀 동기화 진행 중... (75% 이상 완료)');
    } else if (parseInt(syncProgress) >= 50) {
      logger.log('⚙️  동기화 진행 중... (50% 이상 완료)');
    } else if (parseInt(syncProgress) > 0) {
      logger.log('🔄 동기화 진행 중... (초기 단계)');
    } else {
      logger.log('⚠️  동기화가 시작되지 않았습니다.');
    }
    logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.log('');
    logger.log('[ImageSync] 조회 완료!');
  } catch (error) {
    logger.error('[ImageSync] 동기화 통계 조회 실패:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkImageSyncProgress();
