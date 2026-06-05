/**
 * 파트너 계약 서류(신분증·통장) Google Drive 업로드 헬퍼
 *
 * 신분증/통장은 민감정보이므로:
 * - 비공개 폴더에 업로드 (anyone 권한 부여 금지)
 * - 열람은 GLOBAL_ADMIN 인증 프록시(/api/affiliate/contracts/[id]/document)로만
 * - DB(metadata)에는 base64 대신 Drive fileId만 저장
 */

import { Readable } from 'stream';
import { getDriveClient, findOrCreateFolder } from '@/lib/drive-client';
import { logger } from '@/lib/logger';

function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string; ext: string } | null {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length === 0) return null;
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
  return { buffer, mime, ext };
}

/**
 * base64 dataURL 서류를 비공개 Drive 폴더에 업로드하고 fileId를 반환.
 * dataURL이 아니거나 업로드 실패 시 null (호출부가 base64 폴백 유지).
 */
export async function uploadContractDocToDrive(dataUrl: string, baseName: string): Promise<string | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  const explicit = process.env.AFFILIATE_DOCS_DRIVE_FOLDER_ID;
  const root = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!explicit && !root) {
    logger.warn('[contract-docs] Drive 폴더 환경변수 미설정 — 업로드 건너뜀');
    return null;
  }

  try {
    const drive = getDriveClient();
    // 전용 폴더가 지정되면 그대로, 아니면 루트 아래 "파트너서류" 비공개 폴더
    const folderId = explicit ?? (await findOrCreateFolder('파트너서류', root!));

    const file = await drive.files.create(
      {
        requestBody: { name: `${baseName}.${parsed.ext}`, parents: [folderId] },
        media: { mimeType: parsed.mime, body: Readable.from(parsed.buffer) },
        fields: 'id',
        supportsAllDrives: true,
      },
      { timeout: 120_000 },
    );
    // 민감정보 — anyone 권한 부여하지 않음 (서비스계정 프록시로만 열람)
    return file.data.id ?? null;
  } catch (err) {
    logger.error('[contract-docs] Drive 업로드 실패', { err, baseName });
    return null;
  }
}
