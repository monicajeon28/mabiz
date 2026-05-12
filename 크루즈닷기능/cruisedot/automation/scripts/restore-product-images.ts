// scripts/restore-product-images.ts
// 손상된 상품의 이미지 데이터 복구
// Usage: npx tsx scripts/restore-product-images.ts [productCode]

import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

async function restoreProductImages(productCodeInput?: string) {
  try {
    console.log('🔍 손상된 상품 스캔 중...\n');

    // NULL 이미지를 가진 상품들 조회
    const damagedProducts = await prisma.mallProductContent.findMany({
      where: {
        OR: [
          { thumbnail: null },
          { images: null }
        ],
        isActive: true
      },
      include: {
        CruiseProduct: {
          select: {
            id: true,
            productCode: true,
            packageName: true,
            cruiseLine: true,
            basePrice: true
          }
        }
      }
    });

    if (damagedProducts.length === 0) {
      console.log('✅ 손상된 상품이 없습니다!');
      return;
    }

    console.log(`⚠️  손상된 상품 ${damagedProducts.length}개 발견:\n`);

    damagedProducts.forEach((content) => {
      if (content.CruiseProduct) {
        console.log(`  - ${content.CruiseProduct.productCode}`);
        console.log(`    상품명: ${content.CruiseProduct.packageName}`);
        console.log(`    thumbnail: ${content.thumbnail ? '✅' : '❌'}`);
        console.log(`    images: ${content.images ? '✅' : '❌'}`);
        console.log(`    가격: ${content.CruiseProduct.basePrice?.toLocaleString()}원\n`);
      }
    });

    // 특정 상품만 복구하는 경우
    if (productCodeInput) {
      const product = damagedProducts.find(
        d => d.CruiseProduct?.productCode === productCodeInput
      );

      if (!product) {
        console.log(`❌ ${productCodeInput} 상품을 찾을 수 없습니다.`);
        return;
      }

      console.log(`\n🔧 ${productCodeInput} 복구 옵션:`);
      console.log('  1. placeholder 이미지 설정');
      console.log('  2. Google Drive에서 이미지 재다운로드');
      console.log('  3. 관리자가 수동으로 이미지 첨부\n');

      console.log('📌 현재는 placeholder 설정으로 진행합니다.');

      // placeholder 이미지 설정
      const placeholderUrl = 'https://via.placeholder.com/1200x800?text=Product+Image';
      await prisma.mallProductContent.update({
        where: { productCode: productCodeInput },
        data: {
          thumbnail: placeholderUrl,
          images: [placeholderUrl],
          updatedAt: new Date()
        }
      });

      console.log(`✅ ${productCodeInput} 복구 완료!\n`);
      return;
    }

    // 전체 손상된 상품 복구 (확인 필요)
    console.log('\n⚠️  전체 복구를 원하시면 productCode를 입력하세요.');
    console.log('예: npx tsx scripts/restore-product-images.ts REC-HK-2394\n');

  } catch (error) {
    logger.error('[Restore Images] Error:', error);
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
const productCode = process.argv[2];
restoreProductImages(productCode).catch(console.error);
