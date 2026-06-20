export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { processUploadedImage } from '@/lib/image-upload-processing';
import { uploadImageToDrive } from '@/lib/image-sync';
import { logger } from '@/lib/logger';

/** GLOBAL_ADMIN 포함 orgId 해결 헬퍼 */
async function getOrgId(ctx: Awaited<ReturnType<typeof getAuthContext>>): Promise<string> {
  if (ctx.role === 'GLOBAL_ADMIN' && !ctx.organizationId) {
    const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
    if (!firstOrg) throw new Error('NO_ORGANIZATION');
    return firstOrg.id;
  }
  return resolveOrgId(ctx);
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Magic bytes 기반 파일 타입 검증
async function validateFileMagic(
  file: File,
): Promise<{ valid: boolean; mimeType: string | null; detected?: string }> {
  const MAGIC_BYTES: Record<string, { bytes: number[]; mimeType: string }> = {
    jpeg: { bytes: [0xff, 0xd8, 0xff], mimeType: 'image/jpeg' },
    png: { bytes: [0x89, 0x50, 0x4e, 0x47], mimeType: 'image/png' },
    gif: { bytes: [0x47, 0x49, 0x46], mimeType: 'image/gif' },
    webp: { bytes: [0x52, 0x49, 0x46, 0x46], mimeType: 'image/webp' },
  };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    for (const [fmt, { bytes: magicBytes, mimeType }] of Object.entries(MAGIC_BYTES)) {
      if (buffer.length >= magicBytes.length) {
        const match = magicBytes.every((byte, i) => buffer[i] === byte);
        if (match) {
          if (fmt === 'webp') {
            const webpCheck = buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP';
            if (webpCheck) return { valid: true, mimeType };
          } else {
            return { valid: true, mimeType };
          }
        }
      }
    }

    return { valid: false, mimeType: null, detected: 'unknown' };
  } catch {
    return { valid: false, mimeType: null, detected: 'read_error' };
  }
}

/**
 * POST /api/funnel-email/images
 * 이메일 퍼널 이미지 업로드 (WebP 자동 변환, Drive 백업)
 *
 * FormData: file
 * Response: { ok, url, driveFileId }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = await getOrgId(ctx);

    // Content-Length 사전 검증
    const contentLength = req.headers.get('content-length');
    if (contentLength) {
      const sizeBytes = parseInt(contentLength, 10);
      if (sizeBytes > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            ok: false,
            message: `파일 크기는 5MB 이하여야 합니다 (현재: ${(sizeBytes / 1024 / 1024).toFixed(1)}MB)`,
          },
          { status: 413 },
        );
      }
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, message: '파일은 필수입니다' }, { status: 400 });
    }

    // 파일 크기 재검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, message: '파일 크기는 5MB 이하여야 합니다' },
        { status: 400 },
      );
    }

    // 확장자 기반 MIME 추론 (Windows 드래그&드롭 시 MIME 빈 문자열 보완)
    const extMime: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const mimeFromExt = extMime[ext] || '';

    // Magic bytes 검증
    const magicCheck = await validateFileMagic(file);
    if (!magicCheck.valid) {
      return NextResponse.json(
        {
          ok: false,
          message: `유효하지 않은 이미지 형식입니다 (${magicCheck.detected || '감지 불가'})`,
        },
        { status: 400 },
      );
    }
    const resolvedType = magicCheck.mimeType || mimeFromExt || '';

    if (!ALLOWED_TYPES.includes(resolvedType)) {
      return NextResponse.json(
        { ok: false, message: 'JPG, PNG, WebP, GIF만 업로드 가능합니다' },
        { status: 400 },
      );
    }

    // 파일 읽기 + WebP 변환
    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);
    const processed = await processUploadedImage(originalBuffer, resolvedType, file.name);
    const { buffer: processedBuffer, mimeType: finalMimeType, fileName: finalFileName } = processed;

    // 조직명 조회 (Drive 폴더용)
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    // Google Drive 업로드
    const asset = await uploadImageToDrive({
      organizationId: orgId,
      userId: ctx.userId,
      orgName: org?.name || orgId,
      buffer: processedBuffer,
      fileName: finalFileName,
      mimeType: finalMimeType,
      category: '이메일퍼널',
      tags: ['funnel-email'],
      folderId: process.env.FUNNEL_EMAIL_DRIVE_FOLDER_ID,
    });

    const url = `/api/funnel-email/images/proxy?id=${asset.driveFileId}`;

    logger.info('[funnel-email-images] 업로드 완료', {
      orgId,
      driveFileId: asset.driveFileId,
      fileName: finalFileName,
      size: processedBuffer.length,
    });

    return NextResponse.json({
      ok: true,
      url,
      driveFileId: asset.driveFileId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다' }, { status: 401 });
    }
    if (msg === 'ORGANIZATION_REQUIRED' || msg === 'NO_ORGANIZATION') {
      return NextResponse.json({ ok: false, message: '조직 정보가 필요합니다' }, { status: 403 });
    }
    if (
      msg.includes('Failed to parse body as FormData') ||
      msg.includes('Request body exceeded')
    ) {
      logger.warn('[funnel-email-images] 업로드 본문 크기 초과 또는 파싱 실패', { message: msg });
      return NextResponse.json(
        {
          ok: false,
          message:
            '업로드 파일이 너무 크거나 손상되어 처리할 수 없습니다. 5MB 이하의 이미지로 다시 시도하세요.',
        },
        { status: 413 },
      );
    }
    logger.error('[funnel-email-images] 업로드 실패', {
      message: msg,
      stack: err instanceof Error ? err.stack : '',
    });
    return NextResponse.json(
      { ok: false, message: '이미지 업로드 중 오류가 발생했습니다' },
      { status: 500 },
    );
  }
}
