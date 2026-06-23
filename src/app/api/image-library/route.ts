import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthContext, resolveOrgId } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { uploadImageToDrive } from "@/lib/image-sync";
import { getDriveClient } from "@/lib/drive-client";
import sharp from "sharp";
import { MAX_IMAGE_UPLOAD_BYTES, processUploadedImage } from "@/lib/image-upload-processing";

// App Router에서 formData 크기 제한 설정
export const maxDuration = 60; // Vercel Pro: 60초

// GET /api/image-library?q=검색어&folder=폴더
export async function GET(req: Request) {
  try {
    let ctx;
    try {
      ctx = await getAuthContext();
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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

    const cacheResult = (cacheImages as CacheRow[]).map((img) => {
      // driveUrl에서 파일 ID 추출: https://...?id=FILE_ID 형식
      const fileIdMatch = img.driveUrl?.match(/[?&]id=([^&]+)/);
      const fileId = fileIdMatch?.[1] || img.driveUrl?.split('/').pop() || '';
      const proxyUrl = fileId ? `/api/landing-pages/images/proxy?id=${fileId}` : '';

      return {
        id:           String(img.id),
        title:        img.title ?? img.fileName,
        thumbnailUrl: proxyUrl || img.thumbnailUrl || "",
        fullUrl:      proxyUrl || img.driveUrl || img.thumbnailUrl || "",
        folder:       img.folder ?? "기타",
        tags:         img.tags,
        isGif:        img.fileName?.toLowerCase().endsWith(".gif") ?? false,
        isVideo:      false,
        source:       "cache" as const,
      };
    });

    // ── GLOBAL_ADMIN: orgId null이면 전체 조직 조회 ────────
    const orgId: string | null =
      ctx.role === "GLOBAL_ADMIN" && !ctx.organizationId
        ? null
        : resolveOrgId(ctx);

    // ── ImageAsset (CRM 자체 이미지) ──────────────────────
    const assetImages = await prisma.imageAsset.findMany({
      where: {
        // GLOBAL_ADMIN(orgId=null)이면 organizationId 필터 생략 → 전체 조직
        ...(orgId ? { organizationId: orgId } : {}),
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
      // 삽입 HTML용: proxy로 통일 (모든 이미지 미리보기처럼 제공)
      fullUrl:      `/api/landing-pages/images/proxy?id=${asset.driveFileId}`,
      folder:       asset.category ?? "기타",
      tags:         asset.tags,
      isGif:        asset.mimeType === "image/gif",
      isVideo:      false,
      source:       "asset" as const,
      driveFileId:  asset.driveFileId,
    }));

    const result = [...assetResult, ...cacheResult];

    return NextResponse.json({ ok: true, images: result, total: result.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;

    // P0: 인증 실패 (이미 위에서 처리되지만, 이중 확인)
    if (message === 'UNAUTHORIZED') {
      logger.warn("[GET /api/image-library] 인증 실패", { message });
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }

    // P1: 조직 정보 누락
    if (message.includes('ORGANIZATION_REQUIRED') || message.includes('NO_ORGANIZATION')) {
      logger.warn("[GET /api/image-library] 조직 정보 누락", { message });
      return NextResponse.json({ ok: false, error: '조직 정보가 필요합니다' }, { status: 403 });
    }

    // P2: 나머지 에러는 상세히 로깅
    logger.error("[GET /api/image-library] 쿼리 실패", { message, stack, errType: err?.constructor?.name });
    return NextResponse.json(
      { ok: false, error: '이미지를 불러올 수 없습니다', message: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 }
    );
  }
}

// POST /api/image-library  (multipart/form-data: file, folder?, title?)
export async function POST(req: Request) {
  // Content-Length 사전 체크 (413 전에 명확한 에러)
  const contentLength = req.headers.get('content-length');
  const parsedLen = contentLength ? parseInt(contentLength, 10) : NaN;
  if (!isNaN(parsedLen) && parsedLen > MAX_IMAGE_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: '파일이 너무 큽니다. 100MB 이하 파일을 업로드해주세요.' },
      { status: 413 }
    );
  }

  let userId: string | undefined;
  let fileSize: number | undefined;
  try {
    const ctx = await getAuthContext();
    userId = ctx.userId ?? undefined;

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
    fileSize = file.size;

    // 파일 검증 — Windows 드래그&드롭 시 MIME 타입 빈 문자열 대응
    const extMimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
    };
    const fileExt = ((file as File).name ?? '').split('.').pop()?.toLowerCase() ?? '';
    const resolvedMime = file.type || extMimeMap[fileExt] || '';
    if (!resolvedMime.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "이미지 파일만 업로드 가능합니다" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "파일 크기는 100MB 이하여야 합니다" }, { status: 400 });
    }

    // 원본 파일명
    const originalName = (file as File).name ?? `upload_${Date.now()}`;
    const arrayBuffer  = await file.arrayBuffer();
    const inputBuffer  = Buffer.from(arrayBuffer);

    // Sharp 처리
    const processed = await processUploadedImage(
      inputBuffer,
      resolvedMime,
      originalName,
      titleParam ?? undefined,
    );
    const { buffer: outputBuffer, mimeType: outputMimeType, fileName: outputFileName } = processed;
    const meta = await sharp(outputBuffer, outputMimeType === "image/gif" ? { animated: true } : undefined).metadata();
    const width = meta.width;
    const height = meta.height;

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
    }).catch((err: unknown) => {
      logger.warn("[POST /api/image-library] Drive 공개 권한 설정 실패", {
        driveFileId: asset.driveFileId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

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
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;

    // P0: 인증 실패
    if (message === 'UNAUTHORIZED') {
      logger.warn("[POST /api/image-library] 인증 실패", { message, userId });
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    // P0: 조직 정보 누락
    if (message.includes('ORGANIZATION_REQUIRED') || message.includes('NO_ORGANIZATION') || message.includes('조직 없음')) {
      logger.warn("[POST /api/image-library] 조직 정보 누락", { message, userId });
      return NextResponse.json(
        { ok: false, error: '조직 정보가 필요합니다' },
        { status: 403 }
      );
    }

    // P1: 413/크기 초과 감지
    const isSizeError = message.toLowerCase().includes('too large') ||
                        message.toLowerCase().includes('size') ||
                        message.toLowerCase().includes('413') ||
                        message.toLowerCase().includes('payload');
    if (isSizeError) {
      logger.warn("[POST /api/image-library] 파일 크기 초과", { message, fileSize, userId });
      return NextResponse.json(
        { ok: false, error: '파일이 너무 큽니다. 이미지를 압축하거나 100MB 이하 파일을 사용해주세요.' },
        { status: 413 }
      );
    }

    // P2: FormData 파싱 오류인 경우 명확한 에러 메시지
    const isFormDataError = message.includes("FormData") || message.includes("multipart");
    const userMessage = isFormDataError
      ? "파일 형식이 잘못되었거나 크기가 너무 큽니다"
      : "업로드 실패";

    logger.error("[POST /api/image-library] 업로드 실패", {
      message,
      stack,
      userId,
      isFormDataError,
      fileSize,
      errType: err?.constructor?.name,
    });

    return NextResponse.json(
      { ok: false, error: userMessage, devMessage: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: isFormDataError ? 400 : 500 }
    );
  }
}
