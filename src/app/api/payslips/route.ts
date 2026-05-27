export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GMcruise AffiliatePayslip 실제 status 값
const ALLOWED_STATUSES = new Set(['PENDING', 'APPROVED', 'SENT']);
const PERIOD_RE        = /^\d{4}-\d{2}$/;

type RawPayslip = {
  id: number;
  profileId: number;
  period: string;
  totalCommission: number;
  totalWithholding: number;
  netPayment: number;
  bonusAmount: number | null;
  status: string;
  sentAt: Date | null;
  createdAt: Date;
  agentDisplayName: string | null;
  agentMallUserId: string | null;
};

/**
 * GET /api/payslips
 * GMcruise AffiliatePayslip 급여명세 목록 조회
 *
 * GLOBAL_ADMIN: 전체
 * OWNER:        AffiliateRelation 소속 에이전트 급여만
 * AGENT/FREE_SALES: 본인 profileId만
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '이 기능에 접근할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // OWNER는 organizationId가 필수
    if (ctx.role === 'OWNER' && !ctx.organizationId) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '조직 정보가 없습니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1')  || 1);
    const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20') || 20);
    const offset = (page - 1) * limit;

    const rawPeriod = searchParams.get('yearMonth')?.trim() ?? '';
    const rawStatus = searchParams.get('status') ?? '';

    const period = PERIOD_RE.test(rawPeriod) ? rawPeriod : null;
    const status = ALLOWED_STATUSES.has(rawStatus) ? rawStatus : null;

    // 역할별 스코프 조건
    let scopeCondition: Prisma.Sql = Prisma.empty;

    if (ctx.role === 'OWNER') {
      const ownerProfileId = ctx.mallUser?.affiliateProfileId;
      if (!ownerProfileId) {
        return NextResponse.json({ ok: false, error: '파트너 프로필이 없습니다.' }, { status: 403 });
      }
      scopeCondition = Prisma.sql`
        AND p."profileId" IN (
          SELECT ar."agentId"
          FROM "AffiliateRelation" ar
          WHERE ar."managerId" = ${ownerProfileId}
            AND ar.status = 'ACTIVE'
        )
      `;
    } else if (ctx.role === 'AGENT') {
      const agentProfileId = ctx.mallUser?.affiliateProfileId;
      if (!agentProfileId) {
        return NextResponse.json({ ok: false, error: '파트너 프로필이 없습니다.' }, { status: 403 });
      }
      scopeCondition = Prisma.sql`AND p."profileId" = ${agentProfileId}`;
    }
    // GLOBAL_ADMIN: 조건 없음

    const periodCondition: Prisma.Sql = period
      ? Prisma.sql`AND p."period" = ${period}`
      : Prisma.empty;
    const statusCondition: Prisma.Sql = status
      ? Prisma.sql`AND p.status = ${status}`
      : Prisma.empty;

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<RawPayslip[]>(Prisma.sql`
        SELECT
          p.id,
          p."profileId",
          p."period",
          p."totalCommission",
          p."totalWithholding",
          p."netPayment",
          COALESCE(pb."bonusAmount", 0)::integer AS "bonusAmount",
          p.status,
          p."sentAt",
          p."createdAt",
          COALESCE(ap."displayName", u.name) AS "agentDisplayName",
          u."mallUserId"                      AS "agentMallUserId"
        FROM "AffiliatePayslip" p
        JOIN "AffiliateProfile" ap ON ap.id = p."profileId"
        JOIN "User"             u  ON u.id  = ap."userId"
        LEFT JOIN "PayslipBonus" pb ON pb."profileId" = p."profileId"
                                    AND pb."period" = p."period"
                                    AND pb."deletedAt" IS NULL
        WHERE 1=1
          ${scopeCondition}
          ${periodCondition}
          ${statusCondition}
        ORDER BY p."period" DESC, p."createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "AffiliatePayslip" p
        JOIN "AffiliateProfile" ap ON ap.id = p."profileId"
        JOIN "User"             u  ON u.id  = ap."userId"
        WHERE 1=1
          ${scopeCondition}
          ${periodCondition}
          ${statusCondition}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    const payslips = rows.map((r) => {
      const baseCommission = Number(r.totalCommission);
      const bonus = Number(r.bonusAmount) || 0;
      const grossCommission = baseCommission + bonus;
      const deduction = Number(r.totalWithholding);
      const netAmount = Number(r.netPayment);

      return {
        id:                r.id,
        agentId:           r.profileId,
        yearMonth:         r.period,
        baseCommission,
        bonus,
        grossCommission,
        deduction,
        netAmount,
        status:            r.status,
        paidAt:            r.sentAt?.toISOString() ?? null,
        createdAt:         r.createdAt.toISOString(),
        agentDisplayName:  r.agentDisplayName,
        agentMallUserId:   r.agentMallUserId,
      };
    });

    const totalPages = Math.ceil(total / limit);
    logger.log('[GET /api/payslips]', { role: ctx.role, total, page, totalPages });
    return NextResponse.json({ ok: true, payslips, total, page, totalPages });

  } catch (err) {
    logger.error('[GET /api/payslips]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: '급여명세 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
