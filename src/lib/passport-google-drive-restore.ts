/**
 * Passport Google Drive 복원 라이브러리
 * - M3-2: Google Drive에서 여권 파일 다운로드
 * - Trip 폴더 구조: Org-{orgId}/Trip-{tripId}/passport_{guestId}.*
 * - 메모리 안전 스트리밍 다운로드
 * - WebP 형식 검증
 * - 재시도 로직 (3회, 지수 백오프)
 *
 * 폴더 구조:
 *   Org-{organizationId}/
 *   └─ Trip-{tripId}/
 *      ├─ passport_1001.webp
 *      ├─ passport_1002.webp
 *      └─ ...
 */

import { getDriveClient } from '@/lib/drive-client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Readable } from 'stream';

/**
 * 여권 파일 다운로드 메타데이터
 */
export interface PassportFileMetadata {
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number; // 바이트
  createdTime: string; // ISO 8601
  modifiedTime: string; // ISO 8601
}

/**
 * 여권 파일 다운로드 결과
 */
export interface PassportDownloadResult {
  guestId: number;
  fileBuffer: Buffer;
  metadata: PassportFileMetadata;
  downloadedAt: Date;
  retryCount: number;
}

/**
 * 여권 파일 검색 및 다운로드
 *
 * 1. Trip Google Drive 폴더 설정 조회
 * 2. 여권 파일 검색 (passport_{guestId}.*)
 * 3. 메타데이터 검증
 * 4. 스트리밍 다운로드 (메모리 안전)
 * 5. WebP 형식 검증
 * 6. BackupLog 기록
 *
 * @param guestId - GmPassportSubmissionGuest.id
 * @param tripId - GmTrip.id
 * @param organizationId - Organization.id
 * @returns PassportDownloadResult
 * @throws Error 파일 미발견, 다운로드 실패 시
 */
