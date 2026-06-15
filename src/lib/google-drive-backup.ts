/**
 * Google Drive Contact 백업 라이브러리
 * - OAuth 2.0 기반 사용자 Google Drive로 Contact 백업
 * - Google Sheets 자동 생성 및 CSV 형식 저장
 * - 년월별 폴더 구조 자동화
 *
 * 폴더 구조:
 *   마비즈CRM-Backup/
 *   └─ 2026-06/
 *      ├─ Contact_2026-06-14.csv
 *      └─ ...
 */

import { google } from 'googleapis';
import { logger } from '@/lib/logger';

export interface BackupResult {
  sheetId: string;
  folderId: string;
  backupAt: Date;
  count: number;
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
 * 백업 폴더 찾기/생성 (년월별 자동 분류)
 * 폴더 구조:
 * 📁 마비즈CRM-Backup
 *   └─ 📁 2026-06
 *      ├─ 📊 Contact_2026-06-15.csv
 *      └─ ...
 */
export async function getOrCreateBackupFolder(
  organizationId: string,
  yearMonth: string,
  accessToken: string
): Promise<string> {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  try {
    // 1. 루트 폴더 찾기/생성 (마비즈CRM-Backup)
    const listRes = await drive.files.list({
      q: "name='마비즈CRM-Backup' and trashed=false and mimeType='application/vnd.google-apps.folder'",
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
          name: '마비즈CRM-Backup',
          mimeType: 'application/vnd.google-apps.folder',
          appProperties: { type: 'backup_root', organizationId },
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
 * Google Sheet 생성
 */
export async function createBackupSheet(
  folderId: string,
  sheetName: string,
  accessToken: string
): Promise<string> {
  const auth = createAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  try {
    const createRes = await drive.files.create({
      requestBody: {
        name: sheetName,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: [folderId],
      },
      fields: 'id,webViewLink',
    });

    return createRes.data.id!;
  } catch (err) {
    logger.error('[createBackupSheet]', err);
    throw new Error('Google Sheet 생성 실패');
  }
}

/**
 * Contact 데이터를 Google Sheet에 입력
 * 헤더: ID, 이름, 연락처, 이메일, 출처, 공개범위, 등록일
 */
export async function populateSheetData(
  sheetId: string,
  contacts: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    sourceId?: string | null;
    visibility?: string;
    createdAt?: Date;
  }>,
  accessToken: string
): Promise<void> {
  const auth = createAuthClient(accessToken);
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // 헤더 + 데이터 구성
    const headers = ['ID', '이름', '연락처', '이메일', '출처', '공개범위', '등록일'];
    const rows = [
      headers,
      ...contacts.map((c) => [
        c.id,
        c.name || '',
        c.phone || '',
        c.email || '',
        c.sourceId || 'UNKNOWN',
        c.visibility || 'SHARED',
        c.createdAt ? c.createdAt.toISOString().split('T')[0] : '',
      ]),
    ];

    // Sheet에 데이터 입력
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });

    logger.info(`[populateSheetData] ${contacts.length}개 행 입력됨`);
  } catch (err) {
    logger.error('[populateSheetData]', err);
    throw new Error('Sheet 데이터 입력 실패');
  }
}

/**
 * Contact 백업 메인 함수
 * - 년월별 폴더 자동 생성
 * - Google Sheet 생성 및 데이터 입력
 * - 백업 메타데이터 반환
 */
export async function backupContactsToDrive(
  organizationId: string,
  contacts: Array<{
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    sourceId?: string | null;
    visibility?: string;
    createdAt?: Date;
  }>,
  accessToken: string
): Promise<BackupResult> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dateStr = now.toISOString().split('T')[0];

  try {
    logger.info(`[backupContactsToDrive] 시작: organizationId=${organizationId}, count=${contacts.length}`);

    // 1. 년월별 폴더 찾기/생성
    const folderId = await getOrCreateBackupFolder(organizationId, yearMonth, accessToken);

    // 2. Google Sheet 생성
    const sheetId = await createBackupSheet(folderId, `Contact_${dateStr}`, accessToken);

    // 3. 데이터 입력
    await populateSheetData(sheetId, contacts, accessToken);

    logger.info(`[backupContactsToDrive] 완료: sheetId=${sheetId}`);

    return {
      sheetId,
      folderId,
      backupAt: now,
      count: contacts.length,
    };
  } catch (err) {
    logger.error('[backupContactsToDrive]', err);
    throw err;
  }
}

/**
 * 백업 목록 조회
 */
export async function listBackups(
  organizationId: string,
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
    // 마비즈CRM-Backup 폴더 찾기
    const rootRes = await drive.files.list({
      q: "name='마비즈CRM-Backup' and trashed=false and mimeType='application/vnd.google-apps.folder'",
      spaces: 'drive',
      pageSize: 1,
      fields: 'files(id)',
    });

    if (!rootRes.data.files?.length) {
      return [];
    }

    const rootFolderId = rootRes.data.files[0].id!;

    // 모든 Contact CSV 파일 조회
    const filesRes = await drive.files.list({
      q: `name contains 'Contact_' and trashed=false and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet'`,
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
    logger.error('[listBackups]', err);
    throw new Error('백업 목록 조회 실패');
  }
}
