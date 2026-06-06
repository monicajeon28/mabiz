export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/lib/passport-auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';

/**
 * GET /api/pnr/partner/trips
 * 신규 예약 페이지(상품 드롭다운)용 활성 여행 상품 목록 조회
 *
 * ⚠️ CruiseProduct 는 Prisma 모델이 아니므로 prisma.$queryRaw 로 조회한다.
 *    (create/list 라우트와 동일한 패턴)
 *
 * 응답 shape 는 src/app/(dashboard)/pnr/new/page.tsx 의 Trip 인터페이스와 정확히 일치:
 *   { ok: true, trips: Array<{
 *       id, shipName, departureDate, endDate, destination,
 *       product?: {
 *         cruiseLine, shipName, productCode,
 *         MallProductContent?: { layout?: { pricing?: [...], departureDate? }, isActive? } | null
 *       }
 *   }> }
 *
 *   id 는 반드시 CruiseProduct.id (= create 라우트가 tripId 로 소비하는 값).
 */
export async function GET(req: NextRequest) {
  // ────────────────────────────────────────────────────────
  // RBAC: 인증된 사용자만 (AUTH 필수) — list 라우트와 동일
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    authOnly: true,
    errorMessage: '인증이 필요합니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await requirePartnerContext();
    if (!ctx) {
      return NextResponse.json(
        { ok: false, message: '인증이 필요합니다.' },
        { status: 403 }
      );
    }

    // 활성 상품 조회 (isActive = true, deletedAt IS NULL)
    // 신규 예약 상품 드롭다운은 모든 파트너(HQ/대리점장/판매원)가 동일한 상품 카탈로그를 사용
    const products = await prisma.$queryRaw<Array<{
      id: number;
      productCode: string;
      cruiseLine: string | null;
      shipName: string | null;
      packageName: string | null;
      tourCities: string | null;
      startDate: Date | null;
      endDate: Date | null;
    }>>`
      SELECT id, "productCode", "cruiseLine", "shipName", "packageName", "tourCities", "startDate", "endDate"
      FROM "CruiseProduct"
      WHERE "isActive" = true
        AND "deletedAt" IS NULL
      ORDER BY "startDate" ASC NULLS LAST, id DESC
    `;

    if (products.length === 0) {
      return NextResponse.json({ ok: true, trips: [] });
    }

    // MallProductContent(layout/pricing/isActive) 조회 — productCode 로 매핑
    const productCodes = products
      .map((p) => p.productCode)
      .filter((code): code is string => !!code);

    const contentMap = new Map<
      string,
      { layout: unknown; isActive: boolean }
    >();

    if (productCodes.length > 0) {
      const contents = await prisma.mallProductContent.findMany({
        where: { productCode: { in: productCodes } },
        select: { productCode: true, layout: true, isActive: true },
      });
      contents.forEach((c) => {
        contentMap.set(c.productCode, {
          layout: c.layout,
          isActive: c.isActive,
        });
      });
    }

    const trips = products.map((p) => {
      const content = contentMap.get(p.productCode) ?? null;

      // layout JSON 은 { pricing: [...], departureDate?: string, ... } 형태
      const layout =
        content && content.layout && typeof content.layout === 'object'
          ? (content.layout as Record<string, unknown>)
          : null;

      const departureDateStr = p.startDate
        ? p.startDate.toISOString().split('T')[0]
        : (typeof layout?.departureDate === 'string' ? layout.departureDate : '');
      const endDateStr = p.endDate
        ? p.endDate.toISOString().split('T')[0]
        : '';

      return {
        id: p.id, // ⚠️ CruiseProduct.id — create 라우트가 tripId 로 소비
        shipName: p.shipName ?? '',
        departureDate: departureDateStr,
        endDate: endDateStr,
        destination: p.tourCities ?? p.packageName ?? '',
        product: {
          cruiseLine: p.cruiseLine ?? '',
          shipName: p.shipName ?? '',
          productCode: p.productCode,
          MallProductContent: content
            ? {
                layout: layout
                  ? {
                      pricing: Array.isArray(layout.pricing)
                        ? layout.pricing
                        : [],
                      departureDate:
                        typeof layout.departureDate === 'string'
                          ? layout.departureDate
                          : undefined,
                    }
                  : undefined,
                isActive: content.isActive,
              }
            : null,
        },
      };
    });

    return NextResponse.json({ ok: true, trips });
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    logger.error('GET /api/pnr/partner/trips error', {
      error: err instanceof Error ? (err as Error).message : String(err),
    });
    return NextResponse.json(
      { ok: false, message: (err as any).message || '여행 상품 목록 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
