export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * GET /api/admin/affiliate/messages/activities
 * 관리자용: 모든 팀의 고객 기록 업데이트 조회
 * 최근 30일간의 데이터만 조회
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const skip = (page - 1) * limit;

        // 30일 전 날짜
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 총 개수 조회 (페이지네이션용)
        const totalCount = await prisma.affiliateInteraction.count({
            where: {
                occurredAt: { gte: thirtyDaysAgo },
            },
        });

        logger.log(`[Admin Activities] Total count: ${totalCount}, thirtyDaysAgo: ${thirtyDaysAgo.toISOString()}`);

        // 고객 기록 조회 (관리자는 모든 기록 조회 가능)
        const activities = await prisma.affiliateInteraction.findMany({
            where: {
                occurredAt: { gte: thirtyDaysAgo },
            },
            include: {
                AffiliateLead: {
                    select: {
                        id: true,
                        customerName: true,
                        customerPhone: true,
                        status: true,
                    },
                },
                AffiliateProfile: {
                    select: {
                        id: true,
                        displayName: true,
                        type: true,
                        User: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                User: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { occurredAt: 'desc' },
            skip,
            take: limit,
        });

        logger.log(`[Admin Activities] Found ${activities.length} activities`);

        // 프로필 타입별 카운트 로깅
        const profileTypes = activities.reduce((acc, a) => {
            const type = a.AffiliateProfile?.type || 'NO_PROFILE';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        logger.log(`[Admin Activities] Profile types:`, profileTypes);

        // 응답 포맷팅
        const formattedActivities = activities.map((activity) => ({
            id: activity.id,
            interactionType: activity.interactionType,
            note: activity.note,
            occurredAt: activity.occurredAt.toISOString(),
            // 고객 정보
            lead: activity.AffiliateLead ? {
                id: activity.AffiliateLead.id,
                customerName: activity.AffiliateLead.customerName,
                customerPhone: activity.AffiliateLead.customerPhone,
                status: activity.AffiliateLead.status,
            } : null,
            // 담당자 정보
            profile: activity.AffiliateProfile ? {
                id: activity.AffiliateProfile.id,
                displayName: activity.AffiliateProfile.displayName || activity.AffiliateProfile.User?.name,
                type: activity.AffiliateProfile.type,
            } : null,
            // 기록 작성자
            createdBy: activity.User ? {
                id: activity.User.id,
                name: activity.User.name,
            } : null,
            // 관리자는 모든 기록이 타인 기록
            isOwn: false,
        }));

        const totalPages = Math.ceil(totalCount / limit);

        return NextResponse.json({
            ok: true,
            activities: formattedActivities,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasMore: page < totalPages,
            },
        });
    } catch (error: any) {
        console.error('[Admin Activities] Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Failed to fetch activities' },
            { status: error.status || 500 }
        );
    }
}
