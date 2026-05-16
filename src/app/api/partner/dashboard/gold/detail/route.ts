export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';

/**
 * GET /api/partner/dashboard/gold/detail?type=members|consultations|payment-breakdown&month=2026-05&page=1
 * 골드 드릴다운: 전체 회원 / 전체 상담 / 납부 분류 (페이징)
 */
export async function GET(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') ?? 'members';
    const monthParam = searchParams.get('month');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1);
    const limit = 30;

    const now = new Date();
    const [year, month] = monthParam
      ? monthParam.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const isAdmin = ctx.sessionUser.role === 'admin';
    const orgFilter = isAdmin ? {} : { organizationId: ctx.organizationId! };

    if (type === 'members') {
      const [rows, total] = await Promise.all([
        prisma.goldMember.findMany({
          where: { ...orgFilter, status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.goldMember.count({ where: { ...orgFilter, status: 'ACTIVE' } }),
      ]);

      return NextResponse.json({
        ok: true,
        data: {
          items: rows.map((m) => ({
            id: m.id,
            name: m.name,
            phone: m.phone ? m.phone.slice(0, 3) + '-****-' + m.phone.slice(-4) : '-',
            courseType: m.courseType,
            paidCount: m.paidCount,
            totalPayments: m.totalPayments,
            status: m.status,
            joinDate: m.joinDate.toISOString().slice(0, 10),
          })),
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    if (type === 'consultations') {
      const consultOrgFilter = isAdmin ? {} : { organizationId: ctx.organizationId! };
      const [rows, total] = await Promise.all([
        prisma.goldMemberConsultation.findMany({
          where: {
            createdAt: { gte: startDate, lt: endDate },
            goldMember: consultOrgFilter,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { goldMember: { select: { name: true, memberCode: true } } },
        }),
        prisma.goldMemberConsultation.count({
          where: {
            createdAt: { gte: startDate, lt: endDate },
            goldMember: consultOrgFilter,
          },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        data: {
          items: rows.map((c) => ({
            id: c.id,
            memberName: c.goldMember.name,
            memberCode: c.goldMember.memberCode,
            content: c.content,
            authorId: c.authorId,
            date: c.createdAt.toISOString().slice(0, 10),
          })),
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    if (type === 'payment-breakdown') {
      // 납부 완료/진행 중/건강코스 분류
      const allActive = await prisma.goldMember.findMany({
        where: { ...orgFilter, status: 'ACTIVE' },
        select: { id: true, name: true, courseType: true, paidCount: true, totalPayments: true },
        orderBy: { createdAt: 'desc' },
      });

      const completed = allActive.filter((m) => m.totalPayments > 0 && m.paidCount >= m.totalPayments);
      const inProgress = allActive.filter((m) => m.totalPayments > 0 && m.paidCount < m.totalPayments);
      const healthCourse = allActive.filter((m) => m.courseType === 'HEALTH');

      return NextResponse.json({
        ok: true,
        data: {
          total: allActive.length,
          page: 1,
          totalPages: 1,
          summary: {
            completedCount: completed.length,
            inProgressCount: inProgress.length,
            healthCourseCount: healthCourse.length,
            totalActive: allActive.length,
          },
          items: allActive.map((m) => ({
            id: m.id,
            name: m.name,
            courseType: m.courseType,
            paidCount: m.paidCount,
            totalPayments: m.totalPayments,
            category: m.courseType === 'HEALTH'
              ? 'health'
              : m.totalPayments > 0 && m.paidCount >= m.totalPayments
                ? 'completed'
                : 'inProgress',
          })),
        },
      });
    }

    return NextResponse.json({ ok: false, error: '유효하지 않은 type' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
