// app/api/admin/mall/upload/route.ts
// 관리자 상품 이미지 업로드 — Sharp WebP 변환 → Google Drive 저장 → proxy URL 반환

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import { uploadFileToDrive } from '@/lib/google-drive';
import { getDriveFolderId } from '@/lib/config/drive-config';
import { logger } from '@/lib/logger';
import sharp from 'sharp';
import { validateImageMagicBytes } from '@/lib/file-validation';
import { WEBP_CONFIG } from '@/lib/image-optimize';
import { validateCsrfAndRespond } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(req: NextRequest) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
    }

    const csrfCheck = validateCsrfAndRespond(req, 'Admin Mall Upload');
    if (!csrfCheck.valid) return csrfCheck.response!;

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: '파일을 찾을 수 없습니다.' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ ok: false, error: '파일은 비어있을 수 없습니다.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ ok: false, error: `파일 크기는 ${MAX_FILE_SIZE_MB}MB 이하여야 합니다.` }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ ok: false, error: '지원하는 이미지 형식: JPG, PNG, WebP, GIF' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 매직 바이트 검증 (MIME 타입 스푸핑 방지)
    const validation = await validateImageMagicBytes(buffer, file.type);
    if (!validation.valid) {
      return NextResponse.json({ ok: false, error: validation.error || '유효하지 않은 이미지 파일입니다.' }, { status: 400 });
    }

    const isGif = validation.actualFormat === 'gif';

    // WebP 변환 (GIF는 애니메이션 보존을 위해 원본 유지)
    let uploadBuffer: Buffer;
    let uploadMimeType: string;
    let uploadFileName: string;

    if (isGif) {
      uploadBuffer = buffer;
      uploadMimeType = 'image/gif';
      uploadFileName = file.name;
    } else {
      uploadBuffer = await sharp(buffer).webp(WEBP_CONFIG).toBuffer();
      uploadMimeType = 'image/webp';
      uploadFileName = file.name.replace(/\.[^.]+$/, '.webp');
    }

    // Google Drive UPLOADS_IMAGES 폴더에 저장 (어디서든 로그인 후 접근 가능)
    const folderId = await getDriveFolderId('UPLOADS_IMAGES');
    const result = await uploadFileToDrive({
      folderId,
      fileName: uploadFileName,
      mimeType: uploadMimeType,
      buffer: uploadBuffer,
    });

    if (!result.ok || !result.fileId) {
      logger.error('[Admin Upload] Drive upload failed:', { error: result.error, fileName: file.name });
      return NextResponse.json({ ok: false, error: result.error || 'Drive 업로드 실패' }, { status: 500 });
    }

    const proxyUrl = `/api/public/image-proxy?fileId=${result.fileId}`;
    logger.log('[Admin Upload] Success:', { fileName: uploadFileName, fileId: result.fileId });

    return NextResponse.json({ ok: true, url: proxyUrl, fileName: uploadFileName });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[Admin Mall Upload] Error:', { message: msg });
    return NextResponse.json({ ok: false, error: '업로드 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
