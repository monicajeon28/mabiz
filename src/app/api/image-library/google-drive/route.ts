import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { driveImageUrl } from '@/lib/drive-image';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { parseServiceAccount } from '@/lib/parse-service-account';

/**
 * GET /api/image-library/google-drive
 * 하드코딩된 3개 폴더에서 이미지 목록 조회
 *
 * ?folders=true                          → 폴더 목록 + 각 폴더 이미지 수
 * ?folderId=xxx&page=1&limit=20          → 특정 폴더 이미지 목록
 *
 * POST /api/image-library/google-drive
 * Body: { action: 'add_folder', name: string, driveId: string }
 * → 세션 메모리(customFolders)에 임시 추가 (서버 재시작 전까지 유효)
 */

// ────────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────────

interface FolderDef {
  name: string;
  id: string;
}

interface DriveImageItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailUrl: string;   // proxy 경유 (내부)
  publicUrl: string;      // lh3 공개 URL
  altPublicUrl: string;   // drive.google.com/uc 공개 URL
  webViewLink: string;
  folderId: string;
  folderName: string;
}

interface FolderSummary {
  id: string;
  name: string;
  imageCount: number;
}

// ────────────────────────────────────────────────────────────────
// 기본 폴더 정의 (환경변수 GOOGLE_DRIVE_FOLDERS_JSON 으로 오버라이드 가능)
// ────────────────────────────────────────────────────────────────

const DEFAULT_FOLDERS: FolderDef[] = [
  { name: '크루즈 정보사진', id: '17QT8_NTQXpOzcfaZ3silp-hqD0sgOAck' },
  { name: '후기',           id: '1po1OyLETzyRUA_WHWe9QlUGdoh34pm51' },
  { name: '로고',           id: '1s3dL8SCPHlsG8qcVo4TzG6MFvdql4bYf' },
  { name: '크루즈 자료',     id: '1NKe7U-VKROfuJL6LvhP4KT1Gp28bpK1-' },
];

function getBaseFolders(): FolderDef[] {
  const envJson = process.env.GOOGLE_DRIVE_FOLDERS_JSON;
  if (envJson) {
    try {
      return JSON.parse(envJson) as FolderDef[];
    } catch {
      logger.warn('[GoogleDrive] GOOGLE_DRIVE_FOLDERS_JSON 파싱 실패, 기본값 사용');
    }
  }
  return DEFAULT_FOLDERS;
}

// 세션 메모리 — POST로 추가된 커스텀 폴더 (서버 재시작 전까지 유효)
const customFolders: FolderDef[] = [];

function getAllFolders(): FolderDef[] {
  return [...getBaseFolders(), ...customFolders];
}

// ────────────────────────────────────────────────────────────────
// 폴더별 독립 캐시
// ────────────────────────────────────────────────────────────────

const CACHE_DURATION = 5 * 60 * 1000; // 5분

interface FolderCache {
  images: DriveImageItem[];
  fetchedAt: number;
}

const folderCache = new Map<string, FolderCache>();

function isCacheValid(folderId: string): boolean {
  const entry = folderCache.get(folderId);
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < CACHE_DURATION;
}

// ────────────────────────────────────────────────────────────────
// Google Drive 클라이언트
// ────────────────────────────────────────────────────────────────

function getGoogleDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: parseServiceAccount(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

// ────────────────────────────────────────────────────────────────
// 폴더 이미지 조회 (페이지네이션 없이 최대 200개)
// ────────────────────────────────────────────────────────────────

async function fetchFolderImages(folder: FolderDef): Promise<DriveImageItem[]> {
  const drive = getGoogleDriveClient();
  const images: DriveImageItem[] = [];

  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folder.id}' in parents and mimeType contains 'image/' and trashed = false`,
      // 공유 드라이브(Shared Drive) 및 서비스계정에 공유된 폴더의 항목까지 모두 포함.
      // 이 플래그가 없으면 서비스계정의 "내 드라이브"만 검색하여 0건이 반환됨.
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink)',
      pageSize: 100,
      ...(pageToken ? { pageToken } : {}),
    });

    const files = response.data.files ?? [];
    for (const file of files) {
      if (!file.id || !file.name || !file.mimeType) continue;
      images.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        thumbnailUrl: `/api/landing-pages/images/proxy?id=${file.id}`,
        publicUrl: driveImageUrl(file.id, 2000),
        altPublicUrl: driveImageUrl(file.id, 2000),
        webViewLink: file.webViewLink ?? '',
        folderId: folder.id,
        folderName: folder.name,
      });
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken && images.length < 200);

  return images;
}

