import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getEffectiveImageUrl } from '@/lib/cloudinary-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 크루즈 사진 응답 타입
 */
interface CruisePhoto {
  id: string;
  name: string;
  url: string;
  folder: string;
  size: number | null;
}

/**
 * 폴더별 이미지 그룹 응답 타입
 */
interface FolderGroup {
  folder: string;
  count: number;
  images: CruisePhoto[];
}

/**
 * GET /api/admin/cruise-photos
 *
 * 크루즈 관련 이미지를 폴더별로 조회합니다.
 *
 * 쿼리 파라미터:
 * - folder: (선택사항) 특정 폴더만 조회 (예: "cruise/ship-photos")
 * - format: (선택사항) 응답 형식 - "grouped" (기본값) | "flat"
 *
 * 응답 형식 (grouped):
 * {
 *   ok: true,
 *   data: {
 *     folders: [
 *       {
 *         folder: "cruise/ship-photos",
 *         count: 15,
 *         images: [
 *           {
 *             id: "cloudinary_url",
 *             name: "ship-01.jpg",
 *             url: "https://res.cloudinary.com/...",
 *             folder: "cruise/ship-photos",
 *             size: 245000
 *           }
 *         ]
 *       }
 *     ],
 *     stats: {
 *       totalFolders: 5,
 *       totalImages: 100
 *     }
 *   }
 * }
 *
 * 응답 형식 (flat):
 * {
 *   ok: true,
 *   data: {
 *     images: [...]
 *   }
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // 관리자 인증 확인
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      logger.error('[Admin Cruise Photos GET] Unauthorized access attempt');
      return NextResponse.json(
        { ok: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const folderFilter = searchParams.get('folder');
    const format = searchParams.get('format') || 'grouped';

    // ImageCache에서 이미지 조회 (cloudinaryUrl 또는 webpUrl 또는 driveUrl 중 하나 필수)
    // 우선순위: cloudinaryUrl (Cloudinary) > webpUrl (Google Drive WebP) > driveUrl (Google Drive 원본)
    const where: {
      OR: Array<{ driveUrl: { not: null } }>;
      folder?: string;
    } = {
      OR: [
        { driveUrl: { not: null } },
      ],
    };

    if (folderFilter) {
      where.folder = folderFilter;
    }

    const imageCaches = await prisma.imageCache.findMany({
      where,
      select: {
        id: true,
        cloudinaryUrl: true,
        webpUrl: true,
        driveUrl: true,
        fileName: true,
        folder: true,
        fileSize: true,
      },
      orderBy: [{ folder: 'asc' }, { fileName: 'asc' }],
    });

    if (format === 'flat') {
      // 평탄 형식 응답
      const images: CruisePhoto[] = imageCaches
        .filter((img) => getEffectiveImageUrl(img) !== null)
        .map((img) => {
          const url = getEffectiveImageUrl(img) || '';
          return {
            id: url,
            name: img.fileName,
            url,
            folder: img.folder,
            size: img.fileSize,
          };
        });

      return NextResponse.json({
        ok: true,
        data: {
          images,
          count: images.length,
        },
      });
    }

    // 폴더별 그룹화 (기본값)
    const folderMap = new Map<string, CruisePhoto[]>();

    imageCaches
      .filter((img) => getEffectiveImageUrl(img) !== null)
      .forEach((img) => {
        const url = getEffectiveImageUrl(img) || '';
        const photo: CruisePhoto = {
          id: url,
          name: img.fileName,
          url,
          folder: img.folder,
          size: img.fileSize,
        };

        if (!folderMap.has(img.folder)) {
          folderMap.set(img.folder, []);
        }
        folderMap.get(img.folder)!.push(photo);
      });

    // 폴더별 그룹화된 응답 생성
    const folders: FolderGroup[] = Array.from(folderMap.entries())
      .map(([folderName, images]) => ({
        folder: folderName,
        count: images.length,
        images,
      }))
      .sort((a, b) => a.folder.localeCompare(b.folder));

    const totalImages = imageCaches.length;

    logger.log('[Admin Cruise Photos GET] Success', {
      folderFilter: folderFilter || 'all',
      format,
      totalFolders: folders.length,
      totalImages,
    });

    return NextResponse.json({
      ok: true,
      data: {
        folders,
        stats: {
          totalFolders: folders.length,
          totalImages,
        },
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[Admin Cruise Photos GET] Error', {
      message: msg,
    });

    return NextResponse.json(
      { ok: false, error: '크루즈 이미지를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
