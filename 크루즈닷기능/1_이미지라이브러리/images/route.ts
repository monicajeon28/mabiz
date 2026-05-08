// app/api/admin/images/route.ts
// 이미지 목록 조회 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { listFilesInFolder, deleteFileFromDrive, listFoldersInFolder, createFolder, moveFileToFolder, renameFolder } from '@/lib/google-drive';
import { logger } from '@/lib/logger';
import { validateCsrfToken, getCsrfErrorResponse } from '@/lib/utils/csrfValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 메모리 캐시 (5분간 유지)
let imageCache: { data: any; timestamp: number; folderId: string } | null = null;
let folderCache: { data: any; timestamp: number; parentId: string } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5분
const FOLDER_CACHE_TTL = 10 * 60 * 1000; // 폴더 캐시 10분

// 관리자 또는 판매원 권한 확인 (읽기 전용)
async function requireAdminOrPartner() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      role: true,
      phone: true,
      AffiliateProfile: {
        select: { id: true, type: true }
      }
    },
  });

  // 관리자이거나 판매원(AffiliateProfile이 있음)이면 접근 허용
  if (user?.role !== 'admin' && !user?.AffiliateProfile) {
    return NextResponse.json({ ok: false, message: 'Admin or Partner access required' }, { status: 403 });
  }

  // 슈퍼 관리자 확인 (환경변수만 사용, 폴백 하드코딩 없음)
  const normalizedPhone = user?.phone?.replace(/[-\s]/g, '') || '';
  const superAdminPhones = process.env.SUPER_ADMIN_PHONES?.split(',').map(p => p.trim()).filter(Boolean) ?? [];
  if (superAdminPhones.length === 0) {
    logger.error('[Admin Images] SUPER_ADMIN_PHONES 환경변수가 설정되지 않았습니다. 슈퍼어드민 기능이 비활성화됩니다.');
  }
  const isSuperAdmin = superAdminPhones.includes(normalizedPhone);

  // 대리점장 확인
  const isBranchManager = user?.AffiliateProfile?.type === 'BRANCH_MANAGER';

  return { user, isAdmin: user?.role === 'admin', isSuperAdmin, isBranchManager };
}

