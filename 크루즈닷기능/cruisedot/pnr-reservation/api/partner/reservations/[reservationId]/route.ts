export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerContext } from '@/app/api/partner/_utils';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { PartnerApiError } from '@/app/api/partner/_utils';

/**
 * GET /api/partner/reservations/[reservationId]
 * 예약 상세 정보 조회 (Traveler 포함)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  try {
    const { profile } = await requirePartnerContext();
    const { reservationId: reservationIdStr } = await params;
    const reservationId = parseInt(reservationIdStr);

    if (isNaN(reservationId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid reservation ID' },
        { status: 400 }
      );
    }

    // 대리점장인 경우 팀 판매원들의 ID 목록 조회
    let teamAgentIds: number[] = [];
    if (profile.type === 'BRANCH_MANAGER') {
      const teamRelations = await prisma.affiliateRelation.findMany({
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

    // 대리점장/판매원이 관리하는 Lead 조회
    const managedLeads = await prisma.affiliateLead.findMany({
      where: {
        OR: [
          { managerId: profile.id },
          { agentId: profile.id },
          // 대리점장인 경우 팀 판매원들이 관리하는 Lead도 포함
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

      const usersFromPhones = await prisma.user.findMany({
        where: {
          phone: { in: Array.from(phoneVariants) },
        },
        select: {
          id: true,
        },
      });
      usersFromPhones.forEach(user => managedUserIds.add(user.id));
    }

    // 예약 정보 조회 (Traveler 포함)
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        Traveler: {
          orderBy: [
            { roomNumber: 'asc' },
            { id: 'asc' },
          ],
        },
        Trip: {
          select: {
            id: true,
            productCode: true,
            shipName: true,
            departureDate: true,
            endDate: true,
          },
        },
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: 'Reservation not found' },
        { status: 404 }
      );
    }

    // 권한 확인: 예약이 관리하는 고객의 예약인지 확인
    if (!managedUserIds.has(reservation.mainUserId)) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Product 정보 조회 (productCode로 CruiseProduct 조회)
    let product = null;
    if (reservation.Trip?.productCode) {
      const cruiseProduct = await prisma.cruiseProduct.findUnique({
        where: { productCode: reservation.Trip.productCode },
        select: {
          id: true,
          productCode: true,
          cruiseLine: true,
          shipName: true,
          packageName: true,
          nights: true,
          days: true,
          basePrice: true,
          description: true,
        },
      });
      product = cruiseProduct;
    }

    return NextResponse.json({
      ok: true,
      reservation: {
        id: reservation.id,
        totalPeople: reservation.totalPeople,
        pnrStatus: reservation.pnrStatus,
        createdAt: reservation.createdAt ? reservation.createdAt.toISOString() : null,
        trip: reservation.Trip ? {
          id: reservation.Trip.id,
          productCode: reservation.Trip.productCode,
          shipName: reservation.Trip.shipName,
          departureDate: reservation.Trip.departureDate ? reservation.Trip.departureDate.toISOString() : null,
          endDate: reservation.Trip.endDate ? reservation.Trip.endDate.toISOString() : null,
          product: product,
        } : null,
        user: reservation.User,
        travelers: reservation.Traveler.map((t) => ({
          id: t.id,
          roomNumber: t.roomNumber,
          korName: t.korName,
          engSurname: t.engSurname,
          engGivenName: t.engGivenName,
          passportNo: t.passportNo,
          residentNum: t.residentNum,
          nationality: t.nationality,
          dateOfBirth: t.dateOfBirth ? t.dateOfBirth.toISOString().split('T')[0] : null,
          passportExpiryDate: t.passportExpiryDate ? t.passportExpiryDate.toISOString().split('T')[0] : null,
          hasPassportImage: !!t.passportImage,
        })),
      },
    });
  } catch (error: any) {
    logger.error('[Reservation GET] Error', { error: error instanceof Error ? error.message : String(error) });
    const isBusinessError = error instanceof PartnerApiError;
    return NextResponse.json(
      { ok: false, message: isBusinessError ? error.message : '예약 정보를 불러올 수 없습니다.' },
      { status: isBusinessError ? error.status : 500 }
    );
  }
}

