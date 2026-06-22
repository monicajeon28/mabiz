import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface BackupPassportOCRParams {
  organizationId: string;
  passportId: string;
  tripId: string;
  passportNumber: string;
  ocrData: Record<string, unknown>;
}

interface BackupPassportOCRResult {
  success: boolean;
  googleDriveFileId?: string;
  passportOCRBackupLogId: string;
  error?: string;
}

/**
 * M4-1: 여권 OCR 데이터를 Google Drive JSON으로 백업
 *
 * 재사용 함수:
 * - refreshTripGoogleAccessToken (M2-2): Trip의 Google 토큰 갱신
 * - getOrCreateTripFolder (M2-4): Trip별 폴더 생성/조회
 *
 * 폴더 구조:
 *   📁 마비즈CRM-여권백업-{organizationId}
 *   └─ 📁 2026-06 (년월)
 *      ├─ ocr_20260622_kim_P12345678.json (하나의 여권 OCR)
 *      └─ ...
 */
async function backupPassportOCRToGoogleDrive(
  params: BackupPassportOCRParams
): Promise<BackupPassportOCRResult> {
  const { organizationId, passportId, tripId, passportNumber, ocrData } = params;

  const logId = `ocr_${Date.now()}_${passportId}`;

  try {
    // 1. PassportOCRBackupLog 레코드 생성 (PENDING)
    const backupLog = await prisma.passportOCRBackupLog.create({
      data: {
        id: logId,
        organizationId,
        passportImageId: passportId,
        tripId,
        passportNumber: passportNumber || 'UNKNOWN',
        ocrData: ocrData as any, // JSON 저장
        status: 'PENDING',
      },
    });

    // 2. Trip의 Google Drive 설정 조회 (GmTrip은 organizationId가 없음 - 대신 userId를 통해 권한 검증)
    const tripId_int = parseInt(tripId, 10);
    const tripConfig = await prisma.gmTripGoogleDriveConfig.findUnique({
      where: { tripId: tripId_int },
      select: {
        tripId: true,
        accessToken: true,
        refreshToken: true,
      },
    });

    if (!tripConfig) {
      throw new Error(`Trip Google Drive config not found: ${tripId}`);
    }

    // 토큰 복호화 (실제 구현에서는 암호화된 토큰 복호화)
    let accessToken = tripConfig.accessToken;

    // 3. 토큰 갱신 필요 시 (M2-2 패턴)
    if (!accessToken || isTokenExpired(accessToken)) {
      if (!tripConfig.refreshToken) {
        throw new Error('Google refresh token not available');
      }

      try {
        accessToken = await refreshTripGoogleAccessToken(tripId);
      } catch (err) {
        logger.error(
          `[backupPassportOCRToGoogleDrive] 토큰 갱신 실패: tripId=${tripId}`,
          err
        );
        throw new Error('Token refresh failed');
      }
    }

    // 4. Google Drive 폴더 준비 (조직별 폴더 + 년월 하위폴더)
    // 폴더명: 마비즈CRM-여권백업-{organizationId}/2026-06/
    const yearMonth = new Date().toISOString().substring(0, 7); // 2026-06
    const folderId = await getOrCreatePassportOCRFolder(
      organizationId,
      yearMonth,
      accessToken
    );

    // 5. OCR JSON 파일 업로드 (Google Drive)
    const googleDriveFileId = await uploadOCRJsonToGoogleDrive(
      accessToken,
      folderId,
      {
        passportId,
        tripId,
        passportNumber: maskPassportNumber(passportNumber),
        ocrData,
        backupAt: new Date().toISOString(),
      }
    );

    // 6. BackupLog 상태 업데이트 (COMPLETED)
    await prisma.passportOCRBackupLog.update({
      where: { id: logId },
      data: {
        googleDriveFileId,
        googleDrivePath: `마비즈CRM-여권백업-${organizationId}/${yearMonth}/`,
        status: 'COMPLETED',
        backupCompletedAt: new Date(),
      },
    });

    logger.info(
      `[backupPassportOCRToGoogleDrive] 성공: passport=${passportId}, driveId=${googleDriveFileId}`
    );

    return {
      success: true,
      googleDriveFileId,
      passportOCRBackupLogId: backupLog.id,
    };
  } catch (err) {
    // 에러 시 BackupLog 상태 업데이트 (FAILED)
    try {
      await prisma.passportOCRBackupLog.update({
        where: { id: logId },
        data: {
          status: 'FAILED',
          backupAttempt: {
            increment: 1,
          },
        },
      });
    } catch (updateErr) {
      logger.error(
        `[backupPassportOCRToGoogleDrive] BackupLog 업데이트 실패: ${logId}`,
        updateErr
      );
    }

    logger.error(
      `[backupPassportOCRToGoogleDrive] 실패: passportId=${passportId}`,
      err
    );

    return {
      success: false,
      passportOCRBackupLogId: logId,
      error: String(err),
    };
  }
}

