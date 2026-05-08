export const dynamic = 'force-dynamic';

// app/api/admin/mall/products/[productCode]/route.ts
// MallProductContent의 layout 필드 업데이트

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/auth';
import { validateCsrfAndRespond } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

export async function PUT(
  req: NextRequest,
  { params }: { params: { productCode: string } }
) {
  try {
    const { isAdmin } = await checkAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const csrfCheck = validateCsrfAndRespond(req, 'Mall Products Update');
    if (!csrfCheck.valid) return csrfCheck.response!;

    const { productCode } = params;
    const { layout } = await req.json();

    if (!layout) {
      return NextResponse.json({ ok: false, message: 'Layout data required' }, { status: 400 });
    }

    // 기존 MallProductContent 조회
    const existingContent = await prisma.mallProductContent.findUnique({
      where: { productCode },
      select: { layout: true },
    });

    // 기존 layout과 병합 (기존 데이터 유지)
    let mergedLayout = layout;
    if (existingContent?.layout) {
      const existingLayout = typeof existingContent.layout === 'string'
        ? JSON.parse(existingContent.layout)
        : (existingContent.layout as Record<string, unknown>);
      mergedLayout = {
        ...existingLayout,
        ...layout, // 새로운 layout 데이터로 덮어쓰기
      };
    }

    // MallProductContent 업데이트 또는 생성
    const productContent = await prisma.mallProductContent.upsert({
      where: { productCode },
      update: {
        layout: mergedLayout,
        updatedAt: new Date(),
      },
      create: {
        productCode,
        layout: mergedLayout,
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true, productContent });
  } catch (error) {
    logger.error('PUT /api/admin/mall/products/[productCode] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
