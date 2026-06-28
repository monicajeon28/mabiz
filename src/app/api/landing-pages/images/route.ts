export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import sharp from 'sharp';
import prisma from '@/lib/prisma';
import { getAuthContext, landingOwnershipScope, canEditLandingPages } from '@/lib/rbac';
import { MAX_IMAGE_UPLOAD_BYTES, processUploadedImage } from '@/lib/image-upload-processing';

// 소유권은 landingOwnershipScope(ctx)로 통일 — 편집기 GET([id]/route.ts)과 동일 규칙.
//   • GLOBAL_ADMIN(모니카·저스틴): 전 조직 / OWNER(지사): 본인 조직 / AGENT(대리점장): 본인 생성분만
// 과거: GLOBAL_ADMIN일 때 정렬 없는 findFirst()로 임의 조직을 골라 본인 페이지를 404 처리하던 버그 제거.
// 생성되는 이미지는 업로더 소속이 아니라 "그 페이지의 소속(page.organizationId)"을 따라간다.
import { uploadImageToDrive } from '@/lib/image-sync';
import { getDriveClient } from '@/lib/drive-client';
import { logger } from '@/lib/logger';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * POST /api/landing-pages/images
 * 랜딩페이지 이미지 업로드 (WebP 자동 변환, GIF 압축 유지, Drive 백업)
 *
 * FormData: file, landingPageId, sortOrder?
 * Response: { ok, image: { id, url, width, height, mimeType, sortOrder } }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!canEditLandingPages(ctx)) {
      return NextResponse.json({ ok: false, message: '랜딩페이지 권한이 없습니다' }, { status: 403 });
    }
    const scope = landingOwnershipScope(ctx);

    // JSON body: 라이브러리 이미지 등록 (파일 업로드 없이 driveFileId로 연결)
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = await req.json() as { landingPageId?: string; driveFileId?: string; sortOrder?: number };
      const { landingPageId: lpId, driveFileId, sortOrder: sortOrderVal } = body;

      if (!lpId || !driveFileId) {
        return NextResponse.json(
          { ok: false, message: 'landingPageId와 driveFileId는 필수입니다' },
          { status: 400 },
        );
      }

      // 소유권 확인 (GLOBAL_ADMIN은 org 필터 생략 = 전 조직 허용)
      const page = await prisma.crmLandingPage.findFirst({
        where: { id: lpId, ...scope },
        select: { id: true, organizationId: true },
      });
      if (!page) {
        return NextResponse.json(
          { ok: false, message: '랜딩페이지를 찾을 수 없습니다' },
          { status: 404 },
        );
      }

      // 기존 ImageAsset 조회 (driveFileId로, 페이지 소속 조직으로 격리)
      const asset = await prisma.imageAsset.findFirst({
        where: { driveFileId, organizationId: page.organizationId },
        select: { id: true, driveFileId: true, originalFileName: true, mimeType: true, width: true, height: true },
      });
      if (!asset) {
        return NextResponse.json(
          { ok: false, message: '이미지를 찾을 수 없습니다. 먼저 파일로 업로드해주세요.' },
          { status: 404 },
        );
      }

      const resolvedSortOrder = sortOrderVal ?? await getNextSortOrder(lpId);
      const pageImage = await prisma.crmLandingPageImage.create({
        data: { landingPageId: lpId, imageAssetId: asset.id, sortOrder: resolvedSortOrder },
      });

      const thumbnailUrl = `/api/landing-pages/images/proxy?id=${asset.driveFileId}`;
      return NextResponse.json({
        ok: true,
        image: {
          id: pageImage.id,
          assetId: asset.id,
          url: thumbnailUrl,
          driveFileId: asset.driveFileId,
          width: asset.width || 0,
          height: asset.height || 0,
          mimeType: asset.mimeType || 'image/webp',
          fileName: asset.originalFileName || '라이브러리 이미지',
          sortOrder: resolvedSortOrder,
        },
      });
    }

    // P0-1: Content-Length 헤더 사전 검증
    const contentLength = req.headers.get('content-length');
    if (contentLength) {
      const sizeBytes = parseInt(contentLength, 10);
      if (sizeBytes > MAX_IMAGE_UPLOAD_BYTES) {
        return NextResponse.json(
          { ok: false, message: `파일 크기는 100MB 이하여야 합니다 (현재: ${(sizeBytes / 1024 / 1024).toFixed(1)}MB)` },
          { status: 413 },
        );
      }
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const landingPageId = formData.get('landingPageId') as string | null;
    const sortOrderStr = formData.get('sortOrder') as string | null;

    if (!file || !landingPageId) {
      return NextResponse.json(
        { ok: false, message: '파일과 landingPageId는 필수입니다' },
        { status: 400 },
      );
    }

    // Windows 드래그&드롭 시 MIME 타입이 빈 문자열일 수 있어 확장자로 추론
    const extMime: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp',
    };
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const mimeFromExt = extMime[ext] || '';

    // P0-2: Magic bytes 검증
    const magicCheck = await validateFileMagic(file);
    if (!magicCheck.valid) {
      return NextResponse.json(
        { ok: false, message: `유효하지 않은 이미지 형식입니다 (${magicCheck.detected || '감지 불가'})` },
        { status: 400 },
      );
    }
    const resolvedType = magicCheck.mimeType || mimeFromExt || '';

    if (!ALLOWED_TYPES.includes(resolvedType)) {
      return NextResponse.json(
        { ok: false, message: 'JPG, PNG, WebP, GIF만 업로드 가능합니다' },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, message: '파일 크기는 100MB 이하여야 합니다' },
        { status: 400 },
      );
    }

    // 랜딩페이지 소유권 확인 (GLOBAL_ADMIN은 org 필터 생략 = 전 조직 허용)
    const page = await prisma.crmLandingPage.findFirst({
      where: { id: landingPageId, ...scope },
      select: { id: true, title: true, organizationId: true },
    });
    if (!page) {
      return NextResponse.json(
        { ok: false, message: '랜딩페이지를 찾을 수 없습니다' },
        { status: 404 },
      );
    }

    // 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);
    const processed = await processUploadedImage(originalBuffer, resolvedType, file.name);
    const { buffer: processedBuffer, mimeType: finalMimeType, fileName: finalFileName, isAnimated } = processed;

    // 메타데이터 추출 — animated GIF fallback일 때만 pages로 나눔
    const meta = await sharp(processedBuffer, finalMimeType === 'image/gif' ? { animated: true } : undefined).metadata();
    const displayHeight = isAnimated && finalMimeType === 'image/gif' && meta.pages && meta.pages > 1
      ? Math.round((meta.height ?? 0) / meta.pages)
      : meta.height;

    // 조직명 조회 (Drive 폴더용) — 이미지는 페이지 소속 조직에 귀속
    const org = await prisma.organization.findUnique({
      where: { id: page.organizationId },
      select: { name: true },
    });

    // Google Drive 백업 (랜딩페이지 전용 폴더)
    const asset = await uploadImageToDrive({
      organizationId: page.organizationId,
      userId: ctx.userId,
      orgName: org?.name || page.organizationId,
      buffer: processedBuffer,
      fileName: finalFileName,
      mimeType: finalMimeType,
      category: `랜딩페이지/${page.title}`,
      tags: ['landing-page', landingPageId],
      width: meta.width,
      height: displayHeight,
      folderId: process.env.LANDING_PAGES_DRIVE_FOLDER_ID ?? '1PpZbApjr5rZRlyP5onwkRUxz6X9gFPZz',
    });

    // 중간 테이블에 순서 기록
    const rawSortOrder = parseInt(sortOrderStr ?? '', 10);
    const sortOrder = (sortOrderStr && !isNaN(rawSortOrder)) ? rawSortOrder : await getNextSortOrder(landingPageId);

    // P0-7/8: Prisma 트랜잭션으로 원자성 보장
    const pageImage = await prisma.$transaction(async (tx) => {
      // 2단계: WebP 처리 상태 업데이트 (트랜잭션 내)
      if (finalMimeType !== 'image/gif') {
        await tx.imageAsset.update({
          where: { id: asset.id },
          data: {
            webpDriveFileId: asset.driveFileId,
            processingStatus: 'DONE',
            processedAt: new Date(),
          },
        });
      }

      // 3단계: CrmLandingPageImage 생성 (트랜잭션 내, FK 제약 자동 검증)
      return await tx.crmLandingPageImage.create({
        data: {
          landingPageId,
          imageAssetId: asset.id,
          sortOrder,
        },
      });
    });

    // 랜딩페이지 이미지는 공개 접근 가능하도록 권한 설정
    // P0-6: Drive 권한 설정 재시도 (exponential backoff)
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let permissionSuccess = false;

    while (retryCount < MAX_RETRIES && !permissionSuccess) {
      try {
        const drive = getDriveClient();
        await drive.permissions.create({
          fileId: asset.driveFileId,
          requestBody: { role: 'reader', type: 'anyone' },
        });
        permissionSuccess = true;
      } catch (err) {
        retryCount++;
        if (retryCount >= MAX_RETRIES) {
          // 최종 실패: 로그만 기록
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.warn('[landing-images] Drive 공개 권한 설정 최종 실패', {
            assetId: asset.id,
            attempt: retryCount,
            error: errMsg,
          });
        } else {
          // 재시도 (exponential backoff: 1초, 2초, 4초)
          const waitMs = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitMs));
          logger.debug('[landing-images] Drive 권한 설정 재시도', {
            assetId: asset.id,
            attempt: retryCount,
            nextWaitMs: waitMs,
          });
        }
      }
    }

    const thumbnailUrl = `/api/landing-pages/images/proxy?id=${asset.driveFileId}`;

    logger.info('[landing-images] 업로드 완료', {
      pageId: landingPageId,
      assetId: asset.id,
      fileName: finalFileName,
      size: processedBuffer.length,
    });

    return NextResponse.json({
      ok: true,
      image: {
        id: pageImage.id,
        assetId: asset.id,
        url: thumbnailUrl,
        driveFileId: asset.driveFileId,
        width: meta.width || 0,
        height: displayHeight || 0,
        mimeType: finalMimeType,
        fileName: finalFileName,
        sortOrder,
        // 공개(anyone:reader) 권한 부여 성공 여부. false면 라이브 미리보기(iframe 공개URL)가
        // 잠시 안 보일 수 있음 → 프런트에서 "미리보기 준비 중" 배지로 정직하게 안내.
        publicReady: permissionSuccess,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다' }, { status: 401 });
    }
    if (msg === 'ORGANIZATION_REQUIRED' || msg === 'NO_ORGANIZATION') {
      return NextResponse.json({ ok: false, message: '조직 정보가 필요합니다' }, { status: 403 });
    }
    if (msg.includes('Failed to parse body as FormData') || msg.includes('Request body exceeded')) {
      logger.warn('[landing-images] 업로드 본문 크기 초과 또는 파싱 실패', { message: msg });
      // 본문 한도 초과는 거의 항상 압축 안 되는 GIF가 원인(JPG/PNG/WebP는 클라에서 작게 변환됨).
      return NextResponse.json(
        { ok: false, message: '이미지가 너무 커서 업로드되지 않았습니다. 움직이는 GIF는 약 4MB까지 가능합니다. 용량을 줄이거나 JPG·PNG로 올려주세요.' },
        { status: 413 },
      );
    }
    logger.error('[landing-images] 업로드 실패', { message: msg, stack: err instanceof Error ? err.stack : '' });
    return NextResponse.json({ ok: false, message: '이미지 업로드 중 오류가 발생했습니다' }, { status: 500 });
  }
}

