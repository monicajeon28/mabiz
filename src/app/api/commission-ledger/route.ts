export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// GMcruise CommissionLedger 실제 entryType 값
const ALLOWED_TYPES = new Set([
  'SALES_COMMISSION', 'OVERRIDE_COMMISSION', 'BRANCH_COMMISSION', 'HQ_NET', 'WITHHOLDING',
]);
const YEAR_MONTH_RE = /^\d{4}-\d{2}$/;

// yearMonth → [start, end) Date 범위 (index 활용)
function monthRange(yearMonth: string): [Date, Date] {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end   = m === 12 ? new Date(y + 1, 0, 1) : new Date(y, m, 1);
  return [start, end];
}

type RawLedger = {
  id: number;
  profileId: number | null;
  saleId: number;
  entryType: string;
  amount: number;
  withholdingAmount: number | null;
  isSettled: boolean;
  notes: string | null;
  createdAt: Date;
  balance: number;  // 누적 잔액
};

type RawSummary = {
  totalSalesCommission: bigint;
  totalOverride: bigint;
  totalWithholding: bigint;
};

/**
 * GET /api/commission-ledger
 * GMcruise CommissionLedger 커미션 원장 조회
 *
 * GLOBAL_ADMIN: 전체
 * OWNER:        AffiliateRelation 소속 에이전트
 * AGENT:        본인 profileId
 * FREE_SALES:   403
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    // GLOBAL_ADMIN은 organizationId 없이도 접근 가능 (모든 조직의 데이터 조회)
    // AGENT/OWNER는 organizationId가 필수
    const organizationId = ctx.organizationId;
    if (ctx.role !== 'GLOBAL_ADMIN' && !organizationId) {
      return NextResponse.json({ ok: false, error: '조직이 설정되지 않았습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1')  || 1);
    const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '20') || 20);
    const offset = (page - 1) * limit;

    const rawProfileId  = searchParams.get('agentId');   // UI는 agentId로 보냄
    const rawYearMonth  = searchParams.get('yearMonth')?.trim() ?? '';
    const rawType       = searchParams.get('type');

    // AGENT는 agentId 파라미터 무시 — roleCondition으로 자동 제한
    const canFilterByAgent = ctx.role === 'GLOBAL_ADMIN' || ctx.role === 'OWNER';
    const profileIdFilter  = canFilterByAgent && rawProfileId ? parseInt(rawProfileId) || null : null;
    const yearMonth        = YEAR_MONTH_RE.test(rawYearMonth) ? rawYearMonth : null;
    const typeFilter       = rawType && ALLOWED_TYPES.has(rawType) ? rawType : null;

    // GLOBAL_ADMIN은 organizationId 필터 없이 모든 조직의 데이터 조회 가능
    const orgCondition: Prisma.Sql = organizationId
      ? Prisma.sql`AND cl."organizationId" = ${organizationId}`
      : Prisma.empty;

    // 역할별 스코프
    let roleCondition: Prisma.Sql = Prisma.empty;
    if (ctx.role === 'AGENT') {
      const agentProfileId = ctx.mallUser?.affiliateProfileId;
      if (!agentProfileId) {
        // P0: AGENT가 GMcruise 링크가 없으면 빈 결과 반환 (403 아닌 정상 응답)
        // 향후: CRM-only Agent가 수익을 별도로 추적하는 경우 처리 필요
        logger.warn('[GET /api/commission-ledger] AGENT without GMcruise link', {
          userId: ctx.userId,
          memberDisplayName: ctx.member?.displayName,
        });
        return NextResponse.json({
          ok: true,
          ledger: [],
          summary: null,
          total: 0,
          page: 1,
          totalPages: 1,
          requestedYearMonth: yearMonth,
        });
      }
      roleCondition = Prisma.sql`AND cl."profileId" = ${agentProfileId}`;
    } else if (ctx.role === 'OWNER') {
      const ownerProfileId = ctx.mallUser?.affiliateProfileId;
      if (!ownerProfileId) {
        // P0: OWNER가 GMcruise 링크가 없으면 빈 결과 반환 (403 아닌 정상 응답)
        logger.warn('[GET /api/commission-ledger] OWNER without GMcruise link', {
          userId: ctx.userId,
          memberDisplayName: ctx.member?.displayName,
        });
        return NextResponse.json({
          ok: true,
          ledger: [],
          summary: null,
          total: 0,
          page: 1,
          totalPages: 1,
          requestedYearMonth: yearMonth,
        });
      }
      roleCondition = Prisma.sql`
        AND cl."profileId" IN (
          SELECT ar."agentId" FROM "AffiliateRelation" ar
          WHERE ar."managerId" = ${ownerProfileId} AND ar.status = 'ACTIVE'
        )
      `;
    }

    const profileCondition: Prisma.Sql = profileIdFilter
      ? Prisma.sql`AND cl."profileId" = ${profileIdFilter}`
      : Prisma.empty;
    // yearMonth: CommissionLedger에 yearMonth 컬럼 없음 → createdAt 범위로 변환 (index 활용)
    const yearMonthCondition: Prisma.Sql = yearMonth
      ? (() => {
          const [start, end] = monthRange(yearMonth);
          return Prisma.sql`AND cl."createdAt" >= ${start} AND cl."createdAt" < ${end}`;
        })()
      : Prisma.empty;
    const typeCondition: Prisma.Sql = typeFilter
      ? Prisma.sql`AND cl."entryType" = ${typeFilter}`
      : Prisma.empty;

    const [rows, countRows, summaryRows] = await Promise.all([
      prisma.$queryRaw<RawLedger[]>(Prisma.sql`
        WITH base AS (
          SELECT cl.id, cl."profileId", cl."saleId", cl."entryType",
                 cl.amount, cl."withholdingAmount", cl."isSettled", cl.notes, cl."createdAt",
                 SUM(cl.amount) OVER (
                   PARTITION BY cl."profileId"
                   ORDER BY cl."createdAt" ASC
                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                 ) AS balance
          FROM "CommissionLedger" cl
          WHERE 1=1
            ${orgCondition} ${roleCondition} ${profileCondition} ${yearMonthCondition} ${typeCondition}
        )
        SELECT * FROM base
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "CommissionLedger" cl
        WHERE 1=1 ${orgCondition} ${roleCondition} ${profileCondition} ${yearMonthCondition} ${typeCondition}
      `),
      prisma.$queryRaw<RawSummary[]>(Prisma.sql`
        SELECT
          COALESCE(SUM(CASE WHEN cl."entryType" = 'SALES_COMMISSION'   THEN cl.amount ELSE 0 END), 0)::bigint AS "totalSalesCommission",
          COALESCE(SUM(CASE WHEN cl."entryType" = 'OVERRIDE_COMMISSION' THEN cl.amount ELSE 0 END), 0)::bigint AS "totalOverride",
          COALESCE(SUM(CASE WHEN cl."entryType" = 'WITHHOLDING'         THEN cl.amount ELSE 0 END), 0)::bigint AS "totalWithholding"
        FROM "CommissionLedger" cl
        WHERE 1=1 ${orgCondition} ${roleCondition} ${profileCondition} ${yearMonthCondition} ${typeCondition}
      `),
    ]);

    const total                = Number(countRows[0]?.total ?? 0);
    const totalSalesCommission = Number(summaryRows[0]?.totalSalesCommission ?? 0);
    const totalOverride        = Number(summaryRows[0]?.totalOverride        ?? 0);
    const totalWithholding     = Number(summaryRows[0]?.totalWithholding     ?? 0);
    const totalEarned          = totalSalesCommission + totalOverride;

    const ledger = rows.map((r) => ({
      id:               r.id,
      agentId:          r.profileId ?? null,   // UI 호환성: agentId로 노출
      saleId:           r.saleId,
      type:             r.entryType,           // UI 호환성: type으로 노출
      amount:           Number(r.amount),
      withholdingAmount: r.withholdingAmount != null ? Number(r.withholdingAmount) : null,
      isSettled:        r.isSettled,
      yearMonth:        r.createdAt.toISOString().slice(0, 7), // 파생
      note:             r.notes ?? null,
      createdAt:        r.createdAt.toISOString(),
      balance:          Number(r.balance),
    }));

    logger.log('[GET /api/commission-ledger]', { role: ctx.role, total, page, yearMonth });
    return NextResponse.json({
      ok: true,
      ledger,
      summary: {
        totalEarned,
        totalSalesCommission,
        totalOverride,
        totalWithholding,
        net: totalEarned - totalWithholding,
      },
      total,
      page,
      totalPages: Math.ceil(total / limit),
      requestedYearMonth: yearMonth,
    });

  } catch (err) {
    logger.error('[GET /api/commission-ledger]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
