export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';
import { getMabizSession } from '@/lib/auth';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';
import { resolveActorGmUserId } from '@/lib/apis-traveler-write';
import { Prisma } from '@prisma/client';

/**
 * POST /api/admin/apis/traveler/manual
 *
 * productCode만으로 탑승객 수동 추가.
 * Trip / Reservation이 없을 때 자동으로 생성 후 탑승객을 등록한다.
 *
 * 흐름:
 *  1) productCode → CruiseProduct 조회 (없으면 404)
 *  2) GmTrip findFirst(productCode, 가장 가까운 departureDate) → 없으면 create
 *  3) GmReservation findFirst(tripId, agentName='수동등록') → 없으면 create
 *  4) GmTraveler create
 *  5) 감사로그: GmReservationAudit (action: 'TRAVELER_MANUAL_ADD')
 *
 * 주의:
 *  - 기존 POST /api/admin/apis/traveler (동행인 추가)는 수정하지 않는다.
 *  - GmTrip.userId / GmReservation.mainUserId 는 필수(Int) → 액터 GmUser id 사용.
 *    액터 해석 실패 시 시스템 플레이스홀더 GmUser 를 find-or-create 한다.
 *
 * 권한: GLOBAL_ADMIN / OWNER 전용.
 */
export async function POST(req: NextRequest) {
  // ── RBAC ─────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN', 'OWNER'],
    errorMessage: '권한이 없습니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await getMabizSession();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
    }
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    // 액터 GmUser id 해석 (감사로그/updatedBy/trip.userId)
    let actorUserId = await resolveActorGmUserId({
      userId: ctx.userId,
      role: ctx.role,
      mallUserId: ctx.mallUser?.id ?? null,
    });

    // ── 요청 파싱 ──────────────────────────────────────────────────
    const body = await req.json();

    const productCode: string | null =
      typeof body?.productCode === 'string' ? body.productCode.trim() || null : null;
    const roomNumberRaw = body?.roomNumber;
    const korName: string | null =
      typeof body?.korName === 'string' ? body.korName.trim() || null : null;
    const phone: string | null =
      typeof body?.phone === 'string' ? body.phone.trim() || null : null;
    const passportNo: string | null =
      typeof body?.passportNo === 'string' ? body.passportNo.trim() || null : null;
    const gender: string | null =
      typeof body?.gender === 'string' ? body.gender.trim() || null : null;
    const engSurname: string | null =
      typeof body?.engSurname === 'string' ? body.engSurname.trim() || null : null;
    const engGivenName: string | null =
      typeof body?.engGivenName === 'string' ? body.engGivenName.trim() || null : null;

    // birthDate → YYYY-MM-DD 정규화
    const birthDateRaw = body?.birthDate;
    const birthDate: string | null = birthDateRaw
      ? typeof birthDateRaw === 'string'
        ? birthDateRaw.split('T')[0]
        : new Date(birthDateRaw).toISOString().split('T')[0]
      : null;

    // ── 필수 검증 ─────────────────────────────────────────────────
    if (!productCode) {
      return NextResponse.json(
        { ok: false, error: 'productCode가 필요합니다.' },
        { status: 400 }
      );
    }
    const roomNumber = Number(roomNumberRaw);
    if (!Number.isInteger(roomNumber) || roomNumber <= 0) {
      return NextResponse.json(
        { ok: false, error: 'roomNumber가 올바르지 않습니다. (1 이상 정수)' },
        { status: 400 }
      );
    }

    // ── 1) CruiseProduct 조회 ──────────────────────────────────────
    const product = await prisma.cruiseProduct.findUnique({
      where: { productCode },
      select: {
        productCode: true,
        shipName: true,
        packageName: true,
        cruiseLine: true,
        startDate: true,
        nights: true,
        days: true,
      },
    });
    if (!product) {
      return NextResponse.json(
        { ok: false, error: `상품을 찾을 수 없습니다. (productCode: ${productCode})` },
        { status: 404 }
      );
    }

    // departureDate: CruiseProduct.startDate → 없으면 지금
    const departureDate = product.startDate ?? new Date();

    // ── 2) actorUserId 폴백: 시스템 플레이스홀더 GmUser find-or-create ──
    // GmTrip.userId / GmReservation.mainUserId 는 필수(Int)이므로 null 허용 불가.
    // 액터 해석 실패 시 전용 SYSTEM 사용자를 한 번만 생성하고 재사용한다.
    if (actorUserId === null) {
      const SYSTEM_PHONE = '__SYSTEM_MANUAL_APIS__';
      const existing = await prisma.gmUser.findFirst({
        where: { phone: SYSTEM_PHONE },
        select: { id: true },
      });
      if (existing) {
        actorUserId = existing.id;
      } else {
        const pw = await bcrypt.hash('system_placeholder', 10);
        const created = await prisma.gmUser.create({
          data: {
            phone: SYSTEM_PHONE,
            name: '시스템(수동등록)',
            password: pw,
            role: 'PROSPECT',
            onboarded: false,
            customerStatus: 'PROSPECT',
            customerSource: 'SYSTEM',
            updatedAt: new Date(),
          },
          select: { id: true },
        });
        actorUserId = created.id;
        logger.log('[APIS Manual] 시스템 플레이스홀더 GmUser 생성', { userId: actorUserId });
      }
    }

    const resolvedActorId = actorUserId; // 이후 non-null 보장

    const result = await prisma.$transaction(async (tx) => {
      // ── 3) GmTrip: productCode + departureDate 기준 가장 가까운 것 재사용, 없으면 생성 ──
      const now = new Date();
      const tripCandidates = await tx.gmTrip.findMany({
        where: { productCode, userId: resolvedActorId },
        select: { id: true, departureDate: true },
        orderBy: { departureDate: 'asc' },
      });

      let tripId: number;
      if (tripCandidates.length > 0) {
        // departureDate 가 현재 이후인 것 중 가장 가까운 것. 모두 과거면 마지막 것.
        const future = tripCandidates.filter((t) => t.departureDate >= now);
        const chosen = future.length > 0 ? future[0] : tripCandidates[tripCandidates.length - 1];
        tripId = chosen!.id;
        logger.log('[APIS Manual] 기존 Trip 재사용', { tripId, productCode });
      } else {
        const newTrip = await tx.gmTrip.create({
          data: {
            userId: resolvedActorId,
            productCode,
            shipName: product.shipName,
            cruiseName: product.packageName,
            departureDate,
            startDate: departureDate,
            nights: product.nights,
            days: product.days,
            status: 'Upcoming',
            updatedAt: now,
          },
          select: { id: true },
        });
        tripId = newTrip.id;
        logger.log('[APIS Manual] 신규 Trip 생성', { tripId, productCode });
      }

      // ── 4) GmReservation: 같은 trip에 '수동등록' 예약 재사용, 없으면 생성 ──
      const existingReservation = await tx.gmReservation.findFirst({
        where: { tripId, agentName: '수동등록' },
        select: { id: true },
      });

      let reservationId: number;
      if (existingReservation) {
        reservationId = existingReservation.id;
        logger.log('[APIS Manual] 기존 수동등록 Reservation 재사용', { reservationId, tripId });
      } else {
        const newReservation = await tx.gmReservation.create({
          data: {
            tripId,
            mainUserId: resolvedActorId,
            agentName: '수동등록',
            totalPeople: 1,
            finalConfirmStatus: 'APPROVED',
            status: 'CONFIRMED',
            pnrStatus: 'PENDING',
            passportStatus: 'PENDING',
          },
          select: { id: true },
        });
        reservationId = newReservation.id;
        logger.log('[APIS Manual] 신규 수동등록 Reservation 생성', { reservationId, tripId });
      }

      // ── 5) GmTraveler 생성 ──────────────────────────────────────
      // 같은 방(reservationId, roomNumber)에 이미 등록된 여권번호와 중복이면 partial unique 위반.
      // 클라이언트가 여권번호를 입력했고 이미 같은 방에 동일 여권이 있으면 400 반환.
      if (passportNo) {
        const dupPassport = await tx.gmTraveler.findFirst({
          where: { reservationId, roomNumber, passportNo },
          select: { id: true },
        });
        if (dupPassport) {
          throw new Error('DUPLICATE_PASSPORT');
        }
      }

      const traveler = await tx.gmTraveler.create({
        data: {
          reservationId,
          roomNumber,
          companionGroupId: null,
          userId: null, // 수동 등록은 연결 GmUser 없이 생성 (나중에 매칭)
          korName: korName || null,
          phone: phone || null,
          passportNo: passportNo || null,
          birthDate,
          gender: gender || null,
          engSurname: engSurname || null,
          engGivenName: engGivenName || null,
          version: 0,
          updatedBy: resolvedActorId,
        },
      });

      // ── 6) 감사로그 ────────────────────────────────────────────
      await tx.gmReservationAudit.create({
        data: {
          reservationId,
          userId: resolvedActorId,
          action: 'TRAVELER_MANUAL_ADD',
          newValue: JSON.stringify({
            productCode,
            roomNumber,
            korName,
            phone,
            passportNo,
            travelerId: traveler.id,
          }),
          metadata: { travelerId: traveler.id, tripId } as Prisma.InputJsonValue,
        },
      });

      return { traveler, reservationId, tripId };
    });

    logger.log('[APIS Manual] 탑승객 수동 추가 완료', {
      travelerId: result.traveler.id,
      reservationId: result.reservationId,
      tripId: result.tripId,
      productCode,
      roomNumber,
    });

    return NextResponse.json({
      ok: true,
      traveler: result.traveler,
      reservationId: result.reservationId,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'DUPLICATE_PASSPORT') {
      return NextResponse.json(
        { ok: false, error: '같은 방에 동일한 여권번호가 이미 등록되어 있습니다.' },
        { status: 409 }
      );
    }
    logger.error('[APIS Manual] Error', { err });
    return NextResponse.json(
      { ok: false, error: '탑승객 수동 추가에 실패했습니다.' },
      { status: 500 }
    );
  }
}
