import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { uploadImageToDrive } from "@/lib/image-sync";
import { getDriveClient } from "@/lib/drive-client";
import sharp from "sharp";

// GET /api/image-library?q=검색어&folder=폴더
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const { searchParams } = new URL(req.url);
    const q      = searchParams.get("q");
    const folder = searchParams.get("folder");

    // ── ImageCache (읽기 전용) ──────────────────────────────
    const cacheImages = await prisma.imageCache.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { title:    { contains: q, mode: "insensitive" as const } },
                { fileName: { contains: q, mode: "insensitive" as const } },
                { tags:     { has: q } },
              ],
            }
          : {}),
        ...(folder ? { folder: { contains: folder, mode: "insensitive" } } : {}),
      },
      orderBy: { syncedAt: "desc" },
      take: 60,
      select: {
        id:           true,
        title:        true,
        thumbnailUrl: true,
        driveUrl:     true,
        folder:       true,
        tags:         true,
        fileName:     true,
      },
    });

    type CacheRow = {
      id: number; title: string; thumbnailUrl: string | null;
      driveUrl: string | null; folder: string; tags: string[];
      fileName: string;
    };

    const cacheResult = (cacheImages as CacheRow[]).map((img) => ({
      id:           String(img.id),
      title:        img.title ?? img.fileName,
      thumbnailUrl: img.thumbnailUrl ?? img.driveUrl ?? "",
      fullUrl:      img.driveUrl ?? img.thumbnailUrl ?? "",
      folder:       img.folder ?? "기타",
      tags:         img.tags,
      isGif:        img.fileName?.toLowerCase().endsWith(".gif") ?? false,
      isVideo:      false,
      source:       "cache" as const,
    }));

    // ── GLOBAL_ADMIN org 패턴 ─────────────────────────────
    let orgId: string;
    if (ctx.role === "GLOBAL_ADMIN" && !ctx.organizationId) {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) {
        return NextResponse.json({ ok: true, images: cacheResult });
      }
      orgId = firstOrg.id;
    } else {
      orgId = resolveOrgId(ctx);
    }

    // ── ImageAsset (CRM 자체 이미지) ──────────────────────
    const assetImages = await prisma.imageAsset.findMany({
      where: {
        organizationId: orgId,
        ...(q
          ? {
              OR: [
                { originalFileName: { contains: q, mode: "insensitive" as const } },
                { tags:             { has: q } },
              ],
            }
          : {}),
        ...(folder ? { category: { contains: folder, mode: "insensitive" } } : {}),
      },
      orderBy: { uploadedAt: "desc" },
      take: 60,
    });

    const assetResult = assetImages.map((asset) => ({
      id:           asset.id,
      title:        asset.originalFileName,
      // 모달 썸네일: proxy (인증 보장)
      thumbnailUrl: `/api/landing-pages/images/proxy?id=${asset.driveFileId}`,
      // 삽입 HTML용: Drive 공개 URL (랜딩페이지에서 외부 공개)
      fullUrl:      `https://drive.google.com/thumbnail?id=${asset.driveFileId}&sz=w1200`,
      folder:       asset.category ?? "기타",
      tags:         asset.tags,
      isGif:        asset.mimeType === "image/gif",
      isVideo:      false,
      source:       "asset" as const,
      driveFileId:  asset.driveFileId,
    }));

    const result = [...assetResult, ...cacheResult];

    return NextResponse.json({ ok: true, images: result });
  } catch (err) {
    logger.error("[GET /api/image-library]", { err });
    return NextResponse.json({ ok: false, images: [] }, { status: 500 });
  }
}

// POST /api/image-library  (multipart/form-data: file, folder?, title?)
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    // ── GLOBAL_ADMIN org 패턴 ─────────────────────────────
    let orgId: string;
    if (ctx.role === "GLOBAL_ADMIN" && !ctx.organizationId) {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) return NextResponse.json({ ok: false, error: "조직 없음" }, { status: 500 });
      orgId = firstOrg.id;
    } else {
      orgId = resolveOrgId(ctx);
    }

    // 조직명 조회
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    const orgName = org?.name ?? orgId;

    // FormData 파싱
    const formData = await req.formData();
    const file = formData.get("file");
    const folderParam = (formData.get("folder") as string | null) ?? "기타";
    const titleParam  = (formData.get("title")  as string | null) ?? null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "파일이 없습니다" }, { status: 400 });
    }

    // 파일 검증
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "이미지 파일만 업로드 가능합니다" }, { status: 400 });
    }
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: "파일 크기는 20MB 이하여야 합니다" }, { status: 400 });
    }

    // 원본 파일명
    const originalName = (file as File).name ?? `upload_${Date.now()}`;
    const arrayBuffer  = await file.arrayBuffer();
    const inputBuffer  = Buffer.from(arrayBuffer);

    // Sharp 처리
    const isGif = file.type === "image/gif";
    let outputBuffer: Buffer;
    let outputMimeType: string;
    let outputFileName: string;
    let width: number | undefined;
    let height: number | undefined;

    if (isGif) {
      // GIF: 최대 1200px 리사이즈, 포맷 유지
      const sharpMeta = await sharp(inputBuffer, { animated: true }).metadata();
      const origWidth = sharpMeta.width ?? 0;

      if (origWidth > 1200) {
        outputBuffer = await sharp(inputBuffer, { animated: true })
          .resize({ width: 1200, withoutEnlargement: true })
          .gif()
          .toBuffer();
      } else {
        outputBuffer = inputBuffer;
      }

      outputMimeType = "image/gif";
      outputFileName = titleParam
        ? `${titleParam}.gif`
        : originalName.endsWith(".gif") ? originalName : `${originalName}.gif`;

      const meta = await sharp(outputBuffer, { animated: true }).metadata();
      width  = meta.width;
      height = meta.height;
    } else {
      // 나머지: WebP 변환 (quality 85, 최대 1600px)
      const pipeline = sharp(inputBuffer)
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 85 });

      outputBuffer = await pipeline.toBuffer();
      outputMimeType = "image/webp";

      const baseName = originalName.replace(/\.[^.]+$/, "");
      outputFileName = titleParam ? `${titleParam}.webp` : `${baseName}.webp`;

      const meta = await sharp(outputBuffer).metadata();
      width  = meta.width;
      height = meta.height;
    }

    // Drive 업로드
    const asset = await uploadImageToDrive({
      organizationId: orgId,
      userId: ctx.userId ?? "unknown",
      orgName,
      buffer: outputBuffer,
      fileName: outputFileName,
      mimeType: outputMimeType,
      category: folderParam,
      tags: [],
      width,
      height,
    });

    // Drive 파일 공개 권한 설정 (anyoneWithLink reader)
    const drive = getDriveClient();
    await drive.permissions.create({
      fileId: asset.driveFileId,
      requestBody: { role: "reader", type: "anyone" },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      image: {
        id:           asset.id,
        source:       "asset" as const,
        title:        asset.originalFileName,
        thumbnailUrl: `/api/landing-pages/images/proxy?id=${asset.driveFileId}`,
        fullUrl:      `https://drive.google.com/thumbnail?id=${asset.driveFileId}&sz=w1200`,
        folder:       asset.category ?? "기타",
        isGif:        asset.mimeType === "image/gif",
        mimeType:     asset.mimeType,
        driveFileId:  asset.driveFileId,
      },
    });
  } catch (err) {
    logger.error("[POST /api/image-library]", { err });
    return NextResponse.json({ ok: false, error: "업로드 실패" }, { status: 500 });
  }
}
