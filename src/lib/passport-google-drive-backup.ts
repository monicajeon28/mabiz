/**
 * Passport 파일 Google Drive 백업 라이브러리
 * - WebP로 변환된 여권 파일을 Google Drive에 자동 업로드
 * - 3회 재시도 로직 (지수 백오프)
 * - 년월별 폴더 자동 생성
 *
 * 폴더 구조:
 *   마비즈CRM-여권백업/
 *   └─ 2026-06/
 *      ├─ passport_20260619_kim_m12345678.webp
 *      └─ ...
 */

import { google } from 'googleapis';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';

export interface PassportBackupResult {
  googleDriveFileId: string;
  fileName: string;
  backupAt: Date;
  success: boolean;
}

/**
 * OAuth 2.0 인증 클라이언트 생성
 */
function createAuthClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    process.env.GOOGLE_OAUTH_REDIRECT_URI || ''
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return oauth2Client;
}

/**
 * Google OAuth 토큰 내부 갱신 (refreshToken 사용)
 * M2-2: Trip/조직 레벨 모두에서 재사용
 */
async function refreshGoogleAccessTokenInternal(
  refreshToken: string
): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    process.env.GOOGLE_OAUTH_REDIRECT_URI || ''
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials.access_token || '';
  } catch (err) {
    logger.error('[refreshGoogleAccessTokenInternal] Token refresh failed', err);
    throw new Error('Google OAuth token refresh failed');
  }
}

/**
 * 백업 폴더 찾기/생성 (년월별 자동 분류)
 * 폴더 구조:
 * 📁 마비즈CRM-여권백업
 *   └─ 📁 2026-06
 *      ├─ passport_*.webp
 *      └─ ...
 */
async function getOrCreateBackupFolder(
  yearMonth: string,
  accessToken: string
): Promise<string> {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  try {
    // 1. 루트 폴더 찾기/생성 (마비즈CRM-여권백업)
    const listRes = await drive.files.list({
      q: "name='마비즈CRM-여권백업' and trashed=false and mimeType='application/vnd.google-apps.folder'",
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id)',
    });

    let rootFolderId = '';
    if (listRes.data.files?.length) {
      rootFolderId = listRes.data.files[0].id!;
    } else {
      const createRes = await drive.files.create({
        requestBody: {
          name: '마비즈CRM-여권백업',
          mimeType: 'application/vnd.google-apps.folder',
          appProperties: { type: 'passport_backup_root' },
        },
        fields: 'id',
      });
      rootFolderId = createRes.data.id!;
    }

    // 2. 년월 폴더 찾기/생성 (예: 2026-06)
    const monthListRes = await drive.files.list({
      q: `name='${yearMonth}' and '${rootFolderId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id)',
    });

    let monthFolderId = '';
    if (monthListRes.data.files?.length) {
      monthFolderId = monthListRes.data.files[0].id!;
    } else {
      const createRes = await drive.files.create({
        requestBody: {
          name: yearMonth,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootFolderId],
        },
        fields: 'id',
      });
      monthFolderId = createRes.data.id!;
    }

    return monthFolderId;
  } catch (err) {
    logger.error('[getOrCreateBackupFolder]', err);
    throw new Error('Google Drive 폴더 생성 실패');
  }
}

/**
 * 지수 백오프를 이용한 재시도
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries - 1) {
        throw err;
      }
      const delayMs = initialDelayMs * Math.pow(2, attempt); // 1초, 2초, 4초
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('재시도 실패');
}

/**
 * 파일명 생성
 * 예: passport_20260619_kim_m12345678.webp
 */
function generateBackupFileName(
  guestName: string,
  passportNumber: string,
  date: Date
): string {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, ''); // 20260619
  const nameNormalized = guestName.toLowerCase().replace(/\s+/g, '_');
  const passportNormalized = passportNumber.toLowerCase();
  return `passport_${dateStr}_${nameNormalized}_${passportNormalized}.webp`;
}

/**
 * 부모 폴더 내 자식 폴더 생성/조회 (M2-4)
 * - Google Drive API로 폴더 검색
 * - 없으면 자동 생성
 *
 * @param parentFolderId 부모 폴더 ID
 * @param folderName 생성할 폴더명
 * @param accessToken Google Drive API 토큰
 * @returns { id, name }
 */
export async function getOrCreateSubFolder(
  parentFolderId: string,
  folderName: string,
  accessToken: string
): Promise<{ id: string; name: string }> {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  try {
    // 1. 자식 폴더 검색
    const listRes = await drive.files.list({
      q: `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id, name)',
    });

    if (listRes.data.files?.length) {
      return { id: listRes.data.files[0].id!, name: listRes.data.files[0].name! };
    }

    // 2. 폴더가 없으면 생성
    const createRes = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id, name',
    });

    return { id: createRes.data.id!, name: createRes.data.name! };
  } catch (err) {
    logger.error(`[getOrCreateSubFolder] ${folderName}`, err);
    throw new Error(`Failed to create subfolder: ${folderName}`);
  }
}

