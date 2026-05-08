import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { syncDriveFolder } from '@/lib/image-sync';
import { logger } from '@/lib/logger';

/**
 * POST /api/images/sync
 * Google Drive 폴더를 스캔하여 DB와 동기화 (GLOBAL_ADMIN 전용)
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();

    // GLOBAL_ADMIN 권한 확인
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, message: '관리자만 동기화 가능합니다' },
        { status: 403 }
      );
    }

    const orgId = requireOrgId(ctx);
    const body = await req.json();
    const { category } = body;

    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { ok: false, message: '카테고리가 필요합니다 (예: "배너")' },
        { status: 400 }
      );
    }

    const synced = await syncDriveFolder({
      organizationId: orgId,
      orgName: ctx.organization?.name || orgId,
      category,
    });

    logger.info('[POST /api/images/sync] 동기화 완료', {
      organizationId: orgId,
      category,
      syncedCount: synced.length,
    });

    return NextResponse.json({
      ok: true,
      data: {
        syncedCount: synced.length,
        assets: synced.map((a) => ({
          id: a.id,
          fileName: a.originalFileName,
          category: a.category,
        })),
      },
    });
  } catch (err) {
    logger.error('[POST /api/images/sync]', { err });
    return NextResponse.json(
      { ok: false, message: '동기화 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
