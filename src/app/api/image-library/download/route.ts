import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** 토큰 캐시 (2분 여유) */
let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getDriveToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 120_000) {
    return _tokenCache.token;
  }
  const serviceAccountKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) throw new Error('GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY 미설정');

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(serviceAccountKey),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient() as {
    getAccessToken(): Promise<{ token?: string | null; expiry_date?: number | null }>;
  };
  const res = await client.getAccessToken();
  const token = res.token ?? '';
  _tokenCache = { token, expiresAt: res.expiry_date ?? Date.now() + 3_600_000 };
  return token;
}

/**
 * GET /api/image-library/download?id=DRIVE_FILE_ID&name=파일명
 * Drive 이미지를 다운로드하고 워터마크를 합성하여 PNG로 반환.
 */
export async function GET(req: Request) {
  try {
    await getAuthContext();

    const { searchParams } = new URL(req.url);
    const driveFileId = searchParams.get('id');
    const downloadName = searchParams.get('name') ?? 'image';

    if (!driveFileId || !/^[a-zA-Z0-9_-]+$/.test(driveFileId)) {
      return NextResponse.json({ ok: false, error: 'id 파라미터가 필요합니다' }, { status: 400 });
    }

    // Drive 다운로드
    const token = await getDriveToken();
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!driveRes.ok) {
      logger.error('[download] Drive 다운로드 실패', { status: driveRes.status, fileId: driveFileId });
      return NextResponse.json({ ok: false, error: '이미지를 가져올 수 없습니다' }, { status: 502 });
    }

    const buffer = Buffer.from(await driveRes.arrayBuffer());

    // Sharp 워터마크 합성
    const meta = await sharp(buffer).metadata();
    const w = meta.width ?? 800;
    const h = meta.height ?? 600;

    // 반투명 회색 오버레이
    const overlay = await sharp({
      create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.3 } },
    }).png().toBuffer();

    // 워터마크: logo.png 있으면 사용, 없으면 텍스트
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    let watermarkInput: Buffer;

    if (fs.existsSync(logoPath)) {
      const logoSize = Math.max(80, Math.floor(w * 0.3));
      watermarkInput = await sharp(logoPath)
        .resize({ width: logoSize, withoutEnlargement: true })
        .png()
        .toBuffer();
    } else {
      const fontSize = Math.max(24, Math.min(80, Math.floor(w / 10)));
      watermarkInput = Buffer.from(
        `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
          <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
            font-family="Arial" font-size="${fontSize}" font-weight="bold"
            fill="white" opacity="0.6"
            transform="rotate(-30,${w / 2},${h / 2})">MABIZCRUISE</text>
        </svg>`
      );
    }

    const result = await sharp(buffer)
      .composite([
        { input: overlay, blend: 'over' },
        { input: watermarkInput, gravity: 'center', blend: 'over' },
      ])
      .png()
      .toBuffer();

    const safeName = encodeURIComponent(downloadName.replace(/\.[^.]+$/, ''));
    return new Response(result, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${safeName}.png"; filename*=UTF-8''${safeName}.png`,
        'Content-Length': String(result.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 401 });
    }
    logger.error('[download]', { msg });
    return NextResponse.json({ ok: false, error: '다운로드 실패' }, { status: 500 });
  }
}
