export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/links/cleanup/route.ts
// 어필리에이트 링크 정리 API (관리자 전용)

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { runManualCleanup } from '@/lib/scheduler/affiliateLinkCleanup';
import prisma from '@/lib/prisma';

/**
 * GET: 정리 전 미리보기
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 확인
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.userId) },
      select: { role: true },
    });

    if (user?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const cutoff180 = new Date();
    cutoff180.setDate(cutoff180.getDate() - 180);
    const cutoff365 = new Date();
    cutoff365.setDate(cutoff365.getDate() - 365);
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);

    // 리드나 판매가 있는 링크 ID 조회
    const activeLinkIds = await prisma.$queryRaw<{ linkId: number }[]>`
      SELECT DISTINCT link_id as "linkId"
      FROM "AffiliateLead"
      WHERE link_id IS NOT NULL
      UNION
      SELECT DISTINCT link_id as "linkId"
      FROM "AffiliateSale"
      WHERE link_id IS NOT NULL
    `;

    const activeIds = activeLinkIds.map((r) => r.linkId);

    // 만료된 링크
    const expiredCount = await prisma.affiliateLink.count({
      where: {
        status: 'ACTIVE',
        expiresAt: {
          lt: now,
        },
      },
    });

    // 비활성 링크
    const inactiveCount = await prisma.affiliateLink.count({
      where: {
        status: 'INACTIVE',
        lastAccessedAt: {
          lt: cutoff180,
        },
        ...(activeIds.length > 0 && {
          id: {
            notIn: activeIds,
          },
        }),
      },
    });

    // 오래된 링크
    const oldCount = await prisma.affiliateLink.count({
      where: {
        createdAt: {
          lt: cutoff365,
        },
        lastAccessedAt: {
          lt: cutoff180,
        },
        status: {
          in: ['ACTIVE', 'INACTIVE'],
        },
        ...(activeIds.length > 0 && {
          id: {
            notIn: activeIds,
          },
        }),
      },
    });

    // 테스트 링크
    const testCount = await prisma.affiliateLink.count({
      where: {
        createdAt: {
          lt: cutoff30,
        },
        OR: [
          { campaignName: { contains: 'test' } },
          { campaignName: { contains: '임시' } },
          { campaignName: { contains: 'temp' } },
          { campaignName: { contains: 'Test' } },
          { campaignName: { contains: 'TEST' } },
          { campaignName: { contains: 'Temp' } },
          { campaignName: { contains: 'TEMP' } },
        ],
        ...(activeIds.length > 0 && {
          id: {
            notIn: activeIds,
          },
        }),
      },
    });

    // 전체 링크 통계
    const totalStats = await prisma.affiliateLink.groupBy({
      by: ['status'],
      _count: true,
    });

    return NextResponse.json({
      ok: true,
      preview: {
        expired: expiredCount,
        inactive: inactiveCount,
        old: oldCount,
        test: testCount,
        total: expiredCount + inactiveCount + oldCount + testCount,
      },
      currentStats: totalStats.map((s) => ({
        status: s.status,
        count: s._count,
      })),
    });
  } catch (error: any) {
    console.error('[Admin Link Cleanup] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST: 정리 실행
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 확인
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.userId) },
      select: { role: true },
    });

    if (user?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // 정리 실행
    const stats = await runManualCleanup();

    // 정리 후 통계
    const afterStats = await prisma.affiliateLink.groupBy({
      by: ['status'],
      _count: true,
    });

    return NextResponse.json({
      ok: true,
      stats,
      afterStats: afterStats.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      message: `정리 완료: 총 ${stats.total}개 링크 처리됨${stats.backedUp > 0 ? ` (${stats.backedUp}개 링크 데이터 백업됨)` : ''}`,
    });
  } catch (error: any) {
    console.error('[Admin Link Cleanup] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
