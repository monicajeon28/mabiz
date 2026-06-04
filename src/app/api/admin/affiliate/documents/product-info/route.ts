export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/documents/product-info/route.ts
// 상품 정보 조회 API (비교견적서용)

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/affiliate/documents/product-info?productCode=XXXX
export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: '로그인이 필요합니다' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const productCode = searchParams.get('productCode')?.toUpperCase();

    if (!productCode) {
      return NextResponse.json(
        { ok: false, error: '상품 코드가 필요합니다' },
        { status: 400 },
      );
    }

    // 크루즈 상품 정보 조회
    const product = await prisma.cruiseProduct.findUnique({
      where: { productCode },
      select: {
        id: true,
        productCode: true,
        cruiseLine: true,
        shipName: true,
        packageName: true,
        nights: true,
        days: true,
        basePrice: true,
        description: true,
        startDate: true,
        endDate: true,
        itineraryPattern: true,
        isActive: true,
        saleStatus: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다' },
        { status: 404 },
      );
    }

    // MallProductContent는 CruiseProduct와 별도 모델 (productCode 기준 조회)
    const contentRow = await prisma.mallProductContent
      .findUnique({
        where: { productCode: product.productCode },
        select: { thumbnail: true, images: true },
      })
      .catch(() => null); // 없으면 null 반환

    const productName = `${product.cruiseLine} ${product.shipName} - ${product.packageName}`;

    return NextResponse.json({
      ok: true,
      product: {
        productCode: product.productCode,
        productName,
        cruiseLine: product.cruiseLine,
        shipName: product.shipName,
        packageName: product.packageName,
        nights: product.nights,
        days: product.days,
        basePrice: product.basePrice,
        description: product.description,
        startDate: product.startDate,
        endDate: product.endDate,
        itineraryPattern: product.itineraryPattern,
        isActive: product.isActive,
        saleStatus: product.saleStatus,
        thumbnail: contentRow?.thumbnail ?? null,
        images: contentRow?.images ?? null,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : '상품 정보 조회 중 오류가 발생했습니다';
    console.error('[Product Info API] Error:', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
