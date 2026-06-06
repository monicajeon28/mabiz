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
  judgeSingleCharge,
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

/**
 * DELETE /api/admin/apis/traveler/[id]
 *
 * APIS 협업 편집 Phase 2 — 안전 단건삭제(전체 JSON 스냅샷 복구가능).
 * OWNER / GLOBAL_ADMIN 전용 + 테넌트 격리(assertReservationInOrg).
 *
 * 안전장치:
 *   - 단건만 삭제(deleteMany 전량삭제 절대 금지). id 1개만 처리.
 *   - 삭제 전 traveler 전체 JSON을 GmReservationAudit.oldValue 에 스냅샷으로 남겨
 *     이후 1클릭 되돌리기(undo)로 복구 가능하게 한다.
 *   - 삭제로 같은 방 잔류자의 인원 구성이 바뀌므로 isSingleCharge 를 재판정한다.
 *   - 모든 변경(삭제 + 재판정)을 한 트랜잭션 + 감사로그로 묶는다.
 *   - [P1-4] 낙관적 잠금: expectedVersion(body/query) 제공 시 트랜잭션 내에서
 *     현재 traveler.version 과 비교, 불일치하면 409 conflict + 최신본 반환 →
 *     '내가 보던 화면이 그 사이 바뀐 상태에서 엉뚱한 행을 지우는' lost-delete 차단.
 *
 * body(또는 query) (선택):
 *   - expectedVersion?: number  낙관적 잠금 기준값(불일치 시 409 conflict)
 *
 * 응답:
 *   - 200 { ok:true, deleted: { id, roomNumber, isCompanion }, auditId, residualUpdated }
 *           auditId = 이 삭제로 남긴 TRAVELER_DELETE 감사로그 id. UI가 이 값을
 *           POST /undo { expectedAuditId } 로 넘겨 정확한 그 삭제건만 무손실 복원한다.
 *   - 409 { ok:false, conflict:true, latest }   낙관적 잠금 충돌(최신본 동봉)
 *   - 404 { ok:false, error }   대상 없음
 *   - 400 / 401 / 403 / 500
 */
