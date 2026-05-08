export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import type { PricingMatrixRow } from './shared';
import { productInclude, serializeProduct, toSafeInt, parseLayoutPricing } from './shared';

const SESSION_COOKIE = 'cg.sid.v2';

// 관리자 권한 확인 (세션 만료 검증 포함)
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

    if (!session?.User) return false;

    // 세션 만료 검증
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      logger.log('[Admin Affiliate Products] Session expired');
      return false;
    }

    return session.User.role === 'admin';
  } catch (error) {
    logger.error('[Admin Affiliate Products] Auth check error:', error);
    return false;
  }
}

function normalizeNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return Math.round(num);
}

interface TierInput {
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
}

interface CreateAffiliateProductBody {
  productCode: string;
  title: string;
  cruiseProductId?: number | null;
  status?: string;
  currency?: string;
  defaultSaleAmount?: number | null;
  defaultCostAmount?: number | null;
  defaultNetRevenue?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isPublished?: boolean;
  tiers?: TierInput[];
  metadata?: Prisma.JsonValue;
}

function validateBody(body: CreateAffiliateProductBody) {
  if (!body.productCode?.trim()) {
    throw new Error('상품 코드를 입력해 주세요.');
  }
  if (!body.title?.trim()) {
    throw new Error('상품명을 입력해 주세요.');
  }
  if (!body.effectiveFrom) {
    throw new Error('적용 시작일을 입력해 주세요.');
  }
}

