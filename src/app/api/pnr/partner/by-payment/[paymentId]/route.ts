export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/lib/passport-auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 403 }
      );
    }
    const { profile } = ctx;

    const { paymentId: paymentIdStr } = await params;
    const paymentId = parseInt(paymentIdStr, 10);
    if (isNaN(paymentId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid payment ID' },
        { status: 400 }
      );
    }

    // 결제 정보 조회
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        buyerName: true,
        buyerTel: true,
        buyerEmail: true,
        orderId: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { ok: false, error: 'Payment not found' },
        { status: 404 }
      );
    }

    // 지사장인 경우 팀 대리점장들의 ID 목록 조회
    let teamAgentIds: number[] = [];
    if (profile.type === 'BRANCH_MANAGER') {
      const teamRelations = await prisma.gmAffiliateRelation.findMany({
        where: {
          managerId: profile.id,
          status: 'ACTIVE',
        },
        select: {
          agentId: true,
        },
      });
      teamAgentIds = teamRelations
        .map(r => r.agentId)
        .filter((id): id is number => id !== null);
    }

    // 지사장/대리점장이 관리하는 Lead 조회
    const managedLeads = await prisma.gmAffiliateLead.findMany({
      where: {
        OR: [
          { managerId: profile.id },
          { agentId: profile.id },
          // 지사장인 경우 팀 대리점장들이 관리하는 Lead도 포함
          ...(profile.type === 'BRANCH_MANAGER' && teamAgentIds.length > 0
            ? [{ agentId: { in: teamAgentIds } }]
            : []),
        ],
      },
      select: {
        customerPhone: true,
      },
    });

    // 전화번호를 사용하여 User ID 찾기
    const managedUserIds = new Set<number>();

    // 전화번호로 매칭
    const uniquePhoneDigits = new Set<string>();
    managedLeads.forEach(lead => {
      const phone = lead.customerPhone;
      if (phone) {
        const digits = phone.replace(/[^0-9]/g, '');
        if (digits.length >= 10) {
          uniquePhoneDigits.add(digits);
        }
      }
    });

    if (uniquePhoneDigits.size > 0) {
      // 전화번호 변형 생성 (하이픈 포함/미포함)
      const phoneVariants = new Set<string>();
      uniquePhoneDigits.forEach(digits => {
        phoneVariants.add(digits); // 숫자만
        if (digits.length === 11) {
          phoneVariants.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`); // 010-1234-5678
        } else if (digits.length === 10) {
          phoneVariants.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`); // 010-123-4567
        }
      });

      const usersFromPhones = await prisma.gmUser.findMany({
        where: {
          phone: { in: Array.from(phoneVariants) },
        },
        select: {
          id: true,
        },
      });
      usersFromPhones.forEach(user => managedUserIds.add(user.id));
    }

    const managedUserIdsArray = Array.from(managedUserIds);

    // 해당 결제와 연결된 예약 조회 (buyerTel 또는 buyerEmail로 매칭, 그리고 관리하는 고객만)
    const reservations = await prisma.gmReservation.findMany({
      where: {
        AND: [
          {
            OR: [
              { mainUser: { phone: payment.buyerTel } },
              { mainUser: { email: payment.buyerEmail } },
            ],
          },
          {
            mainUserId: managedUserIdsArray.length > 0 ? { in: managedUserIdsArray } : { in: [] },
          },
        ],
      },
      include: {
        mainUser: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const reservationIds = reservations.map((r) => r.id);
    const allTravelers = reservationIds.length > 0
      ? await prisma.gmTraveler.findMany({
          where: { reservationId: { in: reservationIds } },
          select: { id: true, reservationId: true, korName: true, engSurname: true, engGivenName: true, passportNo: true, birthDate: true, expiryDate: true },
        })
      : [];
    const travelersByReservation = new Map<number, typeof allTravelers>();
    allTravelers.forEach((t) => {
      const list = travelersByReservation.get(t.reservationId) ?? [];
      list.push(t);
      travelersByReservation.set(t.reservationId, list);
    });

    return NextResponse.json({
      ok: true,
      reservations: reservations.map((r) => ({
        id: r.id,
        totalPeople: r.totalPeople,
        pnrStatus: r.pnrStatus,
        createdAt: r.createdAt.toISOString(),
        user: r.mainUser,
        travelers: travelersByReservation.get(r.id) ?? [],
      })),
    });
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    logger.error('[Reservations by Payment] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: (err as any).message || 'Failed to fetch reservations',
      },
      { status: 500 }
    );
  }
}
