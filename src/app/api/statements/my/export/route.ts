/**
 * GET /api/statements/my/export
 * 역할별 개인 정산 내역 CSV 다운로드
 *
 * - FREE_SALES: AffiliateSale 전체 CSV
 * - AGENT / OWNER: AffiliatePayslip 전체 CSV
 *
 * 쿼리 파라미터:
 * - period: YYYY-MM (기간 필터)
 * - status: 상태 필터
 * - format: 'csv' (현재 csv만 지원)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import type { AffiliateSale, AffiliatePayslip } from '@prisma/client';

const MAX_EXPORT_ROWS = 5000;

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDateKR(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ko-KR');
}

function buildCSVResponse(rows: string[][], filename: string): NextResponse {
  const bom = '﻿'; // UTF-8 BOM for Excel compatibility
  const csv = bom + rows.map((row) => row.map(escapeCSV).join(',')).join('\r\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
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

    if (role !== 'FREE_SALES' && role !== 'AGENT' && role !== 'OWNER') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '파트너 계정만 정산 내역을 내보낼 수 있습니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period');
    const statusFilter = searchParams.get('status');

    // ── FREE_SALES: AffiliateSale CSV ────────────────────────────────────────
    if (role === 'FREE_SALES') {
      const mallUserId = session.mallUser?.id;
      if (!mallUserId) {
        return NextResponse.json(
          { ok: false, error: 'FORBIDDEN', message: '파트너 정보가 없습니다.' },
          { status: 403 }
        );
      }

      const gmUserRows = await prisma.$queryRaw<Array<{ affiliateCode: string | null }>>(
        Prisma.sql`SELECT "affiliateCode" FROM "User" WHERE id = ${mallUserId} LIMIT 1`
      );
      const affiliateCode = gmUserRows[0]?.affiliateCode ?? null;

      type SaleOrCondition = { affiliateCode: string } | { affiliateUserId: string };
      type SaleWhere = {
        OR: SaleOrCondition[];
        travelCompletedAt?: { gte: Date; lt: Date };
        status?: string;
      };

      const orConditions: SaleOrCondition[] = [{ affiliateUserId: String(mallUserId) }];
      if (affiliateCode) {
        orConditions.push({ affiliateCode });
      }

      const whereConditions: SaleWhere = { OR: orConditions };

      if (period) {
        const [y, m] = period.split('-').map(Number);
        whereConditions.travelCompletedAt = {
          gte: new Date(Date.UTC(y, m - 1, 1)),
          lt: new Date(Date.UTC(y, m, 1)),
        };
      }
      if (statusFilter) {
        whereConditions.status = statusFilter;
      }

      const profileRows = await prisma.$queryRaw<Array<{ withholdingRate: number }>>(
        Prisma.sql`SELECT "withholdingRate" FROM "AffiliateProfile" WHERE "userId" = ${mallUserId} LIMIT 1`
      );
      const withholdingRate = profileRows[0]?.withholdingRate ?? 3.3;

      const sales = await prisma.affiliateSale.findMany({
        where: whereConditions,
        orderBy: { createdAt: 'desc' },
        take: MAX_EXPORT_ROWS,
      });

      const STATUS_LABEL: Record<string, string> = {
        PENDING: '정산예정',
        COMPLETED: '지급완료',
        REFUNDED: '환불',
        CANCELLED: '취소',
      };

      const header = [
        '번호', '상품명', '판매금액', '수수료율(%)', '수수료금액',
        '원천징수금액', '환불금액', '실지급금액', '상태',
        '여행완료일', '지급일', '등록일',
      ];

      const dataRows = sales.map((s: AffiliateSale, i: number) => {
        const wh = Math.floor(s.commissionAmount * (withholdingRate / 100));
        const net = s.commissionAmount - wh - s.refundedAmount;
        return [
          String(i + 1),
          s.productName,
          String(s.saleAmount),
          String(s.commissionRate),
          String(s.commissionAmount),
          String(wh),
          String(s.refundedAmount),
          String(net),
          STATUS_LABEL[s.status] ?? s.status,
          formatDateKR(s.travelCompletedAt?.toISOString() ?? null),
          formatDateKR(s.paidAt?.toISOString() ?? null),
          formatDateKR(s.createdAt.toISOString()),
        ];
      });

      const periodLabel = period ? `_${period}` : '';
      const filename = `정산내역${periodLabel}.csv`;

      logger.log('[GET /api/statements/my/export] FREE_SALES export', {
        userId: mallUserId,
        rows: sales.length,
        period,
      });

      return buildCSVResponse([header, ...dataRows], filename);
    }

    // ── AGENT / OWNER: AffiliatePayslip CSV ─────────────────────────────────
    const mallUserId = session.mallUser?.id;
    if (!mallUserId) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: 'GMcruise 계정이 연동되지 않았습니다.' },
        { status: 403 }
      );
    }

    type PayslipWhere = {
      agentId: number;
      yearMonth?: string;
      status?: string;
    };

    const where: PayslipWhere = { agentId: mallUserId };
    if (period) where.yearMonth = period;
    if (statusFilter) where.status = statusFilter;

    const profileRows = await prisma.$queryRaw<Array<{ withholdingRate: number }>>(
      Prisma.sql`SELECT "withholdingRate" FROM "AffiliateProfile" WHERE "userId" = ${mallUserId} LIMIT 1`
    );
    const withholdingRate = profileRows[0]?.withholdingRate ?? 3.3;

    const payslips = await prisma.affiliatePayslip.findMany({
      where,
      orderBy: { yearMonth: 'desc' },
      take: MAX_EXPORT_ROWS,
    });

    const STATUS_LABEL: Record<string, string> = {
      PENDING: '정산예정',
      APPROVED: '승인완료',
      SENT: '지급완료',
    };

    const header = [
      '번호', '정산연월', '기본커미션', '보너스', '공제금액',
      '원천징수금액', '실지급금액', '상태', '예상지급일', '실지급일', '메모',
    ];

    const dataRows = payslips.map((p: AffiliatePayslip, i: number) => {
      const base = Number(p.baseCommission);
      const wh = Math.floor(base * (withholdingRate / 100));
      const [year, month] = p.yearMonth.split('-').map(Number);
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const expectedDate = new Date(Date.UTC(nextYear, nextMonth - 1, 15))
        .toLocaleDateString('ko-KR');

      return [
        String(i + 1),
        p.yearMonth,
        String(base),
        String(p.bonus ? Number(p.bonus) : 0),
        String(p.deduction ? Number(p.deduction) : 0),
        String(wh),
        String(Number(p.netAmount)),
        STATUS_LABEL[p.status] ?? p.status,
        expectedDate,
        formatDateKR(p.paidAt?.toISOString() ?? null),
        p.note ?? '',
      ];
    });

    const periodLabel = period ? `_${period}` : '';
    const filename = `정산내역${periodLabel}.csv`;

    logger.log('[GET /api/statements/my/export] AGENT/OWNER export', {
      userId: mallUserId,
      role,
      rows: payslips.length,
      period,
    });

    return buildCSVResponse([header, ...dataRows], filename);
  } catch (err) {
    logger.error('[GET /api/statements/my/export]', { err });
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