export async function GET() {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    logger.log('[admin/affiliate/products][GET] Starting fetch...');
    
    const products = await prisma.affiliateProduct.findMany({
      include: productInclude,
      orderBy: { updatedAt: 'desc' },
    });

    logger.log('[admin/affiliate/products][GET] Found products:', products.length);

    const productCodes = products.map((product) => product.productCode);
    const contentLayouts = productCodes.length
      ? await prisma.mallProductContent.findMany({
          where: { productCode: { in: productCodes } },
          select: { productCode: true, layout: true },
        })
      : [];

    logger.log('[admin/affiliate/products][GET] Found content layouts:', contentLayouts.length);

    const pricingMatrixMap = new Map<string, PricingMatrixRow[]>();
    contentLayouts.forEach((entry) => {
      try {
        const layoutValue = entry.layout;
        pricingMatrixMap.set(entry.productCode, parseLayoutPricing(layoutValue));
      } catch (parseError) {
        logger.error(`[admin/affiliate/products][GET] Error parsing layout for ${entry.productCode}:`, parseError);
        pricingMatrixMap.set(entry.productCode, []);
      }
    });

    const serializedProducts = products.map((product) => {
      try {
        return serializeProduct(product, pricingMatrixMap.get(product.productCode) ?? []);
      } catch (serializeError) {
        logger.error(`[admin/affiliate/products][GET] Error serializing product ${product.productCode}:`, serializeError);
        // 기본 상품 정보만 반환
        return {
          id: product.id,
          productCode: product.productCode,
          title: product.title,
          status: product.status,
          currency: product.currency,
          defaultSaleAmount: product.defaultSaleAmount,
          defaultCostAmount: product.defaultCostAmount,
          defaultNetRevenue: product.defaultNetRevenue,
          isPublished: product.isPublished,
          publishedAt: product.publishedAt,
          effectiveFrom: product.effectiveFrom,
          effectiveTo: product.effectiveTo,
          updatedAt: product.updatedAt,
          cruiseProduct: product.cruiseProduct,
          commissionTiers: Array.isArray(product.commissionTiers) ? product.commissionTiers : [],
          pricingMatrix: [],
          stats: {
            totalLinks: 0,
            activeLinks: 0,
            totalConfirmedSales: 0,
            totalConfirmedAmount: 0,
          },
        };
      }
    });

    logger.log('[admin/affiliate/products][GET] Successfully serialized products');
    
    return NextResponse.json({
      ok: true,
      products: serializedProducts,
    });
  } catch (error: any) {
    logger.error('[admin/affiliate/products][GET] error', { errorType: error?.name, message: error?.message, prismaCode: (error as any)?.code });
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : '상품 데이터를 불러오는 중 오류가 발생했습니다.';
    
    return NextResponse.json({ 
      ok: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/affiliate/products
 * 어필리에이트 상품(수당 카테고리) 생성
 * 
 * 주의사항:
 * - 상품 생성 시 기본 어필리에이트 링크가 자동으로 생성됩니다.
 * - 랜딩페이지는 별도로 생성해야 하며, 링크 수정 시 landingPageId로 연결할 수 있습니다.
 * - 자동 생성된 링크는 공통 링크(managerId/agentId 없음)이며, 필요시 수정하여 특정 파트너에 할당할 수 있습니다.
 */
export async function POST(request: Request) {
  try {
    // 관리자 권한 확인
    const cookieStore = await cookies();
    const sid = cookieStore.get(SESSION_COOKIE)?.value;
    const isAdmin = await checkAdminAuth(sid);

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
    }

    const data = (await request.json()) as CreateAffiliateProductBody;
    validateBody(data);

    const now = new Date();
    const tiers = (data.tiers ?? []).map((tier) => ({
      cabinType: tier.cabinType,
      saleAmount: toSafeInt(tier.saleAmount),
      costAmount: toSafeInt(tier.costAmount),
      hqShareAmount: toSafeInt(tier.hqShareAmount),
      branchShareAmount: toSafeInt(tier.branchShareAmount),
      salesShareAmount: toSafeInt(tier.salesShareAmount),
      overrideAmount: toSafeInt(tier.overrideAmount),
      currency: tier.currency ?? data.currency ?? 'KRW',
      metadata: tier.metadata ?? undefined,
      pricingRowId: tier.pricingRowId ?? undefined,
      fareCategory: tier.fareCategory ?? undefined,
      fareLabel: tier.fareLabel ?? undefined,
      updatedAt: now,
    }));

    const isPublished = data.isPublished ?? true;

    // 세션에서 userId 가져오기 (링크 생성 시 issuedById로 사용)
    const session = await prisma.session.findUnique({
      where: { id: sid },
      select: { userId: true },
    });

    const product = await prisma.affiliateProduct.create({
      data: {
        productCode: data.productCode.trim(),
        title: data.title.trim(),
        CruiseProduct: data.cruiseProductId
          ? {
              connect: { id: data.cruiseProductId },
            }
          : undefined,
        status: data.status ?? 'active',
        currency: data.currency ?? 'KRW',
        defaultSaleAmount: toSafeInt(data.defaultSaleAmount),
        defaultCostAmount: toSafeInt(data.defaultCostAmount),
        defaultNetRevenue: toSafeInt(data.defaultNetRevenue),
        effectiveFrom: new Date(data.effectiveFrom),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : undefined,
        metadata: data.metadata ?? undefined,
        isPublished,
        publishedAt: isPublished ? now : null,
        updatedAt: now,
        AffiliateCommissionTier: tiers.length
          ? {
              create: tiers,
            }
          : undefined,
      },
      include: productInclude,
    });

    // 어필리에이트 상품 생성 시 모든 활성 파트너에게 개인 링크 자동 생성
    if (session?.userId) {
      try {
        const { generateLinksForProduct } = await import('@/lib/affiliate/auto-link-generator');

        // 비동기로 모든 활성 파트너에게 링크 생성 (백그라운드에서 실행)
        generateLinksForProduct(product.productCode, product.id, session.userId)
          .then((result) => {
            logger.log(`[Admin Affiliate Products] 자동 링크 생성 완료 - 상품: ${product.productCode}, 생성: ${result.created}, 스킵: ${result.skipped}, 에러: ${result.errors.length}`);
          })
          .catch((error) => {
            logger.error('[Admin Affiliate Products] 자동 링크 생성 실패:', error);
          });

        logger.log(`[Admin Affiliate Products] 자동 링크 생성 시작 (productCode: ${product.productCode})`);
      } catch (linkError: any) {
        // 링크 생성 실패해도 상품 생성은 성공으로 처리
        logger.error('[Admin Affiliate Products] 자동 링크 생성 시작 실패 (상품은 생성됨):', linkError);
      }
    }

    const pricingMatrix = await prisma.mallProductContent.findUnique({
      where: { productCode: product.productCode },
      select: { layout: true },
    });

    return NextResponse.json(
      { ok: true, product: serializeProduct(product, parseLayoutPricing(pricingMatrix?.layout)) },
      { status: 201 },
    );
  } catch (error: any) {
    logger.error('[admin/affiliate/products][POST] error', { errorType: error?.name, message: error?.message });
    const message = error instanceof Error ? error.message : '상품을 저장하는 중 오류가 발생했습니다.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
