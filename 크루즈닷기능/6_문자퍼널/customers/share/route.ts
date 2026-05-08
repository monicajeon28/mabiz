
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext, PartnerApiError } from '@/app/api/partner/_utils';

export async function POST(req: NextRequest) {
    try {
        const { profile } = await requirePartnerContext();

        // Only Branch Managers can share leads
        if (profile.type !== 'BRANCH_MANAGER') {
            return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
        }

        const body = await req.json();
        const { leadIds, targetManagerId, action } = body; // action: 'SHARE' or 'RECALL'

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return NextResponse.json({ ok: false, message: '대상이 선택되지 않았습니다.' }, { status: 400 });
        }

        if (action === 'SHARE' && !targetManagerId) {
            return NextResponse.json({ ok: false, message: '공유할 대리점장이 선택되지 않았습니다.' }, { status: 400 });
        }

        // Verify ownership of leads
        const leads = await prisma.affiliateLead.findMany({
            where: {
                id: { in: leadIds },
                managerId: profile.id // Must be owned by current manager
            }
        });

        if (leads.length !== leadIds.length) {
            return NextResponse.json({ ok: false, message: '일부 리드에 대한 권한이 없습니다.' }, { status: 403 });
        }

        if (action === 'SHARE') {
            // Verify target manager exists and is a Branch Manager
            const targetManager = await prisma.affiliateProfile.findUnique({
                where: { id: parseInt(targetManagerId) },
                select: { id: true, type: true }
            });

            if (!targetManager || targetManager.type !== 'BRANCH_MANAGER') {
                return NextResponse.json({ ok: false, message: '유효하지 않은 대리점장입니다.' }, { status: 400 });
            }

            // Update leads
            await prisma.affiliateLead.updateMany({
                where: { id: { in: leadIds } },
                data: {
                    sharedToManagerId: parseInt(targetManagerId),
                    updatedAt: new Date()
                }
            });

            return NextResponse.json({ ok: true, message: `${leadIds.length}개의 DB를 공유했습니다.` });

        } else if (action === 'RECALL') {
            // Update leads to remove sharedToManagerId
            await prisma.affiliateLead.updateMany({
                where: { id: { in: leadIds } },
                data: {
                    sharedToManagerId: null,
                    updatedAt: new Date()
                }
            });

            return NextResponse.json({ ok: true, message: `${leadIds.length}개의 DB 공유를 회수했습니다.` });
        } else {
            return NextResponse.json({ ok: false, message: '잘못된 요청입니다.' }, { status: 400 });
        }

    } catch (error) {
        if (error instanceof PartnerApiError) {
            return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
        }
        console.error('[DB Share] Error:', error);
        return NextResponse.json({ ok: false, message: '처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
