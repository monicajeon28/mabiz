export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';

/**
 * GET /api/partner/dashboard/b2b/detail?type=leads|registrations|payments&month=2026-05&page=1
 * B2B 드릴다운: 전체 리드 / 랜딩 등록자 / 전체 결제 (페이징)
 */
export async function GET(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') ?? 'leads';
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

    if (type === 'leads') {
      const [rows, total] = await Promise.all([
        prisma.b2BProspect.findMany({
          where: { ...orgFilter, createdAt: { gte: startDate, lt: endDate } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.b2BProspect.count({
          where: { ...orgFilter, createdAt: { gte: startDate, lt: endDate } },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        data: {
          items: rows.map((l) => ({
            id: l.id,
            name: l.name,
            phone: l.phone ? l.phone.slice(0, 3) + '-****-' + l.phone.slice(-4) : '-',
            interestedPackage: l.packageInterest ?? '-',
            source: l.source ?? '-',
            status: l.status ?? 'NEW',
            date: l.createdAt.toISOString().slice(0, 10),
          })),
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    if (type === 'registrations') {
      const landingOrgFilter = isAdmin ? {} : { organizationId: ctx.organizationId! };
      const [rows, total] = await Promise.all([
        prisma.crmLandingRegistration.findMany({
          where: {
            createdAt: { gte: startDate, lt: endDate },
            landingPage: landingOrgFilter,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { landingPage: { select: { title: true } } },
        }),
        prisma.crmLandingRegistration.count({
          where: {
            createdAt: { gte: startDate, lt: endDate },
            landingPage: landingOrgFilter,
          },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        data: {
          items: rows.map((r) => ({
            id: r.id,
            name: r.name,
            phone: r.phone ? r.phone.slice(0, 3) + '-****-' + r.phone.slice(-4) : '-',
            landingPageTitle: r.landingPage?.title ?? '-',
            utmSource: r.utmSource ?? '-',
            date: r.createdAt.toISOString().slice(0, 10),
          })),
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    if (type === 'payments') {
      const payOrgFilter = isAdmin ? {} : { organizationId: ctx.organizationId! };
      const [rows, total] = await Promise.all([
        prisma.payAppPayment.findMany({
          where: { ...payOrgFilter, status: 'paid', paidAt: { gte: startDate, lt: endDate } },
          orderBy: { paidAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.payAppPayment.count({
          where: { ...payOrgFilter, status: 'paid', paidAt: { gte: startDate, lt: endDate } },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        data: {
          items: rows.map((p) => ({
            id: p.id,
            productName: p.productName ?? '-',
            amount: p.amount,
            status: p.status,
            customerPhone: p.customerPhone ? p.customerPhone.slice(0, 3) + '-****-' + p.customerPhone.slice(-4) : '-',
            date: p.paidAt?.toISOString().slice(0, 10) ?? '-',
          })),
          total,
          page,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    return NextResponse.json({ ok: false, error: '유효하지 않은 type' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
