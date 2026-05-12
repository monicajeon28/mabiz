export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import { generatePassportTokenAsync } from '@/app/api/admin/passport-request/_utils';

/**
 * POST: 파트너용 여권/PNR 등록 링크 생성
 * - 파트너 권한 확인
 * - 해당 고객(Lead)이 파트너의 관리 대상인지 확인
 * - V4 토큰 생성 및 링크 반환
 */
export async function POST(req: NextRequest) {
    try {
        const { profile } = await requirePartnerContext();
        const body = await req.json();
        const { userId, leadId } = body;

        if (!userId || !leadId) {
            return NextResponse.json({ ok: false, error: 'User ID and Lead ID are required' }, { status: 400 });
        }

        // Lead가 파트너의 관리 대상인지 확인
        const lead = await prisma.affiliateLead.findUnique({
            where: { id: Number(leadId) },
            select: {
                id: true,
                managerId: true,
                agentId: true,
            },
        });

        if (!lead) {
            return NextResponse.json({ ok: false, error: 'Lead not found' }, { status: 404 });
        }

        // 권한 체크
        let hasAccess = false;
        if (profile.type === 'BRANCH_MANAGER') {
            // 대리점장은 본인 또는 소속 판매원의 Lead 접근 가능
            if (lead.managerId === profile.id || lead.agentId === profile.id) {
                hasAccess = true;
            } else if (lead.agentId) {
                // 판매원이 본인 팀인지 확인
                const relation = await prisma.affiliateRelation.findFirst({
                    where: {
                        managerId: profile.id,
                        agentId: lead.agentId,
                        status: 'ACTIVE',
                    },
                });
                if (relation) hasAccess = true;
            }
        } else if (profile.type === 'SALES_AGENT') {
            // 판매원은 본인 Lead만 접근 가능
            if (lead.agentId === profile.id) {
                hasAccess = true;
            }
        }

        if (!hasAccess) {
            return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
        }

        // Trip ID 찾기 (최근 예약 기준)
        // V4 시스템은 Trip ID가 필요함. 예약이 없으면 링크 생성 불가할 수 있음.
        // 하지만 예약 전에도 여권을 받을 수 있어야 한다면?
        // 현재 generatePassportToken은 tripId를 필수로 받음.
        // 예약(Reservation)이나 UserTrip을 찾아야 함.

        const latestReservation = await prisma.reservation.findFirst({
            where: { mainUserId: Number(userId) },
            orderBy: { id: 'desc' },
            select: { tripId: true },
        });

        let tripId = latestReservation?.tripId;

        if (!tripId) {
            // 예약이 없으면 UserTrip 확인
            const latestUserTrip = await prisma.userTrip.findFirst({
                where: { userId: Number(userId) },
                orderBy: { createdAt: 'desc' },
                select: { productId: true }, // productId가 tripId와 매핑되는지 확인 필요. Trip 모델은 productCode를 가짐.
            });

            // Trip 테이블에서 productCode로 tripId 찾기
            if (latestUserTrip?.productId) {
                const product = await prisma.cruiseProduct.findUnique({
                    where: { id: latestUserTrip.productId },
                    select: { productCode: true }
                });
                if (product?.productCode) {
                    const trip = await prisma.trip.findUnique({
                        where: { productCode: product.productCode }
                    });
                    tripId = trip?.id;
                }
            }
        }

        if (!tripId) {
            // 임시로 기본 Trip ID 사용하거나 에러 반환
            // 여기서는 에러 반환
            return NextResponse.json({ ok: false, error: '해당 고객의 예약 또는 여행 정보를 찾을 수 없어 여권 링크를 생성할 수 없습니다.' }, { status: 400 });
        }

        // 토큰 생성
        const token = await generatePassportTokenAsync(Number(userId), tripId);

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cruiseguide.co.kr';
        const passportLink = `${baseUrl}/passport/${token}?mode=passport`;
        const pnrLink = `${baseUrl}/passport/${token}?mode=pnr`;

        return NextResponse.json({
            ok: true,
            passportLink,
            pnrLink,
        });

    } catch (error) {
        console.error('[Partner Passport Link] Error:', error);
        return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
