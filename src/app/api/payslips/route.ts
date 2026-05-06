export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const ALLOWED_STATUSES = new Set(['DRAFT', 'CONFIRMED', 'PAID']);
const YEAR_MONTH_RE    = /^\d{4}-\d{2}$/;

type RawPayslip = {
  id: number;
  agentId: number;
  yearMonth: string;
  baseCommission: number;
  bonus: number | null;
  deduction: number | null;
  netAmount: number;
  status: string;
  paidAt: Date | null;
  note: string | null;
  createdAt: Date;
  agentDisplayName: string | null;
  agentMallUserId: string | null;
};

/**
 * GET /api/payslips
 * GMcruise Payslip 급여명세 목록 조회
 *
 * GLOBAL_ADMIN: 전체
 * OWNER:        AffiliateRelation 소속 에이전트 급여만
 * AGENT/FREE_SALES: 본인 agentId만
 * mallUser 없는 CRM 세션: 전체 허용
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1')  || 1);
    const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20') || 20);
    const offset = (page - 1) * limit;

    const rawYearMonth = searchParams.get('yearMonth')?.trim() ?? '';
    const rawStatus    = searchParams.get('status') ?? '';

    const yearMonth = YEAR_MONTH_RE.test(rawYearMonth) ? rawYearMonth : null;
    const status    = ALLOWED_STATUSES.has(rawStatus)  ? rawStatus    : null;

    // 역할별 스코프 조건
    let scopeCondition: Prisma.Sql = Prisma.empty;

    if (ctx.role === 'OWNER') {
      const ownerProfileId = ctx.mallUser?.affiliateProfileId;
      if (!ownerProfileId) {
        return NextResponse.json({ ok: false, error: '파트너 프로필이 없습니다.' }, { status: 403 });
      }
      scopeCondition = Prisma.sql`
        AND p."agentId" IN (
          SELECT ar."agentId"
          FROM "AffiliateRelation" ar
          WHERE ar."managerId" = ${ownerProfileId}
            AND ar.status = 'ACTIVE'
        )
      `;
    } else if (ctx.role === 'AGENT' || ctx.role === 'FREE_SALES') {
      const agentProfileId = ctx.mallUser?.affiliateProfileId;
      if (agentProfileId) {
        scopeCondition = Prisma.sql`AND p."agentId" = ${agentProfileId}`;
      }
      // mallUser 없는 CRM 세션: 전체 허용
    }
    // GLOBAL_ADMIN: 조건 없음

    const yearMonthCondition: Prisma.Sql = yearMonth
      ? Prisma.sql`AND p."yearMonth" = ${yearMonth}`
      : Prisma.empty;
    const statusCondition: Prisma.Sql = status
      ? Prisma.sql`AND p.status = ${status}`
      : Prisma.empty;

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<RawPayslip[]>(Prisma.sql`
        SELECT
          p.id,
          p."agentId",
          p."yearMonth",
          p."baseCommission",
          p.bonus,
          p.deduction,
          p."netAmount",
          p.status,
          p."paidAt",
          p.note,
          p."createdAt",
          COALESCE(ap."displayName", u.name) AS "agentDisplayName",
          u."mallUserId"                      AS "agentMallUserId"
        FROM "Payslip" p
        JOIN "AffiliateProfile" ap ON ap.id = p."agentId"
        JOIN "User"             u  ON u.id  = ap."userId"
        WHERE 1=1
          ${scopeCondition}
          ${yearMonthCondition}
          ${statusCondition}
        ORDER BY p."yearMonth" DESC, p."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "Payslip" p
        JOIN "AffiliateProfile" ap ON ap.id = p."agentId"
        JOIN "User"             u  ON u.id  = ap."userId"
        WHERE 1=1
          ${scopeCondition}
          ${yearMonthCondition}
          ${statusCondition}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    const payslips = rows.map((r) => ({
      id:               r.id,
      agentId:          r.agentId,
      yearMonth:        r.yearMonth,
      baseCommission:   Number(r.baseCommission),
      bonus:            r.bonus != null ? Number(r.bonus) : null,
      deduction:        r.deduction != null ? Number(r.deduction) : null,
      netAmount:        Number(r.netAmount),
      status:           r.status,
      paidAt:           r.paidAt?.toISOString() ?? null,
      note:             r.note,
      createdAt:        r.createdAt.toISOString(),
      agentDisplayName: r.agentDisplayName,
      agentMallUserId:  r.agentMallUserId,
    }));

    logger.log('[GET /api/payslips]', { role: ctx.role, total, page });
    return NextResponse.json({ ok: true, payslips, total, page, totalPages: Math.ceil(total / limit) });

  } catch (err) {
    logger.error('[GET /api/payslips]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