/** 다음 sortOrder 자동 계산 */
async function getNextSortOrder(landingPageId: string): Promise<number> {
  const last = await prisma.crmLandingPageImage.findFirst({
    where: { landingPageId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}

/**
 * GET /api/landing-pages/images?landingPageId=xxx
 * 랜딩페이지의 이미지 목록 (순서 정렬)
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!canEditLandingPages(ctx)) {
      return NextResponse.json({ ok: false, message: '랜딩페이지 권한이 없습니다' }, { status: 403 });
    }
    const scope = landingOwnershipScope(ctx);

    const { searchParams } = new URL(req.url);
    const landingPageId = searchParams.get('landingPageId');
    if (!landingPageId) {
      return NextResponse.json({ ok: false, message: 'landingPageId 필수' }, { status: 400 });
    }

    // 소유권 확인 (GLOBAL_ADMIN은 org 필터 생략 = 전 조직 허용)
    const page = await prisma.crmLandingPage.findFirst({
      where: { id: landingPageId, ...scope },
      select: { id: true },
    });
    if (!page) {
      return NextResponse.json({ ok: false, message: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    const images = await prisma.crmLandingPageImage.findMany({
      where: { landingPageId },
      orderBy: { sortOrder: 'asc' },
    });

    // assetIds는 이미 이 페이지(소유권 검증 완료)의 이미지로만 한정 → org 필터 불필요(레거시 자산도 정상 표시)
    const assetIds = images.map((img) => img.imageAssetId);
    const assets = assetIds.length > 0
      ? await prisma.imageAsset.findMany({
          where: { id: { in: assetIds } },
          select: { id: true, driveFileId: true, originalFileName: true, mimeType: true, width: true, height: true, fileSize: true },
        })
      : [];
    const assetMap = new Map(assets.map((a) => [a.id, a]));

    return NextResponse.json({
      ok: true,
      images: images.map((img) => {
        const asset = assetMap.get(img.imageAssetId);
        return {
          id: img.id,
          assetId: img.imageAssetId,
          url: asset ? `/api/landing-pages/images/proxy?id=${asset.driveFileId}` : '',
          fullUrl: asset ? `https://drive.google.com/uc?id=${asset.driveFileId}&export=download` : '',
          driveFileId: asset?.driveFileId ?? '',
          fileName: asset?.originalFileName ?? '',
          width: asset?.width || 0,
          height: asset?.height || 0,
          mimeType: asset?.mimeType ?? null,
          fileSize: asset?.fileSize ? Number(asset.fileSize) : 0,
          sortOrder: img.sortOrder,
          altText: img.altText,
        };
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다' }, { status: 401 });
    }
    if (msg === 'ORGANIZATION_REQUIRED' || msg === 'NO_ORGANIZATION') {
      return NextResponse.json({ ok: false, message: '조직 정보가 필요합니다' }, { status: 403 });
    }
    logger.error('[landing-images] 목록 조회 실패', { err });
    return NextResponse.json({ ok: false, message: '조회 중 오류 발생' }, { status: 500 });
  }
}

/**
 * PATCH /api/landing-pages/images
 * 이미지 순서 변경 (전체 순서 덮어쓰기)
 * Body: { landingPageId, imageIds: ["id1", "id2", ...] }
 */
export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!canEditLandingPages(ctx)) {
      return NextResponse.json({ ok: false, message: '랜딩페이지 권한이 없습니다' }, { status: 403 });
    }
    const scope = landingOwnershipScope(ctx);

    const body = await req.json();
    const { landingPageId, imageIds } = body as { landingPageId: string; imageIds: string[] };

    if (!landingPageId || !imageIds || !Array.isArray(imageIds)) {
      return NextResponse.json({ ok: false, message: 'landingPageId와 imageIds 배열 필수' }, { status: 400 });
    }

    // 소유권 확인 (GLOBAL_ADMIN은 org 필터 생략 = 전 조직 허용)
    const page = await prisma.crmLandingPage.findFirst({
      where: { id: landingPageId, ...scope },
      select: { id: true },
    });
    if (!page) {
      return NextResponse.json({ ok: false, message: '랜딩페이지를 찾을 수 없습니다' }, { status: 404 });
    }

    // 트랜잭션으로 전체 순서 업데이트 (landingPageId로 소유권 보장)
    await prisma.$transaction(
      imageIds.map((imgId, index) =>
        prisma.crmLandingPageImage.updateMany({
          where: { id: imgId, landingPageId: page.id },
          data: { sortOrder: index },
        }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다' }, { status: 401 });
    }
    if (msg === 'ORGANIZATION_REQUIRED' || msg === 'NO_ORGANIZATION') {
      return NextResponse.json({ ok: false, message: '조직 정보가 필요합니다' }, { status: 403 });
    }
    logger.error('[landing-images] 순서 변경 실패', { err });
    return NextResponse.json({ ok: false, message: '순서 변경 중 오류 발생' }, { status: 500 });
  }
}

/**
 * DELETE /api/landing-pages/images
 * 이미지 삭제 (중간 테이블에서만 제거, ImageAsset은 보존)
 * Body: { id }
 */
export async function DELETE(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!canEditLandingPages(ctx)) {
      return NextResponse.json({ ok: false, message: '랜딩페이지 권한이 없습니다' }, { status: 403 });
    }
    const scope = landingOwnershipScope(ctx);

    const body = await req.json();
    const { id } = body as { id: string };

    if (!id) {
      return NextResponse.json({ ok: false, message: 'id 필수' }, { status: 400 });
    }

    // 소유권 확인 (별도 조회)
    const pageImage = await prisma.crmLandingPageImage.findUnique({
      where: { id },
    });
    if (!pageImage) {
      return NextResponse.json({ ok: false, message: '이미지를 찾을 수 없습니다' }, { status: 404 });
    }
    // GLOBAL_ADMIN은 org 필터 생략 = 전 조직 허용
    const ownerPage = await prisma.crmLandingPage.findFirst({
      where: { id: pageImage.landingPageId, ...scope },
      select: { id: true },
    });
    if (!ownerPage) {
      return NextResponse.json({ ok: false, message: '이미지를 찾을 수 없습니다' }, { status: 404 });
    }

    await prisma.crmLandingPageImage.deleteMany({ where: { id, landingPageId: ownerPage.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, message: '인증이 필요합니다' }, { status: 401 });
    }
    if (msg === 'ORGANIZATION_REQUIRED' || msg === 'NO_ORGANIZATION') {
      return NextResponse.json({ ok: false, message: '조직 정보가 필요합니다' }, { status: 403 });
    }
    logger.error('[landing-images] 삭제 실패', { err });
    return NextResponse.json({ ok: false, message: '삭제 중 오류 발생' }, { status: 500 });
  }
}

