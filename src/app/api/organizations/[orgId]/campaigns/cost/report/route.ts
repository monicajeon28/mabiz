export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ orgId: string }> };

/**
 * GET /api/organizations/[orgId]/campaigns/cost/report
 * 조직의 월별 캠페인 비용 리포트
 */
export async function GET(
  request: NextRequest,
  { params }: Params
) {
  try {
    const ctx = await getAuthContext();
    const currentOrgId = requireOrgId(ctx);
    const { orgId } = await params;

    // IDOR 방지: 현재 조직 확인
    if (currentOrgId !== orgId) {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 쿼리 파라미터에서 month 필터 (선택사항)
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month'); // YYYY-MM 형식

    let dateFilter: any = undefined;

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      // 특정 월의 데이터만 조회
      const [year, month] = monthParam.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      dateFilter = { gte: startDate, lte: endDate };
    }

    // 전체 조직 비용 통계 (월별 또는 전체)
    const costs = await prisma.campaignCost.findMany({
      where: {
        organizationId: orgId,
        ...(dateFilter ? { createdAt: dateFilter } : {})
      },
      select: {
        smsCostTotal: true,
        emailCostTotal: true,
        successCount: true,
        failureCount: true,
        actualCostTotal: true,
        createdAt: true,
        campaign: {
          select: {
            title: true,
            status: true
          }
        }
      }
    });

    // 집계 계산
    const totalCost = costs.reduce((sum, c) => sum + c.actualCostTotal, 0);
    const totalSuccess = costs.reduce((sum, c) => sum + c.successCount, 0);
    const totalFailure = costs.reduce((sum, c) => sum + c.failureCount, 0);
    const smsCost = costs.reduce((sum, c) => sum + c.smsCostTotal, 0);
    const emailCost = costs.reduce((sum, c) => sum + c.emailCostTotal, 0);

    const costPerSuccess = totalSuccess > 0 ? totalCost / totalSuccess : 0;
    const successRate = (totalSuccess + totalFailure) > 0
      ? (totalSuccess / (totalSuccess + totalFailure)) * 100
      : 0;

    logger.log('[GET /api/organizations/[orgId]/campaigns/cost/report]', {
      orgId,
      campaignCount: costs.length,
      totalCost
    });

    return NextResponse.json({
      ok: true,
      period: {
        start: monthParam
          ? `${monthParam}-01`
          : new Date(0).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      },
      aggregate: {
        campaignCount: costs.length,
        totalCost,
        smsCost,
        emailCost,
        totalSuccess,
        totalFailure,
        successRate: Math.round(successRate * 100) / 100,
        costPerSuccess: Math.round(costPerSuccess * 100) / 100
      },
      campaigns: costs.map(c => ({
        title: c.campaign.title,
        status: c.campaign.status,
        cost: c.actualCostTotal,
        success: c.successCount,
        failure: c.failureCount,
        createdAt: c.createdAt
      }))
    });
  } catch (err) {
    logger.error('[GET /api/organizations/[orgId]/campaigns/cost/report]', { err });
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
