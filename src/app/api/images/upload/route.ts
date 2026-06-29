export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { driveImageUrl } from '@/lib/drive-image';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { uploadImageToDrive, validateImageFile } from '@/lib/image-sync';
import { extractImageDimensions } from '@/lib/image-metadata';
import { logger } from '@/lib/logger';

/**
 * POST /api/images/upload
 * 이미지 파일을 Google Drive에 업로드
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const category = (formData.get('category') as string) || 'Other';
    const tagsStr = (formData.get('tags') as string) || '';
    const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];

    // 파일 검증
    if (!file) {
      return NextResponse.json(
        { ok: false, message: '파일이 없습니다' },
        { status: 400 }
      );
    }

    if (!validateImageFile(file.type)) {
      return NextResponse.json(
        { ok: false, message: '이미지 파일만 업로드 가능합니다 (JPEG, PNG, GIF, WebP, SVG)' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (100MB)
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, message: '파일 크기는 100MB 이하여야 합니다' },
        { status: 400 }
      );
    }

    let buffer = Buffer.from(await file.arrayBuffer());

    // 이미지 메타데이터 추출
    const dimensions = extractImageDimensions(buffer);

    // Sharp로 EXIF 기반 자동 회전 적용
    let finalBuffer: Buffer = buffer as Buffer;
    if (file.type.startsWith('image/')) {
      try {
        finalBuffer = await sharp(buffer).rotate().toBuffer();
        logger.info('[POST /api/images/upload] Sharp 자동 회전 완료', { fileName: file.name });
      } catch (rotateErr) {
        logger.warn('[POST /api/images/upload] Sharp 회전 실패, 원본 사용', {
          fileName: file.name,
          err: rotateErr instanceof Error ? rotateErr.message : String(rotateErr),
        });
        finalBuffer = buffer; // 실패 시 원본 사용
      }
    }

    // Drive 업로드 수행
    const asset = await uploadImageToDrive({
      organizationId: orgId,
      userId: ctx.userId!,
      orgName: orgId,
      buffer: finalBuffer,
      fileName: file.name,
      mimeType: file.type,
      category,
      tags,
      width: dimensions?.width,
      height: dimensions?.height,
      orientation: dimensions?.orientation,
    });

    logger.info('[POST /api/images/upload] 이미지 업로드 성공', {
      assetId: asset.id,
      fileName: file.name,
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: asset.id,
        originalFileName: asset.originalFileName,
        driveFileId: asset.driveFileId,
        category: asset.category,
        tags: asset.tags,
        uploadedAt: asset.uploadedAt,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize?.toString(),
        width: asset.width,
        height: asset.height,
        thumbnailUrl: driveImageUrl(asset.driveFileId),
      },
    });
  } catch (err) {
    logger.error('[POST /api/images/upload]', { err });
    return NextResponse.json(
      { ok: false, message: '업로드 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
