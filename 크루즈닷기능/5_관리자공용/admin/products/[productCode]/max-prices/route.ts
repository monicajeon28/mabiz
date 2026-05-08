// app/api/admin/products/[productCode]/max-prices/route.ts
// 상품 최고가 관리 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ productCode: string }>;
}

// 최고가 목록 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productCode } = await params;

    // 상품 확인
    const product = await prisma.cruiseProduct.findUnique({
      where: { productCode },
      select: { id: true, productCode: true, packageName: true, maxPrice: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 객실별 최고가 조회
    const maxPrices = await prisma.productMaxPrice.findMany({
      where: { cruiseProductId: product.id },
      orderBy: { cabinType: 'asc' },
    });

    return NextResponse.json({
      product,
      maxPrices,
    });
  } catch (error: any) {
    logger.error('[Max Prices GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 최고가 설정/업데이트
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productCode } = await params;
    const body = await request.json();
    const { maxPrices } = body;

    if (!Array.isArray(maxPrices)) {
      return NextResponse.json(
        { error: 'maxPrices must be an array' },
        { status: 400 }
      );
    }

    // 상품 확인
    const product = await prisma.cruiseProduct.findUnique({
      where: { productCode },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 최고가 업데이트/생성
    const results = [];
    for (const mp of maxPrices) {
      if (!mp.cabinType || typeof mp.maxPrice !== 'number') {
        continue;
      }

      const result = await prisma.productMaxPrice.upsert({
        where: {
          cruiseProductId_cabinType: {
            cruiseProductId: product.id,
            cabinType: mp.cabinType,
          },
        },
        create: {
          cruiseProductId: product.id,
          cabinType: mp.cabinType,
          maxPrice: mp.maxPrice,
        },
        update: {
          maxPrice: mp.maxPrice,
        },
      });
      results.push(result);
    }

    // 대표 최고가 업데이트 (첫 번째 객실 기준)
    if (results.length > 0) {
      const mainMaxPrice = results[0].maxPrice;
      await prisma.cruiseProduct.update({
        where: { id: product.id },
        data: { maxPrice: mainMaxPrice },
      });
    }

    return NextResponse.json({ maxPrices: results });
  } catch (error: any) {
    logger.error('[Max Prices POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 최고가 전체 교체 (PUT)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productCode } = await params;
    const body = await request.json();
    const { maxPrices } = body;

    if (!Array.isArray(maxPrices)) {
      return NextResponse.json(
        { error: 'maxPrices must be an array' },
        { status: 400 }
      );
    }

    // 상품 확인
    const product = await prisma.cruiseProduct.findUnique({
      where: { productCode },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 기존 최고가 삭제
    await prisma.productMaxPrice.deleteMany({
      where: { cruiseProductId: product.id },
    });

    // 새 최고가 생성
    const results = [];
    for (const mp of maxPrices) {
      if (!mp.cabinType || typeof mp.maxPrice !== 'number') {
        continue;
      }

      const result = await prisma.productMaxPrice.create({
        data: {
          cruiseProductId: product.id,
          cabinType: mp.cabinType,
          maxPrice: mp.maxPrice,
        },
      });
      results.push(result);
    }

    // 대표 최고가 업데이트
    const mainMaxPrice = results.length > 0 ? results[0].maxPrice : null;
    await prisma.cruiseProduct.update({
      where: { id: product.id },
      data: { maxPrice: mainMaxPrice },
    });

    return NextResponse.json({ maxPrices: results });
  } catch (error: any) {
    logger.error('[Max Prices PUT] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