// P0-2: Magic bytes 기반 파일 타입 검증
async function validateFileMagic(file: File): Promise<{ valid: boolean; mimeType: string | null; detected?: string }> {
  const MAGIC_BYTES: Record<string, { bytes: number[]; mimeType: string }> = {
    jpeg: { bytes: [0xff, 0xd8, 0xff], mimeType: 'image/jpeg' },
    png: { bytes: [0x89, 0x50, 0x4e, 0x47], mimeType: 'image/png' },
    gif: { bytes: [0x47, 0x49, 0x46], mimeType: 'image/gif' },
    webp: { bytes: [0x52, 0x49, 0x46, 0x46], mimeType: 'image/webp' },
  };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    for (const [fmt, { bytes: magicBytes, mimeType }] of Object.entries(MAGIC_BYTES)) {
      if (buffer.length >= magicBytes.length) {
        const match = magicBytes.every((byte, i) => buffer[i] === byte);
        if (match) {
          if (fmt === 'webp') {
            const webpCheck = buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP';
            if (webpCheck) return { valid: true, mimeType };
          } else {
            return { valid: true, mimeType };
          }
        }
      }
    }

    return { valid: false, mimeType: null, detected: 'unknown' };
  } catch {
    return { valid: false, mimeType: null, detected: 'read_error' };
  }
}

