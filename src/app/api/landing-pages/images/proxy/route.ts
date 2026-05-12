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
  const privateKey = (
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY ??
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? ''
  ).replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
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

    if (!driveRes.ok) return new NextResponse(null, { status: 404 });

    const contentType = driveRes.headers.get('content-type') ?? 'image/webp';
    const buffer = Buffer.from(await driveRes.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=7200',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
