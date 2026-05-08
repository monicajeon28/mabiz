// app/api/admin/company/logo/upload/route.ts
// 회사 로고 업로드 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { uploadCompanyLogo } from '@/lib/google-drive-company-logo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 관리자 권한 확인
async function requireAdmin() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true },
  });

  if (user?.role !== 'admin') {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const authError = await requireAdmin();
    if (authError) return authError;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, message: '파일이 없습니다.' }, { status: 400 });
    }

    // 이미지 파일만 허용
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ ok: false, message: '이미지 파일만 업로드 가능합니다.' }, { status: 400 });
    }

    // 파일 버퍼 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 파일명 정리
    const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Google Drive에 업로드
    const uploadResult = await uploadCompanyLogo(buffer, fileName, file.type);

    if (!uploadResult.ok) {
      return NextResponse.json(
        { ok: false, message: uploadResult.error || '회사 로고 업로드 실패' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: '회사 로고가 업로드되었습니다.',
      data: {
        url: uploadResult.url,
        fileId: uploadResult.fileId,
        fileName: fileName,
      },
    });
  } catch (error: any) {
    console.error('[Company Logo Upload] Error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || '회사 로고 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


