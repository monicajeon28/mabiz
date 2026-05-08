export const dynamic = 'force-dynamic';

// app/api/admin/pages/upload/route.ts
// 이미지 업로드 API

import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToDrive } from '@/lib/google-drive';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sid) return false;

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    return session?.User?.role === 'admin';
  } catch (error) {
    console.error('[Admin Pages Upload] Auth check error:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await checkAdminAuth())) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid file type' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { ok: false, error: 'File too large (max 10MB)' },
        { status: 400 }
      );
    }

    // 파일 버퍼 변환
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 파일명 생성 (타임스탬프 + 원본 파일명)
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `pages_${timestamp}_${originalName}`;

    // Google Drive 이미지 폴더 ID 가져오기
    const { getDriveFolderId } = await import('@/lib/config/drive-config');
    const imagesFolderId = await getDriveFolderId('UPLOADS_IMAGES');

    if (!imagesFolderId) {
      return NextResponse.json(
        { ok: false, error: 'Google Drive 이미지 폴더 ID가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // Google Drive에 업로드
    const uploadResult = await uploadFileToDrive({
      folderId: imagesFolderId,
      fileName: filename,
      mimeType: file.type,
      buffer: buffer,
      makePublic: true, // 공개 링크로 제공
    });

    if (!uploadResult.ok || !uploadResult.url) {
      return NextResponse.json(
        { ok: false, error: uploadResult.error || '파일 업로드 실패' },
        { status: 500 }
      );
    }

    const url = uploadResult.url;

    return NextResponse.json({
      ok: true,
      url,
      filename,
    });
  } catch (error: any) {
    console.error('[API] Error uploading file:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to upload file' },
      { status: 500 }
    );
  }
}
