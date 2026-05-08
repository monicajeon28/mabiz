export const dynamic = 'force-dynamic';

// GET /api/admin/affiliate/payslips
// 월별 지급명세서 전체 목록 + 필터 (관리자용)
// Query: period=YYYY-MM, type=SALES_AGENT|BRANCH_MANAGER|FREE_SALES_AGENT, status=PENDING|APPROVED|SENT, q=검색어

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const TYPE_LABEL: Record<string, string> = {
  SALES_AGENT: '판매원',
  BRANCH_MANAGER: '대리점장',
  FREE_SALES_AGENT: '프리세일즈',
};

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });
    if (!dbUser || !['admin', 'superadmin'].includes(dbUser.role ?? '')) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period')?.trim() ?? '';
    const typeFilter = searchParams.get('type')?.trim() ?? '';
    const statusFilter = searchParams.get('status')?.trim() ?? '';
    const q = searchParams.get('q')?.trim().toLowerCase() ?? '';

    // period 필수 — YYYY-MM 형식
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { ok: false, error: 'period는 YYYY-MM 형식이어야 합니다.' },
        { status: 400 }
      );
    }

    // AffiliatePayslip 조회 (해당 period)
    const payslips = await prisma.affiliatePayslip.findMany({
      where: {
        period,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      select: {
        id: true,
        profileId: true,
        period: true,
        type: true,
        totalSales: true,
        totalCommission: true,
        totalWithholding: true,
        netPayment: true,
        status: true,
        approvedAt: true,
        approvedBy: true,
        sentAt: true,
        pdfUrl: true,
        createdAt: true,
        updatedAt: true,
        AffiliateProfile: {
          select: {
            id: true,
            affiliateCode: true,
            displayName: true,
            nickname: true,
            type: true,
            bankName: true,
            bankAccount: true,
            bankAccountHolder: true,
          },
        },
        User: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { type: 'asc' },
        { AffiliateProfile: { displayName: 'asc' } },
      ],
    });

    // 프로필 타입 필터 (AffiliateProfile.type 기준)
    const filtered = payslips.filter((p) => {
      const profileType = p.AffiliateProfile?.type ?? p.type ?? '';
      if (typeFilter && profileType !== typeFilter) return false;

      // 검색어 필터 (이름, 코드)
      if (q) {
        const name = (p.AffiliateProfile?.displayName ?? p.AffiliateProfile?.nickname ?? '').toLowerCase();
        const code = (p.AffiliateProfile?.affiliateCode ?? '').toLowerCase();
        if (!name.includes(q) && !code.includes(q)) return false;
      }

      return true;
    });

    // 요약 통계 (필터 적용된 결과 기준)
    const total = filtered.length;
    const sent = filtered.filter((p) => p.status === 'SENT').length;
    const pending = filtered.filter((p) => p.status !== 'SENT').length;
    const totalNetAmount = filtered.reduce((sum, p) => sum + (p.netPayment ?? 0), 0);

    const result = filtered.map((p) => ({
      id: p.id,
      profileId: p.profileId,
      period: p.period,
      type: p.AffiliateProfile?.type ?? p.type,
      typeLabel: TYPE_LABEL[p.AffiliateProfile?.type ?? p.type ?? ''] ?? p.type,
      affiliateCode: p.AffiliateProfile?.affiliateCode ?? null,
      displayName: p.AffiliateProfile?.displayName ?? p.AffiliateProfile?.nickname ?? null,
      bankName: p.AffiliateProfile?.bankName ?? null,
      bankAccount: p.AffiliateProfile?.bankAccount
        ? `****${p.AffiliateProfile.bankAccount.slice(-4)}`
        : null,
      bankAccountHolder: p.AffiliateProfile?.bankAccountHolder ?? null,
      totalSales: p.totalSales,
      totalCommission: p.totalCommission,
      totalWithholding: p.totalWithholding,
      netPayment: p.netPayment,
      status: p.status,
      approvedAt: p.approvedAt?.toISOString() ?? null,
      approvedByName: p.User?.name ?? null,
      sentAt: p.sentAt?.toISOString() ?? null,
      pdfUrl: p.pdfUrl ?? null,
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      period,
      summary: { total, sent, pending, totalNetAmount },
      payslips: result,
    });
  } catch (error: unknown) {
    logger.error('[Admin Payslips] GET 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
