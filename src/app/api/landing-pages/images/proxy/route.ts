export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/drive-client';
import { getAuthContext } from '@/lib/rbac';

/**
 * GET /api/landing-pages/images/proxy?id=DRIVE_FILE_ID
 * Drive 이미지를 서비스 계정으로 가져와서 반환 (preview iframe용)
 */
export async function GET(req: Request) {
  try {
    await getAuthContext();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return new NextResponse(null, { status: 400 });
    }

    const drive = getDriveClient();
    const res = await drive.files.get(
      { fileId: id, alt: 'media' },
      { responseType: 'arraybuffer' },
    );

    const buffer = Buffer.from(res.data as ArrayBuffer);
    const contentType = (res.headers?.['content-type'] as string | undefined) ?? 'image/webp';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
