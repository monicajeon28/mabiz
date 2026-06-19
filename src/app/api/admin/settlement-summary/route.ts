import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import {
  logAuditEntry,
  checkCommissionLedgerSelectPermission,
} from '@/lib/audit-logger';

interface SettlementSummaryRow {
  settlement_id: number;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  targetRole: string | null;
  approvedAt: Date | null;
  approvedBy: number | null;
  lockedAt: Date | null;
  paymentDate: Date | null;
  ledger_count: number;
  total_commission: bigint;
  total_withholding: bigint;
  net_payout: bigint;
  createdAt: Date;
  exportUrl: string | null;
}

type SettlementSummary = {
  settlementId: number;
  period: string; // "2026-05" format
  status: string;
  targetRole: string | null;
  ledgerCount: number;
  totalCommission: number;
  totalWithholding: number;
  netPayout: number;
  approvedAt: string | null;
  lockedAt: string | null;
  paymentDate: string | null;
};

/**
 * GET /api/admin/settlement-summary
 * 정산 요약 데이터 조회 (admin 전용)
 * 페이지네이션 + 필터 지원
 *
 * Query params:
 * - period: YYYY-MM (선택, 정확한 월 지정)
 * - status: DRAFT|APPROVED|LOCKED|PAID (선택)
 * - page: 1-based (기본값: 1)
 * - limit: 1-100 (기본값: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    // GLOBAL_ADMIN만 접근 가능
    if (ctx.role !== 'GLOBAL_ADMIN') {
      // RLS 권한 검증 (감사 로그 생성)
      const permissionCheck = await checkCommissionLedgerSelectPermission(
        ctx,
        ctx.organizationId || ''
      );

      if (!permissionCheck.allowed) {
        await logAuditEntry({
          action: 'SELECT',
          table: 'CommissionLedger',
          userId: ctx.userId,
          organizationId: ctx.organizationId,
          status: 'DENIED',
          reason: permissionCheck.reason,
          details: { endpoint: 'settlement-summary' },
          timestamp: new Date(),
        });

        return NextResponse.json(
          { ok: false, error: 'FORBIDDEN', message: '어드민 권한이 필요합니다.' },
          { status: 403 }
        );
      }
    }

    // 성공적인 접근 로깅
    await logAuditEntry({
      action: 'SELECT',
      table: 'CommissionLedger',
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      status: 'ALLOWED',
      details: { endpoint: 'settlement-summary' },
      timestamp: new Date(),
    });

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period'); // YYYY-MM
    const status = searchParams.get('status'); // DRAFT|APPROVED|LOCKED|PAID
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20', 10) || 20);
    const offset = (page - 1) * limit;

    // 쿼리 조건 — 개별 조건 조각을 모아 WHERE ... AND ... 로 조립
    const conditionFragments: Prisma.Sql[] = [];

    if (period) {
      // YYYY-MM 형식 검증
      const [year, month] = period.split('-');
      if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month)) {
        const startDate = new Date(`${period}-01`);
        const endDate = new Date(parseInt(year, 10), parseInt(month, 10), 0);
        conditionFragments.push(
          Prisma.sql`ms."periodStart" >= ${startDate} AND ms."periodEnd" <= ${endDate}`
        );
      }
    }

    if (status) {
      conditionFragments.push(Prisma.sql`ms.status = ${status}`);
    }

    const whereCondition =
      conditionFragments.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditionFragments, ' AND ')}`
        : Prisma.empty;

    // settlement_summary view가 없는 경우를 대비해 원본 쿼리 사용
    // (migration이 실행되지 않았을 수 있으므로)
    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<SettlementSummaryRow[]>(Prisma.sql`
        SELECT
          ms.id                       AS settlement_id,
          ms."periodStart",
          ms."periodEnd",
          ms.status,
          ms."targetRole",
          ms."approvedAt",
          ms."approvedBy",
          ms."lockedAt",
          ms."paymentDate",
          COUNT(cl.id)::integer       AS ledger_count,
          COALESCE(SUM(cl.amount), 0)::bigint AS total_commission,
          COALESCE(SUM(cl."withholdingAmount"), 0)::bigint AS total_withholding,
          COALESCE(
            SUM(cl.amount) - SUM(cl."withholdingAmount"),
            0
          )::bigint AS net_payout,
          ms."createdAt",
          ms."exportUrl"
        FROM "MonthlySettlement" ms
        LEFT JOIN "CommissionLedger" cl
          ON cl."settlementId" = ms.id
          AND cl."isSettled" = true
        ${whereCondition}
        GROUP BY
          ms.id,
          ms."periodStart",
          ms."periodEnd",
          ms.status,
          ms."targetRole",
          ms."approvedAt",
          ms."approvedBy",
          ms."lockedAt",
          ms."paymentDate",
          ms."createdAt",
          ms."exportUrl"
        ORDER BY ms."periodStart" DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(DISTINCT ms.id)::bigint AS total
        FROM "MonthlySettlement" ms
        LEFT JOIN "CommissionLedger" cl
          ON cl."settlementId" = ms.id
          AND cl."isSettled" = true
        ${whereCondition}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.ceil(total / limit);

    const summaries: SettlementSummary[] = rows.map((r) => {
      const periodStart = r.periodStart;
      const periodMonth = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`;

      return {
        settlementId: r.settlement_id,
        period: periodMonth,
        status: r.status,
        targetRole: r.targetRole,
        ledgerCount: r.ledger_count,
        totalCommission: Number(r.total_commission),
        totalWithholding: Number(r.total_withholding),
        netPayout: Number(r.net_payout),
        approvedAt: r.approvedAt?.toISOString() ?? null,
        lockedAt: r.lockedAt?.toISOString() ?? null,
        paymentDate: r.paymentDate?.toISOString() ?? null,
      };
    });

    logger.log('[GET /api/admin/settlement-summary]', {
      total,
      page,
      totalPages,
      period,
      status,
    });

    return NextResponse.json({
      ok: true,
      data: summaries,
      pagination: {
        total,
        page,
        pageSize: limit,
        totalPages,
      },
    });
  } catch (err) {
    logger.error('[GET /api/admin/settlement-summary]', { err });
    return NextResponse.json(
      {
        ok: false,
        error: 'SERVER_ERROR',
        message: '정산 요약 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
