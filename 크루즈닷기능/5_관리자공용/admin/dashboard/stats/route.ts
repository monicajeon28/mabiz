export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/admin/dashboard/stats
 * 관리자 대시보드 통계 데이터
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        // 1. 전체 사용자 통계
        const userStats = await prisma.user.groupBy({
            by: ['role'],
            _count: { id: true },
        });

        const totalUsers = userStats.reduce((sum, stat) => sum + stat._count.id, 0);
        const usersByRole = Object.fromEntries(
            userStats.map(stat => [stat.role, stat._count.id])
        );

        // 2. 활성 제휴사 통계
        const activeAffiliates = await prisma.affiliateProfile.count({
            where: {
                User: {
                    isHibernated: false,
                    isLocked: false,
                },
            },
        });

        const totalAffiliates = await prisma.affiliateProfile.count();

        const affiliatesByType = await prisma.affiliateProfile.groupBy({
            by: ['type'],
            _count: { id: true },
        });

        // 3. 매출 통계 (이번 달, 지난 달)
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        const thisMonthSales = await prisma.affiliateSale.aggregate({
            where: {
                createdAt: { gte: thisMonthStart },
                status: { in: ['CONFIRMED', 'SETTLED'] },
            },
            _sum: { amount: true },
            _count: { id: true },
        });

        const lastMonthSales = await prisma.affiliateSale.aggregate({
            where: {
                createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
                status: { in: ['CONFIRMED', 'SETTLED'] },
            },
            _sum: { amount: true },
            _count: { id: true },
        });

        // 4. 수수료 통계
        const thisMonthCommission = await prisma.commissionLedger.aggregate({
            where: {
                createdAt: { gte: thisMonthStart },
                status: 'APPROVED',
            },
            _sum: { amount: true },
        });

        const lastMonthCommission = await prisma.commissionLedger.aggregate({
            where: {
                createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
                status: 'APPROVED',
            },
            _sum: { amount: true },
        });

        // 5. 최근 등록 (지난 7일)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentRegistrations = await prisma.user.count({
            where: {
                createdAt: { gte: sevenDaysAgo },
            },
        });

        // 6. 승인 대기 항목
        const pendingContracts = await prisma.affiliateContract.count({
            where: { status: 'PENDING' },
        });

        const pendingDocuments = await prisma.affiliateDocument.count({
            where: { status: 'PENDING' },
        });

        const pendingCertificates = await prisma.certificateApproval.count({
            where: { status: 'pending' },
        });

        // 7. 지난 6개월 매출 추세
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const monthlySales = await prisma.$queryRaw`
      SELECT 
        DATE_FORMAT(createdAt, '%Y-%m') as month,
        COUNT(*) as count,
        SUM(amount) as total
      FROM AffiliateSale
      WHERE createdAt >= ${sixMonthsAgo}
        AND status IN ('CONFIRMED', 'SETTLED')
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
      ORDER BY month ASC
    `;

        return NextResponse.json({
            ok: true,
            stats: {
                users: {
                    total: totalUsers,
                    byRole: usersByRole,
                    recentRegistrations,
                },
                affiliates: {
                    total: totalAffiliates,
                    active: activeAffiliates,
                    byType: Object.fromEntries(
                        affiliatesByType.map(stat => [stat.type, stat._count.id])
                    ),
                },
                sales: {
                    thisMonth: {
                        count: thisMonthSales._count.id,
                        amount: thisMonthSales._sum.amount || 0,
                    },
                    lastMonth: {
                        count: lastMonthSales._count.id,
                        amount: lastMonthSales._sum.amount || 0,
                    },
                    trend: monthlySales,
                },
                commission: {
                    thisMonth: thisMonthCommission._sum.amount || 0,
                    lastMonth: lastMonthCommission._sum.amount || 0,
                },
                pending: {
                    contracts: pendingContracts,
                    documents: pendingDocuments,
                    certificates: pendingCertificates,
                    total: pendingContracts + pendingDocuments + pendingCertificates,
                },
            },
        });
    } catch (error: any) {
        console.error('[Admin Dashboard Stats] Error:', error);
        return NextResponse.json(
            { ok: false, error: 'Failed to fetch dashboard stats' },
            { status: 500 }
        );
    }
}
