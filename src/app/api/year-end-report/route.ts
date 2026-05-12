export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

type RawAgentRow = {
  agentId: number;
  agentName: string;
  mallUserId: string | null;
  totalSaleAmount: bigint;
  totalCommission: bigint;
  totalRefund: bigint;
  confirmedCount: bigint;
  unsetCommissionCount: bigint;
};

const YEAR_RE = /^\d{4}$/;

/**
 * GET /api/year-end-report
 * 연말정산 보고서 — 에이전트별 연간 매출/커미션/환불 집계
 *
 * GLOBAL_ADMIN / OWNER만 접근
 * ?year=2025 (없으면 현재 연도)
 * ?agentId=123 (GLOBAL_ADMIN만 유효)
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    const rawYear = searchParams.get('year');
    let year: string;
    if (rawYear !== null) {
      if (!YEAR_RE.test(rawYear)) {
        return NextResponse.json({ ok: false, error: 'year는 4자리 연도여야 합니다.' }, { status: 400 });
      }
      year = rawYear;
    } else {
      year = String(new Date().getFullYear());
    }
    const yearLike = year + '%';

    // agentId 필터 — GLOBAL_ADMIN만 유효
    const rawAgentId = searchParams.get('agentId');
    const agentIdFilter: Prisma.Sql =
      ctx.role === 'GLOBAL_ADMIN' && rawAgentId && /^\d+$/.test(rawAgentId)
        ? Prisma.sql`AND ap.id = ${parseInt(rawAgentId)}`
        : Prisma.empty;

    // OWNER: 소속 에이전트만
    let relationFilter: Prisma.Sql = Prisma.empty;
    if (ctx.role === 'OWNER') {
      const ownerProfileId = ctx.mallUser?.affiliateProfileId;
      if (!ownerProfileId) {
        return NextResponse.json({ ok: false, error: '파트너 프로필이 없습니다.' }, { status: 403 });
      }
      relationFilter = Prisma.sql`
        AND ap.id IN (
          SELECT ar."agentId" FROM "AffiliateRelation" ar
          WHERE ar."managerId" = ${ownerProfileId} AND ar.status = 'ACTIVE'
        )
      `;
    }

    const rows = await prisma.$queryRaw<RawAgentRow[]>(Prisma.sql`
      SELECT
        ap.id AS "agentId",
        COALESCE(ap."displayName", u.name) AS "agentName",
        u."mallUserId",
        SUM(CASE WHEN als.status IN ('APPROVED','CONFIRMED') THEN als."saleAmount" ELSE 0 END)::bigint AS "totalSaleAmount",
        COALESCE(SUM(CASE WHEN als.status IN ('APPROVED','CONFIRMED') AND als."salesCommission" IS NOT NULL
              THEN als."salesCommission"
              ELSE NULL END), 0)::bigint AS "totalCommission",
        COUNT(CASE WHEN als.status IN ('APPROVED','CONFIRMED') AND als."salesCommission" IS NULL THEN 1 END)::bigint AS "unsetCommissionCount",
        SUM(CASE WHEN als.status = 'REFUNDED' THEN als."saleAmount" ELSE 0 END)::bigint AS "totalRefund",
        COUNT(CASE WHEN als.status IN ('APPROVED','CONFIRMED') THEN 1 END)::bigint AS "confirmedCount"
      FROM "AffiliateProfile" ap
      JOIN "User" u ON u.id = ap."userId"
      LEFT JOIN "AffiliateSale" als
             ON als."agentId" = ap.id AND als."yearMonth" LIKE ${yearLike}
      WHERE 1=1
        ${agentIdFilter}
        ${relationFilter}
      GROUP BY ap.id, ap."displayName", u.name, u."mallUserId"
      -- TODO: FREE_SALES 수당 포함 필요 (AffiliateSale.affiliateCode 기반 별도 집계)
      ORDER BY "totalSaleAmount" DESC
    `);

    const agents = rows.map((r) => {
      const totalSaleAmount = Number(r.totalSaleAmount);
      const totalRefund     = Number(r.totalRefund);
      return {
        agentId:              r.agentId,
        agentName:            r.agentName ?? '',
        mallUserId:           r.mallUserId ?? null,
        totalSaleAmount,
        totalCommission:      Number(r.totalCommission),
        totalRefund,
        confirmedCount:       Number(r.confirmedCount),
        unsetCommissionCount: Number(r.unsetCommissionCount),
        refundRate:           totalSaleAmount > 0
          ? Math.round((totalRefund / totalSaleAmount) * 1000) / 10
          : 0,
      };
    });

    const grandTotal = agents.reduce(
      (acc, a) => ({
        totalSaleAmount:      acc.totalSaleAmount      + a.totalSaleAmount,
        totalCommission:      acc.totalCommission      + a.totalCommission,
        totalRefund:          acc.totalRefund          + a.totalRefund,
        confirmedCount:       acc.confirmedCount       + a.confirmedCount,
        unsetCommissionCount: acc.unsetCommissionCount + a.unsetCommissionCount,
      }),
      { totalSaleAmount: 0, totalCommission: 0, totalRefund: 0, confirmedCount: 0, unsetCommissionCount: 0 }
    );

    logger.log('[GET /api/year-end-report]', { role: ctx.role, year, agentCount: agents.length });
    return NextResponse.json({ ok: true, year, agents, grandTotal });

  } catch (err) {
    logger.error('[GET /api/year-end-report]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