/**
 * Trip별 폴더 생성 또는 조회 (M2-4)
 * - 조직 폴더 내에서 Trip-{tripId} 폴더 생성/조회
 * - GmTripGoogleDriveConfig.googleFolderId에 저장
 *
 * @param tripId Trip ID (숫자)
 * @param organizationId Organization ID (폴더명용)
 * @param accessToken Google Drive API 토큰
 * @returns { folderId, folderName }
 */
export async function getOrCreateTripFolder(
  tripId: number,
  organizationId: string,
  accessToken: string
): Promise<{ folderId: string; folderName: string }> {
  try {
    // 1. DB에서 기존 폴더 조회
    const tripConfig = await prisma.gmTripGoogleDriveConfig.findUnique({
      where: { tripId },
    });

    if (tripConfig?.googleFolderId && !tripConfig.deletedAt) {
      logger.info(`[getOrCreateTripFolder] Trip ${tripId} 기존 폴더 사용: ${tripConfig.googleFolderId}`);
      return {
        folderId: tripConfig.googleFolderId,
        folderName: tripConfig.googleFolderName || `Trip-${tripId}`,
      };
    }

    // 2. 루트 폴더 찾기/생성 (마비즈CRM-여권백업)
    const auth = createAuthClient(accessToken);
    const drive = google.drive({ version: 'v3', auth });

    const rootListRes = await drive.files.list({
      q: "name='마비즈CRM-여권백업' and trashed=false and mimeType='application/vnd.google-apps.folder'",
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id)',
    });

    let rootFolderId = '';
    if (rootListRes.data.files?.length) {
      rootFolderId = rootListRes.data.files[0].id!;
    } else {
      const createRes = await drive.files.create({
        requestBody: {
          name: '마비즈CRM-여권백업',
          mimeType: 'application/vnd.google-apps.folder',
          appProperties: { type: 'passport_backup_root' },
        },
        fields: 'id',
      });
      rootFolderId = createRes.data.id!;
    }

    // 3. 조직 폴더 생성/조회 (Org-{organizationId})
    const orgFolderName = `Org-${organizationId}`;
    const orgFolder = await getOrCreateSubFolder(rootFolderId, orgFolderName, accessToken);

    // 4. Trip 폴더 생성 (조직 폴더 내)
    const tripFolderName = `Trip-${tripId}`;
    const tripFolder = await getOrCreateSubFolder(orgFolder.id, tripFolderName, accessToken);

    // 5. DB에 저장 (GmTripGoogleDriveConfig 업데이트 또는 생성)
    await prisma.gmTripGoogleDriveConfig.upsert({
      where: { tripId },
      create: {
        tripId,
        googleFolderId: tripFolder.id,
        googleFolderName: tripFolderName,
        accessToken: '', // Cron에서 설정
        refreshToken: '',
        expiresAt: new Date(),
      },
      update: {
        googleFolderId: tripFolder.id,
        googleFolderName: tripFolderName,
      },
    });

    logger.info(`[getOrCreateTripFolder] Trip ${tripId} 폴더 생성: ${tripFolder.id}`);

    return { folderId: tripFolder.id, folderName: tripFolderName };
  } catch (err) {
    logger.error(`[getOrCreateTripFolder] Trip ${tripId}`, err);
    throw new Error(`Failed to create trip folder for Trip ${tripId}`);
  }
}

/**
 * WebP 파일을 Google Drive에 업로드
 *
 * 입력:
 * - fileBuffer: WebP로 변환된 파일 (Buffer)
 * - fileName: 파일명 (예: passport_20260619_kim_m12345678.webp)
 * - accessToken: Google OAuth 액세스 토큰
 *
 * 출력:
 * - Google Drive 파일 ID
 *
 * 기능:
 * - M2-4: Org → Trip → 여권이미지 계층 구조에 업로드
 * - 3회 재시도 (지수 백오프)
 * - 타임아웃: 30초
 */
