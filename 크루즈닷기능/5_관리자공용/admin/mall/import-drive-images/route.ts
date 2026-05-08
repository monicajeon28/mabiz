// app/api/admin/mall/import-drive-images/route.ts
// Drive fileId[] → 서버 직접 다운로드 → Sharp WebP → Drive 저장 → proxy URL 반환 (단일 왕복)

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { getDriveClient, uploadFileToDrive } from '@/lib/google-drive';
import { getDriveFolderId } from '@/lib/config/drive-config';
import { validateCsrfAndRespond } from '@/lib/api-utils';
import { validateImageMagicBytes } from '@/lib/file-validation';
import { WEBP_CONFIG } from '@/lib/image-optimize';
import { logger } from '@/lib/logger';
import sharp from 'sharp';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DRIVE_FILE_ID_PATTERN = /^[a-zA-Z0-9_\-]{20,50}$/;
const MAX_BATCH_SIZE = 30;

const importSchema = z.object({
  fileIds: z
    .array(z.string().regex(DRIVE_FILE_ID_PATTERN, 'Invalid fileId format'))
    .min(1)
    .max(MAX_BATCH_SIZE),
  category: z.string().min(1).max(100),
  productCode: z.string().optional(),
});

async function processSingleFile(
  fileId: string,
  productsFolderId: string,
): Promise<{ fileId: string; ok: boolean; url?: string; error?: string }> {
  try {
    const drive = getDriveClient();

    // 메타데이터 + 파일 내용 병렬 요청
    const [meta, content] = await Promise.all([
      drive.files.get(
        { fileId, fields: 'name,mimeType,size', supportsAllDrives: true } as any,
      ),
      drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true } as any,
        { responseType: 'arraybuffer' },
      ),
    ]);

    const fileName = (meta.data as any).name ?? `image-${fileId.slice(0, 8)}.jpg`;
    const mimeType = (meta.data as any).mimeType ?? 'image/jpeg';
    const buffer = Buffer.from(content.data as ArrayBuffer);

    // 매직 바이트 검증
    const validation = await validateImageMagicBytes(buffer, mimeType);
    if (!validation.valid) {
      return { fileId, ok: false, error: `유효하지 않은 이미지: ${validation.error}` };
    }

    const isGif = validation.actualFormat === 'gif';

    // Sharp WebP 변환 (GIF는 원본 유지)
    let uploadBuffer: Buffer;
    let uploadMimeType: string;
    let uploadFileName: string;

    if (isGif) {
      uploadBuffer = buffer;
      uploadMimeType = 'image/gif';
      uploadFileName = fileName;
    } else {
      uploadBuffer = await sharp(buffer).webp(WEBP_CONFIG).toBuffer();
      uploadMimeType = 'image/webp';
      uploadFileName = fileName.replace(/\.[^.]+$/, '.webp');
    }

    // Google Drive PRODUCTS 폴더에 저장
    const result = await uploadFileToDrive({
      folderId: productsFolderId,
      fileName: uploadFileName,
      mimeType: uploadMimeType,
      buffer: uploadBuffer,
    });

    if (!result.ok || !result.fileId) {
      return { fileId, ok: false, error: result.error ?? 'Drive 업로드 실패' };
    }

    // 프록시 URL 반환 — 어디서든 로그인 후 접근 가능
    const proxyUrl = `/api/public/image-proxy?fileId=${result.fileId}`;
    return { fileId, ok: true, url: proxyUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[DriveImport] Failed:', { fileId: fileId.slice(0, 10), error: msg });
    return { fileId, ok: false, error: '처리 실패' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
    }

    const csrfCheck = validateCsrfAndRespond(req, 'Import Drive Images');
    if (!csrfCheck.valid) return csrfCheck.response!;

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: '요청 본문이 없습니다.' }, { status: 400 });
    }

    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? '잘못된 요청 형식' },
        { status: 400 },
      );
    }

    const { fileIds } = parsed.data;

    // PRODUCTS 폴더 ID 조회 (DB 캐시 5분)
    const productsFolderId = await getDriveFolderId('PRODUCTS');

    // 모든 파일 병렬 처리
    const results = await Promise.all(
      fileIds.map(fileId => processSingleFile(fileId, productsFolderId)),
    );

    const succeeded = results.filter(r => r.ok).length;
    const safeResults = results.map(({ ok, url, error }) => ({ ok, url, error }));
    return NextResponse.json({ ok: true, results: safeResults, succeeded, total: fileIds.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[DriveImport] Unexpected error:', { error: msg });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
