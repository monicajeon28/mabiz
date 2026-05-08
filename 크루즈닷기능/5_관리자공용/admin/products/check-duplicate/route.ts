// app/api/admin/products/check-duplicate/route.ts
// 상품코드 중복 체크 API

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const productCode = url.searchParams.get('productCode');

    if (!productCode) {
      return NextResponse.json(
        { ok: false, error: 'productCode is required' },
        { status: 400 }
      );
    }

    // 상품코드 유효성 검사
    const validationErrors: string[] = [];

    // 1. 공백 체크
    if (/\s/.test(productCode)) {
      validationErrors.push('상품코드에 공백이 포함되어 있습니다.');
    }

    // 2. 특수문자 체크 (영문, 숫자, 언더스코어, 하이픈만 허용)
    if (!/^[a-zA-Z0-9_-]+$/.test(productCode)) {
      validationErrors.push('상품코드는 영문, 숫자, 언더스코어(_), 하이픈(-)만 사용할 수 있습니다.');
    }

    // 3. 길이 체크
    if (productCode.length < 3) {
      validationErrors.push('상품코드는 최소 3자 이상이어야 합니다.');
    }

    if (productCode.length > 50) {
      validationErrors.push('상품코드는 최대 50자까지 가능합니다.');
    }

    // DB에서 중복 체크
    const existingProduct = await prisma.cruiseProduct.findUnique({
      where: { productCode },
      select: { productCode: true, packageName: true }
    });

    const isDuplicate = !!existingProduct;

    return NextResponse.json({
      ok: true,
      productCode,
      isDuplicate,
      existingProduct: isDuplicate ? {
        productCode: existingProduct.productCode,
        packageName: existingProduct.packageName
      } : null,
      validationErrors,
      isValid: validationErrors.length === 0 && !isDuplicate
    });
  } catch (error: any) {
    logger.error('[Check Duplicate] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to check duplicate' },
      { status: 500 }
    );
  }
}
