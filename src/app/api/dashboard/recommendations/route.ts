export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

type CountRow = { segment: string | null; count: bigint };
type ConversionRow = { segment: string | null; rate: number };
type ProductRow = { recommendedProduct: string | null; count: bigint };

/**
 * GET /api/dashboard/recommendations
 * 세그먼트별 추천 분석 데이터
 *
 * 응답:
 * {
 *   segment_distribution: { A: 12, B: 8, ... },
 *   conversion_rates: { A: 0.45, B: 0.38, ... },
 *   top_products: [ { name: "AI_PACKAGE", count: 15 }, ... ]
 * }
 */
export async function GET(request: Request) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) {
      logger.warn('[RecommendationAPI] No session found');
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!ctx.organizationId) {
      logger.warn('[RecommendationAPI] No organizationId', { userId: ctx.userId, role: ctx.role });
      return NextResponse.json({ ok: false, error: 'Organization not configured' }, { status: 401 });
    }

    const organizationId = ctx.organizationId;

    logger.log('[RecommendationAPI]', {
      action: 'fetch-data',
      organizationId,
      status: 'start',
    });

    // ── 병렬 쿼리 실행 (3개 쿼리를 동시에 실행하여 성능 개선) ──────
    // 1. segment_distribution: Contact 집계
    // 2. conversion_rates: Contact → 완료된 SalesPlaybook 전환율
    // 3. top_products: recommendedProduct 빈도
    const [segmentRows, conversionRows, productRows] = await Promise.all([
      // ── 1. segment_distribution ──────────────────
      prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT "segment", COUNT(*) as count
        FROM "Contact"
        WHERE "organizationId" = ${organizationId}
          AND "deletedAt" IS NULL
          AND "segment" IS NOT NULL
        GROUP BY "segment"
      `),

      // ── 2. conversion_rates ──────────────────
      // SalesPlaybook이 없으면 contact 집계만 사용
      prisma.$queryRaw<ConversionRow[]>(Prisma.sql`
        SELECT
          c."segment",
          CASE
            WHEN COUNT(DISTINCT c.id) = 0 THEN 0
            ELSE ROUND(
              COUNT(CASE WHEN sp.id IS NOT NULL THEN 1 END)::numeric /
              COUNT(DISTINCT c.id), 2
            )::float
          END as rate
        FROM "Contact" c
        LEFT JOIN "SalesPlaybook" sp ON c.id = sp."contactId" AND sp.status = 'COMPLETED'
        WHERE c."organizationId" = ${organizationId}
          AND c."deletedAt" IS NULL
          AND c."segment" IS NOT NULL
        GROUP BY c."segment"
      `),

      // ── 3. top_products ──────────────────
      prisma.$queryRaw<ProductRow[]>(Prisma.sql`
        SELECT "recommendedProduct" as "recommendedProduct", COUNT(*) as count
        FROM "Contact"
        WHERE "organizationId" = ${organizationId}
          AND "deletedAt" IS NULL
          AND "recommendedProduct" IS NOT NULL
        GROUP BY "recommendedProduct"
        ORDER BY count DESC
        LIMIT 10
      `),
    ]);

    // ── 데이터 변환 ──────────────────────────
    const segment_distribution: Record<string, number> = {};
    for (const row of segmentRows) {
      if (row.segment) {
        segment_distribution[row.segment] = Number(row.count);
      }
    }

    const conversion_rates: Record<string, number> = {};
    for (const row of conversionRows) {
      if (row.segment) {
        conversion_rates[row.segment] = row.rate || 0;
      }
    }

    const top_products = productRows.map(row => ({
      name: row.recommendedProduct || 'UNKNOWN',
      count: Number(row.count),
    }));

    logger.log('[RecommendationAPI]', {
      action: 'fetch-data',
      organizationId,
      segmentCount: segmentRows.length,
      productCount: productRows.length,
      status: 'success',
    });

    return NextResponse.json({
      ok: true,
      segment_distribution,
      conversion_rates,
      top_products,
    });
  } catch (error) {
    logger.error('[RecommendationAPI] Error', { error });
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch recommendation data' },
      { status: 500 }
    );
  }
}
