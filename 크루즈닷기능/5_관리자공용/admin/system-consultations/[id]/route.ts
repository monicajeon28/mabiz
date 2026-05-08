
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const consultationId = parseInt(params.id);
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

        // 삭제
        await prisma.systemConsultation.delete({
            where: { id: consultationId }
        });

        return NextResponse.json({
            ok: true,
            message: '삭제되었습니다.'
        });

    } catch (error: any) {
        console.error('[System Consultation DELETE] Error:', error);
        return NextResponse.json(
            { ok: false, message: '삭제 처리에 실패했습니다.' },
            { status: 500 }
        );
    }
}
