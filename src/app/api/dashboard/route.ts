export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const ctx = await getMabizSession();
    if (!ctx || !ctx.organizationId) {
      return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
    }

    const orgId = ctx.organizationId;
    const userId = ctx.userId;
    const role = ctx.role ?? 'AGENT';

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const todayEnd   = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const yearMonth  = now.toISOString().slice(0, 7);

    // 역할별 Contact 필터
    let contactWhere: Record<string, unknown> = { organizationId: orgId, deletedAt: null };
    if (role === 'OWNER') {
      const teamAgentIds = await prisma.organizationMember.findMany({
        where: { organizationId: orgId, role: 'AGENT' },
        select: { userId: true },
      });
      contactWhere.createdByUserId = { in: teamAgentIds.map((m) => m.userId) };
    } else if (role === 'AGENT' && userId) {
      contactWhere.createdByUserId = userId;
    }

    // 공통 쿼리 (모든 역할)
    const [totalContacts, newContactsThisMonth, callDueToday] = await Promise.all([
      prisma.contact.count({ where: contactWhere }),
      prisma.contact.count({ where: { ...contactWhere, createdAt: { gte: monthStart, lte: monthEnd } } }),
      // 오늘 콜: 7일 이상 미접촉이거나 미접촉 고객
      prisma.contact.count({
        where: {
          ...contactWhere,
          OR: [
            { lastContactedAt: null },
            { lastContactedAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
          ],
        },
      }),
    ]);

    // GLOBAL_ADMIN 전용
    if (role === 'GLOBAL_ADMIN') {
      const [
        totalAgents,
        goldMemberCount,
        pendingApprovalCount,
        monthSaleResult,
        monthRefundResult,
      ] = await Promise.all([
        prisma.organizationMember.count({ where: { organizationId: orgId, role: 'AGENT', isActive: true } }),
        prisma.goldMember.count({ where: { organizationId: orgId } }),
        prisma.organization.count({ where: { status: 'PENDING' } }),
        prisma.payAppPayment.aggregate({
          where: {
            organizationId: orgId,
            createdAt: { gte: monthStart, lte: monthEnd },
            status: 'PAID',
          },
          _sum: { amount: true },
        }),
        prisma.payAppPayment.aggregate({
          where: {
            organizationId: orgId,
            createdAt: { gte: monthStart, lte: monthEnd },
            refundAmount: { gt: 0 },
          },
          _sum: { refundAmount: true },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        role,
        yearMonth,
        totalAgents,
        goldMemberCount,
        pendingApprovalCount,
        monthSaleAmount: monthSaleResult._sum.amount ?? 0,
        monthRefundAmount: monthRefundResult._sum.refundAmount ?? 0,
        totalContacts,
        newContactsThisMonth,
        callDueToday,
      });
    }

    // OWNER 전용
    if (role === 'OWNER') {
      const [
        teamAgentCount,
        monthSaleResult,
        monthRefundResult,
        pendingApprovalCount,
      ] = await Promise.all([
        prisma.organizationMember.count({ where: { organizationId: orgId, role: 'AGENT', isActive: true } }),
        prisma.payAppPayment.aggregate({
          where: { organizationId: orgId, createdAt: { gte: monthStart, lte: monthEnd }, status: 'PAID' },
          _sum: { amount: true },
        }),
        prisma.payAppPayment.aggregate({
          where: { organizationId: orgId, createdAt: { gte: monthStart, lte: monthEnd }, refundAmount: { gt: 0 } },
          _sum: { refundAmount: true },
        }),
        prisma.organization.count({ where: { status: 'PENDING' } }),
      ]);

      return NextResponse.json({
        ok: true,
        role,
        yearMonth,
        teamAgentCount,
        monthSaleAmount: monthSaleResult._sum.amount ?? 0,
        monthRefundAmount: monthRefundResult._sum.refundAmount ?? 0,
        pendingApprovalCount,
        totalContacts,
        newContactsThisMonth,
        callDueToday,
      });
    }

    // FREE_SALES 전용
    if (role === 'FREE_SALES') {
      return NextResponse.json({
        ok: true,
        role,
        yearMonth,
        affiliateCode: null, // 별도 쿼리 없이 null 반환 (UI에서 graceful 처리)
        callDueToday,
        totalContacts,
        newContactsThisMonth,
      });
    }

    // AGENT (기본)
    return NextResponse.json({
      ok: true,
      role,
      yearMonth,
      totalContacts,
      newContactsThisMonth,
      callDueToday,
    });
  } catch (err) {
    console.error('[dashboard] error:', err);
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
