export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { uploadFileToDrive } from '@/lib/google-drive';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    return session?.User.role === 'admin';
  } catch (error) {
    console.error('[Admin Payment Pages Upload] Auth check error:', error);
    return false;
  }
}

/**
 * POST /api/admin/affiliate/payment-pages/upload
 * 결제 페이지 이미지 업로드
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const contractType = formData.get('contractType') as string;

    if (!file) {
      return NextResponse.json({ ok: false, message: '파일이 없습니다.' }, { status: 400 });
    }

    if (!contractType) {
      return NextResponse.json({ ok: false, message: '계약서 타입이 없습니다.' }, { status: 400 });
    }

    // 파일 타입 검증 (MIME 타입 또는 확장자로 확인)
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (!file.type.startsWith('image/') && !allowedExtensions.includes(fileExt)) {
      return NextResponse.json({ 
        ok: false, 
        message: `이미지 파일만 업로드 가능합니다. (지원 형식: PNG, JPG, GIF, WEBP, 현재: ${file.type || fileExt})` 
      }, { status: 400 });
    }
    
    // PNG 파일의 경우 MIME 타입이 비어있을 수 있으므로 확장자로도 확인
    if (fileExt === 'png' && !file.type) {
      logger.log('[Admin Payment Pages Upload] PNG 파일 감지 (MIME 타입 없음, 확장자로 확인)');
    }

    // 파일 크기 제한 (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ ok: false, message: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 });
    }

    // 파일 버퍼 변환
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 파일명 생성: payment-page-{contractType}-{timestamp}.{ext}
    const ext = file.name.split('.').pop() || 'png';
    const timestamp = Date.now();
    const fileName = `payment-page-${contractType}-${timestamp}.${ext}`;

    // Google Drive 이미지 폴더 ID 가져오기
    const { getDriveFolderId } = await import('@/lib/config/drive-config');
    const imagesFolderId = await getDriveFolderId('UPLOADS_IMAGES');

    if (!imagesFolderId) {
      return NextResponse.json(
        { ok: false, message: 'Google Drive 이미지 폴더 ID가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // Google Drive에 업로드
    const uploadResult = await uploadFileToDrive({
      folderId: imagesFolderId,
      fileName: `payment-pages/${fileName}`,
      mimeType: file.type || `image/${ext}`,
      buffer: buffer,
      makePublic: true, // 공개 링크로 제공
    });

    if (!uploadResult.ok || !uploadResult.url) {
      return NextResponse.json(
        { ok: false, message: uploadResult.error || '파일 업로드 실패' },
        { status: 500 }
      );
    }

    const url = uploadResult.url;

    logger.log('[Admin Payment Pages Upload] 파일 업로드 성공:', {
      contractType,
      fileName,
      url,
      size: file.size,
    });

    return NextResponse.json({
      ok: true,
      url,
      fileName,
      message: '이미지가 업로드되었습니다.',
    });
  } catch (error: any) {
    console.error('[Admin Payment Pages Upload] error:', error);
    return NextResponse.json(
      { ok: false, message: error?.message || '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