export async function GET(req: NextRequest) {
  try {
    // 관리자 또는 판매원 권한 확인
    const authResult = await requireAdminOrPartner();
    if ('status' in authResult) return authResult; // 에러 응답인 경우

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId'); // 폴더 ID (Google Drive ID)
    const refresh = searchParams.get('refresh') === 'true'; // 강제 새로고침

    // Google Drive 이미지 루트 폴더 ID 가져오기
    const { getDriveFolderId } = await import('@/lib/config/drive-config');
    const rootFolderId = await getDriveFolderId('UPLOADS_IMAGES');

    if (!rootFolderId) {
      return NextResponse.json(
        { ok: false, message: 'Google Drive 이미지 폴더 ID가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 실제 조회할 폴더 ID (folderId가 없으면 루트 폴더)
    const targetFolderId = folderId || rootFolderId;
    const isRootFolder = targetFolderId === rootFolderId;

    // 폴더 목록 캐시 확인
    let folders: Array<{ id: string; name: string }> = [];
    if (!refresh && folderCache && folderCache.parentId === targetFolderId && Date.now() - folderCache.timestamp < FOLDER_CACHE_TTL) {
      folders = folderCache.data;
    } else {
      // 폴더 목록 가져오기
      const foldersResult = await listFoldersInFolder(targetFolderId);
      if (foldersResult.ok && foldersResult.folders) {
        folders = foldersResult.folders.map(f => ({ id: f.id, name: f.name }));
        // 폴더 캐시 저장
        folderCache = {
          data: folders,
          timestamp: Date.now(),
          parentId: targetFolderId,
        };
      }
    }

    // 이미지 캐시 확인
    if (!refresh && imageCache && imageCache.folderId === targetFolderId && Date.now() - imageCache.timestamp < CACHE_TTL) {

      return NextResponse.json({
        ...imageCache.data,
        folders,
        rootFolderId,
        isRootFolder,
      }, {
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Cache': 'HIT',
        },
      });
    }

    // Google Drive에서 파일 목록 가져오기 (폴더 ID로 직접 조회)
    const result = await listFilesInFolder(targetFolderId);

    if (!result.ok || !result.files) {
      return NextResponse.json({
        ok: true,
        images: [],
        folders,
        rootFolderId,
        currentFolderId: targetFolderId,
        isRootFolder,
      });
    }

    const images: Array<{
      id: string;
      name: string;
      url: string;
      webpUrl: string | null;
      size: number;
      modified: Date;
      code: {
        url: string;
        imageTag: string;
        htmlTag: string;
      };
    }> = [];

    // 이미지 파일만 필터링
    for (const file of result.files) {
      const ext = file.name.toLowerCase().split('.').pop() || '';
      // WebP 파일은 목록에서 제외 (원본 파일만 표시)
      if (ext === 'webp') {
        continue;
      }
      if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');

        // WebP 버전 찾기 (같은 폴더에 있을 것으로 가정)
        const webpFile = result.files.find(f =>
          f.name === `${nameWithoutExt}.webp` || f.name === `${nameWithoutExt}.WEBP`
        );
        const webpUrl = webpFile ? webpFile.url : null;

        // 파일에서 size와 modifiedTime 가져오기
        const fileWithMeta = file as any;

        images.push({
          id: file.id,
          name: file.name,
          url: file.url,
          webpUrl,
          size: fileWithMeta.size || 0,
          modified: fileWithMeta.modifiedTime || new Date(),
          code: {
            url: webpUrl || file.url,
            imageTag: `<Image src="${webpUrl || file.url}" alt="${nameWithoutExt}" width={500} height={300} />`,
            htmlTag: `<img src="${webpUrl || file.url}" alt="${nameWithoutExt}" />`,
          },
        });
      }
    }

    // 중복 제거 (URL 기준)
    const uniqueImages = Array.from(
      new Map(images.map((img) => [img.url, img])).values()
    );

    const responseData = {
      ok: true,
      images: uniqueImages.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()),
      currentFolderId: targetFolderId,
    };

    // 캐시 저장
    imageCache = {
      data: responseData,
      timestamp: Date.now(),
      folderId: targetFolderId,
    };

    return NextResponse.json({
      ...responseData,
      folders,
      rootFolderId,
      isRootFolder,
    }, {
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Cache': 'MISS',
      },
    });
  } catch (error: any) {
    logger.error('[Image List] 에러:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, message: error.message || '이미지 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 폴더 생성, 파일 이동, 폴더 이름 수정 (관리자/대리점장만)
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdminOrPartner();
    if ('status' in authResult) return authResult;

    // C-2: CSRF 토큰 검증 (상태변경 요청 보호)
    const csrfValidation = validateCsrfToken(req);
    if (!csrfValidation.valid) {
      return getCsrfErrorResponse(csrfValidation.error || '잘못된 요청입니다.');
    }

    const body = await req.json();
    const { action, folderName, parentFolderId, fileId, targetFolderId, currentFolderId, folderId, newName } = body;

    // 권한 체크
    const canManageFolders = authResult.isSuperAdmin || authResult.isBranchManager;

    // 폴더 이름 수정, 생성, 파일 이동은 관리자/대리점장만 가능
    if ((action === 'renameFolder' || action === 'createFolder' || action === 'moveFile') && !canManageFolders) {
      return NextResponse.json(
        { ok: false, message: '폴더 관리 및 파일 이동은 관리자 또는 대리점장만 가능합니다.' },
        { status: 403 }
      );
    }

    // Google Drive 이미지 루트 폴더 ID 가져오기
    const { getDriveFolderId } = await import('@/lib/config/drive-config');
    const rootFolderId = await getDriveFolderId('UPLOADS_IMAGES');

    if (!rootFolderId) {
      return NextResponse.json(
        { ok: false, message: 'Google Drive 이미지 폴더 ID가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    if (action === 'createFolder') {
      // 폴더 생성
      if (!folderName) {
        return NextResponse.json({ ok: false, message: '폴더 이름이 필요합니다.' }, { status: 400 });
      }

      const targetParentId = parentFolderId || rootFolderId;
      const result = await createFolder(folderName, targetParentId);

      if (!result.ok) {
        return NextResponse.json({ ok: false, message: result.error || '폴더 생성 실패' }, { status: 500 });
      }

      // 폴더 캐시 무효화
      folderCache = null;

      return NextResponse.json({
        ok: true,
        folderId: result.folderId,
        message: '폴더가 생성되었습니다.',
      });
    }

    if (action === 'moveFile') {
      // 파일 이동
      if (!fileId || !targetFolderId) {
        return NextResponse.json({ ok: false, message: '파일 ID와 대상 폴더 ID가 필요합니다.' }, { status: 400 });
      }

      const result = await moveFileToFolder(fileId, targetFolderId, currentFolderId);

      if (!result.ok) {
        return NextResponse.json({ ok: false, message: result.error || '파일 이동 실패' }, { status: 500 });
      }

      // 이미지 캐시 무효화
      imageCache = null;

      return NextResponse.json({
        ok: true,
        message: '파일이 이동되었습니다.',
      });
    }

    if (action === 'renameFolder') {
      // 폴더 이름 수정
      if (!folderId || !newName) {
        return NextResponse.json({ ok: false, message: '폴더 ID와 새 이름이 필요합니다.' }, { status: 400 });
      }

      const result = await renameFolder(folderId, newName);

      if (!result.ok) {
        return NextResponse.json({ ok: false, message: result.error || '폴더 이름 수정 실패' }, { status: 500 });
      }

      // 폴더 캐시 무효화
      folderCache = null;

      return NextResponse.json({
        ok: true,
        message: '폴더 이름이 수정되었습니다.',
      });
    }

    return NextResponse.json({ ok: false, message: '알 수 없는 액션입니다.' }, { status: 400 });
  } catch (error: any) {
    logger.error('[Image API POST] 에러:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, message: error.message || '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // 관리자 또는 대리점장 권한 확인 (삭제는 관리자/대리점장만 가능)
    const authResult = await requireAdminOrPartner();
    if ('status' in authResult) return authResult; // 에러 응답인 경우

    // C-2: CSRF 토큰 검증 (상태변경 요청 보호)
    const csrfValidation = validateCsrfToken(req);
    if (!csrfValidation.valid) {
      return getCsrfErrorResponse(csrfValidation.error || '잘못된 요청입니다.');
    }

    // 삭제는 슈퍼 관리자 또는 대리점장만 가능
    if (!authResult.isSuperAdmin && !authResult.isBranchManager) {
      return NextResponse.json(
        { ok: false, message: '이미지 삭제는 관리자 또는 대리점장만 가능합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({ ok: false, message: '이미지 URL이 필요합니다.' }, { status: 400 });
    }

    // Google Drive URL인지 확인
    if (imageUrl.includes('drive.google.com')) {
      // Google Drive에서 삭제
      const deleteResult = await deleteFileFromDrive(imageUrl);
      if (!deleteResult.ok) {
        return NextResponse.json(
          { ok: false, message: deleteResult.error || '이미지 삭제 실패' },
          { status: 500 }
        );
      }

      // WebP 버전도 삭제 시도 (파일명에서 추출)
      const urlParts = imageUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      if (filename && !filename.toLowerCase().endsWith('.webp')) {
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
        // WebP 파일 ID는 정확히 알 수 없으므로, 원본 파일 삭제만 수행
        // 필요시 별도로 WebP 파일 URL을 받아서 삭제해야 함
      }
    } else {
      // 로컬 파일 삭제 (하위 호환성)
      const fsPromises = await import('fs/promises');
      const fs = await import('fs');
      const pathModule = await import('path');

      const folder = searchParams.get('folder') || 'images';
      const imageLibraryDir = pathModule.join(process.cwd(), 'public', 'image-library');
      const targetDir = pathModule.join(imageLibraryDir, folder);

      // 보안: 상위 디렉토리 접근 방지
      if (!targetDir.startsWith(imageLibraryDir)) {
        return NextResponse.json({ ok: false, message: 'Invalid folder path' }, { status: 400 });
      }

      // URL에서 파일명 추출
      const urlParts = imageUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      const filePath = pathModule.join(targetDir, filename);

      // 보안: 상위 디렉토리 접근 방지
      if (!filePath.startsWith(targetDir)) {
        return NextResponse.json({ ok: false, message: 'Invalid file path' }, { status: 400 });
      }

      // 파일 존재 확인
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ ok: false, message: '파일을 찾을 수 없습니다.' }, { status: 404 });
      }

      // 원본 파일 삭제
      await fsPromises.unlink(filePath);

      // WebP 버전도 삭제 (존재하는 경우)
      const nameWithoutExt = pathModule.parse(filename).name;
      const webpPath = pathModule.join(targetDir, `${nameWithoutExt}.webp`);
      if (fs.existsSync(webpPath)) {
        await fsPromises.unlink(webpPath);
      }
    }

    // 삭제 후 캐시 무효화
    imageCache = null;

    return NextResponse.json({
      ok: true,
      message: '이미지가 삭제되었습니다.',
    });
  } catch (error: any) {
    logger.error('[Image Delete] 에러:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, message: error.message || '이미지 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}










