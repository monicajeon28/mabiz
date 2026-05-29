export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/partner/dashboard/gold?month=2026-05
 * 골드회원 대시보드 탭: 회원 통계 + 전월 대비 트렌드 + 최근 회원 + 최근 상담
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
    const orgFilter = isAdmin ? {} : { organizationId: ctx.organizationId ?? "" };
    const consultOrgFilter = isAdmin ? {} : { organizationId: ctx.organizationId ?? "" };

    // ── 1) 골드회원 수 + 상담 수 + 납부율 (현재 + 전월 병렬) ──
    const [
      memberCount, prevMemberCount,
      newInquiryCount, prevInquiryCount,
    ] = await Promise.all([
      prisma.goldMember.count({ where: { ...orgFilter, status: 'ACTIVE' } }),
      // 전월 기준 활성 회원 (joinDate 기준 근사치)
      prisma.goldMember.count({
        where: { ...orgFilter, status: 'ACTIVE', createdAt: { lt: prevEnd } },
      }),
      prisma.goldMemberConsultation.count({
        where: { createdAt: { gte: startDate, lt: endDate }, goldMember: consultOrgFilter },
      }),
      prisma.goldMemberConsultation.count({
        where: { createdAt: { gte: prevStart, lt: prevEnd }, goldMember: consultOrgFilter },
      }),
    ]);

    // ── 납부율: SQL 집계 사용 (성능 최적화: findMany+reduce 제거) ──
    let paymentRate = 0;
    let prevPaymentRate = 0;

    if (isAdmin) {
      const result = await prisma.$queryRaw<[{ rate: number | null }]>`
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(AVG("paidCount"::float / NULLIF("totalPayments", 0)) * 100, 2)
        END AS rate
        FROM "GoldMember"
        WHERE "status" = 'ACTIVE' AND "totalPayments" > 0
      `;
      paymentRate = Number(result[0]?.rate ?? 0);
    } else {
      const result = await prisma.$queryRaw<[{ rate: number | null }]>`
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(AVG("paidCount"::float / NULLIF("totalPayments", 0)) * 100, 2)
        END AS rate
        FROM "GoldMember"
        WHERE "status" = 'ACTIVE' AND "totalPayments" > 0
          AND "organizationId" = ${ctx.organizationId}
      `;
      paymentRate = Number(result[0]?.rate ?? 0);
    }

    // ── 2) 최근 회원 10건 (프론트 타입에 맞게 매핑) ──
    const recentMembersRaw = await prisma.goldMember.findMany({
      where: orgFilter,
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const members = recentMembersRaw.map((m) => ({
      id: m.id,
      name: m.name,
      course: m.courseType,
      paidCount: m.paidCount,
      totalCount: m.totalPayments,
      status: m.status,
    }));

    // ── 3) 최근 상담 5건 (프론트 타입에 맞게 매핑) ──
    const recentConsRaw = await prisma.goldMemberConsultation.findMany({
      where: { goldMember: consultOrgFilter },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { goldMember: { select: { name: true, memberCode: true } } },
    });

    const recentConsultations = recentConsRaw.map((c) => ({
      id: c.id,
      memberName: c.goldMember.name,
      content: c.content,
      date: c.createdAt.toISOString().slice(0, 10),
    }));

    // ── 트렌드 ──
    const calcTrend = (curr: number, prev: number) =>
      prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

    logger.log('[dashboard/gold] 조회 완료', {
      orgId: ctx.organizationId,
      month: `${year}-${String(month).padStart(2, '0')}`,
    });

    return NextResponse.json({
      ok: true,
      data: {
        goldMemberCount: memberCount,
        newInquiries: newInquiryCount,
        paymentRate,
        members,
        recentConsultations,
        trends: {
          goldMemberCount: calcTrend(memberCount, prevMemberCount),
          newInquiries: calcTrend(newInquiryCount, prevInquiryCount),
          paymentRate: 0, // 납부율은 비율이라 트렌드 불필요
        },
      },
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[dashboard/gold] 오류', { message: err.message, stack: err.stack });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}

