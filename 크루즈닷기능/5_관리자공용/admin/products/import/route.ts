export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { syncProductToSupabase } from '@/lib/supabase-backup';

/**
 * POST /api/admin/products/import
 * 외부 API에서 크루즈 상품 수집 (관리자 전용)
 * 
 * 주의: 이 API는 상품만 수집하며, 랜딩페이지는 자동으로 생성하지 않습니다.
 * 랜딩페이지가 필요한 경우 별도로 생성하고 어필리에이트 링크로 연결하세요.
 */

interface ImportSourceConfig {
  name: string;
  url: string;
  enabled: boolean;
  headers?: Record<string, string>;
}

// API 소스 설정
const API_SOURCES: Record<string, ImportSourceConfig> = {
  cruisedot: {
    name: 'CruiseDot',
    url: process.env.CRUISEDOT_API_URL || '',
    enabled: !!process.env.CRUISEDOT_API_URL,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  },
  wcruise: {
    name: 'WCruise',
    url: process.env.WCRUISE_API_URL || '',
    enabled: !!process.env.WCRUISE_API_URL,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }
};

// 국가 코드 매핑
const countryMap: Record<string, { country: string; currency: string; language: string }> = {
  'Busan': { country: 'KR', currency: 'KRW', language: 'ko' },
  'Seoul': { country: 'KR', currency: 'KRW', language: 'ko' },
  'Incheon': { country: 'KR', currency: 'KRW', language: 'ko' },
  'Fukuoka': { country: 'JP', currency: 'JPY', language: 'ja' },
  'Osaka': { country: 'JP', currency: 'JPY', language: 'ja' },
  'Tokyo': { country: 'JP', currency: 'JPY', language: 'ja' },
  'Nagasaki': { country: 'JP', currency: 'JPY', language: 'ja' },
  'Taipei': { country: 'TW', currency: 'TWD', language: 'zh-TW' },
  'Keelung': { country: 'TW', currency: 'TWD', language: 'zh-TW' },
  'Shanghai': { country: 'CN', currency: 'CNY', language: 'zh-CN' },
  'Hong Kong': { country: 'HK', currency: 'HKD', language: 'zh-HK' },
  'Singapore': { country: 'SG', currency: 'SGD', language: 'en' },
};

function transformItinerary(rawItinerary: any[]): any[] {
  if (!Array.isArray(rawItinerary)) return [];

  return rawItinerary.map((item, index) => {
    const location = item.port || item.location || item.city || '';
    const countryInfo = countryMap[location] || {
      country: 'XX',
      currency: 'USD',
      language: 'en'
    };

    // 타입 결정
    let type = item.type || 'PortVisit';
    if (index === 0) type = 'Embarkation';
    if (index === rawItinerary.length - 1) type = 'Disembarkation';
    if (item.atSea || item.cruising || item.seaDay) type = 'Cruising';

    const result: any = {
      day: item.day || index + 1,
      type,
      ...countryInfo,
    };

    // 해상 항해가 아닌 경우에만 위치 추가
    if (type !== 'Cruising' && location) {
      result.location = location;
    }

    // 시간 정보 추가
    if (item.arrival) result.arrival = item.arrival;
    if (item.departure) result.departure = item.departure;
    if (item.time) result.time = item.time;

    return result;
  });
}

function transformCruiseDotData(apiData: any): any {
  return {
    productCode: apiData.id || apiData.code || apiData.productCode || `CRUISE-${Date.now()}`,
    cruiseLine: apiData.cruiseLine || apiData.line || '미정',
    shipName: apiData.ship || apiData.shipName || apiData.vessel || '미정',
    packageName: apiData.title || apiData.name || apiData.packageName || '미정',
    nights: parseInt(apiData.nights) || parseInt(apiData.duration?.nights) || 0,
    days: parseInt(apiData.days) || parseInt(apiData.duration?.days) || 0,
    basePrice: apiData.price ? parseInt(apiData.price) : apiData.basePrice ? parseInt(apiData.basePrice) : null,
    description: apiData.description || apiData.desc || null,
    itineraryPattern: transformItinerary(apiData.ports || apiData.itinerary || apiData.schedule || []),
  };
}

function transformWCruiseData(apiData: any): any {
  return {
    productCode: apiData.productCode || apiData.code || `WCRUISE-${Date.now()}`,
    cruiseLine: apiData.cruiseLine || apiData.line || '미정',
    shipName: apiData.shipName || apiData.ship || '미정',
    packageName: apiData.packageName || apiData.name || apiData.title || '미정',
    nights: parseInt(apiData.nights) || 0,
    days: parseInt(apiData.days) || 0,
    basePrice: apiData.basePrice ? parseInt(apiData.basePrice) : apiData.price ? parseInt(apiData.price) : null,
    description: apiData.description || null,
    itineraryPattern: transformItinerary(apiData.itinerary || apiData.ports || []),
  };
}

