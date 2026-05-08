import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { uploadImageToDrive, validateImageFile } from '@/lib/image-sync';
import { logger } from '@/lib/logger';

/**
 * POST /api/images/upload
 * 이미지 파일을 Google Drive에 업로드
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

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

    const buffer = Buffer.from(await file.arrayBuffer());

    // Drive 업로드 수행
    const asset = await uploadImageToDrive({
      organizationId: orgId,
      userId: ctx.userId!,
      orgName: ctx.organization?.name || orgId,
      buffer,
      fileName: file.name,
      mimeType: file.type,
      category,
      tags,
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
