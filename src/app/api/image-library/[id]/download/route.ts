import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { parseServiceAccount } from '@/lib/parse-service-account';
import prisma from '@/lib/prisma';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** 토큰 캐시 (2분 여유) */
let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getDriveToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 120_000) {
    return _tokenCache.token;
  }
  const serviceAccountKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  const auth = new google.auth.GoogleAuth({
    credentials: parseServiceAccount(serviceAccountKey),
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
 * GET /api/image-library/[id]/download
 * ImageAsset를 ID로 조회하여 다운로드. 워터마크 합성 후 PNG 반환.
 * 권한: 자신의 조직 이미지만 다운로드 가능 (GLOBAL_ADMIN 제외)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    const { id } = await params;

    // organizationId 해석
    const isGlobalAdmin = ctx.role === 'GLOBAL_ADMIN' && !ctx.organizationId;
    const orgId: string | null = isGlobalAdmin ? null : resolveOrgId(ctx);

    // ImageAsset 조회
    const asset = await prisma.imageAsset.findUnique({
      where: { id },
    });

    if (!asset) {
      return NextResponse.json(
        { ok: false, error: '이미지를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 권한 검증: GLOBAL_ADMIN이 아니면 같은 조직만 접근
    if (!isGlobalAdmin && asset.organizationId !== orgId) {
      return NextResponse.json(
        { ok: false, error: '접근 권한이 없습니다' },
        { status: 401 }
      );
    }

    // Google Drive에서 이미지 다운로드
    const token = await getDriveToken();
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${asset.driveFileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!driveRes.ok) {
      logger.error('[image-library download]', {
        status: driveRes.status,
        assetId: id,
        driveFileId: asset.driveFileId,
      });
      return NextResponse.json(
        { ok: false, error: '이미지를 가져올 수 없습니다' },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await driveRes.arrayBuffer());

    // Sharp 메타데이터 추출
    const meta = await sharp(buffer).metadata();
    const w = meta.width ?? 800;
    const h = meta.height ?? 600;

    // 반투명 회색 오버레이 (alpha: 0.3)
    const overlay = await sharp({
      create: {
        width: w,
        height: h,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0.3 },
      },
    })
      .png()
      .toBuffer();

    // 워터마크: logo.png 있으면 사용, 없으면 텍스트
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    let watermarkInput: Buffer;

    if (fs.existsSync(logoPath)) {
      const logoSize = Math.max(80, Math.floor(w * 0.45));
      // 핑크 로고 → 회색조 + 투명도 55%: 가운데 크게, 도용 방지 강화
      watermarkInput = await sharp(logoPath)
        .resize({ width: logoSize, withoutEnlargement: true })
        .grayscale()
        .ensureAlpha()
        .composite([{
          input: Buffer.from([255, 255, 255, Math.round(255 * 0.55)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in',
        }])
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

    // 워터마크 합성
    const result = await sharp(buffer)
      .composite([
        { input: overlay, blend: 'over' },
        { input: watermarkInput, gravity: 'center', blend: 'over' },
      ])
      .png()
      .toBuffer();

    // 파일 이름 안전화
    const safeName = encodeURIComponent(
      asset.originalFileName.replace(/\.[^.]+$/, '')
    );

    return new Response(result as unknown as BodyInit, {
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
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다' },
        { status: 401 }
      );
    }
    logger.error('[image-library/[id]/download]', { msg });
    return NextResponse.json(
      { ok: false, error: '다운로드 실패' },
      { status: 500 }
    );
  }
}
