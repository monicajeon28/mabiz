export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

type RawSale = {
  id: number;
  agentId: number | null;
  managerId: number | null;
  status: string;
  saleAmount: number;
  salesCommission: number | null;
  commissionRate: number | null;
  yearMonth: string | null;
  saleDate: Date | null;
  confirmedAt: Date | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  externalOrderCode: string | null;
  agentDisplayName: string | null;
  agentMallUserId: string | null;
  customerName: string | null;
  customerPhone: string | null;
};

const ALLOWED_STATUSES = new Set([
  'PENDING', 'PENDING_APPROVAL', 'APPROVED', 'CONFIRMED', 'REJECTED', 'REFUNDED', 'CANCELLED',
]);

/**
 * GET /api/affiliate-sales
 * GMcruise AffiliateSale 판매 목록 조회
 *
 * GLOBAL_ADMIN: 전체
 * OWNER:        managerId = affiliateProfileId
 * AGENT:        agentId   = affiliateProfileId
 * FREE_SALES:   403
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1')  || 1);
    const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20') || 20);
    const offset = (page - 1) * limit;

    const rawStatus  = searchParams.get('status');
    const rawAgentId = searchParams.get('agentId');
    const status     = rawStatus && ALLOWED_STATUSES.has(rawStatus) ? rawStatus : null;
    const agentId    = rawAgentId ? parseInt(rawAgentId) || null : null;

    const conditions: Prisma.Sql[] = [];

    // 역할별 기본 필터
    if (ctx.role === 'OWNER' && ctx.mallUser?.affiliateProfileId) {
      conditions.push(Prisma.sql`als."managerId" = ${ctx.mallUser.affiliateProfileId}`);
    } else if (ctx.role === 'AGENT' && ctx.mallUser?.affiliateProfileId) {
      conditions.push(Prisma.sql`als."agentId" = ${ctx.mallUser.affiliateProfileId}`);
    }

    if (status)  conditions.push(Prisma.sql`als.status = ${status}`);
    if (agentId) conditions.push(Prisma.sql`als."agentId" = ${agentId}`);

    const whereClause = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<RawSale[]>(Prisma.sql`
        SELECT
          als.id,
          als."agentId",
          als."managerId",
          als.status,
          als."saleAmount",
          als."salesCommission",
          als."commissionRate",
          als."yearMonth",
          als."saleDate",
          als."confirmedAt",
          als."paidAt",
          als."refundedAt",
          als."createdAt",
          als."externalOrderCode",
          ap."displayName"   AS "agentDisplayName",
          u."mallUserId"     AS "agentMallUserId",
          lead."customerName",
          lead."customerPhone"
        FROM "AffiliateSale" als
        LEFT JOIN "AffiliateProfile" ap   ON ap.id   = als."agentId"
        LEFT JOIN "User"             u    ON u.id    = ap."userId"
        LEFT JOIN "AffiliateLead"    lead ON lead.id = als."leadId"
        ${whereClause}
        ORDER BY als."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS total
        FROM "AffiliateSale" als
        ${whereClause}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    const sales = rows.map((r) => ({
      id:                 r.id,
      agentId:            r.agentId,
      managerId:          r.managerId,
      status:             r.status,
      saleAmount:         Number(r.saleAmount),
      salesCommission:    r.salesCommission != null ? Number(r.salesCommission) : null,
      commissionRate:     r.commissionRate  != null ? Number(r.commissionRate)  : null,
      yearMonth:          r.yearMonth,
      saleDate:           r.saleDate?.toISOString()    ?? null,
      confirmedAt:        r.confirmedAt?.toISOString() ?? null,
      paidAt:             r.paidAt?.toISOString()      ?? null,
      refundedAt:         r.refundedAt?.toISOString()  ?? null,
      createdAt:          r.createdAt.toISOString(),
      externalOrderCode:  r.externalOrderCode,
      agentDisplayName:   r.agentDisplayName,
      agentMallUserId:    r.agentMallUserId,
      customerName:       r.customerName,
      customerPhone:      r.customerPhone ? r.customerPhone.slice(0, 3) + '-****-****' : null,
    }));

    logger.log('[GET /api/affiliate-sales]', { role: ctx.role, total });
    return NextResponse.json({ ok: true, sales, total, page, totalPages: Math.ceil(total / limit) });

  } catch (err) {
    logger.error('[GET /api/affiliate-sales]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
