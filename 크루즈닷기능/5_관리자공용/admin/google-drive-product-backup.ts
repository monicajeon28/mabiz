// lib/google-drive-product-backup.ts
// 상품 이미지를 구글 드라이브에 백업하는 유틸리티

import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { uploadFileToDrive, findOrCreateFolder } from '../google-drive';
import prisma from '../prisma';
import { logger } from '@/lib/logger';

// 백업 설정
const MAX_BACKUP_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * 로컬 이미지 URL을 구글 드라이브 URL로 변환
 * @param imageUrl - 로컬 이미지 URL (예: /크루즈정보사진/... 또는 /uploads/...)
 * @param productCode - 상품 코드
 * @returns 구글 드라이브 URL 또는 원본 URL
 */
export async function backupImageToGoogleDrive(
  imageUrl: string,
  productCode: string
): Promise<string> {
  try {
    // 이미 구글 드라이브 URL이거나 외부 URL인 경우 그대로 반환
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // 구글 드라이브 URL인지 확인
      if (imageUrl.includes('drive.google.com') || imageUrl.includes('googleusercontent.com')) {
        return imageUrl; // 이미 백업됨
      }
      // 외부 URL인 경우 그대로 반환 (백업하지 않음)
      return imageUrl;
    }

    // 로컬 경로인 경우에만 백업
    if (!imageUrl.startsWith('/')) {
      return imageUrl;
    }

    // public 폴더의 실제 파일 경로
    const publicPath = join(process.cwd(), 'public', imageUrl);

    // 파일이 존재하는지 확인
    if (!existsSync(publicPath)) {
      logger.warn(`[Product Backup] File not found: ${publicPath}`);
      return imageUrl; // 파일이 없으면 원본 URL 반환
    }

    // 파일 크기 확인
    try {
      const fileStats = await stat(publicPath);
      if (fileStats.size > MAX_BACKUP_FILE_SIZE) {
        logger.warn(`[Product Backup] File too large (${(fileStats.size / 1024 / 1024).toFixed(2)}MB), skipping: ${imageUrl}`);
        return imageUrl; // 파일이 너무 크면 백업하지 않음
      }
    } catch (statError) {
      logger.warn(`[Product Backup] Failed to get file stats: ${publicPath}`, statError);
      return imageUrl; // 파일 정보를 가져올 수 없으면 스킵
    }

    // 구글 드라이브 이미지 라이브러리 폴더 ID 가져오기 (UPLOADS_IMAGES 폴더)
    const uploadsImagesConfig = await prisma.systemConfig.findUnique({
      where: { configKey: 'google_drive_uploads_images_folder_id' },
      select: { configValue: true },
    });

    // 이미지 라이브러리 폴더 ID (기본값: 1fWbPelIoftl1DqXLayZNle7z-DSYzvl8)
    const imageLibraryFolderId = uploadsImagesConfig?.configValue
      || process.env.GOOGLE_DRIVE_UPLOADS_IMAGES_FOLDER_ID
      || '1fWbPelIoftl1DqXLayZNle7z-DSYzvl8';

    if (!imageLibraryFolderId) {
      logger.warn('[Product Backup] Google Drive image library folder ID not configured');
      return imageUrl; // 설정이 없으면 원본 URL 반환
    }

    // 상품 코드별 폴더 생성 또는 찾기 (이미지 라이브러리 내에 상품별 폴더)
    const productFolderResult = await findOrCreateFolder(productCode, imageLibraryFolderId);

    if (!productFolderResult.ok || !productFolderResult.folderId) {
      logger.error('[Product Backup] Failed to create/find product folder:', productFolderResult.error);
      return imageUrl;
    }

    // 파일 읽기
    const fileBuffer = await readFile(publicPath);

    // 파일명 추출
    const fileName = imageUrl.split('/').pop() || `image_${Date.now()}.jpg`;

    // MIME 타입 추정
    const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime',
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';

    // 구글 드라이브에 업로드
    const uploadResult = await uploadFileToDrive({
      folderId: productFolderResult.folderId,
      fileName: fileName,
      mimeType: mimeType,
      buffer: fileBuffer,
      makePublic: true, // 공개 설정
    });

    if (uploadResult.ok && uploadResult.url) {
      logger.log(`[Product Backup] Uploaded to Google Drive: ${fileName} -> ${uploadResult.url}`);
      return uploadResult.url;
    } else {
      logger.error('[Product Backup] Upload failed:', uploadResult.error);
      return imageUrl; // 업로드 실패 시 원본 URL 반환
    }
  } catch (error: any) {
    logger.error('[Product Backup] Error backing up image:', error);
    return imageUrl; // 에러 발생 시 원본 URL 반환
  }
}

/**
 * 여행일정의 이미지 백업
 */
async function backupItineraryImages(
  itineraryDays: any[],
  productCode: string
): Promise<any[]> {
  if (!Array.isArray(itineraryDays)) {
    return itineraryDays;
  }

  const backedUpDays = [...itineraryDays];

  for (let i = 0; i < backedUpDays.length; i++) {
    const day = backedUpDays[i];

    // 일정의 블록들 백업
    if (Array.isArray(day.blocks)) {
      for (let j = 0; j < day.blocks.length; j++) {
        const block = day.blocks[j];

        if (block.type === 'image' && block.url) {
          day.blocks[j] = {
            ...block,
            url: await backupImageToGoogleDrive(block.url, productCode),
          };
        } else if (block.type === 'video' && block.url && !block.url.startsWith('http')) {
          day.blocks[j] = {
            ...block,
            url: await backupImageToGoogleDrive(block.url, productCode),
          };
        }
      }
    }
  }

  return backedUpDays;
}

/**
 * 상품의 모든 이미지를 구글 드라이브에 백업
 * @param productCode - 상품 코드
 * @param thumbnail - 썸네일 URL
 * @param detailBlocks - 상세페이지 블록 배열
 * @param itineraryDays - 여행일정 배열 (선택적)
 * @returns 백업된 썸네일 URL, 상세페이지 블록 배열, 여행일정 배열
 */
export async function backupProductImages(
  productCode: string,
  thumbnail: string | null | undefined,
  detailBlocks: any[] | undefined,
  itineraryDays?: any[] | undefined
): Promise<{
  thumbnail: string | null;
  detailBlocks: any[];
  itineraryDays?: any[];
}> {
  const result: {
    thumbnail: string | null;
    detailBlocks: any[];
    itineraryDays?: any[];
  } = {
    thumbnail: thumbnail || null,
    detailBlocks: detailBlocks || [],
  };

  try {
    // 썸네일 백업
    if (thumbnail) {
      result.thumbnail = await backupImageToGoogleDrive(thumbnail, productCode);
    }

    // 상세페이지 블록의 이미지 백업
    if (Array.isArray(detailBlocks)) {
      for (let i = 0; i < detailBlocks.length; i++) {
        const block = detailBlocks[i];

        if (block.type === 'image' && block.url) {
          detailBlocks[i] = {
            ...block,
            url: await backupImageToGoogleDrive(block.url, productCode),
          };
        } else if (block.type === 'video' && block.url && !block.url.startsWith('http')) {
          // 로컬 비디오 파일도 백업
          detailBlocks[i] = {
            ...block,
            url: await backupImageToGoogleDrive(block.url, productCode),
          };
        }
      }
      result.detailBlocks = detailBlocks;
    }

    // 여행일정의 이미지 백업
    if (itineraryDays !== undefined) {
      result.itineraryDays = await backupItineraryImages(itineraryDays, productCode);
    }
  } catch (error: any) {
    logger.error('[Product Backup] Error backing up product images:', error);
  }

  return result;
}
