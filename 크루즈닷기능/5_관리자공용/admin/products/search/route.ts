export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET: 상품 검색 (상품명 + 크루즈명)
 * 관리자 온보딩용
 * - q 파라미터가 없거나 2자 미만이면 모든 상품 반환 (최대 100개)
 * - q 파라미터가 있으면 검색어로 필터링
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q') || '';

    // 모든 상품 조회 (관리자용이므로 판매 상태와 관계없이 모두 조회)
    const allProducts = await prisma.cruiseProduct.findMany({
      select: {
        id: true,
        productCode: true,
        cruiseLine: true,
        shipName: true,
        packageName: true,
        nights: true,
        days: true,
        itineraryPattern: true,
        startDate: true,
        endDate: true,
        isPopular: true,
        isRecommended: true,
        saleStatus: true,
      },
      orderBy: [
        { isPopular: 'desc' },
        { isRecommended: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 200, // 최대 200개까지 조회
    });

    // 검색어가 없거나 2자 미만이면 모든 상품 반환 (최대 100개)
    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        ok: true,
        products: allProducts.slice(0, 100).map(product => ({
          id: product.id,
          productCode: product.productCode,
          cruiseLine: product.cruiseLine,
          shipName: product.shipName,
          packageName: product.packageName,
          nights: product.nights,
          days: product.days,
          itineraryPattern: product.itineraryPattern,
          startDate: product.startDate,
          endDate: product.endDate,
          isPopular: product.isPopular,
          isRecommended: product.isRecommended,
          saleStatus: product.saleStatus,
          // 표시용 라벨
          displayLabel: `${product.packageName} (${product.cruiseLine} ${product.shipName})`,
        })),
      });
    }

    // 검색어로 필터링 (상품명 + 크루즈명 + 상품코드)
    const searchTerm = query.toLowerCase().trim();
    const filteredProducts = allProducts.filter(product => {
      const packageName = (product.packageName || '').toLowerCase();
      const cruiseLine = (product.cruiseLine || '').toLowerCase();
      const shipName = (product.shipName || '').toLowerCase();
      const productCode = (product.productCode || '').toLowerCase();
      
      return (
        packageName.includes(searchTerm) ||
        cruiseLine.includes(searchTerm) ||
        shipName.includes(searchTerm) ||
        productCode.includes(searchTerm) ||
        `${cruiseLine} ${shipName}`.includes(searchTerm) ||
        `${packageName} ${cruiseLine}`.includes(searchTerm) ||
        `${packageName} ${shipName}`.includes(searchTerm)
      );
    }).slice(0, 50); // 검색 결과는 최대 50개만 반환

    return NextResponse.json({
      ok: true,
      products: filteredProducts.map(product => ({
        id: product.id,
        productCode: product.productCode,
        cruiseLine: product.cruiseLine,
        shipName: product.shipName,
        packageName: product.packageName,
        nights: product.nights,
        days: product.days,
        itineraryPattern: product.itineraryPattern,
        startDate: product.startDate,
        endDate: product.endDate,
        isPopular: product.isPopular,
        isRecommended: product.isRecommended,
        saleStatus: product.saleStatus,
        // 표시용 라벨
        displayLabel: `${product.packageName} (${product.cruiseLine} ${product.shipName})`,
      })),
    });
  } catch (error: any) {
    logger.error('[Product Search API] Error:', error);
    return NextResponse.json(
      { ok: false, error: '상품 검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
