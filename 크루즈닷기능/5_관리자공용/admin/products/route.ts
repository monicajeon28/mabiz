export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { backupProductImages } from '@/lib/google-drive-product-backup';
import { parseRefundPolicyText } from '@/lib/mall/refund-calculator';
import { logger } from '@/lib/logger';
import { syncProductToSupabase } from '@/lib/supabase-backup';
import { validateCsrfToken } from '@/lib/csrf';
import { createProductSchema, updateProductSchema } from '@/lib/schemas/productSchema';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인
async function checkAdminAuth(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    return session?.User.role === 'admin';
  } catch (error) {
    logger.error('[Admin Products] Auth check error:', error);
    return false;
  }
}

/**
 * GET /api/admin/products
 * 크루즈 상품 목록 조회 (관리자 전용)
 * 쿼리 파라미터: page, pageSize, search, saleStatus, cruiseLine
 */
export async function GET(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const rawPageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const pageSize = Math.min(200, Math.max(1, isNaN(rawPageSize) ? 50 : rawPageSize));
    const search = searchParams.get('search')?.trim() || '';
    const saleStatusParam = searchParams.get('saleStatus') || '';
    const cruiseLineParam = searchParams.get('cruiseLine') || '';

    // 기본 where 조건: 소프트 삭제된 상품 제외
    const where: any = { deletedAt: null };

    if (saleStatusParam && saleStatusParam !== 'all') {
      if (saleStatusParam === '3일체험') {
        where.isGeniePack = true;
      } else {
        where.saleStatus = saleStatusParam;
      }
    }

    if (cruiseLineParam && cruiseLineParam !== 'all') {
      where.cruiseLine = { contains: cruiseLineParam, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { productCode: { contains: search, mode: 'insensitive' } },
        { packageName: { contains: search, mode: 'insensitive' } },
        { cruiseLine: { contains: search, mode: 'insensitive' } },
        { shipName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * pageSize;

    const [products, total] = await Promise.all([
      prisma.cruiseProduct.findMany({
        where,
        select: {
          id: true,
          productCode: true,
          cruiseLine: true,
          shipName: true,
          packageName: true,
          nights: true,
          days: true,
          itineraryPattern: true,
          basePrice: true,
          description: true,
          source: true,
          category: true,
          tags: true,
          isPopular: true,
          isRecommended: true,
          isPremium: true,
          isGeniePack: true,
          isDomestic: true,
          isJapan: true,
          isBudget: true,
          isUrgent: true,
          isMainProduct: true,
          saleStatus: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
          MallProductContent: {
            select: {
              thumbnail: true,
              layout: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.cruiseProduct.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      products,
      total,
      totalPages: Math.ceil(total / pageSize),
      page,
      pageSize,
    });
  } catch (error) {
    logger.error('[GET /api/admin/products] Error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        ok: false,
        message: 'Server error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/products
 * 새 크루즈 상품 등록
 *
 * 주의: 이 API는 상품만 생성하며, 랜딩페이지는 자동으로 생성하지 않습니다.
 * 랜딩페이지가 필요한 경우:
 * 1. 별도로 랜딩페이지를 생성하세요 (/api/admin/landing-pages 또는 /api/partner/landing-pages)
 * 2. 어필리에이트 링크를 생성할 때 metadata.landingPageId로 상품과 연결하세요
 */
export async function POST(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    // CSRF 토큰 검증
    const csrfSessionToken = cookieStore.get('csrf-token')?.value;
    const csrfRequestToken = req.headers.get('X-CSRF-Token');
    if (!validateCsrfToken(csrfSessionToken, csrfRequestToken)) {
      return NextResponse.json({ ok: false, message: 'CSRF token validation failed' }, { status: 403 });
    }

    // P0-SEC: Zod 입력 검증 (길이/범위/형식/열거형)
    const parseResult = createProductSchema.safeParse(await req.json());

    if (!parseResult.success) {
      logger.error('[POST /api/admin/products] Validation error', {
        errors: parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
      });
      return NextResponse.json(
        {
          ok: false,
          message: '입력값 검증에 실패했습니다.',
          errors: parseResult.error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    const {
      productCode,
      cruiseLine,
      shipName,
      packageName,
      nights,
      days,
      itineraryPattern,
      basePrice,
      description,
      source,
      category,
      tags,
      isPopular,
      isRecommended,
      isPremium,
      isGeniePack,
      isDomestic,
      isJapan,
      isBudget,
      isUrgent,
      isMainProduct,
      saleStatus,
      startDate,
      endDate,
      destination,
      recommendedKeywords,
      thumbnail,
      detailBlocks,
      includedItems,
      excludedItems,
      itineraryDays,
      pricingRows,
      departureDate,
      refundPolicy,
      flightInfo,
      rating,
      reviewCount,
      hasEscort,
      hasLocalGuide,
      hasCruisedotStaff,
      hasTravelInsurance,
      contactType,
      contactOptions: contactOptionsFromSchema,
      tourCities,
      reservedCount,
      availableCount,
      minDeparturePax,
    } = parseResult.data;

    // tourCities: itineraryDays.arrivalLocation에서 자동 추출 (제공된 경우 우선)
    let derivedTourCities: string | null = tourCities ?? null;
    if (itineraryDays && Array.isArray(itineraryDays) && itineraryDays.length > 0) {
      const rawCities = itineraryDays
        .map((d: any) => d.arrivalLocation || d.arrival || '')
        .filter(Boolean) as string[];
      // 연속 중복 제거 후 → 로 연결
      const dedupedCities = rawCities.filter((c, i) => i === 0 || c !== rawCities[i - 1]);
      if (dedupedCities.length > 0) {
        derivedTourCities = dedupedCities.join(' → ');
      }
    }

    // itineraryPattern 검증 및 정규화
    let normalizedItineraryPattern: any[] = [];
    if (Array.isArray(itineraryPattern) && itineraryPattern.length > 0) {
      // 배열인 경우 그대로 사용 (모든 필드 포함: day, type, location, country, currency, language, arrival, departure, time 등)
      normalizedItineraryPattern = itineraryPattern.map((day: any) => ({
        day: day.day || 0,
        type: day.type || 'PortVisit',
        location: day.location || null,
        country: day.country || null,
        currency: day.currency || null,
        language: day.language || null,
        arrival: day.arrival || null,
        departure: day.departure || null,
        time: day.time || null,
      }));
    } else if (itineraryPattern && typeof itineraryPattern === 'object') {
      // 객체인 경우 배열로 변환
      normalizedItineraryPattern = [itineraryPattern];
    }

    // 상품 생성
    const product = await prisma.cruiseProduct.create({
      data: {
        productCode,
        cruiseLine,
        shipName,
        packageName,
        nights: nights || 0,
        days: days || 0,
        itineraryPattern: normalizedItineraryPattern, // 정규화된 itineraryPattern 저장
        basePrice: basePrice || null,
        description: description || null,
        source: source || 'manual',
        category: category || null,
        tags: Array.isArray(tags) ? tags : [],
        isPopular: isPopular || false,
        isRecommended: isRecommended || false,
        isPremium: isPremium || false,
        isGeniePack: isGeniePack || false,
        isDomestic: isDomestic || false,
        isJapan: isJapan || false,
        isBudget: isBudget || false,
        isUrgent: isUrgent || false, // 긴급 상품 여부 추가
        isMainProduct: isMainProduct || false, // 주력 상품 여부 추가
        // 수동 등록 상품은 항상 판매중으로 설정
        saleStatus: (source === 'manual' || !saleStatus) ? '판매중' : saleStatus,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        tourCities: derivedTourCities,
        reservedCount: reservedCount ?? null,
        availableCount: availableCount ?? null,
        minDeparturePax: minDeparturePax ?? null,
        updatedAt: new Date(), // updatedAt 필드 추가
      },
    });

    // MallProductContent 생성 (추천 키워드 및 기타 메타데이터 저장)
    const layoutData: any = {};
    
    if (recommendedKeywords !== undefined) {
      layoutData.recommendedKeywords = Array.isArray(recommendedKeywords) ? recommendedKeywords : [];
    }
    
    if (thumbnail !== undefined) {
      layoutData.thumbnail = thumbnail || null;
    }
    
    if (detailBlocks !== undefined) {
      layoutData.blocks = detailBlocks || [];
    }

    if (includedItems !== undefined) {
      layoutData.included = includedItems || [];
    }

    if (excludedItems !== undefined) {
      layoutData.excluded = excludedItems || [];
    }

    if (itineraryDays !== undefined) {
      layoutData.itinerary = itineraryDays || [];
    }

    if (pricingRows !== undefined) {
      layoutData.pricing = pricingRows || [];
    }

    if (departureDate !== undefined) {
      layoutData.departureDate = departureDate || null;
    }

    if (refundPolicy !== undefined) {
      layoutData.refundPolicy = refundPolicy || '';
    }
    
    if (flightInfo !== undefined) {
      layoutData.flightInfo = flightInfo || null;
    }
    
    if (rating !== undefined) {
      layoutData.rating = rating || 4.4;
    }
    
    if (reviewCount !== undefined) {
      layoutData.reviewCount = reviewCount || 0;
    }
    
    if (hasEscort !== undefined) {
      layoutData.hasEscort = hasEscort || false;
    }
    
    if (hasLocalGuide !== undefined) {
      layoutData.hasLocalGuide = hasLocalGuide || false;
    }
    
    if (hasCruisedotStaff !== undefined) {
      layoutData.hasCruisedotStaff = hasCruisedotStaff || false;
    }
    
    if (hasTravelInsurance !== undefined) {
      layoutData.hasTravelInsurance = hasTravelInsurance || false;
    }

    // 8번: 문의 옵션 저장
    if (contactOptionsFromSchema !== undefined) {
      layoutData.contactOptions = contactOptionsFromSchema;
    } else if (contactType !== undefined) {
      layoutData.contactType = contactType || 'aiChatbot';
    }

    // destination이 있으면 layout에 저장
    if (destination !== undefined && Array.isArray(destination)) {
      layoutData.destination = destination;
    }

    // 구글 드라이브에 이미지 백업 (로컬 이미지만)
    let finalThumbnail = thumbnail;
    let finalDetailBlocks = layoutData.blocks || [];
    let finalItineraryDays = layoutData.itinerary || [];

    try {
      const backupResult = await backupProductImages(
        productCode,
        thumbnail,
        detailBlocks !== undefined ? detailBlocks : layoutData.blocks,
        itineraryDays !== undefined ? itineraryDays : layoutData.itinerary
      );

      finalThumbnail = backupResult.thumbnail;
      finalDetailBlocks = backupResult.detailBlocks;
      if (backupResult.itineraryDays) {
        finalItineraryDays = backupResult.itineraryDays;
      }

      if (detailBlocks !== undefined || layoutData.blocks) {
        layoutData.blocks = finalDetailBlocks;
      }

      if ((itineraryDays !== undefined || layoutData.itinerary) && backupResult.itineraryDays) {
        layoutData.itinerary = finalItineraryDays;
      }

      if (finalThumbnail) {
        layoutData.thumbnail = finalThumbnail;
      }
    } catch (error: any) {
      logger.error('[Product Create] Error backing up images to Google Drive:', error);
      // 백업 실패해도 계속 진행 (원본 URL 유지)
    }

    // 환불정책 텍스트 → 구조화 JSON → CruiseProduct.refundPolicy 업데이트
    if (refundPolicy) {
      await prisma.cruiseProduct.update({
        where: { productCode },
        data: { refundPolicy: parseRefundPolicyText(refundPolicy) as any },
      });
    }

    // MallProductContent 생성 또는 업데이트
    if (Object.keys(layoutData).length > 0) {
      const now = new Date();
      const thumbnailValue = layoutData.thumbnail ?? null;
      await prisma.mallProductContent.upsert({
        where: { productCode },
        update: {
          layout: layoutData,
          thumbnail: thumbnailValue,
          updatedAt: now,
        },
        create: {
          productCode,
          layout: layoutData,
          thumbnail: thumbnailValue,
          isActive: true,
          updatedAt: now,
        },
      });
    }

    // Supabase에 즉시 동기화 (fire-and-forget — 실패해도 등록은 성공으로 처리)
    syncProductToSupabase(productCode).catch((e) =>
      logger.warn('[Products POST] Supabase 동기화 실패', { productCode, error: e?.message })
    );

    return NextResponse.json({ ok: true, product });
  } catch (error) {
    logger.error('POST /api/admin/products error:', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/products/[id]
 * 크루즈 상품 수정
 */
export async function PUT(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    // CSRF 토큰 검증
    const csrfSessionToken = cookieStore.get('csrf-token')?.value;
    const csrfRequestToken = req.headers.get('X-CSRF-Token');
    if (!validateCsrfToken(csrfSessionToken, csrfRequestToken)) {
      return NextResponse.json({ ok: false, message: 'CSRF token validation failed' }, { status: 403 });
    }

    // P0-SEC: Zod 입력 검증 (길이/범위/형식/열거형)
    const requestBody = await req.json();
    const parseResult = updateProductSchema.safeParse(requestBody);

    if (!parseResult.success) {
      logger.error('[PUT /api/admin/products] Validation error', {
        errors: parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
      });
      return NextResponse.json(
        {
          ok: false,
          message: '입력값 검증에 실패했습니다.',
          errors: parseResult.error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    const { id } = requestBody;
    const parsedId = parseInt(id, 10);

    if (!id || isNaN(parsedId)) {
      return NextResponse.json({ ok: false, message: 'Product ID required' }, { status: 400 });
    }

    // parseResult.data 사용 (Zod transform/coerce 적용된 정제 데이터)
    const processedData: any = { ...parseResult.data };

    // tourCities: itineraryDays 있으면 자동 갱신 (mallOnlyFields 삭제 전에 처리)
    if (processedData.itineraryDays && Array.isArray(processedData.itineraryDays)) {
      const rawCities = processedData.itineraryDays
        .map((d: any) => d.arrivalLocation || d.arrival || '')
        .filter(Boolean) as string[];
      const dedupedCities = rawCities.filter((c: string, i: number) => i === 0 || c !== rawCities[i - 1]);
      if (dedupedCities.length > 0) {
        processedData.tourCities = dedupedCities.join(' → ');
      }
    }

    // MallProductContent 전용 필드 제거 (CruiseProduct 모델에 없음)
    const mallOnlyFields = [
      'recommendedKeywords', 'destination', 'thumbnail', 'detailBlocks',
      'includedItems', 'excludedItems', 'itineraryDays', 'pricingRows',
      'departureDate', 'flightInfo', 'rating', 'reviewCount',
      'hasEscort', 'hasLocalGuide', 'hasCruisedotStaff', 'hasTravelInsurance',
      'contactType', 'contactOptions',
    ];
    for (const f of mallOnlyFields) delete processedData[f];
    
    // itineraryPattern 검증 및 정규화
    if (processedData.itineraryPattern !== undefined) {
      if (Array.isArray(processedData.itineraryPattern) && processedData.itineraryPattern.length > 0) {
        // 배열인 경우 모든 필드를 정규화하여 저장
        processedData.itineraryPattern = processedData.itineraryPattern.map((day: any) => ({
          day: day.day || 0,
          type: day.type || 'PortVisit',
          location: day.location || null,
          country: day.country || null,
          currency: day.currency || null,
          language: day.language || null,
          arrival: day.arrival || null,
          departure: day.departure || null,
          time: day.time || null,
        }));
      } else if (processedData.itineraryPattern && typeof processedData.itineraryPattern === 'object') {
        // 객체인 경우 배열로 변환
        processedData.itineraryPattern = [processedData.itineraryPattern];
      } else {
        // 빈 배열 또는 null인 경우 빈 배열로 설정
        processedData.itineraryPattern = [];
      }
    }
    
    if (processedData.startDate != null) {
      processedData.startDate = new Date(processedData.startDate);
    }
    if (processedData.endDate != null) {
      processedData.endDate = new Date(processedData.endDate);
    }
    
    // updatedAt 필드 자동 업데이트
    processedData.updatedAt = new Date();

    const product = await prisma.cruiseProduct.update({
      where: { id: parsedId },
      data: processedData,
      select: {
        id: true,
        productCode: true,
        cruiseLine: true,
        shipName: true,
        packageName: true,
        nights: true,
        days: true,
        itineraryPattern: true,
        basePrice: true,
        description: true,
        source: true,
        category: true,
        tags: true,
        isPopular: true,
        isRecommended: true,
        isUrgent: true,
        isMainProduct: true,
        saleStatus: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Supabase에 즉시 동기화
    syncProductToSupabase(product.productCode).catch((e) =>
      logger.warn('[Products PUT] Supabase 동기화 실패', { productCode: product.productCode, error: e?.message })
    );

    return NextResponse.json({ ok: true, product });
  } catch (error) {
    logger.error('PUT /api/admin/products error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        ok: false,
        message: 'Server error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/products
 * 크루즈 상품 삭제
 */
export async function DELETE(req: NextRequest) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    // CSRF 토큰 검증
    const csrfSessionToken = cookieStore.get('csrf-token')?.value;
    const csrfRequestToken = req.headers.get('X-CSRF-Token');
    if (!validateCsrfToken(csrfSessionToken, csrfRequestToken)) {
      return NextResponse.json({ ok: false, message: 'CSRF token validation failed' }, { status: 403 });
    }

    const { id } = await req.json();
    const parsedId = parseInt(id, 10);

    if (!id || isNaN(parsedId)) {
      return NextResponse.json({ ok: false, message: 'Product ID required' }, { status: 400 });
    }

    // 삭제 전 전체 데이터 조회 (보호 상품 체크 + 백업용 — DB 왕복 1회로 통합)
    const fullProduct = await prisma.cruiseProduct.findUnique({
      where: { id: parsedId },
      include: {
        MallProductContent: true,
        ProductPricePeriod: true,
      },
    });

    if (!fullProduct) {
      return NextResponse.json({ ok: false, message: 'Product not found' }, { status: 404 });
    }

    // 보호된 테스트 상품은 삭제 불가
    const PROTECTED_PRODUCT_CODES = ['SAMPLE-MED-001', 'REAL-CRUISE-01'];
    if (PROTECTED_PRODUCT_CODES.includes(fullProduct.productCode)) {
      return NextResponse.json({
        ok: false,
        message: `테스트 상품 "${fullProduct.packageName}"은(는) 삭제할 수 없습니다. (시스템 테스트용 보호 상품)`,
      }, { status: 403 });
    }

    // 레이어 1: 소프트 삭제 (DB에 데이터 보존)
    await prisma.cruiseProduct.update({
      where: { id: parsedId },
      data: {
        deletedAt: new Date(),
        saleStatus: '삭제됨',
      },
    });

    // 레이어 2: 삭제 로그 테이블에 스냅샷 저장
    const { MallProductContent, ProductPricePeriod, ...productData } = fullProduct;
    let driveFileId: string | undefined;
    let driveFileUrl: string | undefined;

    const logEntry = await prisma.cruiseProductDeleteLog.create({
      data: {
        productCode: fullProduct.productCode,
        packageName: fullProduct.packageName,
        productSnapshot: productData as never,
        contentSnapshot: (MallProductContent?.layout ?? null) as never,
        deletedBy: `product-id:${parsedId}`,
      },
    });

    // 레이어 3: Google Drive 백업 (실패해도 삭제는 이미 완료)
    try {
      const backupJson = JSON.stringify({
        deletedAt: new Date().toISOString(),
        product: productData,
        content: MallProductContent,
        pricePeriods: ProductPricePeriod,
      }, null, 2);

      const { uploadFileToDrive } = await import('@/lib/google-drive');
      const backupFolderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
      if (backupFolderId) {
        const fileName = `product-backup_${fullProduct.productCode}_${new Date().toISOString().split('T')[0]}.json`;
        const uploadResult = await uploadFileToDrive({
          buffer: Buffer.from(backupJson, 'utf-8'),
          fileName,
          mimeType: 'application/json',
          folderId: backupFolderId,
        });
        if (uploadResult.ok && uploadResult.fileId) {
          driveFileId = uploadResult.fileId;
          driveFileUrl = uploadResult.url || undefined;
          // 로그에 드라이브 정보 업데이트
          await prisma.cruiseProductDeleteLog.update({
            where: { id: logEntry.id },
            data: { driveFileId, driveFileUrl },
          });
        }
      }
    } catch (driveErr) {
      logger.error('[Product Delete] Google Drive backup failed (non-critical):', driveErr);
    }

    return NextResponse.json({
      ok: true,
      message: '상품이 삭제되었습니다. (3중 백업 완료)',
      backup: {
        db: true,
        drive: !!driveFileId,
      },
    });
  } catch (error) {
    logger.error('DELETE /api/admin/products error:', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
