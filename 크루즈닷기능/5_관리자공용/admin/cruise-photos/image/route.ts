// app/api/admin/cruise-photos/image/route.ts
// 크루즈정보사진 이미지 프록시 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getDriveClient } from '@/lib/google-drive';
import sharp from 'sharp';
import { logger } from '@/lib/logger';
import { getWatermarkBuffer } from '@/lib/image-watermark';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 관리자 또는 판매원 권한 확인 (읽기 전용)
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

  // 관리자이거나 판매원(AffiliateProfile이 있음)이면 접근 허용
  if (user?.role !== 'admin' && !user?.AffiliateProfile) {
    return NextResponse.json({ ok: false, message: 'Admin or Partner access required' }, { status: 403 });
  }

  return { user, isAdmin: user?.role === 'admin' };
}



// Google Drive fileId 허용 패턴: 영문자, 숫자, 하이픈, 언더스코어, 5~100자
const DRIVE_FILE_ID_PATTERN = /^[a-zA-Z0-9_\-]{5,100}$/;

// GET: 구글 드라이브 이미지 가져오기
// - 조회: 원본 이미지 그대로 반환
// - 다운로드: 워터마크 포함 PNG로 변환
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const download = url.searchParams.get('download') === 'true';

    // Fix P0-2: 조회 요청에도 인증 적용 (다운로드/조회 모두 인증 필요)
    const authResult = await requireAdminOrPartner();
    if ('status' in authResult) return authResult;

    const fileId = url.searchParams.get('id');

    if (!fileId) {
      return NextResponse.json({ ok: false, error: 'File ID is required' }, { status: 400 });
    }

    // Fix P0-3: fileId SSRF 방지 — 허용된 형식만 통과
    if (!DRIVE_FILE_ID_PATTERN.test(fileId)) {
      return NextResponse.json({ ok: false, error: 'Invalid file ID format' }, { status: 400 });
    }

    const drive = getDriveClient();
    // Fix P1-env: 환경변수 없으면 undefined (하드코딩 기본값 제거)
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

    // 이미지가 아니면 에러 반환
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'File is not an image' }, { status: 400 });
    }

    // 이미지 데이터 가져오기
    const getOptions: any = {
      fileId,
      alt: 'media',
    };

    if (sharedDriveId && sharedDriveId !== 'root') {
      getOptions.supportsAllDrives = true;
    }

    const imageResponse = await drive.files.get(getOptions, {
      responseType: 'arraybuffer',
    });

    if (!imageResponse.data) {
      throw new Error('Failed to fetch image data');
    }

    let imageBuffer = Buffer.from(imageResponse.data as ArrayBuffer) as Buffer;
    let outputMimeType = mimeType;
    let outputFileName = fileName;

    // 다운로드 처리: GIF는 애니메이션 유지 + 압축, 나머지는 워터마크 PNG 변환
    if (download) {
      if (mimeType === 'image/gif') {
        // H-2: 20MB 초과 GIF는 animated 처리 건너뛰고 원본 반환 (Vercel 메모리 보호)
        if (imageBuffer.length > 20 * 1024 * 1024) {
          outputMimeType = 'image/gif';
          // imageBuffer 그대로 유지
        } else {
        // GIF 전용 처리: animated: true로 모든 프레임 읽기 + 용량 압축 + GIF 유지
        let gifSharp: sharp.Sharp | null = null;
        // H-1: wmFinal을 finally에서 정리할 수 있도록 try 블록 밖에서 선언
        let wmSharp: sharp.Sharp | null = null;
        let wmFinal: sharp.Sharp | null = null;
        try {
          gifSharp = sharp(imageBuffer, { animated: true });

          // 워터마크 경로 확인 후 GIF 전 프레임에 합성
          const watermarkBuffer = await getWatermarkBuffer();

          if (watermarkBuffer) {
            const meta = await gifSharp.metadata();
            const imgW = meta.width || 800;
            const wmWidth = Math.floor(imgW * 0.4);
            // 워터마크 리사이즈 + 흑백 + 투명도 40%
            wmSharp = sharp(watermarkBuffer);
            const wmResized = await wmSharp
              .resize(wmWidth, undefined, { fit: 'inside' })
              .grayscale()
              .ensureAlpha()
              .png()
              .toBuffer();
            // 알파 채널에 40% 불투명도 적용
            wmFinal = sharp(wmResized);
            const { data, info } = await wmFinal.raw().toBuffer({ resolveWithObject: true });
            for (let i = 3; i < data.length; i += 4) {
              data[i] = Math.floor(data[i] * 0.4);
            }
            const wmOverlay = await sharp(Buffer.from(data), {
              raw: { width: info.width, height: info.height, channels: 4 },
            }).png().toBuffer();

            gifSharp = gifSharp.composite([{ input: wmOverlay, gravity: 'center', blend: 'over' }]);
          }

          // GIF 압축: 256색 팔레트 최적화 + 프레임 간 중복 제거 (화질 거의 무손실)
          const compressed = await gifSharp
            .gif({ colours: 256, interFrameMaxError: 8, interPaletteMaxError: 3, dither: 1.0 })
            .toBuffer() as Buffer;

          // C-1: 워터마크가 합성된 버퍼를 항상 사용 (크기에 관계없이 워터마크 보장)
          imageBuffer = compressed;
          outputMimeType = 'image/gif';
          // 파일명 그대로 유지 (.gif 확장자)
        } catch (gifError: unknown) {
          const errMsg = gifError instanceof Error ? gifError.message : String(gifError);
          logger.error('[Cruise Photos Image] GIF compression error, using original:', { error: errMsg });
          // 실패 시 원본 GIF 그대로 반환
          outputMimeType = 'image/gif';
        } finally {
          // H-1: wmSharp, wmFinal 모두 finally에서 정리 (에러 시에도 메모리 누수 방지)
          wmSharp?.destroy();
          wmFinal?.destroy();
          gifSharp?.destroy();
        }
        } // end H-2 size guard else
      } else {
        // 비-GIF: 기존 워터마크 + PNG 변환
        let processedImage: sharp.Sharp | null = null;
        let watermarkImage: sharp.Sharp | null = null;
        let opacitySharp: sharp.Sharp | null = null;
        let finalWatermarkSharp: sharp.Sharp | null = null;

        try {
          const watermarkBuffer = await getWatermarkBuffer();

          processedImage = sharp(imageBuffer);

          if (watermarkBuffer) {
            const metadata = await processedImage.metadata();
            const imageWidth = metadata.width || 1000;
            const imageHeight = metadata.height || 1000;
            watermarkImage = sharp(watermarkBuffer);
            const watermarkMetadata = await watermarkImage.metadata();

            const watermarkWidth = Math.floor(imageWidth * 0.5);
            const watermarkHeight = Math.floor((watermarkMetadata.height || 1) * (watermarkWidth / (watermarkMetadata.width || 1)));

            const resizedWatermark = await watermarkImage
              .resize(watermarkWidth, watermarkHeight, { fit: 'inside' })
              .grayscale()
              .ensureAlpha()
              .png()
              .toBuffer();

            opacitySharp = sharp(resizedWatermark);
            const watermarkData = await opacitySharp
              .raw()
              .ensureAlpha()
              .toBuffer({ resolveWithObject: true });

            const pixels = watermarkData.data;
            for (let i = 3; i < pixels.length; i += 4) {
              pixels[i] = Math.floor(pixels[i] * 0.4);
            }

            finalWatermarkSharp = sharp(Buffer.from(pixels), {
              raw: {
                width: watermarkData.info.width,
                height: watermarkData.info.height,
                channels: 4,
              },
            });
            const finalWatermark = await finalWatermarkSharp.png().toBuffer();

            const centerTop = Math.floor((imageHeight - watermarkData.info.height) / 2);
            const centerLeft = Math.floor((imageWidth - watermarkData.info.width) / 2);

            processedImage = processedImage.composite([
              { input: finalWatermark, top: centerTop, left: centerLeft, blend: 'over' },
            ]);
          }

          imageBuffer = (await processedImage.png({ compressionLevel: 6 }).toBuffer()) as Buffer;
          outputMimeType = 'image/png';
          outputFileName = fileName.replace(/\.[^/.]+$/, '') + '.png';
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          logger.error('[Cruise Photos Image] PNG conversion/watermark error:', { error: errMsg });
        } finally {
          processedImage?.destroy();
          watermarkImage?.destroy();
          opacitySharp?.destroy();
          finalWatermarkSharp?.destroy();
        }
      }
    }

    // 응답 헤더 설정 (인증 라우트: CORS 와일드카드 제거, private 캐시)
    const headers: Record<string, string> = {
      'Content-Type': outputMimeType,
      'Cache-Control': 'private, max-age=3600',
    };

    // 다운로드인 경우 Content-Disposition 헤더 추가
    if (download) {
      headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(outputFileName)}"`;
    }

    return new NextResponse(imageBuffer as any, {
      headers,
    });
  } catch (error: any) {
    logger.error('[Cruise Photos Image] Error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
}