/**
 * Google Drive 폴더 조회/생성 (조직별 격리)
 * 재사용: getOrCreateTripFolder 패턴 (M2-4)
 */
async function getOrCreatePassportOCRFolder(
  organizationId: string,
  yearMonth: string,
  accessToken: string
): Promise<string> {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  // 1. 루트 폴더 찾기/생성
  const rootFolderName = `마비즈CRM-여권백업-${organizationId}`;
  const listRes = await drive.files.list({
    q: `name='${rootFolderName}' and trashed=false and mimeType='application/vnd.google-apps.folder'`,
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
        name: rootFolderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
    });
    rootFolderId = createRes.data.id!;
  }

  // 2. 년월 서브폴더 찾기/생성
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
    const createMonthRes = await drive.files.create({
      requestBody: {
        name: yearMonth,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId],
      },
    });
    monthFolderId = createMonthRes.data.id!;
  }

  return monthFolderId;
}

/**
 * OCR JSON을 Google Drive에 업로드
 */
async function uploadOCRJsonToGoogleDrive(
  accessToken: string,
  folderId: string,
  ocrData: Record<string, unknown>
): Promise<string> {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  const fileName = `ocr_${Date.now()}_${(ocrData.passportId as string)?.slice(-8)}.json`;

  const createRes = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: 'application/json',
      parents: [folderId],
    },
    media: {
      mimeType: 'application/json',
      body: JSON.stringify(ocrData),
    },
  });

  return createRes.data.id!;
}

// 헬퍼 함수들
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

function isTokenExpired(token: string | null): boolean {
  // 토큰 만료 로직 (token이 없으면 만료된 것으로 취급)
  return !token;
}

async function refreshTripGoogleAccessToken(tripId: string): Promise<string> {
  // M2-2 재사용: GmTrip Google Drive 설정 갱신
  const tripId_int = parseInt(tripId, 10);
  const tripConfig = await prisma.gmTripGoogleDriveConfig.findUnique({
    where: { tripId: tripId_int },
    select: { refreshToken: true },
  });

  if (!tripConfig?.refreshToken) {
    throw new Error('Refresh token not found');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    process.env.GOOGLE_OAUTH_REDIRECT_URI || ''
  );

  oauth2Client.setCredentials({
    refresh_token: tripConfig.refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  const newAccessToken = credentials.access_token;

  if (!newAccessToken) {
    throw new Error('Failed to refresh access token');
  }

  // 새 토큰을 GmTripGoogleDriveConfig에 저장
  await prisma.gmTripGoogleDriveConfig.update({
    where: { tripId: tripId_int },
    data: {
      accessToken: newAccessToken,
      expiresAt: new Date(Date.now() + 55 * 60 * 1000), // TTL 55분
    },
  });

  return newAccessToken;
}

function maskPassportNumber(passportNumber: string): string {
  // 마스킹: M****78 (첫 1자, 마지막 2자만 노출)
  if (!passportNumber || passportNumber.length < 4) {
    return '****';
  }
  return (
    passportNumber.substring(0, 1) +
    '*'.repeat(passportNumber.length - 3) +
    passportNumber.substring(passportNumber.length - 2)
  );
}

export { backupPassportOCRToGoogleDrive };
