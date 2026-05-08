/**
 * Google Drive 이미지 업로드 & 동기화 라이브러리
 * - uploadImageToDrive(): 로컬 이미지 → Drive 업로드 + DB 저장
 * - syncDriveFolder(): Drive 폴더 스캔 → DB 동기화 (배치)
 */

import { getDriveClient, findOrCreateFolder } from '@/lib/drive-client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * 로컬 이미지를 Google Drive에 업로드 + DB 저장
 */
export async function uploadImageToDrive(params: {
  organizationId: string;
  userId: string;
  orgName: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  category?: string;
  tags?: string[];
}) {
  const { organizationId, userId, orgName, buffer, fileName, mimeType, category, tags } = params;

  try {
    const drive = getDriveClient();

    // CRM자산 루트 폴더 ID 확인
    const rootFolderId = process.env.GOOGLE_DRIVE_CRM_BACKUP_FOLDER_ID;
    if (!rootFolderId) {
      throw new Error('GOOGLE_DRIVE_CRM_BACKUP_FOLDER_ID 환경변수 미설정');
    }

    // 조직별 폴더 생성/탐색
    const orgFolder = await findOrCreateFolder(orgName, rootFolderId);

    // 카테고리별 폴더 생성/탐색
    const categoryFolder = category ? await findOrCreateFolder(category, orgFolder) : orgFolder;

    // Drive에 파일 업로드
    const file = await drive.files.create(
      {
        requestBody: {
          name: fileName,
          parents: [categoryFolder],
        },
        media: {
          mimeType,
          body: buffer,
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      },
      { timeout: 300000 } // 5분 타임아웃
    );

    const driveFileId = file.data.id!;

    // DB에 asset 기록 저장
    const asset = await prisma.imageAsset.create({
      data: {
        organizationId,
        originalFileName: fileName,
        driveFileId,
        drivePath: categoryFolder,
        mimeType,
        fileSize: BigInt(buffer.length),
        category: category || 'Other',
        tags: tags || [],
        uploadedBy: userId,
      },
    });

    logger.info('[image-sync] 이미지 업로드 완료', {
      assetId: asset.id,
      fileName,
      driveFileId,
    });

    return asset;
  } catch (err) {
    logger.error('[image-sync] Drive 업로드 실패', { err, fileName });
    throw err;
  }
}

/**
 * Drive 폴더를 스캔하여 DB에 동기화 (배치)
 */
export async function syncDriveFolder(params: {
  organizationId: string;
  orgName: string;
  category: string;
}) {
  const { organizationId, orgName, category } = params;

  try {
    const drive = getDriveClient();

    const rootFolderId = process.env.GOOGLE_DRIVE_CRM_BACKUP_FOLDER_ID;
    if (!rootFolderId) {
      throw new Error('GOOGLE_DRIVE_CRM_BACKUP_FOLDER_ID 환경변수 미설정');
    }

    // 폴더 경로 탐색
    const orgFolder = await findOrCreateFolder(orgName, rootFolderId);
    const categoryFolder = await findOrCreateFolder(category, orgFolder);

    // 폴더 내 이미지 파일 목록 조회
    const response = await drive.files.list({
      q: `'${categoryFolder}' in parents and mimeType contains 'image/' and trashed=false`,
      fields: 'files(id, name, mimeType, size, webViewLink)',
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      pageSize: 100,
      supportsAllDrives: true,
    });

    const files = response.data.files || [];
    const upserted = [];

    for (const file of files) {
      const asset = await prisma.imageAsset.upsert({
        where: {
          organizationId_driveFileId: {
            organizationId,
            driveFileId: file.id!,
          },
        },
        create: {
          organizationId,
          originalFileName: file.name!,
          driveFileId: file.id!,
          drivePath: categoryFolder,
          mimeType: file.mimeType || undefined,
          fileSize: file.size ? BigInt(file.size) : null,
          category,
          tags: [],
          uploadedBy: 'system',
        },
        update: {
          lastAccessedAt: new Date(),
        },
      });

      upserted.push(asset);
    }

    logger.info('[image-sync] 폴더 동기화 완료', {
      organizationId,
      category,
      syncedCount: upserted.length,
    });

    return upserted;
  } catch (err) {
    logger.error('[image-sync] 폴더 동기화 실패', { err });
    throw err;
  }
}

/**
 * 이미지 파일 타입 검증
 */
export function validateImageFile(mimeType: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ];

  return allowedTypes.includes(mimeType);
}

/**
 * 파일명 충돌 처리 (중복 시 suffix 추가)
 */
export function generateUniqueFileName(originalName: string, existingNames: string[]): string {
  if (!existingNames.includes(originalName)) {
    return originalName;
  }

  const [nameWithoutExt, ext] = originalName.split(/\.(?=[^.]+$)/);
  let counter = 1;

  while (existingNames.includes(`${nameWithoutExt}_${counter}.${ext}`)) {
    counter++;
  }

  return `${nameWithoutExt}_${counter}.${ext}`;
}
