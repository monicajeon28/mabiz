// app/api/admin/mall/google-drive-products/route.ts
// 구글 드라이브 상품 폴더의 이미지 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { getDriveClient } from '@/lib/google-drive';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'cg.sid.v2';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { User: true },
    });

    if (session && session.User.role === 'admin') {
      return session.User;
    }
  } catch (error) {
    logger.error('[Admin Auth] Error', { error: error instanceof Error ? error.message : String(error) });
  }

  return null;
}



// GET: 구글 드라이브 상품 폴더의 이미지 목록 조회
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAdminAuth();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const folderId = url.searchParams.get('folderId'); // 특정 폴더 ID (선택적)
    const listFolders = url.searchParams.get('listFolders') === 'true'; // 폴더 목록만 조회

    // 구글 드라이브 상품 폴더 ID 가져오기
    const { getDriveFolderId } = await import('@/lib/config/drive-config');
    const productsFolderId = await getDriveFolderId('PRODUCTS');

    if (!productsFolderId) {
      return NextResponse.json({
        ok: false,
        error: '상품 폴더 ID가 설정되지 않았습니다. 관리자 설정에서 Google Drive 상품 폴더 ID를 설정해주세요.',
      }, { status: 400 });
    }

    const drive = getDriveClient();
    const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

    // 폴더 목록 조회
    if (listFolders) {
      const query = `'${productsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const searchOptions: any = {
        q: query,
        fields: 'files(id, name)',
        pageSize: 1000,
      };

      if (sharedDriveId && sharedDriveId !== 'root') {
        searchOptions.supportsAllDrives = true;
        searchOptions.includeItemsFromAllDrives = true;
        searchOptions.corpora = 'allDrives';
      }

      const response = await drive.files.list(searchOptions);
      const folders = (response.data.files || []).map((file) => ({
        id: file.id,
        name: file.name || '',
      }));

      return NextResponse.json({
        ok: true,
        folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
      });
    }

    // 특정 폴더의 이미지 목록 조회
    const targetFolderId = folderId || productsFolderId;

    // 이미지 파일만 조회 (mimeType이 image로 시작하는 파일)
    const query = `'${targetFolderId}' in parents and mimeType contains 'image/' and trashed=false`;

    // 성능 최적화: list 한 번에 모든 필드 포함 → 개별 files.get 호출 제거
    const searchOptions: any = {
      q: query,
      fields: 'files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,createdTime,size)',
      pageSize: 1000,
    };

    if (sharedDriveId && sharedDriveId !== 'root') {
      searchOptions.supportsAllDrives = true;
      searchOptions.includeItemsFromAllDrives = true;
      searchOptions.corpora = 'allDrives';
    }

    logger.log('[Google Drive Products API] Querying folder:', targetFolderId);
    logger.log('[Google Drive Products API] Query:', query);

    const response = await drive.files.list(searchOptions);

    logger.log('[Google Drive Products API] Response:', {
      fileCount: response.data.files?.length || 0,
    });

    // 성능 최적화: drive.permissions.create / drive.files.get 개별 호출 제거
    // 프록시 URL이 서비스 계정 인증으로 이미지를 제공하므로 공개 설정 불필요
    const images = (response.data.files || []).map((file) => {
        if (!file.id) return null;

        // list 응답에 포함된 필드로 직접 URL 생성 (files.get 재호출 없음)
        let directImageUrl = '';
        let thumbnailUrl = '';

        if (file.webContentLink) {
          directImageUrl = file.webContentLink;
        } else if (file.thumbnailLink) {
          directImageUrl = file.thumbnailLink.replace(/=s\d+/, '=s2000');
        } else {
          directImageUrl = `https://drive.google.com/uc?export=view&id=${file.id}`;
        }

        thumbnailUrl = file.thumbnailLink
          ? file.thumbnailLink.replace(/=s\d+/, '=s400')
          : directImageUrl;

        // 프록시 URL 생성 (공유 설정과 무관하게 작동)
        const proxyUrl = `/api/public/image-proxy?fileId=${file.id}`;

        // 프록시 URL을 우선 사용 (공유 설정 문제 해결)
        // 프록시는 서비스 계정으로 이미지를 가져오므로 공개 설정이 필요 없음
        return {
          id: file.id,
          name: file.name || '',
          url: proxyUrl, // 프록시 URL 우선 사용 (공유 설정 무관)
          proxyUrl: proxyUrl, // 프록시 URL (명시적)
          directUrl: directImageUrl, // 직접 URL (백업용, 공개 설정 필요)
          viewUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`, // 뷰어 링크 (참고용)
          thumbnail: proxyUrl, // 썸네일도 프록시 URL 사용
          mimeType: file.mimeType || 'image/jpeg',
        };
      });

    // null 값 제거
    const validImages = images.filter((img): img is NonNullable<typeof img> => img !== null);

    return NextResponse.json({
      ok: true,
      folderId: targetFolderId,
      images: validImages.sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[Google Drive Products API] Error', { error: msg });
    // 개발 환경에서는 실제 오류 메시지 노출 (디버깅용)
    const clientMsg = process.env.NODE_ENV === 'development'
      ? `Google Drive 오류: ${msg}`
      : 'Google Drive 이미지를 가져오는 중 오류가 발생했습니다.';
    return NextResponse.json({ ok: false, error: clientMsg }, { status: 500 });
  }
}

