export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthContext } from '@/lib/rbac';
import { parseServiceAccount } from '@/lib/parse-service-account';

/** 모듈 레벨 토큰 캐시 — 만료 2분 전까지 재사용 */
let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getServiceToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 120_000) {
    return _tokenCache.token;
  }
  const serviceAccountKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;

  let credentials;
  try {
    credentials = serviceAccountKey
      ? parseServiceAccount(serviceAccountKey)
      : {
          client_email: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: (
            process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY ??
            process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? ''
          ).replace(/\\n/g, '\n'),
        };

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Missing Google service account credentials');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`SERVICE_ACCOUNT_CONFIG_ERROR: ${msg}`);
  }

  try {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`GOOGLE_AUTH_ERROR: ${msg}`);
  }
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

    let token: string;
    try {
      token = await getServiceToken();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('SERVICE_ACCOUNT_CONFIG_ERROR')) {
        return new NextResponse(
          JSON.stringify({ error: 'Google Drive 설정이 완료되지 않았습니다' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw err; // 다른 에러는 catch 블록으로
    }

    if (!token) {
      return new NextResponse(
        JSON.stringify({ error: '인증 토큰을 얻을 수 없습니다' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!driveRes.ok) {
      if (driveRes.status === 401) {
        return new NextResponse(JSON.stringify({ error: '이미지 접근 권한이 없습니다' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (driveRes.status === 403) {
        return new NextResponse(JSON.stringify({ error: '이미지 접근이 금지되었습니다' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new NextResponse(JSON.stringify({ error: '이미지를 찾을 수 없습니다' }), {
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
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('UNAUTHORIZED') ? 401 : 500;
    return new NextResponse(
      JSON.stringify({
        error: '이미지를 불러올 수 없습니다',
        devMessage: process.env.NODE_ENV === 'development' ? msg : undefined,
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
