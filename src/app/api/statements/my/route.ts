/**
 * GET /api/statements/my
 * 역할별 개인 정산 조회
 *
 * - FREE_SALES: AffiliateSale 목록 (affiliateCode 기반)
 * - AGENT / OWNER: AffiliatePayslip 목록
 *
 * 쿼리 파라미터:
 * - period: YYYY-MM (기간 필터)
 * - page: 페이지 번호 (기본: 1)
 * - limit: 페이지당 항목 수 (기본: 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import type { AffiliateSale, AffiliatePayslip } from '@prisma/client';

// ─── 응답 타입 정의 ─────────────────────────────────────────────────────────

interface SaleItem {
  id: string;
  affiliateCode: string;
  productName: string;
  saleAmount: number;
  commissionRate: number;
  commissionAmount: number;
  withholdingAmount: number;
  refundedAmount: number;
  netAmount: number;
  status: string;
  travelCompletedAt: string | null;
  paidAt: string | null;
  orderId: string | null;
  createdAt: string;
}

interface PayslipItem {
  id: number;
  agentId: number;
  yearMonth: string;
  baseCommission: number;
  bonus: number | null;
  deduction: number | null;
  netAmount: number;
  withholdingAmount: number;
  expectedPaymentDate: string;
  status: string;
  paidAt: string | null;
  note: string | null;
  agentDisplayName: string | null;
  agentMallUserId: string | null;
  tierLabel: string | null;
  createdAt: string;
}

interface SummaryData {
  totalCommission: number;
  totalWithholding: number;
  totalNet: number;
  totalDeduction: number;
  pendingCount: number;
  paidCount: number;
}

interface DocumentStatus {
  hasIdCard: boolean;
  hasBankBook: boolean;
  bankName: string | null;
  bankAccount: string | null;
  bankAccountHolder: string | null;
  withholdingRate: number;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Tier 문자열 → 커미션율 라벨 (예: "Bronze" → "Bronze 15%") */
const TIER_RATE_MAP: Record<string, string> = {
  Bronze:   'Bronze 15%',
  Silver:   'Silver 18%',
  Gold:     'Gold 20%',
  Platinum: 'Platinum 22%',
};

function buildTierLabel(tier: string | null | undefined): string | null {
  if (!tier) return null;
  return TIER_RATE_MAP[tier] ?? tier;
}

