import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId, canDelete } from "@/lib/rbac";
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

    // 삭제는 관리자(GLOBAL_ADMIN)·지사장(OWNER)만 — 대리점장(AGENT) 등은 조직 자산 삭제 불가
    if (!canDelete(ctx)) {
      return NextResponse.json({ ok: false, error: "삭제 권한이 없습니다" }, { status: 403 });
    }

    // GLOBAL_ADMIN: orgId null이면 전체 조직 접근 허용
    const isGlobalAdmin = ctx.role === "GLOBAL_ADMIN" && !ctx.organizationId;
    const orgId: string | null = isGlobalAdmin ? null : resolveOrgId(ctx);

    // ImageAsset 조회
    const asset = await prisma.imageAsset.findUnique({ where: { id } });

    if (!asset) {
      return NextResponse.json({ ok: false, error: "이미지를 찾을 수 없습니다" }, { status: 404 });
    }
    // GLOBAL_ADMIN이 아닌 경우에만 조직 소유권 확인
    if (!isGlobalAdmin && asset.organizationId !== orgId) {
      return NextResponse.json({ ok: false, error: "접근 권한이 없습니다" }, { status: 403 });
    }

    // Drive에서 파일 삭제
    const drive = getDriveClient();
    await drive.files.delete({ fileId: asset.driveFileId }).catch((err) => {
      logger.warn("[DELETE /api/image-library] Drive 파일 삭제 실패 (무시)", { err, driveFileId: asset.driveFileId });
    });

    // DB에서 삭제 (ImageCache는 건드리지 않음)
    // GLOBAL_ADMIN이면 organizationId 조건 생략 → 모든 조직 자산 삭제 가능
    await prisma.imageAsset.deleteMany({
      where: { id, ...(isGlobalAdmin ? {} : { organizationId: orgId! }) },
    });

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

    // GLOBAL_ADMIN: orgId null이면 전체 조직 접근 허용
    const isGlobalAdmin = ctx.role === "GLOBAL_ADMIN" && !ctx.organizationId;
    const orgId: string | null = isGlobalAdmin ? null : resolveOrgId(ctx);

    const body = await req.json() as { title?: string; folder?: string };

    // 입력 검증: title과 folder
    const CATEGORIES = ["전체", "지중해", "카리브해", "알래스카", "선박", "객실", "후기", "기타"];

    const title = body.title?.trim() ?? null;
    if (title !== null && !/^[a-zA-Z0-9가-힣\s\-_.]{1,255}$/.test(title)) {
      return NextResponse.json(
        { ok: false, error: "제목은 1-255자, 영문/숫자/한글/공백/-/_/.만 허용됩니다" },
        { status: 400 }
      );
    }

    const folder = body.folder?.trim();
    if (folder && !CATEGORIES.includes(folder)) {
      return NextResponse.json(
        { ok: false, error: `폴더는 다음 중 선택해야 합니다: ${CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    // ImageAsset 조회
    const asset = await prisma.imageAsset.findUnique({ where: { id } });

    if (!asset) {
      return NextResponse.json({ ok: false, error: "이미지를 찾을 수 없습니다" }, { status: 404 });
    }
    // GLOBAL_ADMIN이 아닌 경우에만 조직 소유권 확인
    if (!isGlobalAdmin && asset.organizationId !== orgId) {
      return NextResponse.json({ ok: false, error: "접근 권한이 없습니다" }, { status: 403 });
    }

    // 업데이트
    const updated = await prisma.imageAsset.update({
      where: { id },
      data: {
        ...(title !== null ? { originalFileName: title } : {}),
        ...(folder ? { category: folder } : {}),
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