async function fetchFromAPI(source: ImportSourceConfig) {
  if (!source.url || source.url === '') {
    return {
      success: false,
      message: `${source.name} API URL이 설정되지 않았습니다. .env 파일에 설정해주세요.`,
      products: []
    };
  }

  try {
    const response = await fetch(source.url, {
      headers: source.headers || {},
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // API 응답이 배열인지 객체인지에 따라 처리
    let products = [];
    if (Array.isArray(data)) {
      products = data;
    } else if (data.products) {
      products = data.products;
    } else if (data.data) {
      products = data.data;
    } else if (data.items) {
      products = data.items;
    } else if (data.list) {
      products = data.list;
    } else {
      // 단일 객체를 배열로 변환
      products = [data];
    }

    return {
      success: true,
      message: `${source.name}에서 ${products.length}개 상품을 가져왔습니다.`,
      products
    };

  } catch (error: any) {
    return {
      success: false,
      message: `${source.name} API 호출 실패: ${error.message}`,
      products: []
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (dbUser?.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    const { source } = await req.json();

    if (!source || !API_SOURCES[source]) {
      return NextResponse.json(
        { ok: false, message: 'Invalid source' },
        { status: 400 }
      );
    }

    const apiSource = API_SOURCES[source];

    if (!apiSource.enabled) {
      return NextResponse.json({
        ok: false,
        message: `${apiSource.name} API가 활성화되어 있지 않습니다. .env 파일에 API URL을 설정해주세요.`
      }, { status: 400 });
    }

    // API에서 데이터 가져오기
    const result = await fetchFromAPI(apiSource);

    if (!result.success) {
      return NextResponse.json({
        ok: false,
        message: result.message
      }, { status: 400 });
    }

    // 데이터 변환
    const transformer = source === 'cruisedot' ? transformCruiseDotData : transformWCruiseData;
    const products = result.products.map(transformer);

    // 데이터베이스에 저장 (배치 조회 + 트랜잭션)
    let savedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      // Step 1: 배치 조회로 존재하는 상품 한 번에 확인 (N+1 제거)
      const productCodes = products.map(p => p.productCode);
      const existingProducts = await prisma.cruiseProduct.findMany({
        where: { productCode: { in: productCodes } },
        select: { productCode: true }
      });

      const existingCodes = new Set(existingProducts.map(p => p.productCode));
      skippedCount = existingCodes.size;

      // Step 2: 새로 생성할 상품만 필터링
      const productsToCreate = products.filter(p => !existingCodes.has(p.productCode));

      if (productsToCreate.length > 0) {
        // Step 3: 트랜잭션으로 배치 생성 (원자성 보장)
        await prisma.$transaction(
          async (tx) => {
            const created = await tx.cruiseProduct.createMany({
              data: productsToCreate.map(p => ({
                ...p,
                source: source,
                updatedAt: new Date(),
              })),
              skipDuplicates: true
            });

            savedCount = created.count;

            // Step 4: 생성된 상품들 Supabase 동기화 (비동기, fire-and-forget)
            for (const product of productsToCreate) {
              syncProductToSupabase(product.productCode).catch((e) =>
                logger.warn('[Products Import] Supabase 동기화 실패', {
                  productCode: product.productCode,
                  error: e?.message
                })
              );
            }
          },
          { timeout: 30000 } // 30초 타임아웃 (대량 데이터용)
        );
      }

    } catch (error: any) {
      errorCount = products.length - skippedCount;
      errors.push(`배치 처리 실패: ${error.message}`);
      logger.error('[Products Import] 배치 트랜잭션 실패:', {
        source,
        totalProducts: products.length,
        error: error.message
      });
    }

    return NextResponse.json({
      ok: true,
      message: `처리 완료: 저장 ${savedCount}개, 건너뜀 ${skippedCount}개, 실패 ${errorCount}개`,
      result: {
        source: apiSource.name,
        total: products.length,
        saved: savedCount,
        skipped: skippedCount,
        errors: errorCount,
        errorDetails: errors
      }
    });

  } catch (error: any) {
    logger.error('POST /api/admin/products/import error:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/products/import
 * 사용 가능한 API 소스 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (dbUser?.role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    const sources = Object.entries(API_SOURCES).map(([key, source]) => ({
      key,
      name: source.name,
      enabled: source.enabled,
      configured: !!source.url && source.url !== ''
    }));

    return NextResponse.json({ ok: true, sources });

  } catch (error) {
    logger.error('GET /api/admin/products/import error:', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
