export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/partner/dashboard/b2b?month=2026-05
 * B2B 대시보드 탭: 리드 통계 + 전월 대비 트렌드 + 최근 리드 + 최근 결제
 */
export async function GET(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month');
    const now = new Date();
    const [year, month] = monthParam
      ? monthParam.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const prevStart = new Date(year, month - 2, 1);
    const prevEnd = startDate;

    const isAdmin = ctx.sessionUser.role === 'admin';
    const orgFilter = isAdmin ? {} : { organizationId: ctx.organizationId! };
    const payOrgFilter = isAdmin ? {} : { organizationId: ctx.organizationId! };

    // ── 1) 리드 수 + 등록 수 + 결제 합계 (현재 + 전월 병렬) ──
    const dateFilter = { createdAt: { gte: startDate, lt: endDate } };
    const prevDateFilter = { createdAt: { gte: prevStart, lt: prevEnd } };
    const landingOrgFilter = isAdmin ? {} : { organizationId: ctx.organizationId! };

    const [
      leadCount, prevLeadCount,
      registrationCount, prevRegistrationCount,
      payAgg, prevPayAgg,
    ] = await Promise.all([
      prisma.b2BProspect.count({ where: { ...orgFilter, ...dateFilter } }),
      prisma.b2BProspect.count({ where: { ...orgFilter, ...prevDateFilter } }),
      prisma.crmLandingRegistration.count({
        where: { ...dateFilter, landingPage: landingOrgFilter },
      }),
      prisma.crmLandingRegistration.count({
        where: { ...prevDateFilter, landingPage: landingOrgFilter },
      }),
      // aggregate 사용 (성능 최적화: findMany+reduce 제거)
      prisma.payAppPayment.aggregate({
        where: { ...payOrgFilter, status: 'paid', paidAt: { gte: startDate, lt: endDate } },
        _sum: { amount: true },
      }),
      prisma.payAppPayment.aggregate({
        where: { ...payOrgFilter, status: 'paid', paidAt: { gte: prevStart, lt: prevEnd } },
        _sum: { amount: true },
      }),
    ]);

    const paymentAmount = payAgg._sum.amount ?? 0;
    const prevPaymentAmount = prevPayAgg._sum.amount ?? 0;

    // ── 2) 최근 리드 10건 ──
    const recentLeadsRaw = await prisma.b2BProspect.findMany({
      where: orgFilter,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const recentLeads = recentLeadsRaw.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone ? l.phone.slice(0, 3) + '-****-' + l.phone.slice(-4) : '-',
      interestedPackage: l.packageInterest ?? '-',
      source: l.source ?? '-',
      status: l.status ?? 'NEW',
    }));

    // ── 3) 최근 결제 5건 ──
    const recentPaymentsRaw = await prisma.payAppPayment.findMany({
      where: { ...payOrgFilter, status: 'paid' },
      orderBy: { paidAt: 'desc' },
      take: 5,
    });

    const recentPayments = recentPaymentsRaw.map((p) => ({
      id: p.id,
      customerName: p.productName ?? '-',
      amount: p.amount,
      product: p.productName ?? '-',
      date: p.paidAt?.toISOString().slice(0, 10) ?? '-',
    }));

    // ── 트렌드 ──
    const calcTrend = (curr: number, prev: number) =>
      prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

    logger.log('[dashboard/b2b] 조회 완료', {
      orgId: ctx.organizationId,
      month: `${year}-${String(month).padStart(2, '0')}`,
    });

    return NextResponse.json({
      ok: true,
      data: {
        newLeads: leadCount,
        eduApplicants: registrationCount,
        paymentAmount,
        recentLeads,
        recentPayments,
        trends: {
          newLeads: calcTrend(leadCount, prevLeadCount),
          eduApplicants: calcTrend(registrationCount, prevRegistrationCount),
          paymentAmount: calcTrend(Number(paymentAmount), Number(prevPaymentAmount)),
        },
      },
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[dashboard/b2b] 오류', { message: err.message, stack: err.stack });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
