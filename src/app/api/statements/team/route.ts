/**
 * GET /api/statements/team
 * 팀 정산 관리 (GLOBAL_ADMIN / OWNER 전용)
 * CommissionLedger 기반 재설계 — organizationId로 테넌트 격리
 *
 * 쿼리 파라미터:
 * - period: YYYY-MM (필수)
 * - role: AGENT | OWNER | FREE_SALES | all (기본: all)
 * - organizationId: GLOBAL_ADMIN 전용 조직 필터 (선택)
 * - page: 페이지 번호 (기본: 1)
 * - limit: 페이지당 항목 수 (기본: 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

interface MemberStatement {
  agentId: number;
  name: string;
  role: string;
  payslipId: null;
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

// CommissionLedger entryType 분류
const COMMISSION_ENTRY_TYPES: string[] = [
  'SALES_COMMISSION',
  'OVERRIDE_COMMISSION',
  'BRANCH_COMMISSION',
];

const DEDUCTION_ENTRY_TYPES: string[] = ['WITHHOLDING', 'DEDUCTION', 'REFUND'];

/** YYYY-MM 문자열에서 다음 달 15일 반환 (UTC ISO 형식) */
function calcExpectedPaymentDate(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(Date.UTC(nextYear, nextMonth - 1, 15)).toISOString();
}

// ─── DocRow 타입 ──────────────────────────────────────────────────────────────

type DocRow = {
  userId: number;
  withholdingRate: number;
  bankName: string | null;
  bankAccount: string | null;
  bankAccountHolder: string | null;
  idCardPath: string | null;
  bankbookPath: string | null;
};

type UserNameRow = { id: number; name: string | null };

