export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { parseServiceAccount } from '@/lib/parse-service-account';

/**
 * GET /api/public/landing-image?id=DRIVE_FILE_ID
 *
 * 공개 랜딩페이지(/p/[slug])의 이미지를 인증 없이 "원본 바이트 그대로" 스트리밍한다.
 * lh3 썸네일(=w1200)은 GIF를 정지 프레임으로 재인코딩하므로, 움직이는 GIF를
 * 그대로 보여주기 위해 사용한다. (이미 업로드 시 256색·1200px로 압축된 파일)
 *
 * 보안: 임의 Drive 파일 열람을 막기 위해, 우리 DB(ImageAsset)에 등록된 파일만 서빙한다.
 */

let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getServiceToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 120_000) {
    return _tokenCache.token;
  }
  const auth = new google.auth.GoogleAuth({
    credentials: parseServiceAccount(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = (await auth.getClient()) as {
    getAccessToken(): Promise<{ token?: string | null; expiry_date?: number | null }>;
  };
  const res = await client.getAccessToken();
  const token = res.token ?? '';
  _tokenCache = { token, expiresAt: res.expiry_date ?? Date.now() + 3_600_000 };
  return token;
}

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return new NextResponse(null, { status: 400 });
    }

    // 보안: DB에 등록된 자산만 서빙 (임의 Drive 파일 프록시 방지)
    const asset = await prisma.imageAsset.findFirst({
      where: { OR: [{ driveFileId: id }, { webpDriveFileId: id }] },
      select: { id: true },
    });
    if (!asset) {
      return new NextResponse(null, { status: 404 });
    }

    const token = await getServiceToken();
    if (!token) return new NextResponse(null, { status: 503 });

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!driveRes.ok) {
      return new NextResponse(null, { status: driveRes.status === 404 ? 404 : 502 });
    }

    const buffer = Buffer.from(await driveRes.arrayBuffer());

    // content-type: Drive 값 우선, 없으면 magic bytes로 추정
    const rawCT = driveRes.headers.get('content-type') ?? '';
    let contentType = rawCT && !rawCT.includes('octet-stream') ? rawCT : '';
    if (!contentType) {
      if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) contentType = 'image/gif';
      else if (buffer[0] === 0xff && buffer[1] === 0xd8) contentType = 'image/jpeg';
      else if (buffer[0] === 0x89 && buffer[1] === 0x50) contentType = 'image/png';
      else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[4] === 0x57) contentType = 'image/webp';
      else contentType = 'application/octet-stream';
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        // 공개 이미지 — CDN/브라우저 캐시 허용 (파일 내용은 사실상 불변)
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
