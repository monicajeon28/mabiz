import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { enqueueApisSync } from '@/lib/apis-sync-queue';
import { getSession } from '@/lib/session';

export async function POST(
    req: NextRequest,
    { params }: { params: { reservationId: string } }
) {
    console.log('[Sync APIS] Request received for reservationId:', params.reservationId);

    try {
        // 인증 체크
        const session = await getSession();
        console.log('[Sync APIS] Session:', session?.userId ? `userId: ${session.userId}` : 'No session');

        if (!session?.userId) {
            return NextResponse.json(
                { ok: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // 사용자 정보 조회 (관리자 또는 파트너 권한 확인)
        const user = await prisma.user.findUnique({
            where: { id: Number(session.userId) },
            select: {
                role: true,
                affiliateProfile: { select: { id: true, type: true } }
            },
        });
        console.log('[Sync APIS] User:', { role: user?.role, affiliateProfileId: user?.affiliateProfile?.id });

        const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
        const isPartner = !!user?.affiliateProfile;

        if (!isAdmin && !isPartner) {
            console.log('[Sync APIS] Forbidden - not admin or partner');
            return NextResponse.json(
                { ok: false, error: 'Forbidden' },
                { status: 403 }
            );
        }

        const reservationId = parseInt(params.reservationId);
        if (isNaN(reservationId)) {
            return NextResponse.json(
                { ok: false, error: 'Invalid reservation ID' },
                { status: 400 }
            );
        }

        const reservation = await prisma.reservation.findUnique({
            where: { id: reservationId },
            include: { Trip: true },
        });
        console.log('[Sync APIS] Reservation:', {
            id: reservation?.id,
            tripId: reservation?.Trip?.id,
            affiliateId: reservation?.affiliateId
        });

        if (!reservation || !reservation.Trip) {
            console.log('[Sync APIS] Reservation or Trip not found');
            return NextResponse.json(
                { ok: false, error: 'Reservation or Trip not found' },
                { status: 404 }
            );
        }

        // 파트너인 경우, 자신의 예약만 동기화 가능 (하지만 대리점장 권한 체크 개선)
        if (!isAdmin && isPartner) {
            // 대리점장(BRANCH_MANAGER)은 모든 하위 판매원의 예약도 동기화 가능
            const isBranchManager = user?.affiliateProfile?.type === 'BRANCH_MANAGER';

            if (!isBranchManager && reservation.affiliateId !== user?.affiliateProfile?.id) {
                console.log('[Sync APIS] Forbidden - not owner', {
                    reservationAffiliateId: reservation.affiliateId,
                    userAffiliateId: user?.affiliateProfile?.id
                });
                return NextResponse.json(
                    { ok: false, error: 'Forbidden - Not your reservation' },
                    { status: 403 }
                );
            }
        }

        // Trigger APIS Sync
        console.log('[Sync APIS] Triggering enqueueApisSync for tripId:', reservation.Trip.id);
        await enqueueApisSync('TRIP_SHEET', reservation.Trip.id, 0); // 0 delay for immediate action

        console.log('[Sync APIS] Success - PNR sync triggered');
        return NextResponse.json({
            ok: true,
            message: 'PNR data sync triggered successfully.',
        });
    } catch (error: any) {
        console.error('[Sync APIS] Error:', error);
        console.error('[Sync APIS] Error details:', {
            message: error?.message,
            code: error?.code,
            stack: error?.stack?.substring(0, 500)
        });
        return NextResponse.json(
            { ok: false, error: 'Failed to trigger PNR sync.', details: error?.message },
            { status: 500 }
        );
    }
}
