export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 여권 요청 관리 API (자신의 개인몰 고객만 조회)

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/lib/passport-auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) {
      return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
    }
    const { profile } = ctx;
    const { searchParams } = new URL(req.url);
    const mallUserId = searchParams.get('mallUserId');
    const query = searchParams.get('q')?.trim() || '';

    if (!mallUserId) {
      return NextResponse.json({ ok: false, message: 'mallUserId가 필요합니다.' }, { status: 400 });
    }

    // 자신의 개인몰에 유입된 고객만 조회
    const where: Record<string, unknown> = {
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
            { metadata: { path: ['affiliate_mall_user_id'], equals: mallUserId } },
          ],
        },
      ],
    };

    // 검색어가 있으면 추가 필터링
    if (query) {
      (where.AND as Record<string, unknown>[]).push({
        OR: [
          { customerName: { contains: query, mode: 'insensitive' } },
          { customerPhone: { contains: query } },
        ],
      });
    }

    const customers = await prisma.gmAffiliateLead.findMany({
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
    logger.error('GET /api/passport/partner/requests error:', error as Record<string, unknown>);
    return NextResponse.json({ ok: false, message: '고객 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
