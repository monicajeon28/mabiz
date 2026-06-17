import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // OWNER·GLOBAL_ADMIN만 판매 승인 대기 목록 조회 허용
    if (session.role !== 'OWNER' && session.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const offset = (page - 1) * limit;

    let where: any = { organizationId: session.organizationId };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { productName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { affiliateCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.affiliateSale.findMany({
        where,
        select: {
          id: true,
          organizationId: true,
          affiliateCode: true,
          affiliateUserId: true,
          productName: true,
          saleAmount: true,
          commissionAmount: true,
          status: true,
          customerPhone: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.affiliateSale.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      data: data.map((d: any) => ({
        ...d,
        agentDisplayName: d.affiliateUserId ? `파트너_${d.affiliateUserId.slice(0, 8)}` : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    logger.error('[sales-confirmation GET] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
