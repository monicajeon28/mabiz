export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { Readable } from 'stream';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { getDriveClient } from '@/lib/drive-client';
import { logger } from '@/lib/logger';

const FOLDER_ID =
  process.env.LANDING_PAGES_DRIVE_FOLDER_ID ?? '1PpZbApjr5rZRlyP5onwkRUxz6X9gFPZz';

/** GLOBAL_ADMIN 포함 orgId 해결 헬퍼 */
async function getOrgId(
  ctx: Awaited<ReturnType<typeof getAuthContext>>,
): Promise<string> {
  if (ctx.role === 'GLOBAL_ADMIN' && !ctx.organizationId) {
    const firstOrg = await prisma.organization.findFirst({
      select: { id: true },
    });
    if (!firstOrg) throw new Error('NO_ORGANIZATION');
    return firstOrg.id;
  }
  return resolveOrgId(ctx);
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
 * POST /api/landing-pages/images/finalize
 *
 * 클라이언트가 Drive에 직접 업로드(Resumable)한 원본 파일을 WebP로 변환하고
 * DB에 ImageAsset + CrmLandingPageImage를 생성합니다.
 *
 * Body: {
 *   driveFileId:   string  — 클라이언트가 Drive에 업로드한 원본 파일 ID
 *   landingPageId: string
 *   mimeType:      string  — 원본 MIME (image/gif, image/jpeg, ...)
 *   fileName:      string  — 원본 파일명
 *   sortOrder?:    number
 * }
 *
 * Response: {
 *   ok: true,
 *   image: { id, assetId, url, driveFileId, width, height, mimeType, fileName, sortOrder }
 * }
 */
export async function POST(req: Request) {
  let originalDriveFileId: string | null = null;

  try {
    const ctx = await getAuthContext();
    const orgId = await getOrgId(ctx);

    const body = (await req.json()) as {
      driveFileId: string;
      landingPageId: string;
      mimeType: string;
      fileName: string;
      sortOrder?: number;
    };

    const { driveFileId, landingPageId, mimeType, fileName, sortOrder: sortOrderInput } = body;

    if (!driveFileId || !landingPageId || !mimeType || !fileName) {
      return NextResponse.json(
        { ok: false, message: 'driveFileId, landingPageId, mimeType, fileName 필수' },
        { status: 400 },
      );
    }

    originalDriveFileId = driveFileId;

    // 랜딩페이지 소유권 확인
    const page = await prisma.crmLandingPage.findFirst({
      where: { id: landingPageId, organizationId: orgId },
      select: { id: true, title: true },
    });
    if (!page) {
      return NextResponse.json(
        { ok: false, message: '랜딩페이지를 찾을 수 없습니다' },
        { status: 404 },
      );
    }

    // ── Step 1: Drive에서 원본 파일 다운로드 ──────────────────────────────
    // googleapis의 responseType:'arraybuffer' 타입 불일치 우회 → fetch 직접 호출
    const serviceAccountKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY 미설정');

    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(serviceAccountKey),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const driveAuthClient = await auth.getClient() as {
      getAccessToken(): Promise<{ token?: string | null }>;
    };
    const { token: driveToken } = await driveAuthClient.getAccessToken();
    if (!driveToken) throw new Error('Drive 토큰 발급 실패');

    const downloadRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
      { headers: { Authorization: `Bearer ${driveToken}` } },
    );
    if (!downloadRes.ok) {
      throw new Error(`Drive 다운로드 실패: ${downloadRes.status}`);
    }
    const originalBuffer = Buffer.from(await downloadRes.arrayBuffer());

    // 업로드/삭제용 Drive 클라이언트
    const drive = getDriveClient();

    // ── Step 2: sharp로 WebP 변환 ─────────────────────────────────────────
    const isGif = mimeType === 'image/gif';
    let processedBuffer: Buffer;
    let finalMimeType: string;
    let finalFileName: string;

    if (isGif) {
      // GIF: animated WebP 변환 시도, 실패 시 GIF 압축 유지
      try {
        const metadata = await sharp(originalBuffer, {
          animated: true,
        }).metadata();
        const needsResize = metadata.width && metadata.width > 1200;

        processedBuffer = await sharp(originalBuffer, { animated: true })
          .resize(needsResize ? 1200 : (metadata.width ?? undefined), null, {
            withoutEnlargement: true,
          })
          .webp({ quality: 80, loop: 0 })
          .toBuffer();

        finalMimeType = 'image/webp';
        finalFileName = fileName.replace(/\.[^.]+$/, '.webp');
      } catch {
        // animated WebP 변환 실패 시 GIF 압축으로 폴백
        const metadata = await sharp(originalBuffer, {
          animated: true,
        }).metadata();
        const needsResize = metadata.width && metadata.width > 1200;

        processedBuffer = await sharp(originalBuffer, { animated: true })
          .resize(needsResize ? 1200 : (metadata.width ?? undefined), null, {
            withoutEnlargement: true,
          })
          .gif({ colors: 256 })
          .toBuffer();

        finalMimeType = 'image/gif';
        finalFileName = fileName.replace(/\.[^.]+$/, '.gif');
      }
    } else {
      // JPG / PNG / WebP → WebP 변환 (quality 85, 최대 가로 1600px)
      processedBuffer = await sharp(originalBuffer)
        .resize(1600, null, { withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();

      finalMimeType = 'image/webp';
      finalFileName = fileName.replace(/\.[^.]+$/, '.webp');
    }

    // 메타데이터 추출
    const isOutputGif = finalMimeType === 'image/gif';
    const meta = await sharp(
      processedBuffer,
      isOutputGif ? { animated: true } : undefined,
    ).metadata();
    const displayHeight =
      isOutputGif && meta.pages && meta.pages > 1
        ? Math.round((meta.height ?? 0) / meta.pages)
        : meta.height;

    // ── Step 3: Drive에 WebP 파일 업로드 ─────────────────────────────────
    const uploadedFile = await drive.files.create(
      {
        requestBody: {
          name: finalFileName,
          parents: [FOLDER_ID],
        },
        media: {
          mimeType: finalMimeType,
          body: Readable.from(processedBuffer),
        },
        fields: 'id',
        supportsAllDrives: true,
      },
      { timeout: 300_000 },
    );

    const webpFileId = uploadedFile.data.id;
    if (!webpFileId) throw new Error('WebP Drive 업로드 후 fileId 없음');

    // ── Step 4: 원본 파일 삭제 ────────────────────────────────────────────
    try {
      await drive.files.delete({
        fileId: driveFileId,
        supportsAllDrives: true,
      });
      originalDriveFileId = null; // 삭제 완료 표시
    } catch (delErr) {
      // 원본 삭제 실패는 치명적이지 않으므로 경고만 기록
      logger.warn('[finalize] 원본 파일 삭제 실패', {
        driveFileId,
        err: delErr instanceof Error ? delErr.message : String(delErr),
      });
    }

    // ── Step 5: DB에 ImageAsset + CrmLandingPageImage 생성 ───────────────
    const asset = await prisma.imageAsset.create({
      data: {
        organizationId: orgId,
        originalFileName: finalFileName,
        driveFileId: webpFileId,
        drivePath: FOLDER_ID,
        mimeType: finalMimeType,
        fileSize: BigInt(processedBuffer.length),
        width: meta.width ?? null,
        height: displayHeight ?? null,
        orientation: 1,
        category: `랜딩페이지/${page.title}`,
        tags: ['landing-page', landingPageId],
        uploadedBy: ctx.userId,
        webpDriveFileId: webpFileId,
        processingStatus: 'DONE',
        processedAt: new Date(),
      },
    });

    const sortOrder =
      sortOrderInput !== undefined
        ? sortOrderInput
        : await getNextSortOrder(landingPageId);

    const pageImage = await prisma.crmLandingPageImage.create({
      data: {
        landingPageId,
        imageAssetId: asset.id,
        sortOrder,
      },
    });

    // ── Step 6: 공개 권한 설정 (reader: anyone) ───────────────────────────
    try {
      await drive.permissions.create({
        fileId: webpFileId,
        requestBody: { role: 'reader', type: 'anyone' },
      });
    } catch {
      // 권한 설정 실패는 무시 (이미지는 업로드됨)
    }

    logger.info('[finalize] WebP 변환 + 업로드 완료', {
      pageId: landingPageId,
      assetId: asset.id,
      webpFileId,
      finalMimeType,
      size: processedBuffer.length,
    });

    return NextResponse.json({
      ok: true,
      image: {
        id: pageImage.id,
        assetId: asset.id,
        url: `/api/landing-pages/images/proxy?id=${webpFileId}`,
        driveFileId: webpFileId,
        width: meta.width ?? 0,
        height: displayHeight ?? 0,
        mimeType: finalMimeType,
        fileName: finalFileName,
        sortOrder,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다' },
        { status: 401 },
      );
    }
    if (msg === 'ORGANIZATION_REQUIRED' || msg === 'NO_ORGANIZATION') {
      return NextResponse.json(
        { ok: false, message: '조직 정보가 필요합니다' },
        { status: 403 },
      );
    }

    // 업로드 실패 시 원본 파일 정리 (Drive에 고아 파일 남지 않도록)
    if (originalDriveFileId) {
      try {
        const drive = getDriveClient();
        await drive.files.delete({
          fileId: originalDriveFileId,
          supportsAllDrives: true,
        });
      } catch {
        // 정리 실패는 무시
      }
    }

    logger.error('[finalize] 처리 실패', {
      message: msg,
      stack: err instanceof Error ? err.stack : '',
    });
    return NextResponse.json(
      { ok: false, message: msg || 'WebP 변환 중 오류 발생' },
      { status: 500 },
    );
  }
}
