import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { getDriveClient } from '@/lib/drive-client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/images/[id]
 * 개별 이미지 상세 조회
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const asset = await prisma.imageAsset.findUnique({
      where: { id: params.id },
    });

    if (!asset || asset.organizationId !== orgId) {
      return NextResponse.json(
        { ok: false, message: '이미지를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: asset.id,
        fileName: asset.originalFileName,
        driveFileId: asset.driveFileId,
        category: asset.category,
        tags: asset.tags,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize?.toString(),
        width: asset.width,
        height: asset.height,
        uploadedAt: asset.uploadedAt.toISOString(),
        uploadedBy: asset.uploadedBy,
        lastAccessedAt: asset.lastAccessedAt?.toISOString(),
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${asset.driveFileId}`,
        driveUrl: `https://drive.google.com/file/d/${asset.driveFileId}`,
      },
    });
  } catch (err) {
    logger.error('[GET /api/images/[id]]', { err });
    return NextResponse.json(
      { ok: false, message: '조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/images/[id]
 * 이미지 메타데이터 수정 (category, tags)
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { category, tags } = await req.json();

    const asset = await prisma.imageAsset.findUnique({
      where: { id: params.id },
    });

    if (!asset || asset.organizationId !== orgId) {
      return NextResponse.json(
        { ok: false, message: '이미지를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const updated = await prisma.imageAsset.update({
      where: { id: params.id },
      data: {
        ...(category && { category }),
        ...(tags && { tags }),
        lastAccessedAt: new Date(),
      },
    });

    logger.info('[PATCH /api/images/[id]] 메타데이터 수정', {
      assetId: params.id,
      category,
      tagsCount: tags?.length,
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: updated.id,
        category: updated.category,
        tags: updated.tags,
      },
    });
  } catch (err) {
    logger.error('[PATCH /api/images/[id]]', { err });
    return NextResponse.json(
      { ok: false, message: '수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/images/[id]
 * 이미지 삭제 (DB 기록만 삭제, Drive 파일은 유지)
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const asset = await prisma.imageAsset.findUnique({
      where: { id: params.id },
    });

    if (!asset || asset.organizationId !== orgId) {
      return NextResponse.json(
        { ok: false, message: '이미지를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // DB에서만 삭제 (Drive 파일은 유지)
    await prisma.imageAsset.delete({
      where: { id: params.id },
    });

    logger.info('[DELETE /api/images/[id]] 이미지 삭제', {
      assetId: params.id,
      driveFileId: asset.driveFileId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /api/images/[id]]', { err });
    return NextResponse.json(
      { ok: false, message: '삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
