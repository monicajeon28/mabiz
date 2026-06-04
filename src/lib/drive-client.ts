/**
 * Google Drive 클라이언트 싱글톤
 * - getDriveClient(): 서비스 계정 기반 Drive API 클라이언트
 * - findOrCreateFolder(): 폴더 찾기 또는 생성 (중복 제거)
 */
import { google } from 'googleapis';

let driveClientInstance: ReturnType<typeof google.drive> | null = null;

/**
 * Google Drive API 클라이언트 싱글톤
 */
export function getDriveClient() {
  if (driveClientInstance) {
    return driveClientInstance;
  }

  // GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY (전체 JSON) 우선, 없으면 개별 키 조합
  const serviceAccountKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  const credentials = serviceAccountKey
    ? JSON.parse(serviceAccountKey)
    : {
        client_email: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (
          process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY ??
          process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? ''
        ).replace(/\\n/g, '\n'),
      };

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  driveClientInstance = google.drive({ version: 'v3', auth });
  return driveClientInstance;
}

/**
 * 폴더 찾기 (없으면 생성)
 * - 중복 폴더 방지
 */
export async function findOrCreateFolder(
  name: string,
  parentId: string
): Promise<string> {
  const drive = getDriveClient();

  // 기존 폴더 탐색
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  // 없으면 생성
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  return created.data.id!;
}
