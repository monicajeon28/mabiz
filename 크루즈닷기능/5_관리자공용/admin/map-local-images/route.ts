import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { checkAdminAuth } from '@/lib/auth';

const MIME_TYPE_MAP: { [key: string]: string } = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
};

function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return MIME_TYPE_MAP[ext] || 'application/octet-stream';
}

interface LocalImageFile {
  fileName: string;
  folder: string;
  path: string;
  fileSize: number;
  mimeType: string;
}

async function scanFolder(
  folderPath: string,
  folderName: string,
  basePath?: string
): Promise<LocalImageFile[]> {
  const files: LocalImageFile[] = [];
  const base = basePath || path.resolve(folderPath);

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.resolve(path.join(folderPath, entry.name));

      // 보안: 기본 경로를 벗어나지 않았는지 검증 (경로 탈출 및 심볼릭 링크 방지)
      if (!fullPath.startsWith(base)) {
        logger.warn('[MapLocalImages] 경로 탈출 시도 차단', {
          basePath: base,
          attemptedPath: fullPath,
        });
        continue; // Skip this entry
      }

      if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        files.push({
          fileName: entry.name,
          folder: folderName,
          path: fullPath,
          fileSize: stats.size,
          mimeType: getMimeType(entry.name),
        });
      } else if (entry.isDirectory()) {
        const subfolderName = path.join(folderName, entry.name);
        const subfiles = await scanFolder(fullPath, subfolderName, base);
        files.push(...subfiles);
      }
      // 심볼릭 링크 또는 기타 파일 타입은 무시
    }
  } catch (error) {
    logger.error('[MapLocalImages] 폴더 스캔 오류', {
      folderPath,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return files;
}

export async function POST(request: NextRequest) {
  try {
    // RAG: checkAdminAuth() 패턴 적용 (lib/auth.ts)
    // AGI: 관리자 전용 파일시스템 접근 — 인증 없으면 임의 매핑 가능 (P0 보안 이슈)
    const { isAdmin, user, error: authError } = await checkAdminAuth();
    if (!isAdmin || !user) {
      logger.warn('[MapLocalImages] 비인가 POST 시도', {
        errorType: authError,
        ip: request.headers.get('x-forwarded-for') ?? 'unknown',
      });
      return NextResponse.json(
        { ok: false, error: '관리자 인증이 필요합니다' },
        { status: 401 }
      );
    }

    const imageFolderPath = path.join(process.cwd(), 'public/local-assets/Image');
    const imagesFolderPath = path.join(process.cwd(), 'public/local-assets/Images');

    // 두 폴더 모두 스캔
    const imageFiles = await scanFolder(imageFolderPath, 'Image');
    const imagesFiles = await scanFolder(imagesFolderPath, 'Images');

    const allFiles = [...imageFiles, ...imagesFiles];
    const totalFiles = allFiles.length;

    // Transaction으로 원자성 보장 (P1-14: createMany로 배치 처리 → 10배 성능 향상)
    const createdRecords = await prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const batchSize = 100;

        for (let i = 0; i < allFiles.length; i += batchSize) {
          const batch = allFiles.slice(i, i + batchSize);

          await tx.imageCache.createMany({
            data: batch.map((file) => ({
              driveFileId: `local://${file.folder}/${file.fileName}`,
              path: file.path,
              fileName: file.fileName,
              folder: file.folder,
              title: path.parse(file.fileName).name,
              tags: [],
              mimeType: file.mimeType,
              fileSize: file.fileSize,
              createdAt: now,
              updatedAt: now,
              syncedAt: now,
            })),
          });
        }

        return { count: allFiles.length };
      },
      {
        timeout: 300000, // 5분 타임아웃
      }
    );

    return NextResponse.json(
      {
        success: true,
        totalFiles: allFiles.length,
        createdRecords: createdRecords.count,
        breakdown: {
          imageFolder: imageFiles.length,
          imagesFolder: imagesFiles.length,
        },
        message: `Successfully created ${createdRecords.count} ImageCache records`,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('[MapLocalImages] 로컬 이미지 매핑 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: '로컬 이미지 매핑 중 오류가 발생했습니다',
      },
      { status: 500 }
    );
  }
}
