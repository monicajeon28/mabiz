// app/api/admin/mall/files/route.ts
// 업로드된 파일 목록 조회 API

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { listFilesInFolder, deleteFileFromDrive } from '@/lib/google-drive';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth() {
  const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true },
        },
      },
    });

    if (!session || !session.User || session.User.role !== 'admin') {
      return null;
    }

    return session.User;
  } catch (error) {
    logger.error('[Mall Files API] Auth check error', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * GET: 업로드된 파일 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'all'; // 'image', 'video', 'all'

    const files: Array<{
      url: string;
      filename: string;
      size: number;
      type: string;
      uploadedAt: number;
    }> = [];

    // 이미지 파일 목록 (Google Drive에서 가져오기)
    const { getDriveFolderId } = await import('@/lib/config/drive-config');
    if (type === 'image' || type === 'all') {
      const imagesFolderId = await getDriveFolderId('UPLOADS_IMAGES');
      if (imagesFolderId) {
        try {
          const result = await listFilesInFolder(imagesFolderId);
          if (result.ok && result.files) {
            for (const file of result.files) {
              const ext = file.name.toLowerCase().split('.').pop() || '';
              if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                files.push({
                  url: file.url,
                  filename: file.name,
                  size: 0, // Google Drive에서 크기 정보는 별도로 가져와야 함
                  type: 'image',
                  uploadedAt: Date.now(), // Google Drive에서 수정 시간은 별도로 가져와야 함
                });
              }
            }
          }
        } catch (err) {
          logger.error('Failed to read images from Google Drive', { error: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    // 영상 파일 목록 (Google Drive에서 가져오기)
    if (type === 'video' || type === 'all') {
      const videosFolderId = await getDriveFolderId('UPLOADS_VIDEOS');
      if (videosFolderId) {
        try {
          const result = await listFilesInFolder(videosFolderId);
          if (result.ok && result.files) {
            for (const file of result.files) {
              const ext = file.name.toLowerCase().split('.').pop() || '';
              if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
                files.push({
                  url: file.url,
                  filename: file.name,
                  size: 0, // Google Drive에서 크기 정보는 별도로 가져와야 함
                  type: 'video',
                  uploadedAt: Date.now(), // Google Drive에서 수정 시간은 별도로 가져와야 함
                });
              }
            }
          }
        } catch (err) {
          logger.error('Failed to read videos from Google Drive', { error: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    // 중복 제거 (URL 기준)
    const uniqueFiles = Array.from(
      new Map(files.map((file) => [file.url, file])).values()
    );

    // 업로드 시간 기준 내림차순 정렬 (최신순)
    uniqueFiles.sort((a, b) => b.uploadedAt - a.uploadedAt);

    return NextResponse.json({
      ok: true,
      files: uniqueFiles,
      count: uniqueFiles.length,
    });
  } catch (error) {
    logger.error('[Mall Files API] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '파일 목록을 불러올 수 없습니다.',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 파일 삭제
 */
export async function DELETE(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const fileUrl = url.searchParams.get('url');

    if (!fileUrl) {
      return NextResponse.json(
        { ok: false, error: '파일 URL이 필요합니다.' },
        { status: 400 }
      );
    }

    // Google Drive URL인지 확인
    if (fileUrl.includes('drive.google.com')) {
      // Google Drive에서 삭제
      const deleteResult = await deleteFileFromDrive(fileUrl);
      if (!deleteResult.ok) {
        return NextResponse.json(
          { ok: false, error: deleteResult.error || '파일 삭제 실패' },
          { status: 500 }
        );
      }
    } else if (fileUrl.startsWith('/uploads/')) {
      // 로컬 파일 삭제 (하위 호환성)
      const { readdir, stat, unlink } = await import('fs/promises');
      const { join } = await import('path');
      const { existsSync } = await import('fs');
      
      let filepath: string;
      if (fileUrl.startsWith('/uploads/images/')) {
        const filename = fileUrl.replace('/uploads/images/', '');
        filepath = join(process.cwd(), 'public', 'uploads', 'images', filename);
      } else if (fileUrl.startsWith('/uploads/videos/')) {
        const filename = fileUrl.replace('/uploads/videos/', '');
        filepath = join(process.cwd(), 'public', 'uploads', 'videos', filename);
      } else {
        return NextResponse.json(
          { ok: false, error: '유효하지 않은 파일 경로입니다.' },
          { status: 400 }
        );
      }

      // 보안: public/uploads 디렉토리 내부인지 확인
      const uploadsDir = join(process.cwd(), 'public', 'uploads');
      if (!filepath.startsWith(uploadsDir)) {
        return NextResponse.json(
          { ok: false, error: '접근할 수 없는 경로입니다.' },
          { status: 403 }
        );
      }

      // 파일 존재 확인
      if (!existsSync(filepath)) {
        return NextResponse.json(
          { ok: false, error: '파일을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // 파일 삭제
      await unlink(filepath);
    } else {
      return NextResponse.json(
        { ok: false, error: '유효하지 않은 파일 URL입니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: '파일이 삭제되었습니다.',
    });
  } catch (error) {
    logger.error('[Mall Files API] Delete error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '파일 삭제에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}



