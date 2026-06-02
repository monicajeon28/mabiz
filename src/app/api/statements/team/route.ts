/**
 * GET /api/statements/team
 * 팀 정산 관리 (GLOBAL_ADMIN / OWNER 전용)
 *
 * 쿼리 파라미터:
 * - period: YYYY-MM (필수)
 * - role: AGENT | OWNER | FREE_SALES | all (기본: all)
 * - page: 페이지 번호 (기본: 1)
 * - limit: 페이지당 항목 수 (기본: 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import type { AffiliatePayslip } from '@prisma/client';

// ─── 응답 타입 정의 ─────────────────────────────────────────────────────────

interface MemberStatement {
  agentId: number;
  name: string;
  role: string;
  payslipId: number | null;
  yearMonth: string;
  baseCommission: number;
  deduction: number;
  withholdingAmount: number;
  netAmount: number;
  expectedPaymentDate: string;
  status: string;
  bankName: string | null;
  bankAccount: string | null;
  bankAccountHolder: string | null;
  hasIdCard: boolean;
  hasBankBook: boolean;
  canApprove: boolean;
}

interface TeamSummary {
  totalPayout: number;
  missingDocCount: number;
  pendingCount: number;
  paidCount: number;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** YYYY-MM 문자열에서 다음 달 15일 반환 (ISO 형식) */
