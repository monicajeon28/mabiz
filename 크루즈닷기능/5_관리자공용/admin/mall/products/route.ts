import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sanitizeProductDescription } from '@/lib/html-sanitizer';
import { syncProductToSupabase } from '@/lib/supabase-backup';
import { validateCsrfToken, getCsrfErrorResponse } from '@/lib/utils/csrfValidation';

export const dynamic = 'force-dynamic';

interface CreateProductRequest {
  name: string;
  description: string;
  price: string | number;
  imageUrl: string;
  thumbnailUrl?: string;
  productCode?: string;
}

// POST: 상품 생성
export async function POST(req: NextRequest) {
  try {
    const csrfValidation = validateCsrfToken(req);
    if (!csrfValidation.valid) {
      return getCsrfErrorResponse(csrfValidation.error || '잘못된 요청입니다.');
    }

    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    const body = await req.json() as CreateProductRequest;

    // 입력 검증
    if (!body.name || !body.description || (body.price === undefined || body.price === null) || !body.imageUrl) {
      return NextResponse.json(
        { ok: false, error: '필수 필드를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    if (typeof body.price === 'string' && isNaN(Number(body.price))) {
      return NextResponse.json(
        { ok: false, error: '가격은 숫자여야 합니다.' },
        { status: 400 }
      );
    }

    if (Number(body.price) < 0) {
      return NextResponse.json({ ok: false, error: '가격은 0 이상이어야 합니다.' }, { status: 400 });
    }

    // productCode 생성 또는 사용
    const productCode = body.productCode?.trim() || `ADMIN_${Date.now()}_${randomBytes(4).toString('hex')}`;

    // XSS 방지: description 정제 (트랜잭션 내부·응답 모두에서 재사용)
    const sanitizedDescription = sanitizeProductDescription(body.description);

    // 3개 DB 작업을 원자적으로 처리
    const { product } = await prisma.$transaction(async (tx) => {
      // 기존 CruiseProduct 확인, 없으면 생성
      let cruiseProduct = await tx.cruiseProduct.findUnique({
        where: { productCode },
      });

      if (!cruiseProduct) {
        // 최소 필수 필드로 CruiseProduct 생성
        cruiseProduct = await tx.cruiseProduct.create({
          data: {
            productCode,
            cruiseLine: 'Admin',
            shipName: body.name,
            packageName: body.name,
            nights: 1,
            days: 1,
            description: sanitizedDescription,
            basePrice: Number(body.price),
            maxPrice: Number(body.price),
            itineraryPattern: { days: [{ destination: 'N/A' }] },
          },
        });
      }

      // MallProductContent에 상품 정보 저장
      const product = await tx.mallProductContent.upsert({
        where: { productCode },
        update: {
          thumbnail: body.thumbnailUrl || body.imageUrl,
          images: {
            main: body.imageUrl,
            thumbnail: body.thumbnailUrl || body.imageUrl,
            uploadedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        },
        create: {
          productCode,
          thumbnail: body.thumbnailUrl || body.imageUrl,
          images: {
            main: body.imageUrl,
            thumbnail: body.thumbnailUrl || body.imageUrl,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // AffiliateProduct 자동 생성 — 없으면 생성, 있으면 isPublished/status 활성화
      // effectiveFrom: new Date(0) 고정으로 @@unique([productCode, effectiveFrom]) 충돌 방지
      await tx.affiliateProduct.upsert({
        where: {
          productCode_effectiveFrom: {
            productCode,
            effectiveFrom: new Date(0),
          },
        },
        update: {
          status: 'active',
          isPublished: true,
          title: body.name,
          cruiseProductId: cruiseProduct.id,
          defaultSaleAmount: Number(body.price) || null,
          updatedAt: new Date(),
        },
        create: {
          productCode,
          cruiseProductId: cruiseProduct.id,
          title: body.name,
          status: 'active',
          isPublished: true,
          effectiveFrom: new Date(0),
          effectiveTo: null,
          defaultSaleAmount: Number(body.price) || null,
          currency: 'KRW',
          updatedAt: new Date(),
        },
      });

      return { product };
    }, { timeout: 10000 });

    logger.log('[Admin Products POST] Product created:', {
      productCode,
      name: body.name,
      price: body.price,
    });

    // Supabase에 즉시 동기화 (fire-and-forget, 트랜잭션 외부)
    syncProductToSupabase(productCode).catch((e) =>
      logger.warn('[Mall Products POST] Supabase 동기화 실패', { productCode, error: e?.message })
    );

    return NextResponse.json({
      ok: true,
      data: {
        id: product.id,
        productCode: product.productCode,
        name: body.name,
        description: sanitizedDescription,
        price: body.price,
        imageUrl: body.imageUrl,
        thumbnail: product.thumbnail,
      },
    });
  } catch (error: any) {
    logger.error('[Admin Products POST] Error:', {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { ok: false, error: '상품 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// GET: 상품 목록 조회
export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    const products = await prisma.mallProductContent.findMany({
      where: {
        isActive: true,
      },
      include: {
        CruiseProduct: {
          select: {
            packageName: true,
            basePrice: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      ok: true,
      data: products,
    });
  } catch (error: any) {
    logger.error('[Admin Products GET] Error:', {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { ok: false, error: '상품 목록을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
