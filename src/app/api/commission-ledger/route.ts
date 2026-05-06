export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const ALLOWED_TYPES  = new Set(['EARNED', 'PAID', 'ADJUSTED', 'REVERSED']);
const YEAR_MONTH_RE  = /^\d{4}-\d{2}$/;

type RawLedger = {
  id: number;
  agentId: number;
  saleId: number | null;
  type: string;
  amount: number;
  balance: number;
  yearMonth: string;
  note: string | null;
  createdAt: Date;
};

type RawSummary = {
  totalEarned: bigint;
  totalPaid: bigint;
  totalReversed: bigint;
};

/**
 * GET /api/commission-ledger
 * GMcruise CommissionLedger 커미션 원장 조회
 *
 * GLOBAL_ADMIN: 전체
 * OWNER:        AffiliateRelation 소속 에이전트
 * AGENT:        본인 agentId
 * FREE_SALES:   403
 */
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

    const rawAgentId   = searchParams.get('agentId');
    const rawYearMonth = searchParams.get('yearMonth')?.trim() ?? '';
    const rawType      = searchParams.get('type');

    const agentIdFilter = rawAgentId ? parseInt(rawAgentId) || null : null;
    const yearMonth     = YEAR_MONTH_RE.test(rawYearMonth) ? rawYearMonth : null;
    const typeFilter    = rawType && ALLOWED_TYPES.has(rawType) ? rawType : null;

    // 역할별 스코프
    let roleCondition: Prisma.Sql = Prisma.empty;
    if (ctx.role === 'AGENT') {
      const agentProfileId = ctx.mallUser?.affiliateProfileId;
      if (!agentProfileId) {
        return NextResponse.json({ ok: false, error: '파트너 프로필이 없습니다.' }, { status: 403 });
      }
      roleCondition = Prisma.sql`AND cl."agentId" = ${agentProfileId}`;
    } else if (ctx.role === 'OWNER') {
      const ownerProfileId = ctx.mallUser?.affiliateProfileId;
      if (!ownerProfileId) {
        return NextResponse.json({ ok: false, error: '파트너 프로필이 없습니다.' }, { status: 403 });
      }
      roleCondition = Prisma.sql`
        AND cl."agentId" IN (
          SELECT ar."agentId" FROM "AffiliateRelation" ar
          WHERE ar."managerId" = ${ownerProfileId} AND ar.status = 'ACTIVE'
        )
      `;
    }

    const agentCondition:     Prisma.Sql = agentIdFilter ? Prisma.sql`AND cl."agentId" = ${agentIdFilter}` : Prisma.empty;
    const yearMonthCondition: Prisma.Sql = yearMonth     ? Prisma.sql`AND cl."yearMonth" = ${yearMonth}`   : Prisma.empty;
    const typeCondition:      Prisma.Sql = typeFilter    ? Prisma.sql`AND cl.type = ${typeFilter}`          : Prisma.empty;

    const [rows, countRows, summaryRows] = await Promise.all([
      prisma.$queryRaw<RawLedger[]>(Prisma.sql`
        SELECT cl.id, cl."agentId", cl."saleId", cl.type,
               cl.amount, cl.balance, cl."yearMonth", cl.note, cl."createdAt"
        FROM "CommissionLedger" cl
        WHERE 1=1
          ${roleCondition} ${agentCondition} ${yearMonthCondition} ${typeCondition}
        ORDER BY cl."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "CommissionLedger" cl
        WHERE 1=1 ${roleCondition} ${agentCondition} ${yearMonthCondition} ${typeCondition}
      `),
      prisma.$queryRaw<RawSummary[]>(Prisma.sql`
        SELECT
          COALESCE(SUM(CASE WHEN cl.type IN ('EARNED','ADJUSTED') THEN cl.amount ELSE 0 END), 0)::bigint AS "totalEarned",
          COALESCE(SUM(CASE WHEN cl.type = 'PAID'     THEN cl.amount ELSE 0 END), 0)::bigint             AS "totalPaid",
          COALESCE(SUM(CASE WHEN cl.type = 'REVERSED' THEN cl.amount ELSE 0 END), 0)::bigint             AS "totalReversed"
        FROM "CommissionLedger" cl
        WHERE 1=1 ${roleCondition} ${agentCondition} ${yearMonthCondition} ${typeCondition}
      `),
    ]);

    const total         = Number(countRows[0]?.total ?? 0);
    const totalEarned   = Number(summaryRows[0]?.totalEarned   ?? 0);
    const totalPaid     = Number(summaryRows[0]?.totalPaid     ?? 0);
    const totalReversed = Number(summaryRows[0]?.totalReversed ?? 0);

    const ledger = rows.map((r) => ({
      id:        r.id,
      agentId:   r.agentId,
      saleId:    r.saleId ?? null,
      type:      r.type,
      amount:    Number(r.amount),
      balance:   Number(r.balance),
      yearMonth: r.yearMonth,
      note:      r.note ?? null,
      createdAt: r.createdAt.toISOString(),
    }));

    logger.log('[GET /api/commission-ledger]', { role: ctx.role, total, page });
    return NextResponse.json({
      ok: true,
      ledger,
      summary: { totalEarned, totalPaid, totalReversed, net: totalEarned - totalPaid - totalReversed },
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });

  } catch (err) {
    logger.error('[GET /api/commission-ledger]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
