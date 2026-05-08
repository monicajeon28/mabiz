export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { productInclude, serializeProduct, toSafeInt, PRICING_COLUMNS, PricingMatrixRow } from '../shared';

function parseLayoutPricing(layoutValue: any): PricingMatrixRow[] {
  let parsed: any = layoutValue;
  if (typeof layoutValue === 'string') {
    try {
      parsed = JSON.parse(layoutValue);
    } catch (error) {
      parsed = {};
    }
  }

  const rows = Array.isArray(parsed?.pricing) ? parsed.pricing : [];
  return rows.map((row: any) => {
    const pricingRowId = row?.id ? String(row.id) : undefined;
    const roomType = row?.roomType || row?.cabinType || '객실';

    const options = PRICING_COLUMNS.map((column) => ({
      key: column.key,
      label: column.label,
      fareCategory: column.fareCategory,
      saleAmount: row?.[column.key] != null ? Number(row[column.key]) : null,
    }));

    return {
      pricingRowId,
      roomType,
      options,
    };
  });
}

interface UpdateBody {
  title?: string;
  status?: string;
  currency?: string;
  cruiseProductId?: number | null;
  defaultSaleAmount?: number | null;
  defaultCostAmount?: number | null;
  defaultNetRevenue?: number | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  metadata?: Prisma.JsonValue;
  isPublished?: boolean;
  tiers?: Array<{
    id?: number;
    cabinType: string;
    saleAmount?: number | null;
    costAmount?: number | null;
    hqShareAmount?: number | null;
    branchShareAmount?: number | null;
    salesShareAmount?: number | null;
    overrideAmount?: number | null;
    currency?: string | null;
    metadata?: Prisma.JsonValue;
    pricingRowId?: string | null;
    fareCategory?: string | null;
    fareLabel?: string | null;
  }>;
}

