export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthContext } from '@/lib/rbac';

/** 모듈 레벨 토큰 캐시 — 만료 2분 전까지 재사용 */
let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getServiceToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 120_000) {
    return _tokenCache.token;
  }
  const serviceAccountKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  const credentials = serviceAccountKey
    ? JSON.parse(serviceAccountKey)
    : {
        client_email: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (
          process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY ??
          process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? ''
        ).replace(/\\n/g, '\n'),
      };

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient() as {
    getAccessToken(): Promise<{ token?: string | null; expiry_date?: number | null }>;
  };
  const res   = await client.getAccessToken();
  const token = res.token ?? '';
  _tokenCache = { token, expiresAt: res.expiry_date ?? Date.now() + 3_600_000 };
  return token;
}

/**
 * GET /api/landing-pages/images/proxy?id=DRIVE_FILE_ID
 * 서비스 계정 OAuth 토큰으로 Drive 파일 다운로드 후 반환 (토큰 캐싱)
 */
export async function GET(req: Request) {
  try {
    await getAuthContext();

    const id = new URL(req.url).searchParams.get('id');
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return new NextResponse(null, { status: 400 });
    }

    const token = await getServiceToken();
    if (!token) return new NextResponse(null, { status: 503 });

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!driveRes.ok) {
      if (driveRes.status === 401) {
        return new NextResponse(JSON.stringify({ error: '이미지를 불러올 수 없습니다' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (driveRes.status === 403) {
        return new NextResponse(JSON.stringify({ error: '이미지를 불러올 수 없습니다' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new NextResponse(JSON.stringify({ error: '이미지를 불러올 수 없습니다' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Drive가 content-type 안 주거나 octet-stream인 경우 파일 시그니처로 추정
    const rawCT = driveRes.headers.get('content-type') ?? '';
    let contentType = rawCT && !rawCT.includes('octet-stream') ? rawCT : '';
    const buffer = Buffer.from(await driveRes.arrayBuffer());
    if (!contentType) {
      // 파일 시그니처(magic bytes)로 타입 추정
      if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) contentType = 'image/gif';
      else if (buffer[0] === 0xff && buffer[1] === 0xd8) contentType = 'image/jpeg';
      else if (buffer[0] === 0x89 && buffer[1] === 0x50) contentType = 'image/png';
      else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[4] === 0x57) contentType = 'image/webp';
      else contentType = 'image/jpeg';
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=7200',
      },
    });
  } catch {
    return new NextResponse(JSON.stringify({ error: '이미지를 불러올 수 없습니다' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
