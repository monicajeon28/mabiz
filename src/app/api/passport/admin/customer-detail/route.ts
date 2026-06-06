export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';
import { normalizeDateOnlyString } from '@/lib/passport-date';

/**
 * GmTraveler.birthDate/expiryDate(String SSoT)용 날짜 정규화.
 * 문자열은 yyyy-MM-dd 검증, Date/timestamp는 변환 후 검증.
 * 형식 불일치('2030/01/15','Invalid' 등)는 null → APIS 엑셀 깨짐 차단.
 */
function normalizeTravelerDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') return normalizeDateOnlyString(v);
  const d = new Date(v as string | number | Date);
  if (isNaN(d.getTime())) return null;
  return normalizeDateOnlyString(d.toISOString().slice(0, 10));
}

/**
 * OWNER 테넌트 격리: 대상 고객(userId)이 OWNER의 조직 소속인지 확인.
 * 판매기록(CrmAffiliateSale) OR 리드(AffiliateLead) 합집합으로 판정 —
 * 여권 파이프라인은 리드 기반이라 아직 판매 전환 전(리드 단계)인 정당한 고객도 허용해야
 * OWNER의 합법적 여권 등록/수정이 거짓 403되지 않는다. (phone 숫자만 정규화 후 조직 대조)
 * @returns true = 차단해야 함(권한 없음), false = 접근 허용
 */
