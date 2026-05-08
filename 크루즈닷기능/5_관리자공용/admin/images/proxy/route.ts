// app/api/admin/images/proxy/route.ts
// 이미지 라이브러리 이미지 프록시 API (로고 워터마크 포함 다운로드 지원)

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getDriveClient } from '@/lib/google-drive';
import sharp from 'sharp';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 관리자 또는 판매원 권한 확인
async function requireAdminOrPartner() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      role: true,
      AffiliateProfile: {
        select: { id: true }
      }
    },
  });

  if (user?.role !== 'admin' && !user?.AffiliateProfile) {
    return NextResponse.json({ ok: false, message: 'Admin or Partner access required' }, { status: 403 });
  }

  return { user, isAdmin: user?.role === 'admin' };
}



// GET: 이미지 프록시 (로고 워터마크 포함 다운로드 지원)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    // 권한 확인 (모든 요청에 대해 수행)
    const authResult = await requireAdminOrPartner();
    if ('status' in authResult) return authResult;

    const fileId = url.searchParams.get('id');
    const download = url.searchParams.get('download') === 'true';
    const watermark = url.searchParams.get('watermark') !== 'false';

    if (!fileId) {
      return NextResponse.json({ ok: false, error: 'File ID is required' }, { status: 400 });
    }

    const drive = getDriveClient();
    const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;

    // 파일 정보 가져오기
    const fileInfoOptions: any = {
      fileId,
      fields: 'mimeType, name',
    };
    if (sharedDriveId && sharedDriveId !== 'root') {
      fileInfoOptions.supportsAllDrives = true;
    }

    const fileInfo = await drive.files.get(fileInfoOptions);
    const mimeType = fileInfo.data.mimeType || 'image/jpeg';
    const fileName = fileInfo.data.name || 'image';

    if (!mimeType.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'File is not an image' }, { status: 400 });
    }

    // 이미지 데이터 가져오기
    const getOptions: any = { fileId, alt: 'media' };
    if (sharedDriveId && sharedDriveId !== 'root') {
      getOptions.supportsAllDrives = true;
    }

    const imageResponse = await drive.files.get(getOptions, {
      responseType: 'arraybuffer',
    });

    if (!imageResponse.data) {
      throw new Error('Failed to fetch image data');
    }

    let imageBuffer = Buffer.from(imageResponse.data as ArrayBuffer);
    let outputMimeType = mimeType;
    let outputFileName = fileName;

    // PNG 다운로드 (워터마크 포함)
    if (download) {
      let processedImage: ReturnType<typeof sharp> | undefined;
      let watermarkImage: ReturnType<typeof sharp> | undefined;
      let opacitySharp: ReturnType<typeof sharp> | undefined;
      let finalSharp: ReturnType<typeof sharp> | undefined;
      try {
        const watermarkPath = process.cwd() + '/public/logo-watermark.png';
        const fs = await import('fs/promises');

        let watermarkBuffer: Buffer | null = null;
        try {
          watermarkBuffer = await fs.readFile(watermarkPath);
        } catch (error) {
          logger.warn('[Image Proxy] Watermark file not found, skipping watermark');
        }

        processedImage = sharp(imageBuffer);

        // 워터마크 추가 (정중앙에 크게 배치)
        if (watermark && watermarkBuffer) {
          const metadata = await processedImage.metadata();
          const imageWidth = metadata.width || 1000;
          const imageHeight = metadata.height || 1000;
          watermarkImage = sharp(watermarkBuffer);
          const watermarkMetadata = await watermarkImage.metadata();

          // 워터마크 크기 조정 (원본 이미지의 50% 크기로 크게)
          const watermarkWidth = Math.floor(imageWidth * 0.5);
          const watermarkHeight = Math.floor((watermarkMetadata.height || 1) * (watermarkWidth / (watermarkMetadata.width || 1)));

          // 워터마크 리사이즈 및 흑백 변환
          const resizedWatermark = await watermarkImage
            .resize(watermarkWidth, watermarkHeight, { fit: 'inside' })
            .grayscale() // 흑백 변환
            .ensureAlpha()
            .png()
            .toBuffer();

          // 투명도 적용 (불투명도 40% - 더 잘 보이도록)
          const opacity = 0.40;
          opacitySharp = sharp(resizedWatermark);
          const watermarkData = await opacitySharp
            .raw()
            .ensureAlpha()
            .toBuffer({ resolveWithObject: true });

          const pixels = watermarkData.data;
          for (let i = 3; i < pixels.length; i += 4) {
            pixels[i] = Math.floor(pixels[i] * opacity);
          }

          finalSharp = sharp(Buffer.from(pixels), {
            raw: {
              width: watermarkData.info.width,
              height: watermarkData.info.height,
              channels: 4,
            },
          });
          const finalWatermark = await finalSharp
            .png()
            .toBuffer();

          // 워터마크를 정중앙에 배치
          const centerTop = Math.floor((imageHeight - watermarkData.info.height) / 2);
          const centerLeft = Math.floor((imageWidth - watermarkData.info.width) / 2);

          processedImage = processedImage.composite([
            {
              input: finalWatermark,
              top: centerTop,
              left: centerLeft,
              blend: 'over',
            },
          ]);
        }

        // PNG로 변환
        imageBuffer = await processedImage.png({ compressionLevel: 6 }).toBuffer();
        outputMimeType = 'image/png';
        outputFileName = fileName.replace(/\.[^/.]+$/, '') + '.png';
      } catch (error) {
        logger.error('[Image Proxy] PNG conversion/watermark error:', error);
      } finally {
        processedImage?.destroy();
        watermarkImage?.destroy();
        opacitySharp?.destroy();
        finalSharp?.destroy();
      }
    }

    // 응답 헤더 설정 (인증 필요 리소스: private, no-store)
    const headers: Record<string, string> = {
      'Content-Type': outputMimeType,
      'Cache-Control': 'private, no-store',
    };

    if (download) {
      headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(outputFileName)}"`;
    }

    return new NextResponse(imageBuffer, { headers });
  } catch (error: any) {
    logger.error('[Image Proxy] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}
