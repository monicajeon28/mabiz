import { NextRequest, NextResponse } from 'next/server';
import { listFilesInFolder } from '../../../../../lib/google-drive';
import { logger } from '../../../../../lib/logger';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try {
    const cruiseImagesFolderId = process.env.GOOGLE_DRIVE_CRUISE_IMAGES_FOLDER_ID;
    const uploadsImagesFolderId = process.env.GOOGLE_DRIVE_UPLOADS_IMAGES_FOLDER_ID;

    if (!cruiseImagesFolderId || !uploadsImagesFolderId) {
      return NextResponse.json(
        { error: 'Missing Google Drive folder IDs' },
        { status: 500 }
      );
    }

    logger.log('[Phase 1] Starting Google Drive inventory collection');

    // 폴더 1: 크루즈 정보 이미지
    const cruiseResult = await listFilesInFolder(cruiseImagesFolderId);
    if (!cruiseResult.ok || !cruiseResult.files) {
      throw new Error(`Failed to list cruise images: ${cruiseResult.error}`);
    }

    // 폴더 2: 업로드 이미지
    const uploadsResult = await listFilesInFolder(uploadsImagesFolderId);
    if (!uploadsResult.ok || !uploadsResult.files) {
      throw new Error(`Failed to list uploads images: ${uploadsResult.error}`);
    }

    // 이미지 필터링
    const isImage = (mimeType: string) => mimeType?.startsWith('image/');
    const cruiseImages = cruiseResult.files.filter(f => isImage(f.mimeType));
    const uploadsImages = uploadsResult.files.filter(f => isImage(f.mimeType));
    const allImages = [...cruiseImages, ...uploadsImages];

    // 통계
    const totalSize = allImages.reduce((sum, f) => sum + (f.size || 0), 0);
    const mimeTypeCounts: Record<string, number> = {};
    allImages.forEach(f => {
      mimeTypeCounts[f.mimeType] = (mimeTypeCounts[f.mimeType] || 0) + 1;
    });

    // WebP 변환 분류
    const jpegPng = allImages.filter(f => ['image/jpeg', 'image/png'].includes(f.mimeType));
    const gif = allImages.filter(f => f.mimeType === 'image/gif');
    const webp = allImages.filter(f => f.mimeType === 'image/webp');
    const other = allImages.filter(
      f => !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(f.mimeType)
    );

    const inventory = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: allImages.length,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        cruiseImagesCount: cruiseImages.length,
        uploadsImagesCount: uploadsImages.length,
      },
      mimeTypes: mimeTypeCounts,
      webpConversion: {
        jpegPng: jpegPng.length,
        gif: gif.length,
        alreadyWebp: webp.length,
        other: other.length,
        estimatedPhase2Hours: ((jpegPng.length * 0.5) / 3600).toFixed(1),
      },
      sample: allImages.slice(0, 10).map(f => ({
        fileId: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
      })),
    };

    logger.log('[Phase 1] Inventory collection completed', {
      totalFiles: allImages.length,
      totalSize,
    });

    return NextResponse.json(inventory, { status: 200 });
  } catch (error) {
    logger.error('[Phase 1] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const KB = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(KB));
  return Math.round((bytes / Math.pow(KB, i)) * 100) / 100 + ' ' + sizes[i];
}