async function ownerOrgBlocked(
  manager: { role?: string | null; organizationId?: string | number | null },
  userId: number,
): Promise<boolean> {
  if (manager.role !== 'OWNER') return false; // GLOBAL_ADMIN 등은 통과
  if (!manager.organizationId) return true; // organizationId 없는 OWNER는 차단(보안 기본값)
  const orgId = String(manager.organizationId);
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT (
      (SELECT COUNT(*) FROM "User" u
       JOIN "CrmAffiliateSale" af ON REGEXP_REPLACE(af."customerPhone", '[^0-9]', '', 'g')
           = REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g')
       WHERE u.id = ${userId} AND af."organizationId" = ${orgId})
      +
      (SELECT COUNT(*) FROM "User" u
       JOIN "AffiliateLead" al ON REGEXP_REPLACE(al."customerPhone", '[^0-9]', '', 'g')
           = REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g')
       WHERE u.id = ${userId} AND al."organizationId" = ${orgId})
    ) AS cnt
  `;
  return Number(rows[0]?.cnt ?? 0) === 0;
}

// POST: 수동 여권 등록 (조건 없이 등록 가능)
export async function POST(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const postBody = await req.json();
    const userId = parseInt(String(postBody.userId));
    if (isNaN(userId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const { korName, engGivenName, engSurname, passportNo, birthDate, expiryDate, reservationId } = postBody;

    // 여권번호만 필수, 나머지는 선택사항 (조건 없이 등록 가능)
    if (!passportNo || passportNo.trim() === '') {
      return NextResponse.json(
        { ok: false, error: '여권번호는 필수입니다.' },
        { status: 400 }
      );
    }

    // 사용자 확인
    const user = await prisma.gmUser.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // OWNER 테넌트 격리: 타 조직 고객 여권 PII 조작 차단
    if (await ownerOrgBlocked(manager, userId)) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    let targetReservationId: number;

    // Reservation이 지정되어 있으면 해당 Reservation 사용
    if (reservationId) {
      const reservation = await prisma.gmReservation.findUnique({
        where: { id: reservationId },
        select: { id: true, tripId: true },
      });

      if (!reservation) {
        return NextResponse.json(
          { ok: false, error: 'Reservation not found' },
          { status: 404 }
        );
      }

      targetReservationId = reservation.id;
    } else {
      // Reservation이 없으면 사용자의 가장 최근 Reservation에 추가
      const latestReservation = await prisma.gmReservation.findFirst({
        where: { mainUserId: userId },
        orderBy: { id: 'desc' },
        select: { id: true },
      });

      if (!latestReservation) {
        // Reservation이 없으면 최근 Trip을 찾아서 Reservation 생성
        // 사용자의 최근 Reservation과 연결된 Trip 찾기
        const tripWithReservation = await prisma.gmTrip.findFirst({
          where: {
            reservations: {
              some: {
                mainUserId: userId,
              },
            },
          },
          orderBy: { id: 'desc' },
          select: { id: true },
        });

        let targetTripId: number;

        if (tripWithReservation) {
          targetTripId = tripWithReservation.id;
        } else {
          // 사용자의 Reservation이 전혀 없으면, 시스템의 최근 Trip 사용
          // (실제 운영 환경에서는 이런 경우가 드물지만, 조건 없이 등록 가능하도록 처리)
          const anyTrip = await prisma.gmTrip.findFirst({
            orderBy: { id: 'desc' },
            select: { id: true },
          });

          if (!anyTrip) {
            // Trip이 없으면 임시 Trip 생성 (여행 없이도 여권 등록 가능하도록)
            // APIS에 필요한 입력값을 미리 업데이트하기 위한 임시 Trip
            const tempProductCode = `TEMP-PASSPORT-${userId}-${Date.now()}`;
            const newTrip = await prisma.gmTrip.create({
              data: {
                productCode: tempProductCode,
                shipName: '임시 여행 (수동 여권 등록)',
                departureDate: new Date(),
                status: 'Upcoming',
                userId,                 // 필수(@default 없음) — 누락 시 런타임 500
                updatedAt: new Date(),  // 필수(@default/@updatedAt 없음)
              },
            });
            targetTripId = newTrip.id;
          } else {
            targetTripId = anyTrip.id;
          }
        }

        // Trip이 있으면 해당 Trip에 Reservation 생성
        const newReservation = await prisma.gmReservation.create({
          data: {
            tripId: targetTripId,
            mainUserId: userId,
            totalPeople: 1,
            passportStatus: 'PENDING',
          },
        });
        targetReservationId = newReservation.id;
      } else {
        targetReservationId = latestReservation.id;
      }
    }

    // 기존 Traveler 중 같은 여권번호가 있는지 확인 (중복 방지)
    const existingTraveler = await prisma.gmTraveler.findFirst({
      where: {
        reservationId: targetReservationId,
        passportNo: passportNo.trim(),
      },
    });

    if (existingTraveler) {
      // 기존 여권 정보 업데이트
      await prisma.gmTraveler.update({
        where: { id: existingTraveler.id },
        data: {
          korName: korName?.trim() || null,
          engGivenName: engGivenName?.trim() || null,
          engSurname: engSurname?.trim() || null,
          passportNo: passportNo.trim(),
          birthDate: normalizeTravelerDate(birthDate),
          expiryDate: normalizeTravelerDate(expiryDate),
        },
      });

      return NextResponse.json({
        ok: true,
        message: '여권 정보가 업데이트되었습니다.',
      });
    }

    // 기존 Traveler 수 확인하여 roomNumber 결정
    const travelerCount = await prisma.gmTraveler.count({
      where: { reservationId: targetReservationId },
    });

    // Traveler 생성 (조건 없이 모든 필드 선택사항)
    // birthDate와 expiryDate는 String 타입이므로 문자열로 저장
    await prisma.gmTraveler.create({
      data: {
        reservationId: targetReservationId,
        roomNumber: travelerCount + 1,
        korName: korName?.trim() || null,
        engGivenName: engGivenName?.trim() || null,
        engSurname: engSurname?.trim() || null,
        passportNo: passportNo.trim(),
        birthDate: normalizeTravelerDate(birthDate),
        expiryDate: normalizeTravelerDate(expiryDate),
      },
    });

    return NextResponse.json({
      ok: true,
      message: '여권 정보가 등록되었습니다.',
    });
  } catch (err) {
    const error = err as Record<string, unknown>;
    logger.error('[Admin Passport Registration] Error:', error as object);
    logger.error('[Admin Passport Registration] Error details:', {
      message: (error as Record<string, unknown>).message,
      code: (error as Record<string, unknown>).code,
      meta: error.meta,
    });

    return NextResponse.json(
      {
        ok: false,
        error: '여권 등록에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}

// PUT: 여권 정보 수정
export async function PUT(req: NextRequest) {
  try {
    const manager = await requireCrmManager();
    if (!manager) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { userId: rawUserId, travelerId, korName, engGivenName, engSurname, passportNo, birthDate, expiryDate } = await req.json();
    const userId = parseInt(String(rawUserId));
    if (isNaN(userId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Traveler ID 필수
    if (!travelerId) {
      return NextResponse.json(
        { ok: false, error: 'Traveler ID는 필수입니다.' },
        { status: 400 }
      );
    }

    // 여권번호 필수
    if (!passportNo || passportNo.trim() === '') {
      return NextResponse.json(
        { ok: false, error: '여권번호는 필수입니다.' },
        { status: 400 }
      );
    }

    // Traveler 확인
    const traveler = await prisma.gmTraveler.findUnique({
      where: { id: travelerId },
      select: { id: true, reservationId: true },
    });

    if (!traveler) {
      return NextResponse.json(
        { ok: false, error: 'Traveler not found' },
        { status: 404 }
      );
    }

    // Reservation 확인 (사용자 소유 확인)
    const reservation = await prisma.gmReservation.findUnique({
      where: { id: traveler.reservationId },
      select: { id: true, mainUserId: true },
    });

    if (!reservation || reservation.mainUserId !== userId) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: This traveler does not belong to the user' },
        { status: 403 }
      );
    }

    // OWNER 테넌트 격리: 타 조직 고객 여권 PII 조작 차단
    if (await ownerOrgBlocked(manager, userId)) {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    // 여권 정보 업데이트
    await prisma.gmTraveler.update({
      where: { id: travelerId },
      data: {
        korName: korName?.trim() || null,
        engGivenName: engGivenName?.trim() || null,
        engSurname: engSurname?.trim() || null,
        passportNo: passportNo.trim(),
        birthDate: normalizeTravelerDate(birthDate),
        expiryDate: normalizeTravelerDate(expiryDate),
      },
    });

    return NextResponse.json({
      ok: true,
      message: '여권 정보가 수정되었습니다.',
    });
  } catch (err) {
    const error = err as Record<string, unknown>;
    logger.error('[Admin Passport Update] Error:', error as object);
    logger.error('[Admin Passport Update] Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });

    return NextResponse.json(
      {
        ok: false,
        error: '여권 정보 수정에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
