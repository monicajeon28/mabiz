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

type RawFreeSalesRow = {
  memberId: string;
  agentName: string;
  userId: string;
  totalSaleAmount: bigint;
  totalCommission: bigint;
  totalRefund: bigint;
  confirmedCount: bigint;
};

type AgentSummary = {
  agentId: number | string;
  agentName: string;
  mallUserId: string | null;
  totalSaleAmount: number;
  totalCommission: number;
  totalRefund: number;
  confirmedCount: number;
  unsetCommissionCount: number;
  refundRate: number;
  agentType: 'affiliate' | 'free_sales';
};

const YEAR_RE = /^\d{4}$/;

/**
 * GET /api/year-end-report
 * 연말정산 보고서 — 에이전트별 연간 매출/커미션/환불 집계
 *
 * GLOBAL_ADMIN / OWNER만 접근
 * ?year=2025 (없으면 현재 연도)
 * ?agentId=123 (GLOBAL_ADMIN만, AffiliateProfile.id)
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
    // KST(UTC+9) 기준으로 연도 범위 계산 — UTC 기준으로 하면 한국 기준 9시간이 틀림
    const yearStart = new Date(`${year}-01-01T00:00:00+09:00`);
    const yearEnd   = new Date(`${year}-12-31T23:59:59+09:00`);

    // agentId 필터 — GLOBAL_ADMIN + AffiliateProfile.id 기준
    const rawAgentId = searchParams.get('agentId');
    const agentIdFilter: Prisma.Sql =
      ctx.role === 'GLOBAL_ADMIN' && rawAgentId && /^\d+$/.test(rawAgentId)
        ? Prisma.sql`AND ap.id = ${parseInt(rawAgentId)}`
        : Prisma.empty;

    // OWNER: 소속 AffiliateProfile 에이전트만
    let affiliateRelationFilter: Prisma.Sql = Prisma.empty;
    let ownerOrgId: string | null = null;
    if (ctx.role === 'OWNER') {
      const ownerProfileId = ctx.mallUser?.affiliateProfileId;
      if (!ownerProfileId) {
        return NextResponse.json({ ok: false, error: '파트너 프로필이 없습니다.' }, { status: 403 });
      }
      ownerOrgId = ctx.organizationId ?? null;
      if (!ownerOrgId) {
        return NextResponse.json({ ok: false, error: '조직 정보를 확인할 수 없습니다.' }, { status: 403 });
      }
      affiliateRelationFilter = Prisma.sql`
        AND ap.id IN (
          SELECT ar."agentId" FROM "AffiliateRelation" ar
          WHERE ar."managerId" = ${ownerProfileId} AND ar.status = 'ACTIVE'
        )
      `;
    }

    // ── 쿼리 1: AffiliateProfile 기반 에이전트 ────────────────────────
    const affiliateRowsP = prisma.$queryRaw<RawAgentRow[]>(Prisma.sql`
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
        ${affiliateRelationFilter}
      GROUP BY ap.id, ap."displayName", u.name, u."mallUserId"
      ORDER BY "totalSaleAmount" DESC
    `);

    // ── 쿼리 2: FREE_SALES (OrganizationMember + CrmAffiliateSale) ────
    const freeSalesOrgFilter: Prisma.Sql = ownerOrgId
      ? Prisma.sql`AND om."organizationId" = ${ownerOrgId}`
      : Prisma.empty;

    const freeSalesRowsP = prisma.$queryRaw<RawFreeSalesRow[]>(Prisma.sql`
      SELECT
        om.id                                                         AS "memberId",
        COALESCE(om."displayName", om."userId")                       AS "agentName",
        om."userId",
        COALESCE(SUM(CASE WHEN csa.status IN ('APPROVED','CONFIRMED') THEN csa."saleAmount"      ELSE 0 END), 0)::bigint AS "totalSaleAmount",
        COALESCE(SUM(CASE WHEN csa.status IN ('APPROVED','CONFIRMED') THEN csa."commissionAmount" ELSE 0 END), 0)::bigint AS "totalCommission",
        COALESCE(SUM(CASE WHEN csa.status = 'REFUNDED'                THEN csa."refundedAmount"  ELSE 0 END), 0)::bigint AS "totalRefund",
        COUNT(CASE WHEN csa.status IN ('APPROVED','CONFIRMED') THEN 1 END)::bigint               AS "confirmedCount"
      FROM "OrganizationMember" om
      LEFT JOIN "CrmAffiliateSale" csa
             ON csa."affiliateUserId" = om."userId"
            AND csa."createdAt" BETWEEN ${yearStart} AND ${yearEnd}
      WHERE om.role = 'FREE_SALES'
        AND om."isActive" = true
        ${freeSalesOrgFilter}
      GROUP BY om.id, om."displayName", om."userId"
      ORDER BY "totalSaleAmount" DESC
    `);

    const [affiliateRows, freeSalesRows] = await Promise.all([affiliateRowsP, freeSalesRowsP]);

    // ── 결과 변환 ─────────────────────────────────────────────────────
    const toSummary = (
      r: RawAgentRow | RawFreeSalesRow,
      agentType: 'affiliate' | 'free_sales'
    ): AgentSummary => {
      const totalSaleAmount = Number((r as RawAgentRow).totalSaleAmount ?? 0);
      const totalRefund     = Number((r as RawAgentRow).totalRefund     ?? 0);
      if (agentType === 'affiliate') {
        const a = r as RawAgentRow;
        return {
          agentId:              a.agentId,
          agentName:            a.agentName ?? '',
          mallUserId:           a.mallUserId ?? null,
          totalSaleAmount,
          totalCommission:      Number(a.totalCommission),
          totalRefund,
          confirmedCount:       Number(a.confirmedCount),
          unsetCommissionCount: Number(a.unsetCommissionCount),
          refundRate:           totalSaleAmount > 0 ? Number((totalRefund / totalSaleAmount * 100).toFixed(1)) : 0,
          agentType,
        };
      }
      const f = r as RawFreeSalesRow;
      return {
        agentId:              f.memberId,
        agentName:            f.agentName ?? '',
        mallUserId:           f.userId ?? null,
        totalSaleAmount,
        totalCommission:      Number(f.totalCommission),
        totalRefund,
        confirmedCount:       Number(f.confirmedCount),
        unsetCommissionCount: 0,
        refundRate:           totalSaleAmount > 0 ? Number((totalRefund / totalSaleAmount * 100).toFixed(1)) : 0,
        agentType,
      };
    };

    const agents: AgentSummary[] = [
      ...affiliateRows.map((r) => toSummary(r, 'affiliate')),
      ...freeSalesRows.map((r) => toSummary(r, 'free_sales')),
    ].sort((a, b) => b.totalSaleAmount - a.totalSaleAmount);

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

    logger.log('[GET /api/year-end-report]', {
      role: ctx.role, year,
      affiliateCount: affiliateRows.length,
      freeSalesCount: freeSalesRows.length,
    });
    return NextResponse.json({ ok: true, year, agents, grandTotal });

  } catch (err) {
    logger.error('[GET /api/year-end-report]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
