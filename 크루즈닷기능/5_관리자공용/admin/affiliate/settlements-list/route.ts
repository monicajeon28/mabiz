export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 관리자 또는 파트너 접근 허용
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'admin';

    // 파트너인 경우 파트너 프로필이 있는지 확인
    if (!isAdmin) {
      const partnerProfile = await prisma.affiliateProfile.findFirst({
        where: { userId: sessionUser.id },
        select: { id: true },
      });

      if (!partnerProfile) {
        return NextResponse.json({ ok: false, message: '파트너 프로필이 필요합니다.' }, { status: 403 });
      }
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const settlements = await prisma.monthlySettlement.findMany({
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const formattedSettlements = settlements.map((settlement) => ({
      id: settlement.id,
      periodStart: settlement.periodStart.toISOString(),
      periodEnd: settlement.periodEnd.toISOString(),
      status: settlement.status,
      paymentDate: settlement.paymentDate?.toISOString() || null,
      approvedAt: settlement.approvedAt?.toISOString() || null,
      approvedBy: settlement.User
        ? {
            id: settlement.User.id,
            name: settlement.User.name,
            email: settlement.User.email,
          }
        : null,
    }));

    return NextResponse.json({
      ok: true,
      settlements: formattedSettlements,
    });
  } catch (error: any) {
    console.error('GET /api/admin/affiliate/settlements-list error:', error);
    console.error('Error details:', error?.message, error?.code, error?.meta);
    return NextResponse.json(
      { 
        ok: false, 
        message: '정산 목록을 불러오지 못했습니다.',
        error: error?.message || String(error),
        ...(process.env.NODE_ENV === 'development' ? { details: error } : {})
      },
      { status: 500 }
    );
  }
}
