export const dynamic = 'force-dynamic';

/**
 * GET /api/affiliate/contracts?status=submitted&page=1
 * 대리점 계약 목록 조회 (GLOBAL_ADMIN 전용)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getAuthContext } from '@/lib/rbac';
import { CONTRACT_PRICE_TIERS } from '@/lib/affiliate/priceTiers';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx || ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, message: '관리자 권한이 필요합니다.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'submitted'; // 기본: 승인 대기
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = 20;
    const skip = (page - 1) * limit;

    const where = status === 'all' ? {} : { status };

    const [contracts, total] = await Promise.all([
      prisma.gmAffiliateContract.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          metadata: true,
          createdAt: true,
          contractSignedAt: true,
        },
      }),
      prisma.gmAffiliateContract.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        contracts: contracts.map((c) => {
          const meta = c.metadata as Record<string, any> | null;
          return {
            ...c,
            tierLabel: meta?.tierKey
              ? CONTRACT_PRICE_TIERS[meta.tierKey as keyof typeof CONTRACT_PRICE_TIERS]?.label
              : null,
            approvedAt: meta?.approvedAt || null,
          };
        }),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    logger.error('[AFFILIATE] 계약 목록 조회 실패', { error: err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
