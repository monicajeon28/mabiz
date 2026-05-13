import { NextResponse } from 'next/server';
import { getAuthContext, resolveOrgIdOrNull } from '@/lib/rbac';
import { getDriveClient } from '@/lib/drive-client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** GET /api/images/[id]/download — 원본 PNG 다운로드 (프록시) */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const asset = await prisma.imageAsset.findUnique({ where: { id } });
    if (!asset || asset.organizationId !== orgId) {
      return NextResponse.json({ ok: false, message: '이미지를 찾을 수 없습니다' }, { status: 404 });
    }

    const drive = getDriveClient();
    const response = await drive.files.get(
      { fileId: asset.driveFileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );

    const buffer = Buffer.from(response.data as ArrayBuffer);
    const fileName = asset.originalFileName || 'download.png';

    return new Response(buffer, {
      headers: {
        'Content-Type': asset.mimeType || 'image/png',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    logger.error('[GET /api/images/[id]/download]', { err });
    return NextResponse.json({ ok: false, message: '다운로드 실패' }, { status: 500 });
  }
}