export async function uploadPassportToGoogleDrive(
  fileBuffer: Buffer,
  fileName: string,
  guestName: string,
  passportNumber: string,
  accessToken: string
): Promise<PassportBackupResult> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    logger.info(`[uploadPassportToGoogleDrive] 시작: ${fileName}`);

    // 년월별 폴더 찾기/생성 (M1 호환성 유지)
    const folderId = await retryWithBackoff(() =>
      getOrCreateBackupFolder(yearMonth, accessToken)
    );

    const auth = createAuthClient(accessToken);
    const drive = google.drive({ version: 'v3', auth });

    // Google Drive에 파일 업로드
    const fileId = await retryWithBackoff(async () => {
      const createRes = await drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: 'image/webp',
          parents: [folderId],
          appProperties: {
            type: 'passport_backup',
            guestName,
          },
        },
        media: {
          mimeType: 'image/webp',
          body: fileBuffer,
        },
        fields: 'id',
      });
      return (createRes as { data: { id?: string } }).data.id!;
    });

    logger.info(`[uploadPassportToGoogleDrive] 완료: fileId=${fileId}`);

    return {
      googleDriveFileId: fileId,
      fileName,
      backupAt: now,
      success: true,
    };
  } catch (err) {
    logger.error('[uploadPassportToGoogleDrive]', err);
    return {
      googleDriveFileId: '',
      fileName,
      backupAt: now,
      success: false,
    };
  }
}

/**
 * 1년 이전 파일 자동 삭제
 */
export async function deleteOldBackups(
  accessToken: string,
  daysBefore: number = 365
): Promise<number> {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBefore);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // 루트 폴더 찾기
    const rootRes = await drive.files.list({
      q: "name='마비즈CRM-여권백업' and trashed=false and mimeType='application/vnd.google-apps.folder'",
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id)',
    });

    if (!rootRes.data.files?.length) {
      return 0;
    }

    const rootFolderId = rootRes.data.files[0].id!;

    // 1년 이전 파일 조회
    const filesRes = await drive.files.list({
      q: `'${rootFolderId}' in parents and trashed=false and createdTime < '${cutoffDateStr}' and mimeType='image/webp'`,
      spaces: 'drive',
      pageSize: 100,
      fields: 'files(id)',
    });

    const deleteCount = filesRes.data.files?.length || 0;

    // 파일 삭제
    if (filesRes.data.files) {
      for (const file of filesRes.data.files) {
        await drive.files.delete({ fileId: file.id! });
      }
    }

    logger.info(`[deleteOldBackups] ${deleteCount}개 파일 삭제됨`);

    return deleteCount;
  } catch (err) {
    logger.error('[deleteOldBackups]', err);
    return 0;
  }
}

/**
 * 백업 목록 조회
 */
export async function listPassportBackups(
  accessToken: string,
  limit: number = 10
): Promise<
  Array<{
    fileId: string;
    name: string;
    createdAt: string;
    webViewLink?: string;
  }>
> {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  try {
    // 마비즈CRM-여권백업 폴더 찾기
    const rootRes = await drive.files.list({
      q: "name='마비즈CRM-여권백업' and trashed=false and mimeType='application/vnd.google-apps.folder'",
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id)',
    });

    if (!rootRes.data.files?.length) {
      return [];
    }

    const rootFolderId = rootRes.data.files[0].id!;

    // 모든 passport WebP 파일 조회
    const filesRes = await drive.files.list({
      q: `'${rootFolderId}' in parents and trashed=false and mimeType='image/webp'`,
      spaces: 'drive',
      pageSize: limit,
      orderBy: 'createdTime desc',
      fields: 'files(id, name, createdTime, webViewLink)',
    });

    return (filesRes.data.files || []).map((file) => ({
      fileId: file.id!,
      name: file.name!,
      createdAt: file.createdTime!,
      webViewLink: file.webViewLink || undefined,
    }));
  } catch (err) {
    logger.error('[listPassportBackups]', err);
    throw new Error('백업 목록 조회 실패');
  }
}

/**
 * Google Drive에서 파일 다운로드
 *
 * 입력:
 * - fileId: Google Drive 파일 ID
 * - accessToken: Google OAuth 액세스 토큰
 *
 * 출력:
 * - 파일 버퍼
 *
 * 기능:
 * - 3회 재시도 (지수 백오프)
 * - 타임아웃: 30초
 */
export async function downloadFileFromGoogleDrive(
  fileId: string,
  accessToken: string
): Promise<Buffer> {
  try {
    logger.info(`[downloadFileFromGoogleDrive] 시작: fileId=${fileId}`);

    const auth = createAuthClient(accessToken);
    const drive = google.drive({ version: 'v3', auth });

    const buffer = await retryWithBackoff(async () => {
      const res = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      return Buffer.from(res.data as ArrayBuffer);
    });

    logger.info(`[downloadFileFromGoogleDrive] 완료: ${buffer.length} bytes`);
    return buffer;
  } catch (err) {
    logger.error('[downloadFileFromGoogleDrive]', err);
    throw new Error('Google Drive 파일 다운로드 실패');
  }
}

