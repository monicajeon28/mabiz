// scripts/auto-restore-images-from-gdrive.ts
// Google Drive에서 이미지를 자동으로 조회해서 손상된 상품 복구

import prisma from '@/lib/prisma';
import { google } from 'googleapis';
import { logger } from '@/lib/logger';

async function authenticateGoogleDrive(serviceAccountEmail: string, privateKey: string) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: 'cruisedot-478810',
      private_key_id: 'key-id',
      private_key: privateKey.replace(/\\n/g, '\n'),
      client_email: serviceAccountEmail,
      client_id: '0',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

async function findProductFolder(drive: any, productCode: string, sharedDriveId: string) {
  try {
    const res = await drive.files.list({
      q: `name='${productCode}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id, name)',
      corpora: 'drive',
      driveId: sharedDriveId,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    return res.data.files?.[0];
  } catch (error) {
    logger.error(`[Auto Restore] Error finding folder for ${productCode}:`, error);
    return null;
  }
}

async function getImageFilesFromFolder(drive: any, folderId: string, sharedDriveId: string) {
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType in ('image/jpeg', 'image/png', 'image/webp', 'image/gif') and trashed=false`,
      spaces: 'drive',
      pageSize: 100,
      fields: 'files(id, name, mimeType, webContentLink)',
      corpora: 'drive',
      driveId: sharedDriveId,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    return res.data.files || [];
  } catch (error) {
    logger.error(`[Auto Restore] Error getting files from folder:`, error);
    return [];
  }
}

async function restoreProductImagesFromGDrive(productCodeInput?: string) {
  try {
    console.log('🔍 Google Drive에서 손상된 상품 복구 중...\n');

    // Admin Settings에서 Google Drive 설정 조회
    const serviceAccountEmail = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY;
    const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;
    const imagesFolderId = process.env.GOOGLE_DRIVE_UPLOADS_IMAGES_FOLDER_ID;

    if (!serviceAccountEmail || !privateKey || !sharedDriveId) {
      throw new Error('Google Drive 환경변수 누락: 서비스 계정 이메일, 개인 키, 공유 드라이브 ID');
    }

    if (!imagesFolderId) {
      console.warn('⚠️  GOOGLE_DRIVE_UPLOADS_IMAGES_FOLDER_ID가 설정되지 않았습니다.');
      console.warn('   Admin 패널 → 환경설정에서 설정해주세요.\n');
    }

    const drive = await authenticateGoogleDrive(serviceAccountEmail, privateKey);

    // 손상된 상품 조회
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
            productCode: true,
            packageName: true,
          }
        }
      }
    });

    if (damagedProducts.length === 0) {
      console.log('✅ 손상된 상품이 없습니다!');
      return;
    }

    console.log(`⚠️  손상된 상품 ${damagedProducts.length}개 발견\n`);

    const targetProducts = productCodeInput
      ? damagedProducts.filter(p => p.CruiseProduct?.productCode === productCodeInput)
      : damagedProducts;

    if (targetProducts.length === 0 && productCodeInput) {
      console.log(`❌ ${productCodeInput} 상품을 찾을 수 없습니다.`);
      return;
    }

    let restored = 0;

    for (const product of targetProducts) {
      const productCode = product.CruiseProduct?.productCode;
      if (!productCode) continue;

      console.log(`\n🔧 ${productCode} 복구 중...`);

      // Google Drive에서 상품 폴더 찾기 (이미지 라이브러리 폴더 내에서)
      const parentFolderId = imagesFolderId || sharedDriveId;
      const folder = await findProductFolder(drive, productCode, parentFolderId);

      if (!folder) {
        console.log(`  ⚠️  Google Drive에서 ${productCode} 폴더를 찾을 수 없습니다.`);
        continue;
      }

      // 폴더 내 이미지 파일 조회
      const imageFiles = await getImageFilesFromFolder(drive, folder.id, sharedDriveId);

      if (imageFiles.length === 0) {
        console.log(`  ⚠️  ${productCode} 폴더에 이미지가 없습니다.`);
        continue;
      }

      // 첫 번째 이미지를 thumbnail로, 모든 이미지를 images에 저장
      const imageUrls = imageFiles.map(file => {
        // Google Drive 공개 링크로 변환
        const fileId = file.id;
        return `https://drive.google.com/uc?id=${fileId}&export=download`;
      });

      const thumbnail = imageUrls[0] || null;

      // DB 업데이트
      await prisma.mallProductContent.update({
        where: { productCode },
        data: {
          thumbnail,
          images: imageUrls,
          updatedAt: new Date()
        }
      });

      console.log(`  ✅ 복구 완료!`);
      console.log(`    - thumbnail: ${thumbnail ? '✅' : '❌'}`);
      console.log(`    - images: ${imageUrls.length}개`);
      restored++;
    }

    console.log(`\n\n🎉 복구 완료: ${restored}개 상품`);

  } catch (error) {
    logger.error('[Auto Restore] Error:', error);
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
const productCode = process.argv[2];
restoreProductImagesFromGDrive(productCode).catch(console.error);
