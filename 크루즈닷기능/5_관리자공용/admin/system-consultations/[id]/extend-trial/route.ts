export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function POST(
    req: NextRequest,
    context: RouteContext
) {
    try {
        const resolvedParams = await context.params;
        const consultationId = parseInt(resolvedParams.id);
        if (isNaN(consultationId)) {
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
            return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
        }

        if (!sessionUser) {
            return NextResponse.json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
        }

        // 권한 확인: 관리자 또는 해당 상담의 담당자
        const consultation = await prisma.systemConsultation.findUnique({
            where: { id: consultationId }
        });

        if (!consultation) {
            return NextResponse.json({ ok: false, message: '상담 내역을 찾을 수 없습니다.' }, { status: 404 });
        }

        let hasPermission = false;
        if (sessionUser.role === 'admin') {
            hasPermission = true;
        } else {
            const userProfile = await prisma.affiliateProfile.findUnique({
                where: { userId: sessionUser.id }
            });

            if (userProfile) {
                if (consultation.managerId === userProfile.id || consultation.agentId === userProfile.id) {
                    hasPermission = true;
                }
            }
        }

        if (!hasPermission) {
            return NextResponse.json({ ok: false, message: '권한이 없습니다.' }, { status: 403 });
        }

        const body = await req.json();
        const { days = 3 } = body; // 기본 3일 연장 (통일)

        if (!Number.isInteger(days) || days < 1 || days > 30) {
            return NextResponse.json({ ok: false, message: '연장 기간은 1~30일 사이여야 합니다.' }, { status: 400 });
        }

        // 해당 연락처를 가진 AffiliateLead 찾기
        const lead = await prisma.affiliateLead.findFirst({
            where: { customerPhone: consultation.phone },
            orderBy: { createdAt: 'desc' }
        });

        if (!lead) {
            return NextResponse.json({ ok: false, message: '해당 연락처로 등록된 잠재고객(Lead) 정보를 찾을 수 없어 체험 기간을 연장할 수 없습니다.' }, { status: 404 });
        }

        // 리드의 체험 기간 연장
        const currentMetadata = lead.metadata as any || {};
        const currentExpiresAt = currentMetadata.trialExpiresAt ? new Date(currentMetadata.trialExpiresAt) : new Date();
        const baseDate = currentExpiresAt < new Date() ? new Date() : currentExpiresAt;
        const newExpiresAt = new Date(baseDate);
        newExpiresAt.setDate(newExpiresAt.getDate() + days);

        await prisma.affiliateLead.update({
            where: { id: lead.id },
            data: {
                metadata: {
                    ...currentMetadata,
                    trialExpiresAt: newExpiresAt.toISOString(),
                    lastTrialExtensionBy: sessionUser.id,
                    lastTrialExtensionAt: new Date().toISOString(),
                }
            }
        });

        // 상담 내역에도 메타데이터 업데이트 (기록용)
        await prisma.systemConsultation.update({
            where: { id: consultationId },
            data: {
                metadata: {
                    ...(consultation.metadata as any || {}),
                    lastTrialExtensionAt: new Date().toISOString(),
                    extendedDays: days
                }
            }
        });

        // 이력 기록
        await prisma.affiliateInteraction.create({
            data: {
                leadId: lead.id,
                createdById: sessionUser.id,
                interactionType: 'TRIAL_EXTENDED',
                note: `시스템 상담 내역에서 무료 체험 기간이 ${days}일 연장되었습니다. (만료일: ${newExpiresAt.toLocaleDateString()})`,
                metadata: {
                    extendedDays: days,
                    newExpiresAt: newExpiresAt.toISOString(),
                    consultationId: consultationId
                }
            }
        });

        return NextResponse.json({
            ok: true,
            message: `${days}일 연장되었습니다.`,
            newExpiresAt: newExpiresAt.toISOString(),
        });

    } catch (error: any) {
        console.error('[System Consultation Extend] Error:', error);
        return NextResponse.json(
            { ok: false, message: '연장 처리에 실패했습니다.' },
            { status: 500 }
        );
    }
}
