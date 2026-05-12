export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/partner/dashboard/gold?month=2026-05
 * 골드회원 대시보드 탭: 회원 통계, 최근 회원, 최근 상담
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

    // ── 1) 골드회원 수 (전체 ACTIVE) ──
    const memberCount = await prisma.goldMember.count({
      where: {
        ...orgFilter,
        status: 'ACTIVE',
      },
    });

    // ── 2) 해당 월 신규 문의(상담) 수 ──
    const newInquiryCount = await prisma.goldMemberConsultation.count({
      where: {
        createdAt: { gte: startDate, lt: endDate },
        goldMember: isAdmin ? {} : { organizationId: ctx.organizationId! },
      },
    });

    // ── 3) 납부율 (paidCount / totalPayments 평균) ──
    const membersForRate = await prisma.goldMember.findMany({
      where: {
        ...orgFilter,
        status: 'ACTIVE',
        totalPayments: { gt: 0 },
      },
      select: { paidCount: true, totalPayments: true },
    });

    const paymentRate =
      membersForRate.length > 0
        ? membersForRate.reduce(
            (sum, m) => sum + m.paidCount / m.totalPayments,
            0,
          ) / membersForRate.length
        : 0;

    const stats = {
      memberCount,
      newInquiryCount,
      paymentRate: Math.round(paymentRate * 10000) / 100, // 소수점 2자리 %
    };

    // ── 4) 최근 회원 10건 ──
    const recentMembers = await prisma.goldMember.findMany({
      where: orgFilter,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // ── 5) 최근 상담 5건 (goldMember.organizationId 경유 필터) ──
    const recentConsultations = await prisma.goldMemberConsultation.findMany({
      where: {
        goldMember: isAdmin ? {} : { organizationId: ctx.organizationId! },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        goldMember: {
          select: { name: true, memberCode: true },
        },
      },
    });

    logger.log('[dashboard/gold] 조회 완료', {
      orgId: ctx.organizationId,
      month: `${year}-${String(month).padStart(2, '0')}`,
    });

    return NextResponse.json({ stats, recentMembers, recentConsultations });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[dashboard/gold] 오류', { message: err.message, stack: err.stack });
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
