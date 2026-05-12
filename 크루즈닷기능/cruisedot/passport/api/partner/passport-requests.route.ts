export const dynamic = 'force-dynamic';

// app/api/partner/passport-requests/route.ts
// 여권 요청 관리 API (자신의 개인몰 고객만 조회)

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { profile } = await requirePartnerContext();
    const { searchParams } = new URL(req.url);
    const mallUserId = searchParams.get('mallUserId');
    const query = searchParams.get('q')?.trim() || '';

    if (!mallUserId) {
      return NextResponse.json({ ok: false, message: 'mallUserId가 필요합니다.' }, { status: 400 });
    }

    // 자신의 개인몰에 유입된 고객만 조회
    // source에 mallUserId가 포함되거나, metadata에 mallUserId가 있는 경우
    const where: any = {
      AND: [
        {
          OR: [
            { managerId: profile.id },
            { agentId: profile.id },
          ],
        },
        {
          OR: [
            { source: { contains: `mall-${mallUserId}` } },
            { metadata: { path: ['mallUserId'], equals: mallUserId } },
            // 또는 쿠키 추적으로 생성된 고객 (metadata에 affiliate_mall_user_id가 있는 경우)
            { metadata: { path: ['affiliate_mall_user_id'], equals: mallUserId } },
          ],
        },
      ],
    };

    // 검색어가 있으면 추가 필터링
    if (query) {
      where.AND = [
        {
          OR: [
            { customerName: { contains: query, mode: 'insensitive' } },
            { customerPhone: { contains: query } },
          ],
        },
      ];
    }

    const customers = await prisma.affiliateLead.findMany({
      where,
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        status: true,
        passportRequestedAt: true,
        passportCompletedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      customers,
    });
  } catch (error) {
    console.error('GET /api/partner/passport-requests error:', error);
    return NextResponse.json({ ok: false, message: '고객 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
