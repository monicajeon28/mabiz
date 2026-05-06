export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

type CountRow = { count: bigint };
type SumRow   = { total: bigint };

/**
 * GET /api/dashboard
 * 역할별 대시보드 집계
 *
 * GLOBAL_ADMIN  — 전체 판매원, 이번달 매출/환불, 승인대기, 골드회원
 * OWNER         — 팀 판매원 수, 팀 매출/환불, 팀 승인대기
 * AGENT         — 내 매출/환불/승인대기, 내 골드회원
 * FREE_SALES    — affiliateCode 만 반환
 *
 * currentYearMonth: 서버에서 생성, 클라이언트 입력 없음
 */
export async function GET() {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    const yearMonth = new Date().toISOString().slice(0, 7);

    // ── FREE_SALES ────────────────────────────────────────────
    if (ctx.role === 'FREE_SALES') {
      let affiliateCode: string | null = null;
      if (ctx.mallUser?.affiliateProfileId) {
        const pid = ctx.mallUser.affiliateProfileId;
        const rows = await prisma.$queryRaw<{ affiliateCode: string | null }[]>(Prisma.sql`
          SELECT u."affiliateCode"
          FROM "AffiliateProfile" ap
          JOIN "User" u ON u.id = ap."userId"
          WHERE ap.id = ${pid}
          LIMIT 1
        `);
        affiliateCode = rows[0]?.affiliateCode ?? null;
      }
      return NextResponse.json({ ok: true, role: 'FREE_SALES', yearMonth, affiliateCode });
    }

    // ── GLOBAL_ADMIN ──────────────────────────────────────────
    if (ctx.role === 'GLOBAL_ADMIN') {
      const [agentRows, saleRows, refundRows, pendingRows, goldRows] = await Promise.all([
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count FROM "AffiliateProfile" WHERE status != 'TERMINATED'
        `),
        prisma.$queryRaw<SumRow[]>(Prisma.sql`
          SELECT COALESCE(SUM("saleAmount"), 0)::bigint AS total
          FROM "AffiliateSale"
          WHERE status IN ('APPROVED','CONFIRMED') AND "yearMonth" = ${yearMonth}
        `),
        prisma.$queryRaw<SumRow[]>(Prisma.sql`
          SELECT COALESCE(SUM("saleAmount"), 0)::bigint AS total
          FROM "AffiliateSale"
          WHERE status = 'REFUNDED' AND "yearMonth" = ${yearMonth}
        `),
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "AffiliateSale" WHERE status IN ('PENDING','PENDING_APPROVAL')
        `),
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "GoldMember" WHERE status = 'active' AND "deletedAt" IS NULL
        `),
      ]);

      logger.log('[GET /api/dashboard] GLOBAL_ADMIN', { yearMonth });
      return NextResponse.json({
        ok: true, role: 'GLOBAL_ADMIN', yearMonth,
        totalAgents:          Number(agentRows[0]?.count   ?? 0),
        monthSaleAmount:      Number(saleRows[0]?.total    ?? 0),
        monthRefundAmount:    Number(refundRows[0]?.total  ?? 0),
        pendingApprovalCount: Number(pendingRows[0]?.count ?? 0),
        goldMemberCount:      Number(goldRows[0]?.count    ?? 0),
      });
    }

    // ── OWNER ─────────────────────────────────────────────────
    if (ctx.role === 'OWNER') {
      const profileId = ctx.mallUser?.affiliateProfileId;
      if (!profileId) {
        return NextResponse.json({ ok: false, error: '파트너 프로필이 없습니다.' }, { status: 403 });
      }

      const [teamAgentRows, saleRows, refundRows, pendingRows] = await Promise.all([
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "AffiliateRelation"
          WHERE "managerId" = ${profileId} AND status = 'ACTIVE'
        `),
        prisma.$queryRaw<SumRow[]>(Prisma.sql`
          SELECT COALESCE(SUM("saleAmount"), 0)::bigint AS total
          FROM "AffiliateSale"
          WHERE "managerId" = ${profileId} AND status IN ('APPROVED','CONFIRMED')
            AND "yearMonth" = ${yearMonth}
        `),
        prisma.$queryRaw<SumRow[]>(Prisma.sql`
          SELECT COALESCE(SUM("saleAmount"), 0)::bigint AS total
          FROM "AffiliateSale"
          WHERE "managerId" = ${profileId} AND status = 'REFUNDED'
            AND "yearMonth" = ${yearMonth}
        `),
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "AffiliateSale"
          WHERE "managerId" = ${profileId} AND status IN ('PENDING','PENDING_APPROVAL')
        `),
      ]);

      logger.log('[GET /api/dashboard] OWNER', { profileId, yearMonth });
      return NextResponse.json({
        ok: true, role: 'OWNER', yearMonth,
        teamAgentCount:       Number(teamAgentRows[0]?.count ?? 0),
        monthSaleAmount:      Number(saleRows[0]?.total      ?? 0),
        monthRefundAmount:    Number(refundRows[0]?.total    ?? 0),
        pendingApprovalCount: Number(pendingRows[0]?.count   ?? 0),
      });
    }

    // ── AGENT ─────────────────────────────────────────────────
    if (ctx.role === 'AGENT') {
      const profileId = ctx.mallUser?.affiliateProfileId;
      if (!profileId) {
        return NextResponse.json({ ok: false, error: '파트너 프로필이 없습니다.' }, { status: 403 });
      }

      const [saleRows, refundRows, pendingRows, goldRows] = await Promise.all([
        prisma.$queryRaw<SumRow[]>(Prisma.sql`
          SELECT COALESCE(SUM("saleAmount"), 0)::bigint AS total
          FROM "AffiliateSale"
          WHERE "agentId" = ${profileId} AND status IN ('APPROVED','CONFIRMED')
            AND "yearMonth" = ${yearMonth}
        `),
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "AffiliateSale"
          WHERE "agentId" = ${profileId} AND status = 'REFUNDED'
            AND "yearMonth" = ${yearMonth}
        `),
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "AffiliateSale"
          WHERE "agentId" = ${profileId} AND status IN ('PENDING','PENDING_APPROVAL')
        `),
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "GoldMember"
          WHERE "agentId" = ${profileId} AND status = 'active' AND "deletedAt" IS NULL
        `),
      ]);

      logger.log('[GET /api/dashboard] AGENT', { profileId, yearMonth });
      return NextResponse.json({
        ok: true, role: 'AGENT', yearMonth,
        monthSaleAmount:      Number(saleRows[0]?.total    ?? 0),
        monthRefundCount:     Number(refundRows[0]?.count  ?? 0),
        pendingApprovalCount: Number(pendingRows[0]?.count ?? 0),
        goldMemberCount:      Number(goldRows[0]?.count    ?? 0),
      });
    }

    return NextResponse.json({ ok: false, error: '알 수 없는 역할' }, { status: 403 });

  } catch (err) {
    logger.error('[GET /api/dashboard]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
