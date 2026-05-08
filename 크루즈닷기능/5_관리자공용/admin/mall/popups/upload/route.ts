export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { checkAdminAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { validateCsrfAndRespond } from '@/lib/api-utils';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * 매직바이트로 실제 이미지 타입 검증
 * MIME 타입 스푸핑 방지
 */
function validateMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 &&
    buffer[2] === 0x4E && buffer[3] === 0x47
  ) return true;

  // GIF: 47 49 46 38
  if (
    buffer[0] === 0x47 && buffer[1] === 0x49 &&
    buffer[2] === 0x46 && buffer[3] === 0x38
  ) return true;

  // WebP: 52 49 46 46 __ __ __ __ 57 45 42 50
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 &&
    buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 &&
    buffer[10] === 0x42 && buffer[11] === 0x50
  ) return true;

  return false;
}

export async function POST(req: NextRequest) {
  try {
    // CSRF 검증 (상태 변경 요청 보호)
    const csrf = validateCsrfAndRespond(req, 'Popup Upload');
    if (!csrf.valid) return csrf.response!;

    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: '관리자만 업로드 가능합니다.' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: '파일이 없습니다.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ ok: false, error: 'JPG, PNG, WebP, GIF만 업로드 가능합니다.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: '파일 크기는 5MB 이하여야 합니다.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 매직바이트 검증 (MIME 타입 스푸핑 방지)
    if (!validateMagicBytes(buffer)) {
      return NextResponse.json({ ok: false, error: '허용되지 않는 파일 형식' }, { status: 400 });
    }

    const ext = extname(file.name).toLowerCase() || '.jpg';
    const filename = `popup_${Date.now()}${ext}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'images');

    // 디렉토리 없으면 생성
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), buffer);

    const imageUrl = `/uploads/images/${filename}`;
    logger.log('[Popup Upload] 이미지 업로드 완료:', { filename, size: file.size });

    return NextResponse.json({ ok: true, imageUrl });
  } catch (error: unknown) {
    logger.error('[Popup Upload] 오류:', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: '업로드 실패' }, { status: 500 });
  }
}