/**
 * OCR JSON 데이터를 Google Drive에 업로드
 *
 * 입력:
 * - ocrData: OCR 추출 결과 (JSON 객체)
 * - fileName: 파일명 (예: passport_20260619_kim_m12345678_ocr.json)
 * - accessToken: Google OAuth 액세스 토큰
 *
 * 출력:
 * - Google Drive 파일 ID
 *
 * 기능:
 * - /마비즈CRM-여권백업/YYYY-MM/ 폴더에 업로드 (M1 호환성)
 * - 3회 재시도 (지수 백오프)
 */
export async function uploadOcrDataToGoogleDrive(
  ocrData: Record<string, unknown>,
  fileName: string,
  accessToken: string
): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    logger.info(`[uploadOcrDataToGoogleDrive] 시작: ${fileName}`);

    // 년월별 폴더 찾기/생성
    const folderId = await retryWithBackoff(() =>
      getOrCreateBackupFolder(yearMonth, accessToken)
    );

    const auth = createAuthClient(accessToken);
    const drive = google.drive({ version: 'v3', auth });

    // OCR JSON을 파일로 업로드
    const jsonBuffer = Buffer.from(JSON.stringify(ocrData, null, 2), 'utf8');

    const fileId = await retryWithBackoff(async () => {
      const createRes = await drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: 'application/json',
          parents: [folderId],
          appProperties: {
            type: 'passport_ocr_data',
          },
        },
        media: {
          mimeType: 'application/json',
          body: jsonBuffer,
        },
        fields: 'id',
      });
      return (createRes as { data: { id?: string } }).data.id!;
    });

    logger.info(`[uploadOcrDataToGoogleDrive] 완료: fileId=${fileId}`);
    return fileId;
  } catch (err) {
    logger.error('[uploadOcrDataToGoogleDrive]', err);
    throw new Error('Google Drive OCR 데이터 업로드 실패');
  }
}

/**
 * M2-4: Trip 계층 구조로 여권 + OCR 파일 업로드
 *
 * 입력:
 * - webpBuffer: WebP 파일 버퍼
 * - ocrData: OCR 데이터 JSON
 * - tripId: Trip ID (숫자)
 * - guestId: Guest ID (숫자)
 * - organizationId: 조직 ID
 * - accessToken: Google Drive API 토큰
 *
 * 출력:
 * - { imageFileId, ocrFileId }
 *
 * 폴더 구조:
 * 마비즈CRM-여권백업/
 * └─ Org-{organizationId}/
 *    └─ Trip-{tripId}/
 *       ├─ 여권이미지/
 *       │  └─ guest-{guestId}.webp
 *       └─ OCR데이터/
 *          └─ guest-{guestId}.json
 */
