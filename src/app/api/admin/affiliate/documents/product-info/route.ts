export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 상품 데이터 기반으로 포함/불포함 내역 + 인솔자 유무 자동 도출
function deriveContractItems(product: {
  isJapan: boolean;
  isDomestic: boolean;
  tourType: string;
  airlineName: string | null;
  itineraryPattern: unknown;
}) {
  const includedItems: string[] = [
    '선박/항공기 운임',
    '숙박/식사료',
    '항만세·관광기금',
    '제세금',
    '여행알선수수료',
    '유류할증료',
    '관광지 입장료',
    '여행보험료',
  ];

  // FREE(자유여행)가 아니면 인솔자 포함
  const hasGuide = product.tourType !== 'FREE';
  if (hasGuide) includedItems.push('안내자경비');

  // 항공 연계 상품이면 항공기 운임 별도 표기
  if (product.airlineName) includedItems.push('항공기 추가 운임');

  const excludedItems: string[] = ['선상팁', '쇼핑비', '선택관광'];

  // 일본 기항지 포함 시 관광 입국세 불포함 표기
  if (product.isJapan) excludedItems.push('일본 관광 입국세');

  // 국내 크루즈가 아닌 경우 여권 관련 안내
  if (!product.isDomestic) excludedItems.push('여권·비자 개인 부담');

  return {
    includedItems,
    excludedItems,
    hasGuide: (hasGuide ? 'Y' : 'N') as 'Y' | 'N',
  };
}

// GET /api/admin/affiliate/documents/product-info?productCode=XXXX
export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const productCode = searchParams.get('productCode')?.toUpperCase();
    if (!productCode) {
      return NextResponse.json({ ok: false, error: '상품 코드가 필요합니다' }, { status: 400 });
    }

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
        // 자동화에 필요한 추가 필드
        isJapan: true,
        isDomestic: true,
        tourType: true,
        airlineName: true,
        tags: true,
      },
    });

    if (!product) {
      return NextResponse.json({ ok: false, error: '상품을 찾을 수 없습니다' }, { status: 404 });
    }

    const contentRow = await prisma.mallProductContent
      .findUnique({
        where: { productCode: product.productCode },
        select: { thumbnail: true, images: true },
      })
      .catch(() => null);

    // 상품 데이터 기반 포함/불포함/인솔자 자동 도출
    const derived = deriveContractItems({
      isJapan: product.isJapan ?? false,
      isDomestic: product.isDomestic ?? false,
      tourType: product.tourType ?? 'FREE',
      airlineName: product.airlineName ?? null,
      itineraryPattern: product.itineraryPattern,
    });

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
        // 자동 도출 항목 (ComparisonQuoteTab, ContractTab에서 직접 사용)
        includedItems: derived.includedItems,
        excludedItems: derived.excludedItems,
        hasGuide: derived.hasGuide,
        // 원시 필드도 노출 (프론트에서 추가 로직 필요 시)
        isJapan: product.isJapan ?? false,
        isDomestic: product.isDomestic ?? false,
        tourType: product.tourType ?? 'FREE',
        airlineName: product.airlineName ?? null,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '상품 정보 조회 중 오류가 발생했습니다';
    console.error('[Product Info API] Error:', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
