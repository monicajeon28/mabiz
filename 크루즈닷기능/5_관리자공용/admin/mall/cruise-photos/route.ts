// app/api/admin/mall/cruise-photos/route.ts
// 크루즈정보사진 폴더 목록 및 이미지 조회 API
// Google Drive CRUISE_IMAGES 폴더의 하위 폴더(크루즈썸네일, 크루즈상세페이지이미지 등)와 이미지를 반환

import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient, listFoldersInFolder, listFilesInFolder } from '@/lib/google-drive';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { User: true },
    });
    if (session && session.User.role === 'admin') return session.User;
  } catch (error) {
    logger.error('[Admin Auth] Error', { error: error instanceof Error ? error.message : String(error) });
  }
  return null;
}

// GET: 폴더 목록 또는 특정 폴더 ID의 이미지 목록 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const folderId = url.searchParams.get('folderId');   // 특정 폴더 ID로 이미지 조회
    const listFolders = url.searchParams.get('listFolders') === 'true';

    // CRUISE_IMAGES 루트 폴더 ID
    const { getDriveFolderId } = await import('@/lib/config/drive-config');
    const cruiseImagesFolderId = await getDriveFolderId('CRUISE_IMAGES');

    if (!cruiseImagesFolderId) {
      return NextResponse.json({ ok: false, error: 'CRUISE_IMAGES 폴더 ID가 설정되지 않았습니다.' }, { status: 400 });
    }

    // 폴더 목록 조회 — Google Drive 하위 폴더를 mimeType 기반으로 직접 조회
    if (listFolders) {
      const result = await listFoldersInFolder(cruiseImagesFolderId);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error || '폴더 목록 조회 실패' }, { status: 500 });
      }

      const folders = (result.folders || []).map(f => ({
        id: f.id,
        name: f.name,
      }));

      return NextResponse.json({ ok: true, folders });
    }

    // 특정 폴더 이미지 조회 — folderId 파라미터 기반
    const targetFolderId = folderId || cruiseImagesFolderId;

    const drive = getDriveClient();
    const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

    const searchOptions: any = {
      q: `'${targetFolderId}' in parents and mimeType contains 'image/' and trashed=false`,
      fields: 'files(id,name,mimeType,thumbnailLink,webContentLink)',
      pageSize: 1000,
      orderBy: 'name',
    };

    if (sharedDriveId && sharedDriveId !== 'root') {
      searchOptions.supportsAllDrives = true;
      searchOptions.includeItemsFromAllDrives = true;
      searchOptions.corpora = 'allDrives';
    }

    const response = await drive.files.list(searchOptions);

    const images = (response.data.files || [])
      .filter(f => f.id)
      .map(f => {
        const proxyUrl = `/api/public/image-proxy?fileId=${f.id}`;
        return {
          id: f.id!,
          name: f.name || '',
          url: proxyUrl,
          thumbnail: f.thumbnailLink
            ? f.thumbnailLink.replace(/=s\d+/, '=s400')
            : proxyUrl,
        };
      });

    return NextResponse.json({ ok: true, folderId: targetFolderId, images });
  } catch (error: any) {
    logger.error('[Cruise Photos API] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: '사진 목록을 가져오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
