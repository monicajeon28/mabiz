export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/affiliates/[id]/suspend
 * GMcruise AffiliateProfile 정지 (GLOBAL_ADMIN 전용)
 *
 * 5개 필드 동시 업데이트 필수 — 하나라도 빠지면 cron이 다음날 재정지함
 */
export async function POST(
  req: NextRequest,
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

    let reason: string | null = null;
    try {
    const params = await context.params;
      const body = await req.json() as { reason?: string };
      reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;
    } catch {
      // body 없음 허용
    }

    const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      UPDATE "AffiliateProfile"
      SET    status             = 'SUSPENDED',
             "isActive"         = false,
             "suspendedAt"      = NOW(),
             "suspensionReason" = ${reason},
             "autoSuspended"    = false
      WHERE  id = ${profileId}
      RETURNING id
    `);

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: '에이전트를 찾을 수 없습니다.' }, { status: 404 });
    }

    logger.log('[POST /api/affiliates/suspend]', { profileId, reason: reason?.slice(0, 50) });
    return NextResponse.json({ ok: true, profileId });

  } catch (err) {
    logger.error('[POST /api/affiliates/suspend]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