export async function DELETE(
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

    // ── 대상 traveler id (단건) ──────────────────────────────────
    const { id } = await params;
    const travelerId = Number(id);
    if (!Number.isInteger(travelerId) || travelerId <= 0) {
      return NextResponse.json({ ok: false, error: '잘못된 travelerId 입니다.' }, { status: 400, headers: noStore });
    }

    // ── [P1-4] 낙관적 잠금 기준값 expectedVersion 파싱 (body 우선, 없으면 query) ──
    // DELETE 는 body 가 없을 수 있어 query(?expectedVersion=) 도 허용한다. 둘 다 없으면
    // undefined → 낙관락 미적용(기존 동작 보존, 회귀 없음).
    let expectedVersion: number | undefined;
    {
      const raw = req.headers.get('content-length');
      const hasBody = raw !== null && raw !== '0';
      if (hasBody) {
        try {
          const body = (await req.json()) as { expectedVersion?: unknown };
          if (typeof body?.expectedVersion === 'number' && Number.isInteger(body.expectedVersion)) {
            expectedVersion = body.expectedVersion;
          }
        } catch {
          // 본문 파싱 실패는 무시 — query 폴백으로 진행(낙관락은 선택값)
        }
      }
      if (expectedVersion === undefined) {
        const q = req.nextUrl.searchParams.get('expectedVersion');
        if (q !== null && q.trim() !== '') {
          const n = Number(q);
          if (Number.isInteger(n)) expectedVersion = n;
        }
      }
    }

    // updatedBy / 감사 userId 로 기록할 GmUser id(Int) 해석 (PATCH 와 동일 규칙)
    const userId = await resolveActorGmUserId({
      userId: ctx.userId,
      role: ctx.role,
      mallUserId: ctx.mallUser?.id ?? null,
    });

    // ── 대상 traveler 조회 (전체 컬럼 — 스냅샷용) ──
    const traveler = await prisma.gmTraveler.findUnique({ where: { id: travelerId } });
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

    // ── 테넌트 격리: PATCH 와 동일. OWNER 는 자기 조직 예약만(위반 시 catch → 403) ──
    await assertReservationInOrg({
      reservationId: reservation.id,
      role: ctx.role,
      organizationId: ctx.organizationId,
    });

    // 같은 방 잔류자 재판정 모집단: OWNER 는 자기 조직 예약으로 한정(타 조직 부수효과 차단),
    // GLOBAL_ADMIN 은 trip 전체. (PATCH moveRoom 과 동일한 격리 규칙)
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

    const deletedRoom = traveler.roomNumber;
    const isCompanion = traveler.companionGroupId != null;

    // ── 단건 삭제 + 스냅샷 + 잔류자 싱글차지 재판정 (한 트랜잭션) ──
    const { auditId, residualUpdated } = await prisma.$transaction(async (tx) => {
      // (1) 트랜잭션 내 재확인 (그 사이 삭제됐을 수 있음)
      const cur = await tx.gmTraveler.findUnique({ where: { id: travelerId } });
      if (!cur) throw new TravelerNotFound();

      // (1.5) [P1-4] 낙관적 잠금: 그 사이 다른 사용자가 같은 행을 수정(version+1)했다면
      // 내가 보던 스냅샷과 달라졌으므로 삭제를 막고 최신본을 돌려준다(409). 트랜잭션 내부에서
      // 비교해 TOCTOU 없이 안전. expectedVersion 미제공 시 기존 동작 유지(검사 생략).
      if (expectedVersion !== undefined && cur.version !== expectedVersion) {
        throw new TravelerVersionConflict(cur);
      }

      // (2) 삭제 감사로그 — oldValue = traveler 전체 JSON 스냅샷(복구가능).
      // 생성된 audit.id 를 캡처해 응답으로 돌려준다 → UI 가 /undo { expectedAuditId } 로
      // 정확히 이 삭제건만 무손실 복원(P0 토대).
      const deleteAudit = await tx.gmReservationAudit.create({
        data: {
          reservationId: cur.reservationId,
          userId,
          action: 'TRAVELER_DELETE',
          oldValue: JSON.stringify(cur),
          metadata: { travelerId, isCompanion } as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      // (3) 단건 삭제 (deleteMany 금지 — id 1건만)
      await tx.gmTraveler.delete({ where: { id: travelerId } });

      // (4) 같은 방 잔류자 isSingleCharge 재판정 (삭제 후 상태 기준)
      // ⚠️ [P0/data-loss] roomNumber 는 예약 단위(메인유저=room 1)라 trip 전역 유일값이
      // 아니다. 같은 방 잔류자는 반드시 (reservationId, roomNumber) 복합키로 한정한다.
      const remaining = await tx.gmTraveler.findMany({
        where: { reservationId: { in: tripReservationIds } },
        select: { id: true, reservationId: true, roomNumber: true, passportNo: true, isSingleCharge: true },
      });
      const deletedReservationId = cur.reservationId;
      const roomSingle = judgeSingleCharge(remaining, deletedReservationId, deletedRoom);

      let updatedCount = 0;
      const residents = remaining.filter(
        (t) => t.reservationId === deletedReservationId && t.roomNumber === deletedRoom,
      );
      for (const r of residents) {
        if (r.isSingleCharge !== roomSingle) {
          await tx.gmTraveler.update({
            where: { id: r.id },
            data: { isSingleCharge: roomSingle, version: { increment: 1 }, updatedBy: userId },
          });
          await tx.gmReservationAudit.create({
            data: {
              reservationId: cur.reservationId,
              userId,
              action: 'TRAVELER_SINGLE_CHARGE_RECHECK',
              oldValue: JSON.stringify({ isSingleCharge: r.isSingleCharge }),
              newValue: JSON.stringify({ isSingleCharge: roomSingle }),
              metadata: { travelerId: r.id, cause: 'delete', oldRoom: deletedRoom } as Prisma.InputJsonValue,
            },
          });
          updatedCount++;
        }
      }
      return { auditId: deleteAudit.id, residualUpdated: updatedCount };
    });

    logger.log('[APIS Traveler DELETE]', {
      role: ctx.role,
      travelerId,
      action: 'TRAVELER_DELETE',
      roomNumber: deletedRoom,
      isCompanion,
      auditId,
      residualUpdated,
    });

    return NextResponse.json(
      {
        ok: true,
        deleted: { id: travelerId, roomNumber: deletedRoom, isCompanion },
        auditId,
        residualUpdated,
      },
      { status: 200, headers: noStore }
    );
  } catch (err) {
    // 테넌트 격리 위반 → 403
    if (err instanceof ReservationForbidden) {
      return NextResponse.json(
        { ok: false, error: '해당 예약에 접근할 권한이 없습니다.' },
        { status: 403, headers: noStore }
      );
    }
    // [P1-4] 낙관적 잠금 충돌 → 409 + 최신본 (UI '최신본 불러오기' 후 재시도)
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
    logger.error('[APIS Traveler DELETE]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500, headers: noStore });
  }
}
