// app/api/admin/images/upload/route.ts
// 이미지 업로드 및 WebP 자동 변환 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { uploadFileToDrive, findOrCreateFolder } from '@/lib/google-drive';
import path from 'path';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel 파일 업로드 크기 제한 (50MB)
export const maxDuration = 60; // 60초 타임아웃

// 관리자 또는 판매원 권한 확인
async function requireAdminOrPartner() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      role: true,
      AffiliateProfile: {
        select: { id: true }
      }
    },
  });

  if (user?.role !== 'admin' && !user?.AffiliateProfile) {
    return NextResponse.json({ ok: false, message: 'Admin or Partner access required' }, { status: 403 });
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    // 관리자 또는 판매원 권한 확인
    const authError = await requireAdminOrPartner();
    if (authError) return authError;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string | null;

    if (!file) {
      return NextResponse.json({ ok: false, message: '파일이 없습니다.' }, { status: 400 });
    }

    // 🔒 파일 크기 제한 (50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        ok: false,
        message: `파일 크기가 너무 큽니다. (최대 50MB, 현재 ${Math.round(file.size / 1024 / 1024)}MB)`
      }, { status: 400 });
    }

    // 이미지 파일만 허용
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ ok: false, message: '이미지 파일만 업로드 가능합니다.' }, { status: 400 });
    }

    // 🔒 파일 확장자 검증 (MIME 타입과 확장자 일치 확인)
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExt = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      return NextResponse.json({ ok: false, message: '허용되지 않는 파일 확장자입니다.' }, { status: 400 });
    }

    // 파일명 정리 (특수문자 제거)
    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const nameWithoutExt = path.parse(originalName).name;
    const ext = path.parse(originalName).ext.toLowerCase();

    // 폴더 경로 설정
    const folderPath = folder ? folder.trim() : 'images';

    // 원본 파일 버퍼
    const originalBuffer = Buffer.from(await file.arrayBuffer());

    // Google Drive 폴더 ID 가져오기 (기본 images 폴더 사용)
    const { getDriveFolderId } = await import('@/lib/config/drive-config');
    const baseFolderId = await getDriveFolderId('UPLOADS_IMAGES');

    if (!baseFolderId) {
      return NextResponse.json(
        { ok: false, message: 'Google Drive 이미지 폴더 ID가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 서브폴더 생성 (folderPath가 있으면)
    let targetFolderId = baseFolderId;
    if (folderPath && folderPath !== 'images') {
      const subfolderResult = await findOrCreateFolder(folderPath, baseFolderId);
      if (subfolderResult.ok && subfolderResult.folderId) {
        targetFolderId = subfolderResult.folderId;
      }
    }

    // 원본 파일을 Google Drive에 업로드
    const originalUploadResult = await uploadFileToDrive({
      folderId: targetFolderId,
      fileName: originalName,
      mimeType: file.type,
      buffer: originalBuffer,
      makePublic: true, // 공개 링크로 제공 (로딩 최적화)
    });

    if (!originalUploadResult.ok || !originalUploadResult.url) {
      return NextResponse.json(
        { ok: false, message: `원본 파일 업로드 실패: ${originalUploadResult.error}` },
        { status: 500 }
      );
    }

    const originalUrl = originalUploadResult.url;

    // WebP 변환 및 업로드
    let webpUrl: string | null = null;
    let webpBuffer: Buffer | null = null;

    try {
      webpBuffer = await sharp(originalBuffer)
        .webp({ quality: 80 })
        .toBuffer();

      const webpFileName = `${nameWithoutExt}.webp`;
      const webpUploadResult = await uploadFileToDrive({
        folderId: targetFolderId,
        fileName: webpFileName,
        mimeType: 'image/webp',
        buffer: webpBuffer,
        makePublic: true, // 공개 링크로 제공
      });

      if (webpUploadResult.ok && webpUploadResult.url) {
        webpUrl = webpUploadResult.url;
      }
    } catch (error) {
      logger.error('[Image Upload] WebP 변환 실패', { error: (error as Error)?.message });
      // WebP 변환 실패해도 원본은 저장됨
    }

    return NextResponse.json({
      ok: true,
      image: {
        original: {
          url: originalUrl,
          name: originalName,
          size: originalBuffer.length,
          fileId: originalUploadResult.fileId,
        },
        webp: webpUrl ? {
          url: webpUrl,
          name: `${nameWithoutExt}.webp`,
          size: webpBuffer?.length || 0,
        } : null,
        folder: folderPath,
      },
      code: {
        url: webpUrl || originalUrl,
        imageTag: `<Image src="${webpUrl || originalUrl}" alt="${nameWithoutExt}" width={500} height={300} />`,
        htmlTag: `<img src="${webpUrl || originalUrl}" alt="${nameWithoutExt}" />`,
      },
    });
  } catch (error: any) {
    logger.error('[Image Upload] 에러', { error: (error as Error)?.message });
    return NextResponse.json(
      { ok: false, message: error.message || '이미지 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

