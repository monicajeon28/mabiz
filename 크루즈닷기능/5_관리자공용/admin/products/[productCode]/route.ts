export const dynamic = 'force-dynamic';

// app/api/admin/products/[productCode]/route.ts
// 상품 상세 조회 및 수정 API

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/auth';
import { validateCsrfAndRespond } from '@/lib/api-utils';
import { getCountryCode, getKoreanCountryName } from '@/lib/utils/countryMapping';
import { backupProductImages } from '@/lib/google-drive-product-backup';
import { parseRefundPolicyText } from '@/lib/mall/refund-calculator';
import { logger } from '@/lib/logger';

// GET: 상품 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productCode: string }> }
) {
  try {
    const { productCode } = await params;
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const product = await prisma.cruiseProduct.findUnique({
      where: { productCode: productCode },
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
        saleStatus: true,
        isUrgent: true,
        isMainProduct: true,
        startDate: true,
        endDate: true,
        itineraryPattern: true,
        createdAt: true,
        updatedAt: true,
        tourCities: true,
        reservedCount: true,
        availableCount: true,
        minDeparturePax: true,
        MallProductContent: {
          select: {
            thumbnail: true,
            images: true,
            videos: true,
            layout: true
          }
        }
      }
    });

    if (!product) {
      return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 });
    }

    // destination을 itineraryPattern에서 추출하여 응답에 포함
    let destination: string[] | null = null;
    if (product.itineraryPattern) {
      try {
        const pattern = typeof product.itineraryPattern === 'string' 
          ? JSON.parse(product.itineraryPattern) 
          : product.itineraryPattern;
        
        // 객체인 경우 destination 필드 확인
        if (pattern && typeof pattern === 'object' && !Array.isArray(pattern)) {
          if (pattern.destination && Array.isArray(pattern.destination)) {
            destination = pattern.destination;
          }
        }
      } catch (e) {
        logger.error('[GET Product] Failed to parse itineraryPattern:', e);
      }
    }

    // MallProductContent를 mallProductContent로 변환 (프론트엔드 호환성)
    const { MallProductContent, ...restProduct } = product;

    // layout에서 destination도 추출
    let layoutDestination: string[] | null = null;
    if (MallProductContent?.layout) {
      try {
        const layout = typeof MallProductContent.layout === 'string'
          ? JSON.parse(MallProductContent.layout)
          : MallProductContent.layout;
        if (layout.destination && Array.isArray(layout.destination)) {
          layoutDestination = layout.destination;
        }
      } catch (e) {
        logger.error('[GET Product] Failed to parse layout for destination:', e);
      }
    }

    return NextResponse.json({
      ok: true,
      product: {
        ...restProduct,
        mallProductContent: MallProductContent, // 소문자로 변환
        destination: destination || layoutDestination, // itineraryPattern 또는 layout에서 destination 가져오기
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString()
      }
    });
  } catch (error: any) {
    logger.error('[Admin Product Detail API] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PUT: 상품 수정
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ productCode: string }> }
) {
  try {
    const { productCode: productCodeParam } = await params;
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const csrfCheck = validateCsrfAndRespond(req, 'Admin Products Update');
    if (!csrfCheck.valid) return csrfCheck.response!;

    const body = await req.json();
    const {
      productCode: newProductCode,
      cruiseLine,
      shipName,
      packageName,
      nights,
      days,
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
      thumbnail,
      detailBlocks,
      includedItems,
      excludedItems,
      itineraryDays,
      pricingRows,
      departureDate,
      refundPolicy,
      startDate,
      endDate,
      destination,
      itineraryPattern,
      recommendedKeywords,
      flightInfo,
      rating,
      reviewCount,
      hasEscort,
      hasLocalGuide,
      hasCruisedotStaff,
      hasTravelInsurance,
      hasCruisedotGuide,
      hasCruisedotEscort,
      contactOptions,
      tourCities,
      reservedCount,
      availableCount,
      minDeparturePax,
    } = body;

    // 상품 코드 변경 처리
    const updateProductCode = newProductCode && newProductCode !== productCodeParam;
    const targetProductCode = updateProductCode ? newProductCode : productCodeParam;

    // 상품 업데이트
    const updateData: any = {
      ...(cruiseLine !== undefined && { cruiseLine }),
      ...(shipName !== undefined && { shipName }),
      ...(packageName !== undefined && { packageName }),
      ...(nights !== undefined && { nights: isNaN(parseInt(nights)) ? undefined : parseInt(nights) }),
      ...(days !== undefined && { days: isNaN(parseInt(days)) ? undefined : parseInt(days) }),
      ...(basePrice !== undefined && { basePrice: basePrice ? (isNaN(parseInt(basePrice)) ? null : parseInt(basePrice)) : null }),
      ...(description !== undefined && { description }),
      ...(source !== undefined && { source }),
      ...(category !== undefined && { category: category || null }),
      ...(tags !== undefined && { tags: Array.isArray(tags) ? tags : [] }),
      ...(isPopular !== undefined && { isPopular }),
      ...(isRecommended !== undefined && { isRecommended }),
      ...(isPremium !== undefined && { isPremium }),
      ...(isGeniePack !== undefined && { isGeniePack }),
      ...(isDomestic !== undefined && { isDomestic }),
      ...(isJapan !== undefined && { isJapan }),
      ...(isBudget !== undefined && { isBudget }),
      ...(isUrgent !== undefined && { isUrgent }),
      ...(isMainProduct !== undefined && { isMainProduct }),
      ...(saleStatus !== undefined && { saleStatus }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
    };

    // itineraryPattern 처리
    if (itineraryPattern !== undefined) {
      // itineraryPattern이 직접 전달된 경우
      updateData.itineraryPattern = itineraryPattern;
    } else if (destination !== undefined && Array.isArray(destination)) {
      // destination이 전달된 경우 - itineraryPattern에 destination 저장 및 각 day에 국가 코드 할당
      const currentProduct = await prisma.cruiseProduct.findUnique({
        where: { productCode: productCodeParam },
        select: { itineraryPattern: true },
      });
      
      const currentPattern = currentProduct?.itineraryPattern || [];
      let patternObj: any;
      
      try {
        patternObj = typeof currentPattern === 'string' ? JSON.parse(currentPattern) : currentPattern;
      } catch (e) {
        patternObj = Array.isArray(currentPattern) ? currentPattern : {};
      }
      
      // destination의 한국어 이름을 국가 코드로 변환
      const selectedCountryCodes = destination
        .map((dest: string) => {
          // "스페인 (Spain)" 형식에서 한국어 이름만 추출
          const koreanName = dest.split(' (')[0].trim();
          return getCountryCode(koreanName);
        })
        .filter((code): code is string => code !== null && code !== 'KR');
      
      logger.log('[Product Update] Selected countries:', {
        destination,
        selectedCountryCodes,
      });
      
      // itineraryPattern의 각 day에 국가 코드 할당
      let daysArray: any[] = [];
      if (Array.isArray(patternObj)) {
        daysArray = patternObj;
      } else if (patternObj.days && Array.isArray(patternObj.days)) {
        daysArray = patternObj.days;
      }
      
      // PortVisit 타입 일정에 순서대로 국가 코드 할당
      const portVisitDays = daysArray.filter((day: any) => day.type === 'PortVisit');
      portVisitDays.forEach((day: any, index: number) => {
        if (selectedCountryCodes[index]) {
          day.country = selectedCountryCodes[index];
        }
      });
      
      // Embarkation/Disembarkation 일정에도 첫 번째 국가 코드 할당 (country가 없는 경우)
      daysArray.forEach((day: any) => {
        if ((day.type === 'Embarkation' || day.type === 'Disembarkation') && !day.country && selectedCountryCodes[0]) {
          day.country = selectedCountryCodes[0];
        }
      });
      
      // destination을 itineraryPattern에 저장
      if (Array.isArray(patternObj)) {
        // 배열인 경우 객체로 변환
        updateData.itineraryPattern = {
          destination: destination,
          days: daysArray
        };
      } else {
        // 객체인 경우 destination 추가/업데이트
        updateData.itineraryPattern = {
          ...patternObj,
          destination: destination,
          days: daysArray
        };
      }
      
      logger.log('[Product Update] Updated itineraryPattern:', {
        destination,
        daysCount: daysArray.length,
        portVisitCount: portVisitDays.length,
        selectedCountryCodes,
      });
    }

    // itineraryDays 변경 시 tourCities 재계산용 변수 (itinerary 블록에서 설정)
    let derivedTourCities: string | undefined = undefined;

    // itineraryDays에서 기항지 정보를 itineraryPattern에 동기화 (크루즈 가이드 지니 연동용)
    if (itineraryDays !== undefined && Array.isArray(itineraryDays) && itineraryDays.length > 0) {
      logger.log('[Product Update] itineraryDays에서 itineraryPattern 동기화 시작:', itineraryDays.length, '일');

      // destination 블록에서 이미 설정된 itineraryPattern이 있으면 재사용 (DB 중복 조회 방지)
      const alreadySetPattern = updateData.itineraryPattern;
      let currentPattern: any[] = [];
      if (alreadySetPattern) {
        const p = alreadySetPattern as any;
        currentPattern = Array.isArray(p) ? p : (p.days || []);
      } else {
        // 아직 설정되지 않은 경우에만 DB 조회
        const currentProduct = await prisma.cruiseProduct.findUnique({
          where: { productCode: productCodeParam },
          select: { itineraryPattern: true },
        });
        try {
          const raw = currentProduct?.itineraryPattern;
          if (raw) {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            currentPattern = Array.isArray(parsed) ? parsed : (parsed.days || []);
          }
        } catch (e) {
          currentPattern = [];
        }
      }

      // itineraryDays 정보를 itineraryPattern에 반영
      const updatedPattern = itineraryDays.map((dayInfo: any, index: number) => {
        const existingDay = currentPattern.find((d: any) => d.day === dayInfo.day) || {};

        // 기항지 타입 결정
        let type = existingDay.type || 'port';
        if (dayInfo.arrivalLocation === '해상' || !dayInfo.arrivalLocation) {
          type = 'sea';
        } else if (dayInfo.day === 1) {
          type = 'departure';
        } else if (dayInfo.day === itineraryDays.length) {
          type = 'arrival';
        }

        return {
          ...existingDay,
          day: dayInfo.day,
          type,
          location: dayInfo.arrivalLocation || existingDay.location || null,
          country: dayInfo.arrivalCountry || existingDay.country || null,
          arrival: dayInfo.portArrivalTime || existingDay.arrival || null,
          departure: dayInfo.portDepartureTime || existingDay.departure || null,
        };
      });

      // destination 정보가 이미 설정된 경우 보존 (덮어쓰기 방지)
      const prevPattern = updateData.itineraryPattern as any;
      if (prevPattern && typeof prevPattern === 'object' && !Array.isArray(prevPattern) && prevPattern.destination) {
        updateData.itineraryPattern = { destination: prevPattern.destination, days: updatedPattern };
      } else {
        updateData.itineraryPattern = updatedPattern;
      }

      logger.log('[Product Update] itineraryPattern 동기화 완료:', {
        days: updatedPattern.length,
        sample: updatedPattern.slice(0, 3).map((d: any) => ({
          day: d.day,
          type: d.type,
          location: d.location,
          country: d.country,
          arrival: d.arrival,
        })),
      });

      // itineraryDays 변경 시 tourCities 자동 재계산
      const rawCities = itineraryDays
        .map((d: any) => d.arrivalLocation || d.arrival || '')
        .filter(Boolean) as string[];
      const dedupedCities = rawCities.filter((c: string, i: number) => i === 0 || c !== rawCities[i - 1]);
      if (dedupedCities.length > 0) {
        derivedTourCities = dedupedCities.join(' → ');
      }
    }

    // 최종 데이터 정리: 명시적으로 각 허용 필드만 설정 (recommendedKeywords 등 비허용 필드 차단)
    const finalUpdateData: any = {};
    
    if ('cruiseLine' in updateData && updateData.cruiseLine !== undefined) {
      finalUpdateData.cruiseLine = updateData.cruiseLine;
    }
    if ('shipName' in updateData && updateData.shipName !== undefined) {
      finalUpdateData.shipName = updateData.shipName;
    }
    if ('packageName' in updateData && updateData.packageName !== undefined) {
      finalUpdateData.packageName = updateData.packageName;
    }
    if ('nights' in updateData && updateData.nights !== undefined) {
      finalUpdateData.nights = updateData.nights;
    }
    if ('days' in updateData && updateData.days !== undefined) {
      finalUpdateData.days = updateData.days;
    }
    if ('basePrice' in updateData && updateData.basePrice !== undefined) {
      finalUpdateData.basePrice = updateData.basePrice;
    }
    if ('description' in updateData && updateData.description !== undefined) {
      finalUpdateData.description = updateData.description;
    }
    if ('source' in updateData && updateData.source !== undefined) {
      finalUpdateData.source = updateData.source;
    }
    if ('category' in updateData && updateData.category !== undefined) {
      finalUpdateData.category = updateData.category;
    }
    if ('tags' in updateData && updateData.tags !== undefined) {
      finalUpdateData.tags = updateData.tags;
    }
    if ('isPopular' in updateData && updateData.isPopular !== undefined) {
      finalUpdateData.isPopular = updateData.isPopular;
    }
    if ('isRecommended' in updateData && updateData.isRecommended !== undefined) {
      finalUpdateData.isRecommended = updateData.isRecommended;
    }
    if ('isPremium' in updateData && updateData.isPremium !== undefined) {
      finalUpdateData.isPremium = updateData.isPremium;
    }
    if ('isGeniePack' in updateData && updateData.isGeniePack !== undefined) {
      finalUpdateData.isGeniePack = updateData.isGeniePack;
    }
    if ('isDomestic' in updateData && updateData.isDomestic !== undefined) {
      finalUpdateData.isDomestic = updateData.isDomestic;
    }
    if ('isJapan' in updateData && updateData.isJapan !== undefined) {
      finalUpdateData.isJapan = updateData.isJapan;
    }
    if ('isBudget' in updateData && updateData.isBudget !== undefined) {
      finalUpdateData.isBudget = updateData.isBudget;
    }
    if ('isUrgent' in updateData && updateData.isUrgent !== undefined) {
      finalUpdateData.isUrgent = updateData.isUrgent;
    }
    if ('isMainProduct' in updateData && updateData.isMainProduct !== undefined) {
      finalUpdateData.isMainProduct = updateData.isMainProduct;
    }
    if ('saleStatus' in updateData && updateData.saleStatus !== undefined) {
      finalUpdateData.saleStatus = updateData.saleStatus;
    }
    if ('startDate' in updateData && updateData.startDate !== undefined) {
      finalUpdateData.startDate = updateData.startDate;
    }
    if ('endDate' in updateData && updateData.endDate !== undefined) {
      finalUpdateData.endDate = updateData.endDate;
    }
    if ('itineraryPattern' in updateData && updateData.itineraryPattern !== undefined) {
      finalUpdateData.itineraryPattern = updateData.itineraryPattern;
    }
    if (derivedTourCities !== undefined) finalUpdateData.tourCities = derivedTourCities;
    else if (tourCities !== undefined) finalUpdateData.tourCities = tourCities ?? null;
    if (reservedCount !== undefined) finalUpdateData.reservedCount = reservedCount ?? null;
    if (availableCount !== undefined) finalUpdateData.availableCount = availableCount ?? null;
    if (minDeparturePax !== undefined) finalUpdateData.minDeparturePax = minDeparturePax ?? null;

    // 환불정책 텍스트 → 구조화 JSON → CruiseProduct.refundPolicy DB 컬럼 저장
    if (refundPolicy !== undefined) {
      if (refundPolicy) {
        finalUpdateData.refundPolicy = parseRefundPolicyText(refundPolicy) as any;
      } else {
        finalUpdateData.refundPolicy = null;
      }
    }

    // 디버깅: finalUpdateData 확인
    logger.log('[Product Update] finalUpdateData keys:', Object.keys(finalUpdateData));

    // 상품 코드 변경 시 — 원자적 트랜잭션으로 처리
    if (updateProductCode) {
      const existingContentForMove = await prisma.mallProductContent.findUnique({
        where: { productCode: productCodeParam }
      });

      await prisma.$transaction(async (tx) => {
        await tx.cruiseProduct.delete({ where: { productCode: productCodeParam } });
        await tx.cruiseProduct.create({ data: { productCode: targetProductCode, ...finalUpdateData } });

        if (existingContentForMove) {
          await tx.mallProductContent.create({
            data: {
              productCode: targetProductCode,
              thumbnail: existingContentForMove.thumbnail,
              images: existingContentForMove.images as any,
              videos: existingContentForMove.videos as any,
              layout: existingContentForMove.layout as any,
              isActive: existingContentForMove.isActive,
              updatedAt: new Date(),
            }
          });
          await tx.mallProductContent.delete({ where: { productCode: productCodeParam } });
        }
      });
    } else {
      // 상품 업데이트
      await prisma.cruiseProduct.update({
        where: { productCode: productCodeParam },
        data: finalUpdateData
      });
    }

    const product = await prisma.cruiseProduct.findUnique({
      where: { productCode: targetProductCode }
    });

    // MallProductContent 업데이트 또는 생성
    const existingContent = await prisma.mallProductContent.findUnique({
      where: { productCode: targetProductCode }
    });

    const layoutData = existingContent?.layout 
      ? (typeof existingContent.layout === 'string' 
          ? JSON.parse(existingContent.layout) 
          : existingContent.layout)
      : {};

    // 상세페이지 블록 업데이트
    if (detailBlocks !== undefined) {
      layoutData.blocks = Array.isArray(detailBlocks) ? detailBlocks : [];
    }

    // 포함/불포함 사항 업데이트
    if (includedItems !== undefined) {
      layoutData.included = Array.isArray(includedItems) ? includedItems : [];
    }
    if (excludedItems !== undefined) {
      layoutData.excluded = Array.isArray(excludedItems) ? excludedItems : [];
    }

    // 여행일정 업데이트
    if (itineraryDays !== undefined) {
      layoutData.itinerary = Array.isArray(itineraryDays) ? itineraryDays : [];
    }

    // 요금표 업데이트
    if (pricingRows !== undefined) {
      layoutData.pricing = Array.isArray(pricingRows) ? pricingRows : [];
    }
    if (departureDate !== undefined) {
      layoutData.departureDate = departureDate || '';
    }

    // 환불/취소 규정 업데이트
    if (refundPolicy !== undefined) {
      layoutData.refundPolicy = refundPolicy || '';
    }

    // 추천 키워드 업데이트
    if (recommendedKeywords !== undefined) {
      layoutData.recommendedKeywords = Array.isArray(recommendedKeywords) ? recommendedKeywords : [];
    }

    // 항공 정보 업데이트
    if (flightInfo !== undefined) {
      layoutData.flightInfo = flightInfo || null;
    }

    // 별점 및 리뷰 개수 업데이트
    if (rating !== undefined) {
      layoutData.rating = rating || 4.4;
    }
    if (reviewCount !== undefined) {
      layoutData.reviewCount = reviewCount || 0;
    }
    
    // 서비스 옵션 업데이트
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
    if (hasCruisedotGuide !== undefined) {
      layoutData.hasCruisedotGuide = hasCruisedotGuide || false;
    }
    if (hasCruisedotEscort !== undefined) {
      layoutData.hasCruisedotEscort = hasCruisedotEscort || false;
    }

    // 문의 옵션 업데이트
    if (contactOptions !== undefined) {
      layoutData.contactOptions = contactOptions;
    }

    // 방문국가(destination) 업데이트 - layout에도 저장하여 로드 시 사용
    if (destination !== undefined && Array.isArray(destination)) {
      layoutData.destination = destination;
    }

    // 구글 드라이브에 이미지 백업 (로컬 이미지만)
    let finalThumbnail = thumbnail;
    let finalDetailBlocks = layoutData.blocks || [];
    let finalItineraryDays = layoutData.itinerary || [];
    
    try {
      const backupResult = await backupProductImages(
        targetProductCode,
        thumbnail,
        detailBlocks !== undefined ? detailBlocks : layoutData.blocks,
        itineraryDays !== undefined ? itineraryDays : layoutData.itinerary
      );
      
      finalThumbnail = backupResult.thumbnail;
      finalDetailBlocks = backupResult.detailBlocks;
      if (backupResult.itineraryDays) {
        finalItineraryDays = backupResult.itineraryDays;
      }
      
      // 백업된 블록을 layoutData에 반영
      if (detailBlocks !== undefined) {
        layoutData.blocks = finalDetailBlocks;
      }
      if (itineraryDays !== undefined && backupResult.itineraryDays) {
        layoutData.itinerary = finalItineraryDays;
      }
    } catch (error: any) {
      logger.error('[Product Update] Error backing up images to Google Drive:', error);
      // 백업 실패해도 계속 진행 (원본 URL 유지)
    }

    // 기존 이미지 데이터 보존 (update 시 손실 방지)
    let updatePayload: any = {
      layout: layoutData,
      updatedAt: new Date()
    };

    // thumbnail이 명시적으로 제공된 경우만 업데이트
    if (finalThumbnail !== undefined) {
      updatePayload.thumbnail = finalThumbnail;
    }

    // detailBlocks가 변경된 경우 images도 백업된 것들로 업데이트
    if (detailBlocks !== undefined && finalDetailBlocks.length > 0) {
      const imagesFromBlocks = finalDetailBlocks
        .filter((block: any) => block.type === 'image' && block.url)
        .map((block: any) => block.url);
      if (imagesFromBlocks.length > 0) {
        updatePayload.images = imagesFromBlocks;
      }
    }

    await prisma.mallProductContent.upsert({
      where: { productCode: targetProductCode },
      update: updatePayload,
      create: {
        productCode: targetProductCode,
        thumbnail: finalThumbnail || null,
        layout: layoutData,
        isActive: true,
        updatedAt: new Date()
      }
    });

    // 상세 페이지 캐시 무효화 (썸네일/이미지 변경 즉시 반영)
    try {
      revalidatePath(`/products/${targetProductCode}`);
      revalidatePath(`/partner`, 'layout'); // 파트너 페이지 전체 레이아웃
    } catch {
      // revalidatePath 실패해도 저장은 성공
    }

    return NextResponse.json({
      ok: true,
      product,
      message: '상품이 업데이트되었습니다.'
    });
  } catch (error: any) {
    logger.error('[Admin Product Update API] Error:', error);
    logger.error('[Admin Product Update API] Error details:', error.message);
    logger.error('[Admin Product Update API] Error stack:', error.stack);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to update product',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
