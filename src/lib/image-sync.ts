/**
 * Google Drive 이미지 업로드 & 동기화 라이브러리
 * - uploadImageToDrive(): 로컬 이미지 → Drive 업로드 + DB 저장
 * - syncDriveFolder(): Drive 폴더 스캔 → DB 동기화 (배치)
 */

import { Readable } from 'stream';
import type { drive_v3 } from 'googleapis';
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
  width?: number;
  height?: number;
  orientation?: number;
}) {
  const { organizationId, userId, orgName, buffer, fileName, mimeType, category, tags, width, height, orientation } = params;

  try {
    const drive = getDriveClient();

    // CRM자산 루트 폴더 ID 확인
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (!rootFolderId) {
      throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID 환경변수 미설정');
    }

    // 조직별 폴더 생성/탐색
    const orgFolder = await findOrCreateFolder(orgName, rootFolderId);

    // 카테고리별 폴더 생성/탐색
    const categoryFolder = category ? await findOrCreateFolder(category, orgFolder) : orgFolder;

    // Drive에 파일 업로드
    // googleapis media.body는 stream.Readable 필요 — Buffer 직접 전달 시 오류
    const file = await drive.files.create(
      {
        requestBody: {
          name: fileName,
          parents: [categoryFolder],
        },
        media: {
          mimeType,
          body: Readable.from(buffer),
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
        width: width || null,
        height: height || null,
        orientation: orientation || 1,
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
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[image-sync] Drive 업로드 실패', { message: msg, fileName });
    throw err;
  }
}

/**
 * Drive 폴더를 스캔하여 DB에 동기화 (배치)
 *
 * P0 이슈 해결:
 * - Issue #5: 배치 처리 (페이지 단위)로 메모리 누수 방지 (pageSize 100→1000)
 * - Issue #6: 부분 실패 추적 (failed 배열 + 명확한 로깅)
 * - Issue #7: Drive API 호출 타임아웃 30초 설정
 */
export async function syncDriveFolder(params: {
  organizationId: string;
  orgName: string;
  category: string;
  folderId?: string; // 직접 폴더 ID 지정 가능
}) {
  const { organizationId, orgName, category, folderId } = params;

  try {
    const drive = getDriveClient();

    let targetFolderId = folderId;
    if (!targetFolderId) {
      const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
      if (!rootFolderId) {
        throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID 환경변수 미설정');
      }
      const orgFolder = await findOrCreateFolder(orgName, rootFolderId);
      targetFolderId = await findOrCreateFolder(category, orgFolder);
    }

    // Issue #5: 배치 처리 - 페이지 단위로 즉시 upsert (전체 배열 메모리 누수 방지)
    // pageSize 100 → 1000 (API 호출 10배 감소, 메모리 최대 1000개만 동시 적재)
    let pageToken: string | undefined;
    let totalProcessed = 0;
    const failed: Array<{ fileId: string; fileName?: string; error: string }> = [];

    do {
      const response = await drive.files.list(
        {
          q: `'${targetFolderId}' in parents and mimeType contains 'image/' and not mimeType = 'image/svg+xml' and trashed=false`,
          fields: 'nextPageToken, files(id, name, mimeType, size)',
          corpora: 'allDrives',
          includeItemsFromAllDrives: true,
          pageSize: 1000, // Issue #5: 100 → 1000 (API 호출 10배 감소)
          pageToken,
          supportsAllDrives: true,
        },
        { timeout: 30000 } // Issue #7: Drive API 타임아웃 30초
      );

      const files = response.data.files || [];

      // Issue #5: 페이지 단위로 즉시 upsert (배치 처리)
      for (const file of files) {
        try {
          await prisma.imageAsset.upsert({
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
              drivePath: targetFolderId,
              mimeType: file.mimeType || undefined,
              fileSize: file.size ? BigInt(file.size) : null,
              width: null,
              height: null,
              orientation: 1,
              category,
              tags: [],
              uploadedBy: 'system',
            },
            update: {
              lastAccessedAt: new Date(),
            },
          });

          totalProcessed++;
        } catch (err) {
          // Issue #6: 부분 실패 추적 (failed 배열)
          const errorMsg = err instanceof Error ? err.message : String(err);
          failed.push({
            fileId: file.id!,
            fileName: file.name,
            error: errorMsg,
          });

          logger.warn('[image-sync] 개별 파일 동기화 실패', {
            fileName: file.name,
            driveFileId: file.id,
            error: errorMsg,
          });
        }
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    // Issue #6: 부분 실패 요약 로깅
    if (failed.length > 0) {
      logger.warn('[image-sync] 부분 실패 요약', {
        organizationId,
        category,
        failedCount: failed.length,
        failedIds: failed.map(f => f.fileId).slice(0, 10), // 처음 10개만 로깅
        failedDetails: failed.slice(0, 5), // 상세 정보 처음 5개만
      });
    }

    logger.info('[image-sync] 폴더 동기화 완료', {
      organizationId,
      category,
      processedCount: totalProcessed,
      failedCount: failed.length,
    });

    return {
      processedCount: totalProcessed,
      failedCount: failed.length,
      failed, // 재시도 가능하도록 반환
    };
  } catch (err) {
    logger.error('[image-sync] 폴더 동기화 실패', {
      err: err instanceof Error ? err.message : String(err),
    });
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
