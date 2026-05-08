import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 레거시 이미지 서빙 엔드포인트 — /api/public/image-proxy로 리다이렉트
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId parameter is required' },
        { status: 400 }
      );
    }

    // Google Drive 공개 이미지 프록시 사용
    const driveUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;

    try {
      const response = await fetch(driveUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        logger.warn(`[AdminGDriveImage] Google Drive fetch failed:`, {
          fileId,
          status: response.status,
        });
        return NextResponse.json(
          { error: 'Failed to fetch image from Google Drive' },
          { status: response.status || 500 }
        );
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const buffer = await response.arrayBuffer();

      // 응답 헤더 설정 — 브라우저 캐싱 1시간
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600', // 1시간 캐시
          'Content-Disposition': 'inline', // 인라인 표시 (다운로드 아님)
        },
      });
    } catch (fetchError: any) {
      logger.error('[AdminGDriveImage] Fetch error:', {
        message: fetchError?.message,
        code: fetchError?.code,
      });
      return NextResponse.json(
        { error: 'Failed to fetch image' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    logger.error('[AdminGDriveImage] Error:', {
      message: error?.message,
      code: error?.code,
    });
    return NextResponse.json(
      { error: 'Failed to proxy image' },
      { status: 500 }
    );
  }
}
