/**
 * 엑셀 가져오기 파일 Drive 백업
 * - fire-and-forget: 실패해도 무시
 * - 경로: CRM백업/{orgName}/엑셀업로드/{YYYY-MM-DD}_{target}_{hhmm}.xlsx
 */
import { getDriveClient, findOrCreateFolder } from '@/lib/drive-client';
import { logger } from '@/lib/logger';

/**
 * 엑셀 파일을 Google Drive에 백업
 * - fire-and-forget (null 반환)
 * - 실패해도 에러 로깅만 하고 진행
 */
export async function backupImportFileToDrive(params: {
  orgName: string;
  buffer: Buffer;
  target: 'b2c' | 'b2c_purchased' | 'b2b_buyer' | 'b2b_inquiry';
}): Promise<null> {
  try {
    const { orgName, buffer, target } = params;
    const drive = getDriveClient();

    const backupRootId = process.env.GOOGLE_DRIVE_CRM_BACKUP_FOLDER_ID;
    if (!backupRootId) {
      logger.warn('[importBackup] GOOGLE_DRIVE_CRM_BACKUP_FOLDER_ID 미설정');
      return null;
    }

    // 1. CRM백업/{orgName}/엑셀업로드 폴더 구조 생성
    const orgFolderId = await findOrCreateFolder(orgName, backupRootId);
    const importFolderId = await findOrCreateFolder('엑셀업로드', orgFolderId);

    // 2. 파일명 생성: {YYYY-MM-DD}_{target}_{hhmm}.xlsx
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toISOString().split('T')[1].slice(0, 5).replace(':', ''); // hhmm
    const fileName = `${dateStr}_${target}_${timeStr}.xlsx`;

    // 3. 파일 업로드
    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [importFolderId],
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: buffer,
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    logger.log(`[importBackup] ${orgName}/${target} 백업 완료: ${fileName}`);
  } catch (err) {
    logger.error(`[importBackup] 백업 실패:`, { err: String(err) });
  }

  return null;
}
