// app/api/admin/products/[productCode]/price-periods/route.ts
// 기간별 가격 관리 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/auth';
import { syncCommissionTiers } from '@/lib/pricing-utils';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ productCode: string }>;
}

// 기간별 가격 목록 조회
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

    // 기간별 가격 조회
    const periods = await prisma.productPricePeriod.findMany({
      where: { cruiseProductId: product.id },
      include: {
        ProductCabinPrice: {
          orderBy: [
            { cabinType: 'asc' },
            { fareCategory: 'asc' },
          ],
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // 최고가 목록 조회
    const maxPrices = await prisma.productMaxPrice.findMany({
      where: { cruiseProductId: product.id },
      orderBy: { cabinType: 'asc' },
    });

    return NextResponse.json({
      product,
      periods,
      maxPrices,
    });
  } catch (error: any) {
    logger.error('[Price Periods GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 새 가격 기간 생성
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productCode } = await params;
    const body = await request.json();
    const { name, startDate, endDate, cabinPrices, maxPrices } = body;

    // 상품 확인
    const product = await prisma.cruiseProduct.findUnique({
      where: { productCode },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 기간 중복 검사
    const overlapping = await prisma.productPricePeriod.findFirst({
      where: {
        cruiseProductId: product.id,
        isActive: true,
        OR: [
          {
            startDate: { lte: new Date(endDate) },
            endDate: { gte: new Date(startDate) },
          },
        ],
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { error: '해당 기간에 이미 가격이 설정되어 있습니다.' },
        { status: 400 }
      );
    }

    // 기간 생성
    const period = await prisma.productPricePeriod.create({
      data: {
        cruiseProductId: product.id,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: true,
      },
    });

    // 객실 가격 생성
    if (cabinPrices && Array.isArray(cabinPrices)) {
      for (const price of cabinPrices) {
        const netRevenue = price.saleAmount - price.costAmount;
        await prisma.productCabinPrice.create({
          data: {
            productPricePeriodId: period.id,
            cabinType: price.cabinType,
            fareCategory: price.fareCategory,
            fareLabel: price.fareLabel || null,
            saleAmount: price.saleAmount,
            costAmount: price.costAmount,
            netRevenue,
          },
        });
      }
    }

    // 최고가 업데이트
    if (maxPrices && Array.isArray(maxPrices)) {
      for (const mp of maxPrices) {
        await prisma.productMaxPrice.upsert({
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
      }

      // 대표 최고가 업데이트 (첫 번째 객실 기준)
      const firstMaxPrice = maxPrices[0];
      if (firstMaxPrice) {
        await prisma.cruiseProduct.update({
          where: { id: product.id },
          data: { maxPrice: firstMaxPrice.maxPrice },
        });
      }
    }

    // 수당 테이블 동기화 (현재 기간인 경우)
    const now = new Date();
    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);
    if (now >= periodStart && now <= periodEnd) {
      logger.log('[Price Periods] Syncing commission tiers for current period...');
      const syncResult = await syncCommissionTiers(product.id, period.id);
      logger.log('[Price Periods] Commission sync result:', syncResult);
    }

    // 생성된 기간 조회
    const createdPeriod = await prisma.productPricePeriod.findUnique({
      where: { id: period.id },
      include: {
        ProductCabinPrice: true,
      },
    });

    return NextResponse.json({ period: createdPeriod }, { status: 201 });
  } catch (error: any) {
    logger.error('[Price Periods POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
