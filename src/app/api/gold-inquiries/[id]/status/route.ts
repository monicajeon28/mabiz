export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GMcruise ProductInquiry 실제 status 값 (소문자)
const VALID_STATUSES = new Set(['pending', 'unavailable', 'passport_waiting', 'confirmed', 'refund']);

/**
 * PATCH /api/gold-inquiries/[id]/status
 * 골드문의 상태 변경 (GLOBAL_ADMIN / OWNER만)
 * ProductInquiry에 managerId 컬럼 없으므로 OWNER scope 미적용
 */
export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const inquiryId = parseInt(context.params.id);
    if (!inquiryId || isNaN(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ ok: false, error: '유효하지 않은 ID' }, { status: 400 });
    }

    const body = await req.json() as { status?: string };
    // 대소문자 모두 처리
    const status = (body.status ?? '').toLowerCase();
    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { ok: false, error: `허용된 status: ${[...VALID_STATUSES].join('|')}` },
        { status: 400 }
      );
    }

    const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      UPDATE "ProductInquiry"
      SET    status = ${status},
             "updatedAt" = NOW()
      WHERE  id = ${inquiryId}
        AND  "productCode" = 'GOLD_MEMBERSHIP'
      RETURNING id
    `);

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: '문의를 찾을 수 없습니다.' }, { status: 404 });
    }

    logger.log('[PATCH /api/gold-inquiries/status]', { inquiryId, status, role: ctx.role });
    return NextResponse.json({ ok: true, id: rows[0].id, status });

  } catch (err) {
    logger.error('[PATCH /api/gold-inquiries/status]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
