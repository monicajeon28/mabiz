export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseLayoutPricing } from '../shared';

export async function GET() {
  try {
    const products = await prisma.cruiseProduct.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        MallProductContent: {
          select: { layout: true }
        }
      }
    });

    const result = products.map((product) => {
      const layout = product.MallProductContent?.layout;
      const pricingMatrix = parseLayoutPricing(layout);
      return {
        cruiseProductId: product.id,
        productCode: product.productCode,
        packageName: product.packageName,
        cruiseLine: product.cruiseLine,
        saleStatus: product.saleStatus,
        pricingMatrix,
      };
    });

    return NextResponse.json({ ok: true, products: result });
  } catch (error) {
    console.error('[admin/affiliate/products/sources][GET] error', error);
    return NextResponse.json({ ok: false, error: '상품 목록을 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
