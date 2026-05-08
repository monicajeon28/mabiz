export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/affiliates/[id]/unsuspend
 * GMcruise AffiliateProfile 정지 해제 (GLOBAL_ADMIN 전용)
 *
 * status = 'SUSPENDED' 인 경우에만 해제 — RETURNING id 없으면 404
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });
    }

    const profileId = parseInt(params.id);
    if (!profileId || isNaN(profileId) || profileId <= 0) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID' }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      UPDATE "AffiliateProfile"
      SET    status             = 'ACTIVE',
             "isActive"         = true,
             "suspendedAt"      = NULL,
             "suspensionReason" = NULL,
             "autoSuspended"    = false
      WHERE  id = ${profileId}
        AND  status = 'SUSPENDED'
      RETURNING id
    `);

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: '에이전트를 찾을 수 없거나 정지 상태가 아닙니다.' },
        { status: 404 }
      );
    }

    logger.log('[POST /api/affiliates/unsuspend]', { profileId });
    return NextResponse.json({ ok: true, profileId });

  } catch (err) {
    logger.error('[POST /api/affiliates/unsuspend]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