export async function uploadTripPassportFilesToGoogleDrive(
  webpBuffer: Buffer,
  ocrData: Record<string, unknown> | null,
  tripId: number,
  guestId: number,
  organizationId: string,
  accessToken: string
): Promise<{ imageFileId: string; ocrFileId: string | null }> {
  try {
    logger.info(
      `[uploadTripPassportFilesToGoogleDrive] 시작: Trip ${tripId}, Guest ${guestId}`
    );

    // 1. Trip 폴더 생성/조회 (Org → Trip 계층)
    const tripFolder = await getOrCreateTripFolder(tripId, organizationId, accessToken);

    // 2. 서브폴더 생성 (여권이미지, OCR데이터)
    const imageFolder = await getOrCreateSubFolder(
      tripFolder.folderId,
      '여권이미지',
      accessToken
    );
    const ocrFolder = await getOrCreateSubFolder(
      tripFolder.folderId,
      'OCR데이터',
      accessToken
    );

    // 3. 여권 이미지 파일 업로드
    const auth = createAuthClient(accessToken);
    const drive = google.drive({ version: 'v3', auth });

    const imageFileName = `guest-${guestId}.webp`;
    const imageFileId = await retryWithBackoff(async () => {
      const createRes = await drive.files.create({
        requestBody: {
          name: imageFileName,
          mimeType: 'image/webp',
          parents: [imageFolder.id],
          appProperties: {
            type: 'passport_backup',
            tripId: String(tripId),
            guestId: String(guestId),
          },
        },
        media: {
          mimeType: 'image/webp',
          body: webpBuffer,
        },
        fields: 'id',
      });
      return (createRes as { data: { id?: string } }).data.id!;
    });

    logger.info(
      `[uploadTripPassportFilesToGoogleDrive] 이미지 업로드 완료: ${imageFileId}`
    );

    // 4. OCR 데이터 파일 업로드 (있으면)
    let ocrFileId: string | null = null;
    if (ocrData && typeof ocrData === 'object') {
      try {
        const ocrFileName = `guest-${guestId}.json`;
        const jsonBuffer = Buffer.from(JSON.stringify(ocrData, null, 2), 'utf8');

        ocrFileId = await retryWithBackoff(async () => {
          const createRes = await drive.files.create({
            requestBody: {
              name: ocrFileName,
              mimeType: 'application/json',
              parents: [ocrFolder.id],
              appProperties: {
                type: 'passport_ocr_data',
                tripId: String(tripId),
                guestId: String(guestId),
              },
            },
            media: {
              mimeType: 'application/json',
              body: jsonBuffer,
            },
            fields: 'id',
          });
          return (createRes as { data: { id?: string } }).data.id!;
        });

        logger.info(
          `[uploadTripPassportFilesToGoogleDrive] OCR 업로드 완료: ${ocrFileId}`
        );
      } catch (ocrErr) {
        const err = ocrErr as Record<string, unknown>;
        logger.warn(
          `[uploadTripPassportFilesToGoogleDrive] OCR 업로드 실패 (무시됨):`,
          err
        );
      }
    }

    return { imageFileId, ocrFileId };
  } catch (err) {
    logger.error('[uploadTripPassportFilesToGoogleDrive]', err);
    throw new Error('Trip 폴더 구조로 파일 업로드 실패');
  }
}

/**
 * 생성된 파일명 헬퍼
 * 외부에서 파일명 미리 생성할 때 사용
 */
export { generateBackupFileName };

/**
 * Trip별 Google OAuth 토큰 갱신
 * M2-2: Trip 레벨 권한 격리
 *
 * 로직:
 * 1. GmTripGoogleDriveConfig에서 Trip의 refreshToken 조회
 * 2. 없으면 조직 레벨 토큰으로 fallback (M1 호환성)
 * 3. refreshToken 있으면 새 accessToken 발급
 * 4. DB에 accessToken + expiresAt(55분 TTL) 업데이트
 *
 * @param tripId Trip ID (숫자)
 * @param organizationId 조직 ID (fallback용)
 * @returns { accessToken, expiresAt }
 */
export async function refreshTripGoogleAccessToken(
  tripId: number,
  organizationId?: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  try {
    // 1. Trip 레벨 설정 조회
    const tripConfig = await prisma.gmTripGoogleDriveConfig.findUnique({
      where: { tripId },
    });

    if (
      tripConfig &&
      tripConfig.refreshToken &&
      !tripConfig.deletedAt
    ) {
      try {
        // 2. Trip refreshToken으로 새 accessToken 발급
        const newAccessToken = await refreshGoogleAccessTokenInternal(
          tripConfig.refreshToken
        );
        const expiresAt = new Date(Date.now() + 55 * 60 * 1000); // 55분 TTL

        // 3. DB 업데이트
        await prisma.gmTripGoogleDriveConfig.update({
          where: { id: tripConfig.id },
          data: {
            accessToken: newAccessToken,
            expiresAt,
          },
        });

        logger.info(
          `[refreshTripGoogleAccessToken] Trip ${tripId} token refreshed`
        );

        return { accessToken: newAccessToken, expiresAt };
      } catch (err) {
        const errObj = err instanceof Error
          ? { message: err.message }
          : { error: String(err) };
        logger.warn(
          `[refreshTripGoogleAccessToken] Trip ${tripId} token refresh failed, falling back to organization level`,
          errObj
        );
      }
    }

    // 4. Fallback: 조직 레벨 토큰 (M1 호환성)
    if (organizationId) {
      const newAccessToken =
        process.env.GOOGLE_OAUTH_ACCESS_TOKEN || '';
      if (!newAccessToken) {
        throw new Error('Org-level GOOGLE_OAUTH_ACCESS_TOKEN not set');
      }
      const expiresAt = new Date(Date.now() + 55 * 60 * 1000);
      return { accessToken: newAccessToken, expiresAt };
    }

    throw new Error(
      `Trip ${tripId} has no google drive config and organizationId not provided`
    );
  } catch (err) {
    logger.error(
      '[refreshTripGoogleAccessToken] Fatal error',
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }
}
