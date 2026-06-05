export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { parseServiceAccount } from '@/lib/parse-service-account';

const FOLDER_ID =
  process.env.LANDING_PAGES_DRIVE_FOLDER_ID ?? '1PpZbApjr5rZRlyP5onwkRUxz6X9gFPZz';

/**
 * GET /api/landing-pages/images/upload-url?fileName=xxx&mimeType=image/gif
 *
 * Drive Resumable Upload 세션 URL을 생성해 반환합니다.
 * 클라이언트가 이 URL로 직접 Drive에 파일을 업로드하면,
 * 업로드 완료 후 /api/landing-pages/images/finalize 를 호출해 WebP 변환을 요청합니다.
 *
 * Response: { ok: true, uploadUrl: string }
 */
export async function GET(req: Request) {
  try {
    await getAuthContext(); // 인증 체크만

    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('fileName');
    const mimeType =
      searchParams.get('mimeType') || 'application/octet-stream';

    if (!fileName) {
      return NextResponse.json(
        { ok: false, message: 'fileName 필수' },
        { status: 400 },
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: parseServiceAccount(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const client = await auth.getClient() as {
      getAccessToken(): Promise<{ token?: string | null }>;
    };
    const tokenRes = await client.getAccessToken();
    const token = tokenRes?.token;
    if (!token) throw new Error('Drive 토큰 발급 실패');

    // Resumable Upload 세션 초기화
    const initRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': mimeType,
        },
        body: JSON.stringify({
          name: fileName,
          parents: [FOLDER_ID],
        }),
      },
    );

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error(
        `Drive API ${initRes.status}: ${errText.slice(0, 200)}`,
      );
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) throw new Error('Resumable Upload URL 없음');

    logger.info('[upload-url] Resumable 세션 생성', { fileName });
    return NextResponse.json({ ok: true, uploadUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다' },
        { status: 401 },
      );
    }
    logger.error('[upload-url] 오류', { msg });
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