/** YYYY-MM 문자열에서 다음 달 15일 반환 (ISO 형식, UTC 고정) */
function calcExpectedPaymentDate(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(Date.UTC(nextYear, nextMonth - 1, 15)).toISOString();
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

    const { role } = session;

    // 파트너 역할이 아닌 경우 빈 정산 내역 반환 (403 대신 안내 응답)
    if (role !== 'FREE_SALES' && role !== 'AGENT' && role !== 'OWNER') {
      return NextResponse.json({
        ok: true,
        role,
        data: {
          sales: [],
          payslips: [],
          summary: { totalCommission: 0, totalWithholding: 0, totalNet: 0, totalDeduction: 0, pendingCount: 0, paidCount: 0 },
          document: { hasIdCard: false, hasBankBook: false, bankName: null, bankAccount: null, bankAccountHolder: null, withholdingRate: 3.3 },
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        },
        message: '파트너 계정으로 로그인하면 정산 내역을 확인할 수 있습니다.',
      });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period'); // YYYY-MM
    const statusFilter = searchParams.get('status'); // 상태 필터
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    // ── FREE_SALES: AffiliateSale 조회 ──────────────────────────────────────
    if (role === 'FREE_SALES') {
      const mallUserId = session.mallUser?.id;
      if (!mallUserId) {
        return NextResponse.json(
          { ok: false, error: 'FORBIDDEN', message: '파트너 정보가 없습니다.' },
          { status: 403 }
        );
      }

      // affiliateCode 조회 (GmUser 테이블)
      const gmUserRows = await prisma.$queryRaw<Array<{ affiliateCode: string | null }>>(
        Prisma.sql`SELECT "affiliateCode" FROM "User" WHERE id = ${mallUserId} LIMIT 1`
      );
      const affiliateCode = gmUserRows[0]?.affiliateCode ?? null;

      // 기간 필터 조건 구성
      type SaleOrCondition = { affiliateCode: string } | { affiliateUserId: string };
      type SaleWhere = {
        OR: SaleOrCondition[];
        travelCompletedAt?: { gte: Date; lt: Date };
        status?: string;
      };

      const orConditions: SaleOrCondition[] = [
        { affiliateUserId: String(mallUserId) },
      ];
      if (affiliateCode) {
        orConditions.push({ affiliateCode });
      }

      const whereConditions: SaleWhere = {
        OR: orConditions,
      };

      if (period) {
        const [y, m] = period.split('-').map(Number);
        const periodStart = new Date(Date.UTC(y, m - 1, 1));
        const periodEnd = new Date(Date.UTC(y, m, 1));
        whereConditions.travelCompletedAt = { gte: periodStart, lt: periodEnd };
      }

      if (statusFilter) {
        whereConditions.status = statusFilter;
      }

      const [sales, total] = await Promise.all([
        prisma.affiliateSale.findMany({
          where: whereConditions,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.affiliateSale.count({ where: whereConditions }),
      ]);

      // GmAffiliateProfile 문서 상태 조회
      const profileRows = await prisma.$queryRaw<Array<{
        withholdingRate: number;
        bankName: string | null;
        bankAccount: string | null;
        bankAccountHolder: string | null;
        idCardPath: string | null;
        bankbookPath: string | null;
      }>>(
        Prisma.sql`
          SELECT
            ap."withholdingRate",
            COALESCE(ac."bankName", ap."bankName") AS "bankName",
            COALESCE(ac."bankAccount", ap."bankAccount") AS "bankAccount",
            COALESCE(ac."bankAccountHolder", ap."bankAccountHolder") AS "bankAccountHolder",
            ac."idCardPath",
            ac."bankbookPath"
          FROM "AffiliateProfile" ap
          LEFT JOIN "AffiliateContract" ac ON ac."userId" = ap."userId"
          WHERE ap."userId" = ${mallUserId}
          LIMIT 1
        `
      );

      const profileDoc = profileRows[0];
      const withholdingRate = profileDoc?.withholdingRate ?? 3.3;

      const saleItems: SaleItem[] = sales.map((s: AffiliateSale) => {
        const withholdingAmount = Math.floor(s.commissionAmount * (withholdingRate / 100));
        const netAmount = s.commissionAmount - withholdingAmount - s.refundedAmount;
        return {
          id: s.id,
          affiliateCode: s.affiliateCode,
          productName: s.productName,
          saleAmount: s.saleAmount,
          commissionRate: s.commissionRate,
          commissionAmount: s.commissionAmount,
          withholdingAmount,
          refundedAmount: s.refundedAmount,
          netAmount,
          status: s.status,
          travelCompletedAt: s.travelCompletedAt ? s.travelCompletedAt.toISOString() : null,
          paidAt: s.paidAt ? s.paidAt.toISOString() : null,
          orderId: s.orderId ?? null,
          createdAt: s.createdAt.toISOString(),
        };
      });

      const summary: SummaryData = {
        totalCommission: saleItems.reduce((acc, s) => acc + s.commissionAmount, 0),
        totalWithholding: saleItems.reduce((acc, s) => acc + s.withholdingAmount, 0),
        totalNet: saleItems.reduce((acc, s) => acc + s.netAmount, 0),
        totalDeduction: saleItems.reduce((acc, s) => acc + s.refundedAmount, 0),
        pendingCount: saleItems.filter(s => s.status === 'PENDING').length,
        paidCount: saleItems.filter(s => s.status === 'COMPLETED').length,
      };

      const document: DocumentStatus = {
        hasIdCard: !!profileDoc?.idCardPath,
        hasBankBook: !!profileDoc?.bankbookPath,
        bankName: profileDoc?.bankName ?? null,
        bankAccount: profileDoc?.bankAccount ?? null,
        bankAccountHolder: profileDoc?.bankAccountHolder ?? null,
        withholdingRate,
      };

      return NextResponse.json({
        ok: true,
        role,
        data: {
          sales: saleItems,
          summary,
          document,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    }

    // ── AGENT / OWNER: AffiliatePayslip 조회 ────────────────────────────────
    const mallUserId = session.mallUser?.id;
    if (!mallUserId) {
      // GMcruise 계정 미연동 → 빈 정산 내역 반환 (403 대신 정상 응답)
      return NextResponse.json({
        ok: true,
        role,
        data: {
          payslips: [],
          summary: { totalCommission: 0, totalWithholding: 0, totalNet: 0, totalDeduction: 0, pendingCount: 0, paidCount: 0 },
          document: { hasIdCard: false, hasBankBook: false, bankName: null, bankAccount: null, bankAccountHolder: null, withholdingRate: 3.3 },
          pagination: { page, limit, total: 0, totalPages: 0 },
        },
      });
    }

    const agentId = mallUserId;

    type PayslipWhere = {
      agentId: number;
      yearMonth?: string;
      status?: string;
    };

    const where: PayslipWhere = { agentId };
    if (period) {
      where.yearMonth = period;
    }
    if (statusFilter) {
      where.status = statusFilter;
    }

    const [payslips, total] = await Promise.all([
      prisma.affiliatePayslip.findMany({
        where,
        orderBy: { yearMonth: 'desc' },
        skip,
        take: limit,
      }),
      prisma.affiliatePayslip.count({ where }),
    ]);

    // 문서 상태 조회 (ap.id 포함 — Partner tier 조회에 사용)
    const profileRows = await prisma.$queryRaw<Array<{
      profileId: number;
      withholdingRate: number;
      bankName: string | null;
      bankAccount: string | null;
      bankAccountHolder: string | null;
      idCardPath: string | null;
      bankbookPath: string | null;
    }>>(
      Prisma.sql`
        SELECT
          ap."id" AS "profileId",
          ap."withholdingRate",
          COALESCE(ac."bankName", ap."bankName") AS "bankName",
          COALESCE(ac."bankAccount", ap."bankAccount") AS "bankAccount",
          COALESCE(ac."bankAccountHolder", ap."bankAccountHolder") AS "bankAccountHolder",
          ac."idCardPath",
          ac."bankbookPath"
        FROM "AffiliateProfile" ap
        LEFT JOIN "AffiliateContract" ac ON ac."userId" = ap."userId"
        WHERE ap."userId" = ${agentId}
        LIMIT 1
      `
    );

    const profileDoc = profileRows[0];
    const withholdingRate = profileDoc?.withholdingRate ?? 3.3;

    // Partner tier 조회 (externalProfileId = AffiliateProfile.id)
    let tierLabel: string | null = null;
    if (profileDoc?.profileId) {
      const partnerRecord = await prisma.partner.findFirst({
        where: { externalProfileId: profileDoc.profileId },
        select: { tier: true },
      });
      tierLabel = buildTierLabel(partnerRecord?.tier ?? null);
    }

    const payslipItems: PayslipItem[] = payslips.map((p: AffiliatePayslip) => {
      const base = Number(p.baseCommission);
      const net = Number(p.netAmount);
      const deduction = p.deduction ? Number(p.deduction) : null;
      const bonus = p.bonus ? Number(p.bonus) : null;
      const withholdingAmount = Math.floor(base * (withholdingRate / 100));
      return {
        id: p.id,
        agentId: p.agentId,
        yearMonth: p.yearMonth,
        baseCommission: base,
        bonus,
        deduction,
        netAmount: net,
        withholdingAmount,
        expectedPaymentDate: calcExpectedPaymentDate(p.yearMonth),
        status: p.status,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        note: p.note ?? null,
        agentDisplayName: p.agentDisplayName ?? null,
        agentMallUserId: p.agentMallUserId ?? null,
        tierLabel,
        createdAt: p.createdAt.toISOString(),
      };
    });

    const summary: SummaryData = {
      totalCommission: payslipItems.reduce((acc, p) => acc + p.baseCommission, 0),
      totalWithholding: payslipItems.reduce((acc, p) => acc + p.withholdingAmount, 0),
      totalNet: payslipItems.reduce((acc, p) => acc + p.netAmount, 0),
      totalDeduction: payslipItems.reduce((acc, p) => acc + (p.deduction ?? 0), 0),
      pendingCount: payslipItems.filter(p => p.status === 'PENDING').length,
      paidCount: payslipItems.filter(p => p.status === 'SENT').length,
    };

    const document: DocumentStatus = {
      hasIdCard: !!profileDoc?.idCardPath,
      hasBankBook: !!profileDoc?.bankbookPath,
      bankName: profileDoc?.bankName ?? null,
      bankAccount: profileDoc?.bankAccount ?? null,
      bankAccountHolder: profileDoc?.bankAccountHolder ?? null,
      withholdingRate,
    };

    return NextResponse.json({
      ok: true,
      role,
      data: {
        payslips: payslipItems,
        summary,
        document,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });

  } catch (err) {
    logger.error('[GET /api/statements/my]', { err });
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
