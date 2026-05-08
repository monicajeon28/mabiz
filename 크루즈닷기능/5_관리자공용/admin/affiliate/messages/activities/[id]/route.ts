export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

/**
 * DELETE /api/admin/affiliate/messages/activities/[id]
 * 관리자용: 고객 기록(AffiliateInteraction) 삭제
 * 관리자는 모든 기록 삭제 가능
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const activityId = parseInt(id);

        if (isNaN(activityId)) {
            return NextResponse.json({ ok: false, error: 'Invalid activity ID' }, { status: 400 });
        }

        // 삭제할 기록 조회
        const activity = await prisma.affiliateInteraction.findUnique({
            where: { id: activityId },
            select: { id: true, profileId: true },
        });

        if (!activity) {
            return NextResponse.json({ ok: false, error: 'Activity not found' }, { status: 404 });
        }

        // 삭제 실행 (관리자는 무조건 삭제 가능)
        await prisma.affiliateInteraction.delete({
            where: { id: activityId },
        });

        logger.log(`[Admin Activities] Deleted activity ${activityId} by admin ${user.id}`);

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('[Admin Activities DELETE] Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Failed to delete activity' },
            { status: error.status || 500 }
        );
    }
}
