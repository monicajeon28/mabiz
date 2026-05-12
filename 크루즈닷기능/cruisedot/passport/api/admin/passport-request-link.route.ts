import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminUser, generatePassportToken } from '../_utils';

export async function POST(req: NextRequest) {
    try {
        const admin = await requireAdminUser();
        if (!admin) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { userId, tripId } = body;

        if (!userId) {
            return NextResponse.json({ ok: false, error: 'User ID is required' }, { status: 400 });
        }

        // 1. User & Trip 확인
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { trips: true },
        });

        if (!user) {
            return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
        }

        // tripId가 없으면 가장 최근 여행 사용
        let targetTripId = tripId;
        if (!targetTripId && user.trips && user.trips.length > 0) {
            targetTripId = user.trips[0].id;
        }

        if (!targetTripId) {
            return NextResponse.json({ ok: false, error: 'No trip found for user' }, { status: 400 });
        }

        // 2. 기존 Submission 확인 또는 생성
        let submission = await prisma.passportSubmission.findFirst({
            where: {
                userId: userId,
                tripId: targetTripId,
                tokenExpiresAt: { gt: new Date() }, // 만료되지 않은 것
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!submission) {
            const token = generatePassportToken();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 3); // 3일 유효

            submission = await prisma.passportSubmission.create({
                data: {
                    userId: userId,
                    tripId: targetTripId,
                    token: token,
                    tokenExpiresAt: expiresAt,
                    status: 'PENDING',
                },
            });
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cruise-guide.co.kr';
        const passportLink = `${baseUrl}/passport/${submission.token}?mode=passport`;
        const pnrLink = `${baseUrl}/passport/${submission.token}?mode=pnr`;

        return NextResponse.json({
            ok: true,
            passportLink,
            pnrLink,
            token: submission.token
        });

    } catch (error: any) {
        console.error('[Passport Link] Error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
