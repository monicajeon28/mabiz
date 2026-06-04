import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/image-library/google-drive
 * 구글 드라이브의 마비즈 자료 폴더에서 이미지 목록 조회
 *
 * 폴더 ID: 1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz
 * 하위 폴더:
 * - 크루즈자료
 * - 후기
 * - 크루즈정보사진
 * - 크루즈닷메인로고
 * - 상품
 */

interface GoogleDriveImage {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnailUrl: string;
  downloadUrl: string;
  category: string;
}

const ROOT_FOLDER_ID = '1YEsNRV2MQT5nSjtMniVcEVsECUeCgLBz';

// 캐시 (5분)
let cachedFolders: Map<string, GoogleDriveImage[]> | null = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Google Drive API 클라이언트 초기화
 */
function getGoogleDriveClient() {
  const serviceAccountKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY 환경변수가 설정되지 않았습니다');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(serviceAccountKey),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * 폴더의 모든 이미지 파일 조회
 */
async function fetchFolderImages(folderId: string, folderName: string): Promise<GoogleDriveImage[]> {
  try {
    const drive = getGoogleDriveClient();
    const images: GoogleDriveImage[] = [];

    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      spaces: 'drive',
      fields: 'files(id, name, mimeType, webViewLink, size)',
      pageSize: 100,
    });

    if (response.data.files) {
      for (const file of response.data.files) {
        if (file.id && file.name && file.mimeType) {
          images.push({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            webViewLink: file.webViewLink || '',
            thumbnailUrl: `/api/landing-pages/images/proxy?id=${file.id}`,
            downloadUrl: `https://drive.google.com/uc?id=${file.id}&export=download`,
            category: folderName,
          });
        }
      }
    }

    return images;
  } catch (err) {
    logger.error(`[GoogleDrive] 폴더 조회 실패: ${folderName}`, { err });
    return [];
  }
}

/**
 * 루트 폴더의 모든 하위 폴더 조회
 */
async function fetchGoogleDriveFolders(): Promise<Map<string, GoogleDriveImage[]>> {
  const result = new Map<string, GoogleDriveImage[]>();

  try {
    const drive = getGoogleDriveClient();

    // 루트 폴더의 하위 폴더 목록 조회
    const foldersResponse = await drive.files.list({
      q: `'${ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      spaces: 'drive',
      fields: 'files(id, name)',
      pageSize: 50,
    });

    if (foldersResponse.data.files) {
      for (const folder of foldersResponse.data.files) {
        if (folder.id && folder.name) {
          const images = await fetchFolderImages(folder.id, folder.name);
          if (images.length > 0) {
            result.set(folder.name, images);
          }
        }
      }
    }
  } catch (err) {
    logger.error('[GoogleDrive] 폴더 목록 조회 실패', { err });
  }

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    // 권한: GLOBAL_ADMIN, OWNER, AGENT 모두 접근 가능
    if (!ctx || (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER' && ctx.role !== 'AGENT')) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category'); // 폴더 필터 (필수)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '12', 10)));

    // 캐시 확인
    const now = Date.now();
    if (!cachedFolders || (now - cacheTime) >= CACHE_DURATION) {
      // 구글 드라이브 폴더 조회
      cachedFolders = await fetchGoogleDriveFolders();
      cacheTime = now;
    }

    if (!category || !cachedFolders.has(category)) {
      // 전체 폴더 목록 반환
      const foldersArray = Array.from(cachedFolders.entries())
        .map(([name, images]) => ({
          category: name,
          total: images.length,
        }))
        .sort((a, b) => a.category.localeCompare(b.category, 'ko'));

      return NextResponse.json({
        ok: true,
        folders: foldersArray,
      });
    }

    // 특정 카테고리의 이미지 페이지네이션
    const images = cachedFolders.get(category) || [];
    const total = images.length;
    const skip = (page - 1) * limit;
    const paginatedImages = images.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      ok: true,
      category,
      images: paginatedImages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      cacheExpiry: new Date(cacheTime + CACHE_DURATION).toISOString(),
    });
  } catch (err) {
    logger.error('[GET /api/image-library/google-drive]', { err });
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
