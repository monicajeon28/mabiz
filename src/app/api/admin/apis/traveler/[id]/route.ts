export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  writeTravelerWithAudit,
  moveTravelerRoomWithAudit,
  assertReservationInOrg,
  resolveActorGmUserId,
  TravelerVersionConflict,
  TravelerNotFound,
  ReservationForbidden,
  RoomCapacityExceeded,
} from '@/lib/apis-traveler-write';

/**
 * PATCH /api/admin/apis/traveler/[id]
 *
 * APIS 협업 편집 Phase 1 — 셀 수정 + 방 이동(낙관적 잠금).
 * OWNER / GLOBAL_ADMIN 전용 + 테넌트 격리.
 *
 * 모든 쓰기는 writeTravelerWithAudit() 경유 → 감사로그 동시 기록 + version+1.
 *
 * body:
 *   - changes?: object         (셀 수정 — 화이트리스트 필드만 반영)
 *   - expectedVersion?: number (낙관적 잠금 기준값. 불일치 시 409 conflict)
 *   - action?: 'update' | 'moveRoom'
 *   - roomNumber?: number      (action='moveRoom' 일 때 이동할 방 번호)
 *
 * 응답:
 *   - 200 { ok:true, traveler }
 *   - 409 { ok:false, conflict:true, latest }   낙관적 잠금 충돌
 *   - 404 { ok:false, error }                   대상 없음
 *   - 400 / 401 / 403 / 500
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const noStore = { 'Cache-Control': 'no-store' };

  // ── RBAC: GLOBAL_ADMIN / OWNER 전용 ───────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN', 'OWNER'],
    errorMessage: '권한이 없습니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await getMabizSession();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401, headers: noStore });
    }
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403, headers: noStore });
    }

    // ── 대상 traveler id ─────────────────────────────────────────
    const { id } = await params;
    const travelerId = Number(id);
    if (!Number.isInteger(travelerId) || travelerId <= 0) {
      return NextResponse.json({ ok: false, error: '잘못된 travelerId 입니다.' }, { status: 400, headers: noStore });
    }

    // ── body 파싱 ────────────────────────────────────────────────
    let body: {
      changes?: Record<string, unknown>;
      expectedVersion?: number;
      action?: 'update' | 'moveRoom';
      roomNumber?: number;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: '잘못된 요청 본문입니다.' }, { status: 400, headers: noStore });
    }

    const action = body.action ?? 'update';
    const expectedVersion =
      typeof body.expectedVersion === 'number' ? body.expectedVersion : undefined;

    // updatedBy 에 저장할 GmUser id(Int) 해석. CUID(memberId/adminId)를 그대로
    // Number() 하면 NaN→null 이 되어 '최근 수정자' 표시가 깨지던 P1 버그를 막는다.
    const userId = await resolveActorGmUserId({
      userId: ctx.userId,
      role: ctx.role,
      mallUserId: ctx.mallUser?.id ?? null,
    });

    // ── 대상 traveler → reservation → trip 확인 ──
    const traveler = await prisma.gmTraveler.findUnique({
      where: { id: travelerId },
      select: { id: true, reservationId: true },
    });
    if (!traveler) {
      return NextResponse.json({ ok: false, error: '대상 탑승객을 찾을 수 없습니다.' }, { status: 404, headers: noStore });
    }

    const reservation = await prisma.gmReservation.findUnique({
      where: { id: traveler.reservationId },
      select: { id: true, tripId: true },
    });
    if (!reservation) {
      return NextResponse.json({ ok: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404, headers: noStore });
    }

    // ── 테넌트 격리: board GET 과 동일한 규칙(공용 헬퍼). OWNER 는 자기 조직 예약만.
    // GLOBAL_ADMIN 만 전체 허용. 위반 시 403(예외 → catch).
    await assertReservationInOrg({
      reservationId: reservation.id,
      role: ctx.role,
      organizationId: ctx.organizationId,
    });

    if (action === 'moveRoom') {
      // ── 방 이동: 같은 trip 내 이동 + 정원 검증 + 출발/도착 방 싱글차지 재판정 ──
      const targetRoom = body.roomNumber;
      if (typeof targetRoom !== 'number' || !Number.isInteger(targetRoom) || targetRoom <= 0) {
        return NextResponse.json({ ok: false, error: '이동할 방 번호가 올바르지 않습니다.' }, { status: 400, headers: noStore });
      }

      // 같은 trip 내 이동 범위. OWNER는 자기 조직 예약으로 한정해
      // 방이동 재판정·쓰기가 타 조직 traveler에 부수효과를 내지 않게 한다([P2] 격리).
      // GLOBAL_ADMIN은 trip 전체(전권). 이동 대상 예약은 위 assertReservationInOrg를 이미 통과.
      const isOwnerScoped = ctx.role === 'OWNER' && !!ctx.organizationId;
      const tripReservationIds = isOwnerScoped
        ? (await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
            SELECT r.id FROM "Reservation" r
            JOIN "User" u ON u.id = r."mainUserId"
            JOIN "OrganizationMember" om
              ON om.phone = u.phone AND om."organizationId" = ${ctx.organizationId}
            WHERE r."tripId" = ${reservation.tripId}
          `)).map((r) => r.id)
        : (await prisma.gmReservation.findMany({
            where: { tripId: reservation.tripId },
            select: { id: true },
          })).map((r) => r.id);

      const { moved, residualUpdated } = await moveTravelerRoomWithAudit({
        travelerId,
        targetRoom,
        tripReservationIds,
        userId,
        expectedVersion,
      });

      logger.log('[APIS Traveler PATCH]', {
        role: ctx.role,
        travelerId,
        action: 'TRAVELER_MOVE_ROOM',
        version: moved.version,
        residualUpdated,
      });

      return NextResponse.json({ ok: true, traveler: moved }, { status: 200, headers: noStore });
    }

    // ── 셀 수정 ──────────────────────────────────────────────
    const changes = body.changes ?? {};
    if (typeof changes !== 'object' || changes === null || Array.isArray(changes)) {
      return NextResponse.json({ ok: false, error: 'changes 형식이 올바르지 않습니다.' }, { status: 400, headers: noStore });
    }
    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ ok: false, error: '변경할 내용이 없습니다.' }, { status: 400, headers: noStore });
    }

    // ── 안전 쓰기 (감사로그 + version+1, 낙관적 잠금) ──────────────
    const updated = await writeTravelerWithAudit({
      travelerId,
      changes,
      userId,
      expectedVersion,
      action: 'TRAVELER_UPDATE',
    });

    logger.log('[APIS Traveler PATCH]', {
      role: ctx.role,
      travelerId,
      action: 'TRAVELER_UPDATE',
      version: updated.version,
    });

    return NextResponse.json({ ok: true, traveler: updated }, { status: 200, headers: noStore });
  } catch (err) {
    // 테넌트 격리 위반 → 403 (타 대리점 예약 편집 차단)
    if (err instanceof ReservationForbidden) {
      return NextResponse.json(
        { ok: false, error: '해당 예약에 접근할 권한이 없습니다.' },
        { status: 403, headers: noStore }
      );
    }
    // 낙관적 잠금 충돌 → 409 + 최신본 (UI '최신본 불러오기')
    if (err instanceof TravelerVersionConflict) {
      return NextResponse.json(
        { ok: false, conflict: true, latest: err.latest },
        { status: 409, headers: noStore }
      );
    }
    if (err instanceof TravelerNotFound) {
      return NextResponse.json(
        { ok: false, error: '대상 탑승객을 찾을 수 없습니다.' },
        { status: 404, headers: noStore }
      );
    }
    // 정원 초과 방 이동 → 409 (충돌)
    if (err instanceof RoomCapacityExceeded) {
      return NextResponse.json(
        { ok: false, error: `${err.roomNumber}번 방 정원을 초과하여 이동할 수 없습니다.` },
        { status: 409, headers: noStore }
      );
    }
    logger.error('[APIS Traveler PATCH]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500, headers: noStore });
  }
}