// ─── GET 핸들러 ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // ── 0. 세션 / 권한 체크 ────────────────────────────────────────────────────
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { role, organizationId: sessionOrgId } = session;

    if (role !== 'GLOBAL_ADMIN' && role !== 'OWNER') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '관리자 또는 대리점장 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // OWNER인데 organizationId가 없으면 접근 불가
    if (role === 'OWNER' && !sessionOrgId) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '조직에 속해 있지 않습니다.' },
        { status: 403 }
      );
    }

    // ── 1. 쿼리 파라미터 파싱 ─────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period');
    const VALID_ROLE_FILTERS = ['all', 'AGENT', 'OWNER', 'FREE_SALES'];
    const rawRole = searchParams.get('role') ?? 'all';
    const roleFilter = VALID_ROLE_FILTERS.includes(rawRole) ? rawRole : 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    // GLOBAL_ADMIN 전용 조직 필터
    const queryOrgId = searchParams.get('organizationId') ?? null;

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'period는 YYYY-MM 형식이어야 합니다.' },
        { status: 400 }
      );
    }

    // ── 2. 기간 경계 계산 (UTC 기반) ─────────────────────────────────────────
    const [periodYear, periodMonth] = period.split('-').map(Number);
    const periodStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1));
    const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 1));

    // ── 3. organizationId 결정 (테넌트 격리) ──────────────────────────────────
    // OWNER: 자신의 조직으로 강제 고정
    // GLOBAL_ADMIN: 쿼리 파라미터 값 사용 (없으면 전체 조직 대상)
    const effectiveOrgId: string | undefined =
      role === 'OWNER' ? sessionOrgId! : (queryOrgId ?? undefined);

    // ── 4. CommissionLedger WHERE 조건 ────────────────────────────────────────
    const baseLedgerWhere: Prisma.CommissionLedgerWhereInput = {
      ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
      createdAt: { gte: periodStart, lt: periodEnd },
      agentId: { not: null },
    };

    // ── 5. CommissionLedger 전체 조회 ─────────────────────────────────────────
    const ledgerEntries = await prisma.commissionLedger.findMany({
      where: baseLedgerWhere,
      orderBy: [{ agentId: 'asc' }, { createdAt: 'desc' }],
      select: {
        agentId: true,
        entryType: true,
        amount: true,
        withholdingAmount: true,
        isSettled: true,
      },
    });

    // ── 6. agentId별 집계 ─────────────────────────────────────────────────────
    type AgentAccum = {
      baseCommission: number;
      deduction: number;
      withholdingAmountSum: number;
      allSettled: boolean;
      entryCount: number;
    };

    const agentMap = new Map<number, AgentAccum>();

    for (const entry of ledgerEntries) {
      if (entry.agentId === null) continue;
      const agentId = entry.agentId;

      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          baseCommission: 0,
          deduction: 0,
          withholdingAmountSum: 0,
          allSettled: true,
          entryCount: 0,
        });
      }

      const accum = agentMap.get(agentId)!;
      accum.entryCount += 1;

      if (COMMISSION_ENTRY_TYPES.includes(entry.entryType)) {
        accum.baseCommission += entry.amount;
        if (entry.withholdingAmount != null) {
          accum.withholdingAmountSum += entry.withholdingAmount;
        }
      } else if (DEDUCTION_ENTRY_TYPES.includes(entry.entryType)) {
        accum.deduction += entry.amount;
      }

      if (!entry.isSettled) {
        accum.allSettled = false;
      }
    }

    // 집계 결과가 없으면 빈 응답
    if (agentMap.size === 0) {
      return NextResponse.json({
        ok: true,
        period,
        data: {
          members: [],
          summary: { totalPayout: 0, missingDocCount: 0, pendingCount: 0, paidCount: 0 },
          pagination: { page, limit, total: 0, totalPages: 0 },
        },
      });
    }

    // ── 7. 문서 상태 조회 (AffiliateProfile + AffiliateContract) ─────────────
    const agentIds = Array.from(agentMap.keys());

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

    // ── 8. GmUser 이름 조회 ───────────────────────────────────────────────────
    let userNameRows: UserNameRow[] = [];
    if (agentIds.length > 0) {
      userNameRows = await prisma.$queryRaw<UserNameRow[]>(
        Prisma.sql`
          SELECT id, name
          FROM "GmUser"
          WHERE id = ANY(${agentIds})
        `
      );
    }
    const userNameMap = new Map<number, string | null>(
      userNameRows.map(u => [u.id, u.name])
    );

    // ── 9. MemberStatement 조립 ───────────────────────────────────────────────
    // FREE_SALES 필터 시 CommissionLedger 기반 데이터는 제외 (별도 집계 없음)
    const members: MemberStatement[] = [];

    if (roleFilter !== 'FREE_SALES') {
      for (const [agentId, accum] of agentMap.entries()) {
        const doc = docMap.get(agentId);
        const withholdingRate = doc?.withholdingRate ?? 3.3;

        // withholdingAmount: 필드 합산값이 있으면 사용, 없으면 baseCommission * rate 계산
        const withholdingAmount =
          accum.withholdingAmountSum > 0
            ? accum.withholdingAmountSum
            : Math.floor(accum.baseCommission * (withholdingRate / 100));

        const netAmount = accum.baseCommission - withholdingAmount - accum.deduction;
        const status = accum.allSettled && accum.entryCount > 0 ? 'SENT' : 'PENDING';

        const hasIdCard = !!doc?.idCardPath;
        const hasBankBook = !!doc?.bankbookPath;
        const userName = userNameMap.get(agentId) ?? null;

        members.push({
          agentId,
          name: userName ?? String(agentId),
          role: 'AGENT',
          payslipId: null,
          yearMonth: period,
          baseCommission: accum.baseCommission,
          deduction: accum.deduction,
          withholdingAmount,
          netAmount,
          expectedPaymentDate: calcExpectedPaymentDate(period),
          status,
          bankName: doc?.bankName ?? null,
          bankAccount: doc?.bankAccount ?? null,
          bankAccountHolder: doc?.bankAccountHolder ?? null,
          hasIdCard,
          hasBankBook,
          canApprove: hasIdCard && hasBankBook,
        });
      }
    }

    // ── 10. 요약 계산 (슬라이싱 전 전체 기준) ────────────────────────────────
    const summary: TeamSummary = {
      totalPayout: members.reduce((acc, m) => acc + m.netAmount, 0),
      missingDocCount: members.filter(m => !m.canApprove).length,
      pendingCount: members.filter(m => m.status === 'PENDING').length,
      paidCount: members.filter(m => m.status === 'SENT').length,
    };

    // ── 11. 페이지네이션 슬라이싱 ────────────────────────────────────────────
    const totalMembers = members.length;
    const pagedMembers = members.slice(skip, skip + limit);

    const pagination: PaginationData = {
      page,
      limit,
      total: totalMembers,
      totalPages: Math.ceil(totalMembers / limit),
    };

    logger.info('[GET /api/statements/team] 조회 완료', {
      role,
      organizationId: effectiveOrgId ?? 'ALL',
      period,
      memberCount: totalMembers,
    });

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
