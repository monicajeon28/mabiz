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
      const startOfMonth = new Date(`${yearMonth}-01T00:00:00.000Z`);
      const [agentRows, saleRows, refundRows, pendingRows, goldCount, callDueRows, totalContactRows, newContactRows] = await Promise.all([
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count FROM "AffiliateProfile" WHERE status != 'TERMINATED'
        `),
        prisma.$queryRaw<SumRow[]>(Prisma.sql`
          SELECT COALESCE(SUM("saleAmount"), 0)::bigint AS total
          FROM "AffiliateSale"
          WHERE status IN ('APPROVED','CONFIRMED')
            AND TO_CHAR("saleDate", 'YYYY-MM') = ${yearMonth}
        `),
        prisma.$queryRaw<SumRow[]>(Prisma.sql`
          SELECT COALESCE(SUM("saleAmount"), 0)::bigint AS total
          FROM "AffiliateSale"
          WHERE status = 'REFUNDED'
            AND TO_CHAR("saleDate", 'YYYY-MM') = ${yearMonth}
        `),
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "AffiliateSale" WHERE status IN ('PENDING','PENDING_APPROVAL')
        `),
        // CRM GoldMember 테이블 사용
        prisma.goldMember.count({ where: { status: 'ACTIVE' } }),
        // 오늘 콜 예정 건수 (전체)
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count FROM "CallLog"
          WHERE ("scheduledAt"::date) = (NOW() AT TIME ZONE 'Asia/Seoul')::date
        `),
        // CRM 전체 고객 수
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count FROM "Contact" WHERE "deletedAt" IS NULL
        `),
        // CRM 이번달 신규 고객 수
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count FROM "Contact"
          WHERE "deletedAt" IS NULL AND "createdAt" >= ${startOfMonth}
        `),
      ]);

      logger.log('[GET /api/dashboard] GLOBAL_ADMIN', { yearMonth });
      return NextResponse.json({
        ok: true, role: 'GLOBAL_ADMIN', yearMonth,
        totalAgents:          Number(agentRows[0]?.count      ?? 0),
        monthSaleAmount:      Number(saleRows[0]?.total       ?? 0),
        monthRefundAmount:    Number(refundRows[0]?.total     ?? 0),
        pendingApprovalCount: Number(pendingRows[0]?.count    ?? 0),
        goldMemberCount:      goldCount,
        callDueToday:         Number(callDueRows[0]?.count    ?? 0),
        totalContacts:        Number(totalContactRows[0]?.count ?? 0),
        newContactsThisMonth: Number(newContactRows[0]?.count  ?? 0),
      });
    }

    // ── OWNER ─────────────────────────────────────────────────
    if (ctx.role === 'OWNER') {
      const profileId = ctx.mallUser?.affiliateProfileId;

      // CRM 전용 대리점장 — affiliateProfileId 없어도 CRM 통계로 대시보드 표시
      if (!profileId) {
        const orgId = ctx.organizationId!;
        const startOfMonth = new Date(`${yearMonth}-01T00:00:00.000Z`);
        const [totalContacts, newThisMonth, callDueRows] = await Promise.all([
          prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM "Contact"
            WHERE "organizationId" = ${orgId}
          `),
          prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM "Contact"
            WHERE "organizationId" = ${orgId}
              AND "createdAt" >= ${startOfMonth}
          `),
          prisma.$queryRaw<CountRow[]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM "CallLog" cl
            JOIN "Contact" c ON c.id = cl."contactId"
            WHERE c."organizationId" = ${orgId}
              AND ("scheduledAt"::date) = (NOW() AT TIME ZONE 'Asia/Seoul')::date
          `),
        ]);
        logger.log('[GET /api/dashboard] OWNER(CRM전용)', { orgId, yearMonth });
        return NextResponse.json({
          ok: true, role: 'OWNER', yearMonth,
          teamAgentCount: 0,
          monthSaleAmount: 0,
          monthRefundAmount: 0,
          pendingApprovalCount: 0,
          totalContacts: Number(totalContacts[0]?.count ?? 0),
          newContactsThisMonth: Number(newThisMonth[0]?.count ?? 0),
          callDueToday: Number(callDueRows[0]?.count ?? 0),
        });
      }

      const [teamAgentRows, saleRows, refundRows, pendingRows, callDueRows] = await Promise.all([
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "AffiliateRelation"
          WHERE "managerId" = ${profileId} AND status = 'ACTIVE'
        `),
        prisma.$queryRaw<SumRow[]>(Prisma.sql`
          SELECT COALESCE(SUM("saleAmount"), 0)::bigint AS total
          FROM "AffiliateSale"
          WHERE "managerId" = ${profileId} AND status IN ('APPROVED','CONFIRMED')
            AND TO_CHAR("saleDate", 'YYYY-MM') = ${yearMonth}
        `),
        prisma.$queryRaw<SumRow[]>(Prisma.sql`
          SELECT COALESCE(SUM("saleAmount"), 0)::bigint AS total
          FROM "AffiliateSale"
          WHERE "managerId" = ${profileId} AND status = 'REFUNDED'
            AND TO_CHAR("saleDate", 'YYYY-MM') = ${yearMonth}
        `),
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "AffiliateSale"
          WHERE "managerId" = ${profileId} AND status IN ('PENDING','PENDING_APPROVAL')
        `),
        ctx.organizationId
          ? prisma.$queryRaw<CountRow[]>(Prisma.sql`
              SELECT COUNT(*)::bigint AS count FROM "CallLog" cl
              JOIN "Contact" c ON c.id = cl."contactId"
              WHERE c."organizationId" = ${ctx.organizationId}
                AND (cl."scheduledAt"::date) = (NOW() AT TIME ZONE 'Asia/Seoul')::date
            `)
          : Promise.resolve([{ count: BigInt(0) }] as CountRow[]),
      ]);

      logger.log('[GET /api/dashboard] OWNER', { profileId, yearMonth });
      return NextResponse.json({
        ok: true, role: 'OWNER', yearMonth,
        teamAgentCount:       Number(teamAgentRows[0]?.count ?? 0),
        monthSaleAmount:      Number(saleRows[0]?.total      ?? 0),
        monthRefundAmount:    Number(refundRows[0]?.total    ?? 0),
        pendingApprovalCount: Number(pendingRows[0]?.count   ?? 0),
        callDueToday:         Number(callDueRows[0]?.count   ?? 0),
      });
    }

    // ── AGENT ─────────────────────────────────────────────────
    if (ctx.role === 'AGENT') {
      const profileId = ctx.mallUser?.affiliateProfileId;

      // CRM 전용 판매원 — affiliateProfileId 없어도 CRM 통계로 대시보드 표시
      if (!profileId) {
        const orgId = ctx.organizationId!;
        const startOfMonth = new Date(`${yearMonth}-01T00:00:00.000Z`);
        const [totalContacts, newThisMonth, callDueRows] = await Promise.all([
          prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM "Contact"
            WHERE "organizationId" = ${orgId}
              AND "assignedUserId" = ${ctx.userId}
          `),
          prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM "Contact"
            WHERE "organizationId" = ${orgId}
              AND "assignedUserId" = ${ctx.userId}
              AND "createdAt" >= ${startOfMonth}
          `),
          prisma.$queryRaw<CountRow[]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM "CallLog"
            WHERE "userId" = ${ctx.userId}
              AND ("scheduledAt"::date) = (NOW() AT TIME ZONE 'Asia/Seoul')::date
          `),
        ]);
        logger.log('[GET /api/dashboard] AGENT(CRM전용)', { orgId, userId: ctx.userId, yearMonth });
        return NextResponse.json({
          ok: true, role: 'AGENT', yearMonth,
          monthSaleAmount: 0,
          monthRefundCount: 0,
          pendingApprovalCount: 0,
          goldMemberCount: 0,
          totalContacts: Number(totalContacts[0]?.count ?? 0),
          newContactsThisMonth: Number(newThisMonth[0]?.count ?? 0),
          callDueToday: Number(callDueRows[0]?.count ?? 0),
        });
      }

      const [saleRows, refundRows, pendingRows, goldCount, callDueRows] = await Promise.all([
        prisma.$queryRaw<SumRow[]>(Prisma.sql`
          SELECT COALESCE(SUM("saleAmount"), 0)::bigint AS total
          FROM "AffiliateSale"
          WHERE "agentId" = ${profileId} AND status IN ('APPROVED','CONFIRMED')
            AND TO_CHAR("saleDate", 'YYYY-MM') = ${yearMonth}
        `),
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "AffiliateSale"
          WHERE "agentId" = ${profileId} AND status = 'REFUNDED'
            AND TO_CHAR("saleDate", 'YYYY-MM') = ${yearMonth}
        `),
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "AffiliateSale"
          WHERE "agentId" = ${profileId} AND status IN ('PENDING','PENDING_APPROVAL')
        `),
        // CRM GoldMember 테이블 사용
        prisma.goldMember.count({ where: { status: 'ACTIVE' } }),
        prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count FROM "CallLog"
          WHERE "userId" = ${ctx.userId}
            AND ("scheduledAt"::date) = (NOW() AT TIME ZONE 'Asia/Seoul')::date
        `),
      ]);

      logger.log('[GET /api/dashboard] AGENT', { profileId, yearMonth });
      return NextResponse.json({
        ok: true, role: 'AGENT', yearMonth,
        monthSaleAmount:      Number(saleRows[0]?.total    ?? 0),
        monthRefundCount:     Number(refundRows[0]?.count  ?? 0),
        pendingApprovalCount: Number(pendingRows[0]?.count ?? 0),
        goldMemberCount:      goldCount,
        callDueToday:         Number(callDueRows[0]?.count ?? 0),
      });
    }

    return NextResponse.json({ ok: false, error: '알 수 없는 역할' }, { status: 403 });

  } catch (err) {
    logger.error('[GET /api/dashboard]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
