// lib/google-drive-company-logo.ts
// 회사 로고를 Google Drive에 저장하는 유틸리티

import { uploadFileToDrive, findOrCreateFolder } from '../google-drive';
import { logger } from '@/lib/logger';

/**
 * 회사 로고를 Google Drive에 업로드
 * @param fileBuffer - 파일 버퍼
 * @param fileName - 파일명
 * @param mimeType - MIME 타입
 * @returns Google Drive URL 또는 에러
 */
export async function uploadCompanyLogo(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string = 'image/jpeg'
): Promise<{ ok: boolean; url?: string; fileId?: string; error?: string }> {
  try {
    const companyLogoFolderId = process.env.GOOGLE_DRIVE_COMPANY_LOGO_FOLDER_ID;

    if (!companyLogoFolderId) {
      return {
        ok: false,
        error: 'GOOGLE_DRIVE_COMPANY_LOGO_FOLDER_ID가 설정되지 않았습니다.',
      };
    }

    // Google Drive에 업로드
    const uploadResult = await uploadFileToDrive({
      folderId: companyLogoFolderId,
      fileName: fileName,
      mimeType: mimeType,
      buffer: fileBuffer,
      makePublic: true, // 공개 링크로 제공
    });

    if (uploadResult.ok && uploadResult.url) {
      return {
        ok: true,
        url: uploadResult.url,
        fileId: uploadResult.fileId,
      };
    } else {
      return {
        ok: false,
        error: uploadResult.error || '회사 로고 업로드 실패',
      };
    }
  } catch (error: any) {
    logger.error('[Company Logo Upload] Error:', error);
    return {
      ok: false,
      error: error?.message || '회사 로고 업로드 중 오류가 발생했습니다.',
    };
  }
}
