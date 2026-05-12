export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthContext } from '@/lib/rbac';

/**
 * GET /api/landing-pages/images/proxy?id=DRIVE_FILE_ID
 * 서비스 계정 OAuth 토큰으로 Drive 파일 다운로드 후 반환
 */
export async function GET(req: Request) {
  try {
    await getAuthContext();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return new NextResponse(null, { status: 400 });
    }

    const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const client = await auth.getClient() as { getAccessToken(): Promise<{ token: string | null | undefined }> };
    const tokenRes = await client.getAccessToken();
    const token = tokenRes.token ?? '';
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
