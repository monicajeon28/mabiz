export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/partner/dashboard/b2b?month=2026-05
 * B2B 대시보드 탭: 리드 통계, 최근 리드, 최근 결제
 */
export async function GET(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month');
    const now = new Date();
    const [year, month] = monthParam
      ? monthParam.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // ── 조직 필터 (GLOBAL_ADMIN: 전체, OWNER: 자기 조직만) ──
    const isAdmin = ctx.sessionUser.role === 'admin';
    const orgFilter = isAdmin ? {} : { organizationId: ctx.organizationId! };

    // ── 1) B2B 잠재고객(리드) 수 ──
    const leadCount = await prisma.b2BProspect.count({
      where: {
        ...orgFilter,
        createdAt: { gte: startDate, lt: endDate },
      },
    });

    // ── 2) 랜딩 등록 수 (CrmLandingRegistration → CrmLandingPage.organizationId 경유) ──
    const registrationCount = await prisma.crmLandingRegistration.count({
      where: {
        createdAt: { gte: startDate, lt: endDate },
        landingPage: isAdmin ? {} : { organizationId: ctx.organizationId! },
      },
    });

    // ── 3) PayApp 결제 합계 (paid, 해당 월) ──
    const paidPayments = await prisma.payAppPayment.findMany({
      where: {
        ...( isAdmin ? {} : { organizationId: ctx.organizationId! }),
        status: 'paid',
        paidAt: { gte: startDate, lt: endDate },
      },
      select: { amount: true },
    });
    const paymentTotal = paidPayments.reduce((sum, p) => sum + p.amount, 0);

    const stats = { leadCount, registrationCount, paymentTotal };

    // ── 4) 최근 리드 10건 ──
    const recentLeads = await prisma.b2BProspect.findMany({
      where: orgFilter,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // ── 5) 최근 결제 5건 ──
    const recentPayments = await prisma.payAppPayment.findMany({
      where: {
        ...(isAdmin ? {} : { organizationId: ctx.organizationId! }),
        status: 'paid',
      },
      orderBy: { paidAt: 'desc' },
      take: 5,
    });

    logger.log('[dashboard/b2b] 조회 완료', {
      orgId: ctx.organizationId,
      month: `${year}-${String(month).padStart(2, '0')}`,
    });

    return NextResponse.json({ stats, recentLeads, recentPayments });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[dashboard/b2b] 오류', { message: err.message, stack: err.stack });
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
