import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/contacts/[id]/reservations
 * Contact에 연결된 GmReservation + GmTrip 정보 조회
 * Contact.reservationId (직접 FK) 또는 Contact.userId (GmUser → GmTrip → GmReservation) 경로
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id: contactId } = await params;

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
      select: { id: true, reservationId: true, userId: true },
    });
    if (!contact) {
      return NextResponse.json({ ok: false, message: 'Contact not found' }, { status: 404 });
    }

    const reservations: ReservationItem[] = [];

    // 경로 1: 직접 FK (reservationId)
    if (contact.reservationId) {
      const res = await prisma.gmReservation.findUnique({
        where: { id: contact.reservationId },
        include: {
          trip: {
            select: {
              id: true, cruiseName: true, shipName: true, productCode: true,
              startDate: true, endDate: true, nights: true, status: true,
              departureDate: true, reservationCode: true,
            },
          },
        },
      });
      if (res) reservations.push(formatReservation(res));
    }

    // 경로 2: GmUser → GmTrip → GmReservation (userId가 있고 중복 아닌 경우)
    if (contact.userId) {
      const userReservations = await prisma.gmReservation.findMany({
        where: {
          mainUserId: contact.userId,
          ...(contact.reservationId ? { id: { not: contact.reservationId } } : {}),
        },
        include: {
          trip: {
            select: {
              id: true, cruiseName: true, shipName: true, productCode: true,
              startDate: true, endDate: true, nights: true, status: true,
              departureDate: true, reservationCode: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      reservations.push(...userReservations.map(formatReservation));
    }

    logger.log('[GET /api/contacts/[id]/reservations]', {
      contactId, orgId, count: reservations.length,
    });

    return NextResponse.json({ ok: true, reservations, total: reservations.length });
  } catch (err) {
    logger.error('[GET /api/contacts/[id]/reservations]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

type GmReservationWithTrip = {
  id: number;
  status: string;
  totalPeople: number;
  cabinType: string | null;
  paymentDate: Date | null;
  paymentMethod: string | null;
  paymentAmount: number | null;
  agentName: string | null;
  remarks: string | null;
  passportStatus: string;
  pnrStatus: string;
  createdAt: Date;
  trip: {
    id: number;
    cruiseName: string | null;
    shipName: string;
    productCode: string;
    startDate: Date | null;
    endDate: Date | null;
    nights: number;
    status: string;
    departureDate: Date;
    reservationCode: string | null;
  };
};

type ReservationItem = {
  id: number;
  status: string;
  totalPeople: number;
  cabinType: string | null;
  paymentDate: string | null;
  paymentMethod: string | null;
  paymentAmount: number | null;
  agentName: string | null;
  remarks: string | null;
  passportStatus: string;
  pnrStatus: string;
  createdAt: string;
  trip: {
    id: number;
    cruiseName: string | null;
    shipName: string;
    productCode: string;
    startDate: string | null;
    endDate: string | null;
    nights: number;
    status: string;
    departureDate: string;
    reservationCode: string | null;
  };
};

function formatReservation(r: GmReservationWithTrip): ReservationItem {
  return {
    id: r.id,
    status: r.status,
    totalPeople: r.totalPeople,
    cabinType: r.cabinType,
    paymentDate: r.paymentDate?.toISOString() ?? null,
    paymentMethod: r.paymentMethod,
    paymentAmount: r.paymentAmount,
    agentName: r.agentName,
    remarks: r.remarks,
    passportStatus: r.passportStatus,
    pnrStatus: r.pnrStatus,
    createdAt: r.createdAt.toISOString(),
    trip: {
      id: r.trip.id,
      cruiseName: r.trip.cruiseName,
      shipName: r.trip.shipName,
      productCode: r.trip.productCode,
      startDate: r.trip.startDate?.toISOString() ?? null,
      endDate: r.trip.endDate?.toISOString() ?? null,
      nights: r.trip.nights,
      status: r.trip.status,
      departureDate: r.trip.departureDate.toISOString(),
      reservationCode: r.trip.reservationCode,
    },
  };
}
