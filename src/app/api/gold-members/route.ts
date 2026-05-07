export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/gold-members
 * GMcruise ProductInquiry WHERE productCode='GOLD_MEMBERSHIP' AND status='confirmed'
 * (GoldMember 전용 테이블 없음 — 골드 구매 확정 문의를 골드회원으로 간주)
 *
 * GLOBAL_ADMIN / OWNER / AGENT: 전체 조회
 * FREE_SALES: 403
 */

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(0, 3) + '-****-' + digits.slice(-4);
  }
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

type RawMember = {
  id: number;
  productCode: string;
  name: string;
  phone: string;
  message: string | null;
  status: string;
  createdAt: Date;
  userId: number | null;
};

export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1')  || 1);
    const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20') || 20);
    const offset = (page - 1) * limit;

    const q = searchParams.get('q')?.trim() ?? '';

    const searchCondition: Prisma.Sql = q
      ? Prisma.sql`AND (pi.name ILIKE ${'%' + q + '%'} OR pi.phone ILIKE ${'%' + q + '%'})`
      : Prisma.empty;

    // 골드회원 = productCode='GOLD_MEMBERSHIP' + status='confirmed'
    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<RawMember[]>(Prisma.sql`
        SELECT
          pi.id,
          pi."productCode",
          pi.name,
          pi.phone,
          pi.message,
          pi.status,
          pi."createdAt",
          pi."userId"
        FROM "ProductInquiry" pi
        WHERE pi."productCode" = 'GOLD_MEMBERSHIP'
          AND pi.status = 'confirmed'
          ${searchCondition}
        ORDER BY pi."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM "ProductInquiry" pi
        WHERE pi."productCode" = 'GOLD_MEMBERSHIP'
          AND pi.status = 'confirmed'
          ${searchCondition}
      `),
    ]);

    const total = Number(countRows[0]?.count ?? 0);

    const goldMembers = rows.map((r) => ({
      id:           r.id,
      name:         r.name,
      phone:        maskPhone(r.phone),
      status:       'active',          // confirmed = active
      productType:  r.productCode,
      tier:         null,
      paymentCount: null,
      maxPaymentCount: null,
      startDate:    r.createdAt.toISOString(),
      createdAt:    r.createdAt.toISOString(),
      memo:         r.message,
      agentName:    null,
      agentMallUserId: null,
      managerName:  null,
    }));

    logger.log('[GET /api/gold-members]', { role: ctx.role, total });
    return NextResponse.json({ ok: true, goldMembers, total, page, totalPages: Math.ceil(total / limit) });

  } catch (err) {
    logger.error('[GET /api/gold-members]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
