export const dynamic = 'force-dynamic';

/**
 * GET /api/affiliate/contracts/[contractId]/document?kind=idPhoto|bankBook
 *
 * 파트너 계약 서류(신분증/통장)를 GLOBAL_ADMIN 인증 하에 스트리밍.
 * Drive에는 비공개로 저장되어 있으므로 서비스계정 토큰으로 받아 중계한다.
 * (민감정보 — 캐시/공개 금지)
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { parseServiceAccount } from '@/lib/parse-service-account';
import { logger } from '@/lib/logger';

let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getServiceToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 120_000) return _tokenCache.token;
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  try {
    const ctx = await getAuthContext();
    if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
      return new NextResponse(null, { status: 403 });
    }

    const { contractId } = await params;
    const id = parseInt(contractId, 10);
    if (isNaN(id) || id <= 0) return new NextResponse(null, { status: 400 });

    const kind = new URL(req.url).searchParams.get('kind');
    if (kind !== 'idPhoto' && kind !== 'bankBook') return new NextResponse(null, { status: 400 });

    const contract = await prisma.gmAffiliateContract.findUnique({
      where: { id },
      select: { metadata: true },
    });
    const meta = (contract?.metadata as Record<string, unknown> | null) ?? {};
    const driveId = kind === 'idPhoto' ? meta.idPhotoDriveId : meta.bankBookDriveId;
    if (typeof driveId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(driveId)) {
      return new NextResponse(null, { status: 404 });
    }

    const token = await getServiceToken();
    if (!token) return new NextResponse(null, { status: 503 });

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!driveRes.ok) {
      return new NextResponse(null, { status: driveRes.status === 404 ? 404 : 502 });
    }

    const buffer = Buffer.from(await driveRes.arrayBuffer());
    const rawCT = driveRes.headers.get('content-type') ?? '';
    let contentType = rawCT && !rawCT.includes('octet-stream') ? rawCT : '';
    if (!contentType) {
      if (buffer[0] === 0xff && buffer[1] === 0xd8) contentType = 'image/jpeg';
      else if (buffer[0] === 0x89 && buffer[1] === 0x50) contentType = 'image/png';
      else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[4] === 0x57) contentType = 'image/webp';
      else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) contentType = 'image/gif';
      else contentType = 'application/octet-stream';
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        // 민감정보 — 캐시 금지
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  } catch (err) {
    logger.error('[contract-document] 스트리밍 실패', { err });
    return new NextResponse(null, { status: 500 });
  }
}