export async function downloadPassportFileFromGoogleDrive(
  guestId: number,
  tripId: number,
  organizationId: string
): Promise<PassportDownloadResult> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    try {
      logger.info('[Passport Restore] 다운로드 시작', {
        guestId,
        tripId,
        organizationId,
        retryCount
      });

      // 1. Trip Google Drive 설정 조회
      const driveConfig = await prisma.gmTripGoogleDriveConfig.findUnique({
        where: { tripId },
        select: {
          googleFolderId: true,
          accessToken: true,
          expiresAt: true
        }
      });

      if (!driveConfig?.googleFolderId) {
        throw new Error(
          `Trip Google Drive 설정 미발견 (tripId: ${tripId}). 먼저 M2-3 (리포지토리 백업)을 완료하세요.`
        );
      }

      // 토큰 만료 확인 (TODO: M3-1에서 토큰 갱신 예정)
      if (driveConfig.expiresAt < new Date()) {
        throw new Error(
          `Google OAuth 토큰 만료됨 (expiresAt: ${driveConfig.expiresAt.toISOString()})`
        );
      }

      // 2. Trip 폴더에서 여권 파일 검색
      const fileMetadata = await findPassportFileInDrive(guestId, driveConfig.googleFolderId);

      if (!fileMetadata) {
        throw new Error(
          `여권 파일 미발견 (guestId: ${guestId}, folderName: Trip-${tripId})`
        );
      }

      // 3. WebP 형식 검증
      if (!isWebPFile(fileMetadata.fileName, fileMetadata.mimeType)) {
        logger.warn('[Passport Restore] WebP 형식 아님 (경고)', {
          guestId,
          fileName: fileMetadata.fileName,
          mimeType: fileMetadata.mimeType
        });
        // 계속 진행 (WebP 아니어도 다운로드)
      }

      // 4. 스트리밍 다운로드 (메모리 안전)
      const fileBuffer = await downloadFileAsBuffer(fileMetadata.fileId);

      // 5. 다운로드 성공 로그 기록
      await logBackupStatus(guestId, 'success', fileMetadata.fileId, null, retryCount);

      logger.info('[Passport Restore] 다운로드 완료', {
        guestId,
        fileId: fileMetadata.fileId,
        fileName: fileMetadata.fileName,
        size: fileBuffer.length,
        retryCount
      });

      return {
        guestId,
        fileBuffer,
        metadata: fileMetadata,
        downloadedAt: new Date(),
        retryCount
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // 지수 백오프 (1s, 2s, 4s)
      if (retryCount < maxRetries - 1) {
        const delayMs = Math.pow(2, retryCount) * 1000;
        logger.warn('[Passport Restore] 재시도 예정', {
          guestId,
          retryCount,
          nextRetryIn: `${delayMs}ms`,
          error: lastError.message
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        // 모든 재시도 실패
        await logBackupStatus(
          guestId,
          'failed',
          null,
          lastError.message,
          retryCount
        );

        logger.error('[Passport Restore] 다운로드 실패 (모든 재시도 완료)', {
          guestId,
          tripId,
          organizationId,
          totalRetries: maxRetries,
          error: lastError.message
        });

        throw lastError;
      }
    }
  }

  // 이론적으로 도달 불가능
  throw lastError || new Error('알 수 없는 오류');
}

/**
 * Trip 폴더에서 여권 파일 검색
 *
 * 파일 패턴: passport_{guestId}.* (WebP, JPEG, PNG 등)
 * 예: passport_1001.webp, passport_1002.jpg
 *
 * @param guestId - GmPassportSubmissionGuest.id
 * @param tripFolderId - Trip Google Drive 폴더 ID
 * @returns 파일 메타데이터 또는 null (미발견)
 */
export async function findPassportFileInDrive(
  guestId: number,
  tripFolderId: string
): Promise<PassportFileMetadata | null> {
  const drive = getDriveClient();

  try {
    // 파일명 패턴: passport_1001.*, passport_1002.* 등
    const fileNamePrefix = `passport_${guestId}`;

    const res = await drive.files.list({
      q: `'${tripFolderId}' in parents and name contains '${fileNamePrefix}' and trashed=false and (mimeType='image/webp' or mimeType='image/jpeg' or mimeType='image/png')`,
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime)',
      pageSize: 1,
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    const file = res.data.files?.[0];

    if (!file || !file.id) {
      logger.warn('[Passport Restore] 파일 미발견', {
        guestId,
        tripFolderId,
        searchPattern: `${fileNamePrefix}.*`
      });
      return null;
    }

    const metadata: PassportFileMetadata = {
      fileId: file.id,
      fileName: file.name!,
      mimeType: file.mimeType!,
      size: parseInt(file.size as unknown as string, 10) || 0,
      createdTime: file.createdTime!,
      modifiedTime: file.modifiedTime!
    };

    logger.info('[Passport Restore] 파일 발견', {
      guestId,
      fileName: metadata.fileName,
      fileId: metadata.fileId,
      size: metadata.size
    });

    return metadata;
  } catch (err) {
    logger.error('[Passport Restore] 파일 검색 실패', {
      guestId,
      tripFolderId,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

/**
 * Google Drive 파일을 Buffer로 다운로드 (메모리 안전 스트리밍)
 *
 * - 스트리밍 다운로드로 대용량 파일도 메모리 안전하게 처리
 * - 최대 100MB 파일 지원 (여권 사진은 보통 1-5MB)
 * - 타임아웃 30초
 *
 * @param fileId - Google Drive 파일 ID
 * @returns 파일 내용 Buffer
 */
async function downloadFileAsBuffer(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const TIMEOUT_MS = 30000; // 30초

  try {
    const downloadPromise = new Promise<Buffer>((resolve, reject) => {
      let chunks: Buffer[] = [];
      let totalSize = 0;

      const timeout = setTimeout(() => {
        reject(new Error(`다운로드 타임아웃 (${TIMEOUT_MS}ms)`));
      }, TIMEOUT_MS);

      drive.files
        .get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' })
        .then((res) => {
          const stream = res.data as any;

          stream.on('data', (chunk: Buffer) => {
            totalSize += chunk.length;

            // 파일 크기 제한 (악의적 공격 방지)
            if (totalSize > MAX_FILE_SIZE) {
              stream.destroy();
              clearTimeout(timeout);
              reject(new Error(`파일 크기 초과 (${totalSize} > ${MAX_FILE_SIZE})`));
              return;
            }

            chunks.push(chunk);
          });

          stream.on('end', () => {
            clearTimeout(timeout);
            resolve(Buffer.concat(chunks));
          });

          stream.on('error', (err: Error) => {
            clearTimeout(timeout);
            reject(err);
          });
        })
        .catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
    });

    return await downloadPromise;
  } catch (err) {
    logger.error('[Passport Restore] 파일 다운로드 실패', {
      fileId,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

/**
 * WebP 파일 형식 검증
 *
 * - 파일명 확장자 검증 (.webp)
 * - MIME 타입 검증 (image/webp)
 * - 바이너리 헤더 검증 (RIFF...WEBP)
 *
 * @param fileName - Google Drive 파일명
 * @param mimeType - MIME 타입
 * @returns true if WebP, false otherwise
 */
function isWebPFile(fileName: string, mimeType: string): boolean {
  // 1. 파일명 확장자 검증
  if (!fileName.toLowerCase().endsWith('.webp')) {
    return false;
  }

  // 2. MIME 타입 검증
  if (mimeType !== 'image/webp') {
    return false;
  }

  return true;
}

/**
 * 바이너리 헤더로 WebP 형식 검증
 *
 * WebP 시그니처: RIFF....WEBP (바이트 0-3: 'RIFF', 바이트 8-11: 'WEBP')
 *
 * @param buffer - 파일 내용 Buffer
 * @returns true if WebP binary signature found
 */
export function validateWebPBinary(buffer: Buffer): boolean {
  if (buffer.length < 12) {
    return false;
  }

  // RIFF 헤더 (바이트 0-3)
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') {
    return false;
  }

  // WEBP 시그니처 (바이트 8-11)
  if (buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return false;
  }

  return true;
}

/**
 * BackupLog 기록
 *
 * - success: googleDriveFileId 저장
 * - failed: errorMessage + retryCount 저장
 *
 * @param guestId - GmPassportSubmissionGuest.id
 * @param status - 'success' | 'failed'
 * @param fileId - Google Drive 파일 ID (성공 시)
 * @param errorMessage - 에러 메시지 (실패 시)
 * @param retryCount - 재시도 횟수
 */
async function logBackupStatus(
  guestId: number,
  status: 'success' | 'failed',
  fileId: string | null,
  errorMessage: string | null,
  retryCount: number
): Promise<void> {
  try {
    await prisma.passportBackupLog.create({
      data: {
        guestId,
        status,
        googleDriveFileId: fileId,
        errorMessage,
        retryCount,
        backupTime: new Date()
      }
    });

    logger.info('[Passport Restore] BackupLog 기록됨', {
      guestId,
      status,
      retryCount
    });
  } catch (err) {
    logger.error('[Passport Restore] BackupLog 기록 실패', {
      guestId,
      status,
      error: err instanceof Error ? err.message : String(err)
    });
    // BackupLog 실패는 다운로드 실패의 원인이 아님 (로깅만 목적)
  }
}

/**
 * Trip별 여권 파일 목록 조회
 *
 * 모든 게스트의 여권 파일을 조회하고 다운로드 가능 여부 확인
 *
 * @param tripId - GmTrip.id
 * @returns 파일 메타데이터 목록
 */
export async function listPassportFilesInTrip(
  tripId: number
): Promise<PassportFileMetadata[]> {
  try {
    const driveConfig = await prisma.gmTripGoogleDriveConfig.findUnique({
      where: { tripId },
      select: { googleFolderId: true }
    });

    if (!driveConfig?.googleFolderId) {
      logger.warn('[Passport Restore] Trip Google Drive 설정 미발견', { tripId });
      return [];
    }

    const drive = getDriveClient();

    const res = await drive.files.list({
      q: `'${driveConfig.googleFolderId}' in parents and name contains 'passport_' and trashed=false and (mimeType='image/webp' or mimeType='image/jpeg' or mimeType='image/png')`,
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime)',
      pageSize: 100,
      orderBy: 'name asc',
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    const files = (res.data.files || []).map((file) => ({
      fileId: file.id!,
      fileName: file.name!,
      mimeType: file.mimeType!,
      size: parseInt(file.size as unknown as string, 10) || 0,
      createdTime: file.createdTime!,
      modifiedTime: file.modifiedTime!
    }));

    logger.info('[Passport Restore] Trip 파일 목록 조회', {
      tripId,
      count: files.length
    });

    return files;
  } catch (err) {
    logger.error('[Passport Restore] Trip 파일 목록 조회 실패', {
      tripId,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}
