export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

type RawGoldMember = {
  id: number;
  name: string | null;
  phone: string | null;
  tier: number | null;
  status: string;
  paymentCount: number | null;
  maxPaymentCount: number | null;
  productType: string | null;
  startDate: Date | null;
  createdAt: Date;
  memo: string | null;
  agentName: string | null;
  agentMallUserId: string | null;
  managerName: string | null;
  managerMallUserId: string | null;
};

const ALLOWED_STATUSES = new Set(['active', 'inactive']);

/**
 * GET /api/gold-members
 * GMcruise GoldMember 목록 조회
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

    const rawStatus = searchParams.get('status');
    const q         = searchParams.get('q')?.trim() ?? '';
    const status    = rawStatus && ALLOWED_STATUSES.has(rawStatus) ? rawStatus : null;

    // 파라미터화된 WHERE 조건
    const conditions: Prisma.Sql[] = [Prisma.sql`gm."deletedAt" IS NULL`];

    if (ctx.role === 'OWNER' && ctx.mallUser?.affiliateProfileId) {
      conditions.push(Prisma.sql`gm."managerId" = ${ctx.mallUser.affiliateProfileId}`);
    } else if (ctx.role === 'AGENT' && ctx.mallUser?.affiliateProfileId) {
      conditions.push(Prisma.sql`gm."agentId" = ${ctx.mallUser.affiliateProfileId}`);
    }

    if (status) conditions.push(Prisma.sql`gm.status = ${status}`);
    if (q)      conditions.push(Prisma.sql`(gm.name ILIKE ${'%' + q + '%'} OR gm.phone ILIKE ${'%' + q + '%'})`);

    const whereClause = Prisma.join(conditions, ' AND ');

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<RawGoldMember[]>(Prisma.sql`
        SELECT
          gm.id,
          gm.name,
          gm.phone,
          gm.tier,
          gm.status,
          gm."paymentCount",
          gm."maxPaymentCount",
          gm."productType",
          gm."startDate",
          gm."createdAt",
          gm.memo,
          agent_u.name          AS "agentName",
          agent_u."mallUserId"  AS "agentMallUserId",
          mgr_u.name            AS "managerName",
          mgr_u."mallUserId"    AS "managerMallUserId"
        FROM "GoldMember" gm
        LEFT JOIN "AffiliateProfile" agent_ap ON agent_ap.id  = gm."agentId"
        LEFT JOIN "User"             agent_u  ON agent_u.id   = agent_ap."userId"
        LEFT JOIN "AffiliateProfile" mgr_ap   ON mgr_ap.id    = gm."managerId"
        LEFT JOIN "User"             mgr_u    ON mgr_u.id     = mgr_ap."userId"
        WHERE ${whereClause}
        ORDER BY gm."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM "GoldMember" gm
        WHERE ${whereClause}
      `),
    ]);

    const total = Number(countRows[0]?.count ?? 0);

    const goldMembers = rows.map((r) => ({
      id:                 r.id,
      name:               r.name,
      phone:              r.phone ? r.phone.slice(0, 3) + '-****-' + r.phone.slice(-4) : null,
      tier:               r.tier,
      status:             r.status,
      paymentCount:       r.paymentCount,
      maxPaymentCount:    r.maxPaymentCount,
      productType:        r.productType,
      startDate:          r.startDate?.toISOString() ?? null,
      createdAt:          r.createdAt.toISOString(),
      memo:               r.memo,
      agentName:          r.agentName,
      agentMallUserId:    r.agentMallUserId,
      managerName:        r.managerName,
      managerMallUserId:  r.managerMallUserId,
    }));

    logger.log('[GET /api/gold-members]', { role: ctx.role, total });
    return NextResponse.json({ ok: true, goldMembers, total, page, totalPages: Math.ceil(total / limit) });

  } catch (err) {
    logger.error('[GET /api/gold-members]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