export async function PUT(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { productId: productIdStr } = await params;
    const productId = Number(productIdStr);
    if (!Number.isInteger(productId)) {
      return NextResponse.json({ ok: false, error: '잘못된 상품 ID 입니다.' }, { status: 400 });
    }

    const data = (await request.json()) as UpdateBody;

    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.affiliateProduct.findUnique({
        where: { id: productId },
      });
      if (!existing) {
        throw new Error('상품을 찾을 수 없습니다.');
      }

      const updateData: Prisma.AffiliateProductUpdateInput = {};

      if (data.title !== undefined) {
        updateData.title = data.title.trim();
      }
      if (data.status !== undefined) {
        updateData.status = data.status;
      }
      if (data.currency !== undefined) {
        updateData.currency = data.currency;
      }
      if (data.cruiseProductId !== undefined) {
        updateData.CruiseProduct = data.cruiseProductId
          ? { connect: { id: data.cruiseProductId } }
          : { disconnect: true };
      }
      if (data.defaultSaleAmount !== undefined) {
        updateData.defaultSaleAmount = toSafeInt(data.defaultSaleAmount);
      }
      if (data.defaultCostAmount !== undefined) {
        updateData.defaultCostAmount = toSafeInt(data.defaultCostAmount);
      }
      if (data.defaultNetRevenue !== undefined) {
        updateData.defaultNetRevenue = toSafeInt(data.defaultNetRevenue);
      }
      if (data.metadata !== undefined) {
        updateData.metadata = data.metadata;
      }
      if (data.effectiveFrom !== undefined) {
        updateData.effectiveFrom = data.effectiveFrom ? new Date(data.effectiveFrom) : undefined;
      }
      if (data.effectiveTo !== undefined) {
        updateData.effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null;
      }
      if (data.isPublished !== undefined) {
        updateData.isPublished = data.isPublished;
        updateData.publishedAt = data.isPublished ? new Date() : null;
      }

      const updated = await tx.affiliateProduct.update({
        where: { id: productId },
        data: updateData,
      });

      if (Array.isArray(data.tiers)) {
        await tx.affiliateCommissionTier.deleteMany({ where: { affiliateProductId: productId } });
        if (data.tiers.length) {
          const now = new Date();
          await tx.affiliateCommissionTier.createMany({
            data: data.tiers.map((tier) => ({
              affiliateProductId: productId,
              cabinType: tier.cabinType,
              saleAmount: toSafeInt(tier.saleAmount),
              costAmount: toSafeInt(tier.costAmount),
              hqShareAmount: toSafeInt(tier.hqShareAmount),
              branchShareAmount: toSafeInt(tier.branchShareAmount),
              salesShareAmount: toSafeInt(tier.salesShareAmount),
              overrideAmount: toSafeInt(tier.overrideAmount),
              currency: tier.currency ?? data.currency ?? updated.currency,
              metadata: tier.metadata,
              pricingRowId: tier.pricingRowId ?? undefined,
              fareCategory: tier.fareCategory ?? undefined,
              fareLabel: tier.fareLabel ?? undefined,
              updatedAt: now,
            })),
          });
        }
      }

      return tx.affiliateProduct.findUniqueOrThrow({
        where: { id: productId },
        include: productInclude,
      });
    });

    const content = await prisma.mallProductContent.findUnique({
      where: { productCode: product.productCode },
      select: { layout: true },
    });

    return NextResponse.json({
      ok: true,
      product: serializeProduct(product, parseLayoutPricing(content?.layout)),
    });
  } catch (error) {
    logger.error('[admin/affiliate/products/:id][PUT] error', { errorType: error instanceof Error ? error.name : typeof error });
    const message = error instanceof Error ? error.message : '상품 정보를 저장하는 중 오류가 발생했습니다.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/affiliate/products/:productId
 * 어필리에이트 상품 삭제
 * 
 * 삭제 시:
 * - AffiliateProduct 삭제
 * - 관련된 AffiliateCommissionTier 삭제
 * - 관련된 AffiliateLink 삭제 (또는 비활성화)
 * - 구매몰에서 즉시 노출 중지 (isPublished = false로 설정 후 삭제)
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { productId: productIdStr } = await params;
    const productId = Number(productIdStr);
    if (!Number.isInteger(productId)) {
      return NextResponse.json({ ok: false, error: '잘못된 상품 ID 입니다.' }, { status: 400 });
    }

    // 관리자 권한 확인
    const { cookies } = await import('next/headers');
    const SESSION_COOKIE = 'cg.sid.v2';
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    
    if (!sid) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: {
        User: {
          select: { role: true },
        },
      },
    });

    if (session?.User.role !== 'admin') {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    // 상품 정보 조회
    const product = await prisma.affiliateProduct.findUnique({
      where: { id: productId },
      select: {
        id: true,
        productCode: true,
        title: true,
      },
    });

    if (!product) {
      return NextResponse.json({ ok: false, error: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 트랜잭션으로 삭제 처리
    await prisma.$transaction(async (tx) => {
      // 1. 관련된 수당 티어 삭제
      await tx.affiliateCommissionTier.deleteMany({
        where: { affiliateProductId: productId },
      });

      // 2. 관련된 어필리에이트 링크 삭제 (또는 비활성화)
      // 링크는 삭제하지 않고 비활성화하는 것이 안전할 수 있지만, 요구사항에 따라 삭제
      await tx.affiliateLink.deleteMany({
        where: { affiliateProductId: productId },
      });

      // 3. 어필리에이트 상품 삭제
      await tx.affiliateProduct.delete({
        where: { id: productId },
      });
    });

    logger.log(`[Admin Affiliate Products] 상품 삭제 완료: ${product.productCode} (${product.title})`);

    return NextResponse.json({
      ok: true,
      message: '상품이 삭제되었습니다.',
      productCode: product.productCode,
    });
  } catch (error) {
    logger.error('[admin/affiliate/products/:id][DELETE] error', { errorType: error instanceof Error ? error.name : typeof error });
    const message = error instanceof Error ? error.message : '상품을 삭제하는 중 오류가 발생했습니다.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
