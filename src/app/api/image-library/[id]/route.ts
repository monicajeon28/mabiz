import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { getDriveClient } from "@/lib/drive-client";
import { logger } from "@/lib/logger";

// DELETE /api/image-library/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;

    // GLOBAL_ADMIN org 패턴
    let orgId: string;
    if (ctx.role === "GLOBAL_ADMIN" && !ctx.organizationId) {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false, error: "조직 없음" }, { status: 500 });
      orgId = firstOrg.id;
    } else {
      orgId = resolveOrgId(ctx);
    }

    // ImageAsset 조회 + 조직 소유권 확인
    const asset = await prisma.imageAsset.findUnique({ where: { id } });

    if (!asset) {
      return NextResponse.json({ ok: false, error: "이미지를 찾을 수 없습니다" }, { status: 404 });
    }
    if (asset.organizationId !== orgId) {
      return NextResponse.json({ ok: false, error: "접근 권한이 없습니다" }, { status: 403 });
    }

    // Drive에서 파일 삭제
    const drive = getDriveClient();
    await drive.files.delete({ fileId: asset.driveFileId }).catch((err) => {
      logger.warn("[DELETE /api/image-library] Drive 파일 삭제 실패 (무시)", { err, driveFileId: asset.driveFileId });
    });

    // DB에서 삭제 (ImageCache는 건드리지 않음)
    await prisma.imageAsset.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[DELETE /api/image-library/[id]]", { err });
    return NextResponse.json({ ok: false, error: "삭제 실패" }, { status: 500 });
  }
}

// PATCH /api/image-library/[id]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;

    // GLOBAL_ADMIN org 패턴
    let orgId: string;
    if (ctx.role === "GLOBAL_ADMIN" && !ctx.organizationId) {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false, error: "조직 없음" }, { status: 500 });
      orgId = firstOrg.id;
    } else {
      orgId = resolveOrgId(ctx);
    }

    const body = await req.json() as { title?: string; folder?: string };

    // ImageAsset 조회 + 조직 소유권 확인
    const asset = await prisma.imageAsset.findUnique({ where: { id } });

    if (!asset) {
      return NextResponse.json({ ok: false, error: "이미지를 찾을 수 없습니다" }, { status: 404 });
    }
    if (asset.organizationId !== orgId) {
      return NextResponse.json({ ok: false, error: "접근 권한이 없습니다" }, { status: 403 });
    }

    // 업데이트
    const updated = await prisma.imageAsset.update({
      where: { id },
      data: {
        ...(body.title  !== undefined ? { originalFileName: body.title  } : {}),
        ...(body.folder !== undefined ? { category:         body.folder } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      image: {
        id:           updated.id,
        source:       "asset" as const,
        title:        updated.originalFileName,
        folder:       updated.category ?? "기타",
        thumbnailUrl: `/api/landing-pages/images/proxy?id=${updated.driveFileId}`,
        fullUrl:      `/api/landing-pages/images/proxy?id=${updated.driveFileId}`,
        isGif:        updated.mimeType === "image/gif",
        mimeType:     updated.mimeType,
      },
    });
  } catch (err) {
    logger.error("[PATCH /api/image-library/[id]]", { err });
    return NextResponse.json({ ok: false, error: "수정 실패" }, { status: 500 });
  }
}