async function getOrFetchFolder(folder: FolderDef): Promise<DriveImageItem[]> {
  if (isCacheValid(folder.id)) {
    return folderCache.get(folder.id)!.images;
  }

  try {
    const images = await fetchFolderImages(folder);
    folderCache.set(folder.id, { images, fetchedAt: Date.now() });
    return images;
  } catch (err) {
    logger.error(`[GoogleDrive] 폴더 이미지 조회 실패: ${folder.name} (${folder.id})`, { err });
    // 캐시에 이전 데이터가 있으면 만료돼도 반환
    return folderCache.get(folder.id)?.images ?? [];
  }
}

// ────────────────────────────────────────────────────────────────
// GET 핸들러
// ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (!ctx || (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER' && ctx.role !== 'AGENT')) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const foldersParam = searchParams.get('folders');
    const folderId    = searchParams.get('folderId');
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

    const allFolders = getAllFolders();

    // ── ?folders=true → 폴더 목록 + 각 이미지 수 ──────────────────
    if (foldersParam === 'true') {
      const summaries: FolderSummary[] = await Promise.all(
        allFolders.map(async (f) => {
          const images = await getOrFetchFolder(f);
          return { id: f.id, name: f.name, imageCount: images.length };
        })
      );

      return NextResponse.json({ ok: true, folders: summaries });
    }

    // ── ?folderId=xxx → 특정 폴더 이미지 페이지네이션 ─────────────
    if (folderId) {
      const folderDef = allFolders.find((f) => f.id === folderId);
      if (!folderDef) {
        return NextResponse.json(
          { ok: false, error: 'NOT_FOUND', message: '등록되지 않은 폴더 ID입니다.' },
          { status: 404 }
        );
      }

      const images    = await getOrFetchFolder(folderDef);
      const total     = images.length;
      const skip      = (page - 1) * limit;
      const paginated = images.slice(skip, skip + limit);
      const totalPages = Math.ceil(total / limit);

      const cacheEntry = folderCache.get(folderId);

      return NextResponse.json({
        ok: true,
        folderId,
        folderName: folderDef.name,
        images: paginated,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
        cacheExpiry: cacheEntry
          ? new Date(cacheEntry.fetchedAt + CACHE_DURATION).toISOString()
          : null,
      });
    }

    // ── 파라미터 없음 → 폴더 목록만 반환 (이미지 수 제외, 빠름) ───
    const folderList = allFolders.map((f) => ({ id: f.id, name: f.name }));
    return NextResponse.json({ ok: true, folders: folderList });
  } catch (err) {
    logger.error('[GET /api/image-library/google-drive]', { err });
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────
// POST 핸들러 — 커스텀 폴더 추가 (메모리, 서버 재시작 전까지 유효)
// ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (!ctx || (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER')) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '폴더 추가 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await req.json() as { action?: string; name?: string; driveId?: string };

    if (body.action !== 'add_folder') {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'action은 add_folder 여야 합니다.' },
        { status: 400 }
      );
    }

    const name    = (body.name    ?? '').trim();
    const driveId = (body.driveId ?? '').trim();

    if (!name || !driveId) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'name과 driveId는 필수입니다.' },
        { status: 400 }
      );
    }

    // 중복 확인
    const exists = getAllFolders().some((f) => f.id === driveId);
    if (exists) {
      return NextResponse.json(
        { ok: false, error: 'CONFLICT', message: '이미 등록된 폴더 ID입니다.' },
        { status: 409 }
      );
    }

    const newFolder: FolderDef = { name, id: driveId };
    customFolders.push(newFolder);

    logger.info(`[GoogleDrive] 커스텀 폴더 추가: ${name} (${driveId})`);

    return NextResponse.json(
      { ok: true, message: '폴더가 추가되었습니다 (서버 재시작 전까지 유효).', folder: newFolder },
      { status: 201 }
    );
  } catch (err) {
    logger.error('[POST /api/image-library/google-drive]', { err });
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
