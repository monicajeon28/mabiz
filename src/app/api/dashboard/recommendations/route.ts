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

    // 세그먼트별 고객 수 집계
    const contactsBySegment = await prisma.contact.groupBy({
      by: ['segment'],
      where: {
        organizationId: orgId,
        deletedAt: null,
        segment: { in: ['A', 'B', 'C', 'D', 'E'] },
      },
      _count: { _all: true },
    });

    // 세그먼트별 구매 완료 고객 수
    const purchasedBySegment = await prisma.contact.groupBy({
      by: ['segment'],
      where: {
        organizationId: orgId,
        deletedAt: null,
        segment: { in: ['A', 'B', 'C', 'D', 'E'] },
        lastPaymentStatus: 'PAID',
      },
      _count: { _all: true },
    });

    const purchasedMap: Record<string, number> = {};
    for (const row of purchasedBySegment) {
      if (row.segment) purchasedMap[row.segment] = row._count._all;
    }

    const segment_distribution: Record<string, number> = {};
    const conversion_rates: Record<string, number> = {};

    for (const row of contactsBySegment) {
      if (!row.segment) continue;
      const total = row._count._all;
      const purchased = purchasedMap[row.segment] ?? 0;
      segment_distribution[row.segment] = total;
      conversion_rates[row.segment] = total > 0 ? purchased / total : 0;
    }

    // 상위 추천 상품 (recommendedProduct 필드 집계)
    const topProductsRaw = await prisma.contact.groupBy({
      by: ['recommendedProduct'],
      where: {
        organizationId: orgId,
        deletedAt: null,
        recommendedProduct: { not: null },
      },
      _count: { recommendedProduct: true },
      orderBy: { _count: { recommendedProduct: 'desc' } },
      take: 5,
    });

    const top_products = topProductsRaw
      .filter((r) => r.recommendedProduct)
      .map((r) => ({
        name: r.recommendedProduct as string,
        count: (r._count as { recommendedProduct: number }).recommendedProduct,
      }));

    return NextResponse.json({
      ok: true,
      segment_distribution,
      conversion_rates,
      top_products,
    });
  } catch (err) {
    console.error('[dashboard/recommendations] error:', err);
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
