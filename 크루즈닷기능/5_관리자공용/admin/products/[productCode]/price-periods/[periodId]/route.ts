// app/api/admin/products/[productCode]/price-periods/[periodId]/route.ts
// 개별 가격 기간 관리 API (조회/수정/삭제)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/auth';
import { syncCommissionTiers } from '@/lib/pricing-utils';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ productCode: string; periodId: string }>;
}

// 특정 기간 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productCode, periodId } = await params;

    const period = await prisma.productPricePeriod.findFirst({
      where: {
        id: parseInt(periodId),
        CruiseProduct: { productCode },
      },
      include: {
        ProductCabinPrice: {
          orderBy: [
            { cabinType: 'asc' },
            { fareCategory: 'asc' },
          ],
        },
        CruiseProduct: {
          select: {
            id: true,
            productCode: true,
            packageName: true,
            maxPrice: true,
          },
        },
      },
    });

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    return NextResponse.json({ period });
  } catch (error: any) {
    logger.error('[Price Period GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 기간 수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productCode, periodId } = await params;
    const body = await request.json();
    const { name, startDate, endDate, isActive, cabinPrices } = body;

    // 기간 확인
    const existingPeriod = await prisma.productPricePeriod.findFirst({
      where: {
        id: parseInt(periodId),
        CruiseProduct: { productCode },
      },
      include: {
        CruiseProduct: { select: { id: true } },
      },
    });

    if (!existingPeriod) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // 기간 중복 검사 (자기 자신 제외)
    if (startDate && endDate) {
      const overlapping = await prisma.productPricePeriod.findFirst({
        where: {
          cruiseProductId: existingPeriod.cruiseProductId,
          id: { not: existingPeriod.id },
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
          { error: '해당 기간에 이미 다른 가격이 설정되어 있습니다.' },
          { status: 400 }
        );
      }
    }

    // 기간 업데이트
    const updatedPeriod = await prisma.productPricePeriod.update({
      where: { id: existingPeriod.id },
      data: {
        ...(name && { name }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(typeof isActive === 'boolean' && { isActive }),
      },
    });

    // 객실 가격 업데이트
    if (cabinPrices && Array.isArray(cabinPrices)) {
      // 기존 가격 삭제
      await prisma.productCabinPrice.deleteMany({
        where: { productPricePeriodId: existingPeriod.id },
      });

      // 새 가격 생성
      for (const price of cabinPrices) {
        const netRevenue = price.saleAmount - price.costAmount;
        await prisma.productCabinPrice.create({
          data: {
            productPricePeriodId: existingPeriod.id,
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

    // 수당 테이블 동기화 (현재 기간인 경우)
    const now = new Date();
    const periodStart = startDate ? new Date(startDate) : updatedPeriod.startDate;
    const periodEnd = endDate ? new Date(endDate) : updatedPeriod.endDate;
    if (now >= periodStart && now <= periodEnd && cabinPrices?.length > 0) {
      logger.log('[Price Period PUT] Syncing commission tiers for updated period...');
      const syncResult = await syncCommissionTiers(existingPeriod.cruiseProductId, existingPeriod.id);
      logger.log('[Price Period PUT] Commission sync result:', syncResult);
    }

    // 업데이트된 기간 조회
    const result = await prisma.productPricePeriod.findUnique({
      where: { id: existingPeriod.id },
      include: {
        ProductCabinPrice: true,
      },
    });

    return NextResponse.json({ period: result });
  } catch (error: any) {
    logger.error('[Price Period PUT] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 기간 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productCode, periodId } = await params;

    // 기간 확인
    const period = await prisma.productPricePeriod.findFirst({
      where: {
        id: parseInt(periodId),
        CruiseProduct: { productCode },
      },
    });

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // 삭제 (cascade로 ProductCabinPrice도 함께 삭제됨)
    await prisma.productPricePeriod.delete({
      where: { id: period.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('[Price Period DELETE] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
