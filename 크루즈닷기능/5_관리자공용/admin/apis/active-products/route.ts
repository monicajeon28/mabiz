export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

const SESSION_COOKIE = 'cg.sid.v2';

/**
 * 판매 활성화된 상품 목록 조회
 * GET /api/admin/apis/active-products
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sid) {
      return NextResponse.json(
        { ok: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { id: true, role: true },
        },
      },
    });

    if (!session?.User || session.User.role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 판매 활성화된 상품 조회
    const products = await prisma.cruiseProduct.findMany({
      where: {
        saleStatus: '판매중',
      },
      select: {
        id: true,
        productCode: true,
        cruiseLine: true,
        shipName: true,
        packageName: true,
        startDate: true,
        endDate: true,
        saleStatus: true,
        _count: {
          select: {
            UserTrip: {
              where: {
                status: {
                  in: ['Upcoming', 'InProgress'],
                },
              },
            },
          },
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    return NextResponse.json({
      ok: true,
      products,
    });
  } catch (error: any) {
    logger.error('[Active Products API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: '상품 목록 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
