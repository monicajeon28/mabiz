/**
 * Google Drive 클라이언트 싱글톤
 * - getDriveClient(): 서비스 계정 기반 Drive API 클라이언트
 * - findOrCreateFolder(): 폴더 찾기 또는 생성 (중복 제거)
 */
import { google } from 'googleapis';
import { Readable } from 'stream';
import { parseServiceAccount } from './parse-service-account';

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
    ? parseServiceAccount(serviceAccountKey)
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

/**
 * 파일 찾기 (이름 + 부모 폴더 기준)
 * - 없으면 null 반환
 */
export async function findFile(
  name: string,
  parentId: string
): Promise<string | null> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * xlsx 멱등 업로드
 * - existingFileId 가 있으면 해당 파일을 덮어쓰되, 404면 신규 생성으로 self-heal
 * - existingFileId 가 없으면 findFile 로 동일 이름 탐색 → 있으면 update, 없으면 create
 * - 항상 supportsAllDrives:true
 */
export async function uploadXlsxIdempotent(
  buf: Buffer,
  fileName: string,
  parentId: string,
  existingFileId?: string | null
): Promise<{ fileId: string; viewUrl: string }> {
  const drive = getDriveClient();

  const create = async (): Promise<string> => {
    const created = await drive.files.create({
      requestBody: { name: fileName, parents: [parentId] },
      media: { mimeType: XLSX_MIME, body: Readable.from(buf) },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    fileId = created.data.id!;
    viewUrl = created.data.webViewLink ?? '';
    return fileId;
  };

  const update = async (id: string): Promise<string> => {
    const updated = await drive.files.update({
      fileId: id,
      media: { mimeType: XLSX_MIME, body: Readable.from(buf) },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    fileId = updated.data.id!;
    viewUrl = updated.data.webViewLink ?? '';
    return fileId;
  };

  let fileId = '';
  let viewUrl = '';

  if (existingFileId) {
    try {
      await update(existingFileId);
    } catch (err) {
      // 404 → 파일이 삭제됨: 신규 생성으로 self-heal
      const status =
        (err as { code?: number; status?: number })?.code ??
        (err as { code?: number; status?: number })?.status;
      if (status === 404) {
        await create();
      } else {
        throw err;
      }
    }
  } else {
    const found = await findFile(fileName, parentId);
    if (found) {
      await update(found);
    } else {
      await create();
    }
  }

  return {
    fileId,
    viewUrl: viewUrl || `https://drive.google.com/file/d/${fileId}/view`,
  };
}

/**
 * 폴더 내 MD 파일 목록 조회 (최신순)
 * - 마지막 동기화 이후 새 파일만 가져오기 지원
 */
export async function listMdFilesInFolder(
  folderId: string,
  afterDate?: Date
): Promise<Array<{ id: string; name: string; createdTime: string; modifiedTime: string }>> {
  const drive = getDriveClient();

  let q = `'${folderId}' in parents and mimeType='text/markdown' and trashed=false`;
  if (afterDate) {
    q += ` and modifiedTime > '${afterDate.toISOString()}'`;
  }

  const res = await drive.files.list({
    q,
    fields: 'files(id, name, createdTime, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 100,
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  return (res.data.files ?? []) as Array<{ id: string; name: string; createdTime: string; modifiedTime: string }>;
}

/**
 * Drive 파일 내용 읽기 (텍스트 파일용)
 */
export async function readDriveFileContent(fileId: string): Promise<string> {
  const drive = getDriveClient();

  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'text' }
  );

  return (res.data as unknown as string) ?? '';
}

/**
 * 폴더 내 하위 폴더 목록 조회
 */
export async function listSubFolders(
  parentId: string
): Promise<Array<{ id: string; name: string }>> {
  const drive = getDriveClient();

  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  return (res.data.files ?? []) as Array<{ id: string; name: string }>;
}