function calcExpectedPaymentDate(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const date = new Date(nextYear, nextMonth - 1, 15);
  return date.toISOString();
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { role, organizationId } = session;

    // GLOBAL_ADMIN 또는 OWNER만 접근 가능
    if (role !== 'GLOBAL_ADMIN' && role !== 'OWNER') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '관리자 또는 대리점장 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period');
    const roleFilter = searchParams.get('role') ?? 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    if (!period) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'period 파라미터(YYYY-MM)가 필요합니다.' },
        { status: 400 }
      );
    }

    // ── 1. AffiliatePayslip 팀 목록 조회 (AGENT / OWNER 역할) ───────────────

    // roleFilter가 FREE_SALES 전용이 아닌 경우 payslip 조회
    type PayslipWhere = {
      yearMonth: string;
    };
    const payslipWhere: PayslipWhere = { yearMonth: period };

    const [payslips, payslipTotal] = await Promise.all([
      prisma.affiliatePayslip.findMany({
        where: payslipWhere,
        orderBy: { agentId: 'asc' },
        skip: roleFilter === 'FREE_SALES' ? 0 : skip,
        take: roleFilter === 'FREE_SALES' ? 1000 : limit,
      }),
      prisma.affiliatePayslip.count({ where: payslipWhere }),
    ]);

    // agentId 목록 추출 (문서 조회용)
    const agentIds = payslips.map((p: AffiliatePayslip) => p.agentId);

    // ── 2. FREE_SALES: AffiliateSale 집계 ────────────────────────────────────
    type FreeSalesRow = {
      affiliateUserId: string;
      name: string | null;
      totalCommission: bigint;
      totalRefunded: bigint;
      saleCount: bigint;
    };

    const [periodYear, periodMonth] = period.split('-').map(Number);
    const periodStart = new Date(periodYear, periodMonth - 1, 1);
    const periodEnd = new Date(periodYear, periodMonth, 1);

    const freeSalesRows: FreeSalesRow[] = await prisma.$queryRaw<FreeSalesRow[]>(
      Prisma.sql`
        SELECT
          s."affiliateUserId",
          u."name",
          COALESCE(SUM(s."commissionAmount"), 0) AS "totalCommission",
          COALESCE(SUM(s."refundedAmount"), 0) AS "totalRefunded",
          COUNT(s.id) AS "saleCount"
        FROM "CrmAffiliateSale" s
        LEFT JOIN "User" u ON u.id::text = s."affiliateUserId"
        WHERE s."travelCompletedAt" >= ${periodStart}
          AND s."travelCompletedAt" < ${periodEnd}
          AND s."affiliateUserId" IS NOT NULL
        GROUP BY s."affiliateUserId", u."name"
      `
    );

    // ── 3. 문서 상태 조회 (GmAffiliateProfile + GmAffiliateContract) ─────────

    // Payslip agentIds 기반 문서 조회
    type DocRow = {
      userId: number;
      withholdingRate: number;
      bankName: string | null;
      bankAccount: string | null;
      bankAccountHolder: string | null;
      idCardPath: string | null;
      bankbookPath: string | null;
    };

    let docRows: DocRow[] = [];
    if (agentIds.length > 0) {
      docRows = await prisma.$queryRaw<DocRow[]>(
        Prisma.sql`
          SELECT
            ap."userId",
            ap."withholdingRate",
            COALESCE(ac."bankName", ap."bankName") AS "bankName",
            COALESCE(ac."bankAccount", ap."bankAccount") AS "bankAccount",
            COALESCE(ac."bankAccountHolder", ap."bankAccountHolder") AS "bankAccountHolder",
            ac."idCardPath",
            ac."bankbookPath"
          FROM "AffiliateProfile" ap
          LEFT JOIN "AffiliateContract" ac ON ac."userId" = ap."userId"
          WHERE ap."userId" = ANY(${agentIds})
        `
      );
    }

    const docMap = new Map<number, DocRow>(docRows.map(d => [d.userId, d]));

    // ── 4. MemberStatement 조립 ───────────────────────────────────────────────

    const members: MemberStatement[] = [];

    // Payslip 기반 멤버 (AGENT / OWNER)
    if (roleFilter !== 'FREE_SALES') {
      for (const p of payslips) {
        const doc = docMap.get(p.agentId);
        const withholdingRate = doc?.withholdingRate ?? 3.3;
        const base = Number(p.baseCommission);
        const deduction = p.deduction ? Number(p.deduction) : 0;
        const withholdingAmount = Math.floor(base * (withholdingRate / 100));
        const net = Number(p.netAmount);
        const hasIdCard = !!doc?.idCardPath;
        const hasBankBook = !!doc?.bankbookPath;

        members.push({
          agentId: p.agentId,
          name: p.agentDisplayName ?? String(p.agentId),
          role: 'AGENT',
          payslipId: p.id,
          yearMonth: p.yearMonth,
          baseCommission: base,
          deduction,
          withholdingAmount,
          netAmount: net,
          expectedPaymentDate: calcExpectedPaymentDate(p.yearMonth),
          status: p.status,
          bankName: doc?.bankName ?? null,
          bankAccount: doc?.bankAccount ?? null,
          bankAccountHolder: doc?.bankAccountHolder ?? null,
          hasIdCard,
          hasBankBook,
          canApprove: hasIdCard && hasBankBook,
        });
      }
    }

    // FREE_SALES 집계 멤버
    if (roleFilter === 'FREE_SALES' || roleFilter === 'all') {
      for (const fs of freeSalesRows) {
        const totalCommission = Number(fs.totalCommission);
        const totalRefunded = Number(fs.totalRefunded);
        const withholdingAmount = Math.floor(totalCommission * 0.033);
        const net = totalCommission - withholdingAmount - totalRefunded;

        members.push({
          agentId: parseInt(fs.affiliateUserId, 10),
          name: fs.name ?? fs.affiliateUserId,
          role: 'FREE_SALES',
          payslipId: null,
          yearMonth: period,
          baseCommission: totalCommission,
          deduction: totalRefunded,
          withholdingAmount,
          netAmount: net,
          expectedPaymentDate: calcExpectedPaymentDate(period),
          status: 'PENDING',
          bankName: null,
          bankAccount: null,
          bankAccountHolder: null,
          hasIdCard: false,
          hasBankBook: false,
          canApprove: false,
        });
      }
    }

    // OWNER는 자신의 조직 내 멤버만 보여야 하지만,
    // AffiliatePayslip에 organizationId가 없으므로 organizationId 세션 기록
    // (추후 organizationId 필드 추가 시 필터 적용)
    // 현재는 전체 조회 후 로그만 남김
    if (role === 'OWNER' && organizationId) {
      logger.info('[GET /api/statements/team] OWNER 접근', { organizationId, period });
    }

    // 페이지네이션 (FREE_SALES 혼합 시 전체 기준)
    const totalMembers =
      roleFilter === 'FREE_SALES'
        ? freeSalesRows.length
        : roleFilter === 'all'
          ? payslipTotal + freeSalesRows.length
          : payslipTotal;

    // role 필터에 따른 슬라이싱 (FREE_SALES 포함 all일 때)
    const pagedMembers = roleFilter === 'all'
      ? members.slice(skip, skip + limit)
      : members;

    // ── 5. 요약 계산 ─────────────────────────────────────────────────────────
    const summary: TeamSummary = {
      totalPayout: pagedMembers.reduce((acc, m) => acc + m.netAmount, 0),
      missingDocCount: pagedMembers.filter(m => !m.canApprove && m.role !== 'FREE_SALES').length,
      pendingCount: pagedMembers.filter(m => m.status === 'PENDING').length,
      paidCount: pagedMembers.filter(m => m.status === 'SENT').length,
    };

    const pagination: PaginationData = {
      page,
      limit,
      total: totalMembers,
      totalPages: Math.ceil(totalMembers / limit),
    };

    return NextResponse.json({
      ok: true,
      period,
      data: {
        members: pagedMembers,
        summary,
        pagination,
      },
    });

  } catch (err) {
    logger.error('[GET /api/statements/team]', { err });
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
