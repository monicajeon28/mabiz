export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const ALLOWED_CONTRACT_STATUSES = new Set([
  'PENDING', 'SIGNED', 'ACTIVE', 'TERMINATED', 'SUSPENDED',
]);

/**
 * PATCH /api/affiliates/[id]/contract-status
 * GMcruise AffiliateProfile 계약상태 수정 (GLOBAL_ADMIN 전용)
 */
export async function PATCH(
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

    let contractStatus: string;
    try {
      const body = await req.json() as { contractStatus?: unknown };
      contractStatus = String(body.contractStatus ?? '');
    } catch {
      return NextResponse.json({ ok: false, error: '요청 본문을 파싱할 수 없습니다.' }, { status: 400 });
    }

    if (!ALLOWED_CONTRACT_STATUSES.has(contractStatus)) {
      return NextResponse.json(
        { ok: false, error: `허용되지 않은 contractStatus. 허용값: ${[...ALLOWED_CONTRACT_STATUSES].join('|')}` },
        { status: 400 }
      );
    }

    const rows = await prisma.$queryRaw<{ id: number; contractStatus: string }[]>(Prisma.sql`
      UPDATE "AffiliateProfile"
      SET    "contractStatus" = ${contractStatus}
      WHERE  id = ${profileId}
      RETURNING id, "contractStatus"
    `);

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: '에이전트를 찾을 수 없습니다.' }, { status: 404 });
    }

    logger.log('[PATCH /api/affiliates/contract-status]', { profileId, contractStatus });
    return NextResponse.json({ ok: true, id: rows[0].id, contractStatus: rows[0].contractStatus });

  } catch (err) {
    logger.error('[PATCH /api/affiliates/contract-status]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
