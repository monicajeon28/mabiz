export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

type RouteContext = {
    params: Promise<{ leadId: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
    try {
        const resolvedParams = await context.params;
        const leadId = parseInt(resolvedParams.leadId);
        logger.log('[B2B Lead Extend Trial] Starting...', { leadId });

        if (isNaN(leadId)) {
            return NextResponse.json({ ok: false, message: '잘못된 요청입니다.' }, { status: 400 });
        }

        // 인증 확인
        let sessionUser: { id: number; role: string | null } | null = null;
        try {
            const cookieStore = await cookies();
            const sid = cookieStore.get('cg.sid.v2')?.value;
            if (sid) {
                const sess = await prisma.session.findUnique({
                    where: { id: sid },
                    select: { User: { select: { id: true, role: true } } },
                });
                if (sess?.User) {
                    sessionUser = { id: sess.User.id, role: sess.User.role };
                }
            }
        } catch (authError) {
            console.error('[B2B Lead Extend Trial] Auth error:', authError);
            return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
        }

        if (!sessionUser) {
            return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
        }

        logger.log('[B2B Lead Extend Trial] Session user:', sessionUser.id);

        // 권한 확인: 관리자 또는 해당 리드의 담당자(대리점장/판매원)
        const lead = await prisma.affiliateLead.findUnique({
            where: { id: leadId },
            include: {
                AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: true,
                AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: true,
            }
        });

        if (!lead) {
            return NextResponse.json({ ok: false, message: '리드를 찾을 수 없습니다.' }, { status: 404 });
        }

        logger.log('[B2B Lead Extend Trial] Lead found:', { id: lead.id, name: lead.customerName, phone: lead.customerPhone });

        // 권한 체크 로직
        let hasPermission = false;
        if (sessionUser.role === 'admin') {
            hasPermission = true;
        } else {
            // 파트너 권한 체크
            const userProfile = await prisma.affiliateProfile.findUnique({
                where: { userId: sessionUser.id }
            });

            if (userProfile) {
                if (lead.managerId === userProfile.id || lead.agentId === userProfile.id) {
                    hasPermission = true;
                }
            }
        }

        if (!hasPermission) {
            return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
        }

        const body = await req.json();
        const { days = 3 } = body; // 기본 3일 연장

        if (!Number.isInteger(days) || days < 1 || days > 30) {
            return NextResponse.json({ ok: false, message: '연장 기간은 1~30일 사이여야 합니다.' }, { status: 400 });
        }

        // B2B 대시보드 체험 정보는 AffiliateLead.metadata에 저장됨
        const currentMetadata = (lead.metadata as any) || {};
        const now = new Date();

        // 현재 trialExpiresAt 확인
        const currentTrialEnd = currentMetadata.trialExpiresAt
            ? new Date(currentMetadata.trialExpiresAt)
            : new Date();

        // 만료된 경우 오늘부터, 아직 유효한 경우 기존 날짜부터 연장
        const baseDate = currentTrialEnd > now ? currentTrialEnd : now;
        const newTrialEnd = new Date(baseDate);
        newTrialEnd.setDate(newTrialEnd.getDate() + days);

        // AffiliateLead metadata 업데이트
        await prisma.affiliateLead.update({
            where: { id: leadId },
            data: {
                metadata: {
                    ...currentMetadata,
                    trialExpiresAt: newTrialEnd.toISOString(),
                    trialExtendedAt: now.toISOString(),
                    trialExtendedBy: sessionUser.id,
                    trialExtendedDays: (currentMetadata.trialExtendedDays || 0) + days,
                },
                updatedAt: new Date(),
            }
        });

        // 이력 기록
        await prisma.affiliateInteraction.create({
            data: {
                leadId,
                createdById: sessionUser.id,
                interactionType: 'TRIAL_EXTENDED',
                note: `무료 체험 기간이 ${days}일 연장되었습니다. (만료일: ${newTrialEnd.toLocaleDateString('ko-KR')})`,
                metadata: {
                    extendedDays: days,
                    newExpiresAt: newTrialEnd.toISOString(),
                }
            }
        });

        const formattedDate = newTrialEnd.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        logger.log(`[B2B Lead Extend Trial] ${lead.customerName} (${lead.customerPhone}) extended by ${days} days until ${formattedDate}`);

        return NextResponse.json({
            ok: true,
            message: `${lead.customerName || '고객'}님의 무료 체험이 ${days}일 연장되었습니다.\n새 만료일: ${formattedDate}`,
            newTrialEndDate: newTrialEnd.toISOString(),
        });

    } catch (error: any) {
        console.error('[B2B Lead Extend Trial] Error:', error);
        return NextResponse.json(
            { ok: false, message: '연장 처리에 실패했습니다.' },
            { status: 500 }
        );
    }
}
