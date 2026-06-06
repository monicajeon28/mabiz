export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  assertReservationInOrg,
  resolveActorGmUserId,
  judgeSingleCharge,
  ReservationForbidden,
} from '@/lib/apis-traveler-write';

/**
 * POST /api/admin/apis/traveler/[id]/undo
 *
 * APIS 협업 편집 Phase 2 — 단건 삭제 1클릭 되돌리기(undo).
 * DELETE 가 GmReservationAudit.oldValue 에 남긴 전체 JSON 스냅샷으로 탑승객을 복원한다.
 * OWNER / GLOBAL_ADMIN 전용 + 테넌트 격리(assertReservationInOrg).
 *
 * 낙관적 잠금 설계(삭제된 행은 version 컬럼이 없으므로):
 *   - body.expectedAuditId = 되돌릴 TRAVELER_DELETE 감사로그 id 를 기준값으로 사용.
 *   - 트랜잭션 안에서
 *       (a) 기준 audit 이 TRAVELER_DELETE 이고 metadata.travelerId 가 일치하는지
 *       (b) 같은 audit 에 대한 TRAVELER_UNDO 가 이미 있는지(이미 복원됨)
 *       (c) 대상 id 가 이미 존재하는지(재사용/중복복원)
 *     를 모두 재확인 → 동시 더블클릭/중복 복원을 차단.
 *
 * [P1-1] 멱등 보장 한계(정직한 명세):
 *   - (a)/(b)/(c) findFirst/findUnique 선조회는 "베스트에포트" 멱등 가드일 뿐,
 *     동시 트랜잭션 사이의 경합 윈도우를 완전히 닫지 못한다(SELECT 시점엔 둘 다 미존재).
 *   - 최종 방어선은 GmTraveler.id PK(@id) 의 UNIQUE 제약이다.
 *     두 트랜잭션이 같은 id 로 create 하면 한쪽이 P2002 로 실패 → catch 에서 409 변환.
 *   - TRAVELER_UNDO 감사로그에 대한 DB 레벨 UNIQUE 인덱스(undoOfAuditId) 추가는
 *     prisma/schema.prisma 변경이 필요한 별도 순차작업이며 본 라우트 범위 밖이다.
 *
 * 절차(한 트랜잭션):
 *   1) 기준 삭제 감사 재확인 + 스냅샷 파싱(화이트리스트 컬럼만).
 *   2) 이미 복원/존재 시 409 충돌.
 *   3) 스냅샷으로 traveler 재생성(원래 id, version=0, updatedBy=복원자).
 *   4) 같은 방 점유 변화로 isSingleCharge 재판정(복원 본인 포함).
 *   5) 복원 + 재판정 전부를 TRAVELER_UNDO / TRAVELER_SINGLE_CHARGE_RECHECK 감사로그로 기록.
 *
 * body:
 *   - expectedAuditId: number   (되돌릴 TRAVELER_DELETE 감사로그 id)
 *
 * 응답:
 *   - 200 { ok:true, restored, residualUpdated }
 *   - 404 { ok:false, error }   기준 삭제 감사 없음/불일치 또는 예약 없음
 *   - 409 { ok:false, conflict:true, error }   이미 복원됨 / 대상 id 이미 존재
 *   - 400 / 401 / 403 / 500
 */

/**
 * 복원 가능한 스칼라 컬럼 화이트리스트 (임의 컬럼 주입 방지).
 * 각 컬럼의 기대 타입을 명시해 스냅샷 → create 주입 전 값 가드를 강제한다([P2-3]).
 *   - 'string'  : String? 컬럼
 *   - 'int'     : Int? 컬럼 (정수만 허용)
 *   - 'bool'    : Boolean 컬럼
 *   - 'fk'      : Int? FK 컬럼 (존재검증 대상, [P1-2])
 */
const RESTORABLE_FIELDS = {
  roomNumber: 'int',
  isSingleCharge: 'bool',
  engSurname: 'string',
  engGivenName: 'string',
  korName: 'string',
  residentNum: 'string',
  gender: 'string',
  birthDate: 'string',
  passportNo: 'string',
  issueDate: 'string',
  expiryDate: 'string',
  nationality: 'string',
  notes: 'string',
  phone: 'string',
  companionGroupId: 'fk',
  roomingGroupId: 'int',
  passportImage: 'string',
  passportDriveUrl: 'string',
  userId: 'fk',
} as const;

type RestorableType = (typeof RESTORABLE_FIELDS)[keyof typeof RESTORABLE_FIELDS];

/**
 * 스냅샷 원시값을 기대 타입으로 변환·검증한다([P2-3]).
 * 부적합하면 null 을 반환해 'as unknown as' 광역 캐스팅 대신 안전한 값만 주입한다.
 */
function coerceRestorable(type: RestorableType, raw: unknown): string | number | boolean | null {
  if (raw === null || raw === undefined) return null;
  switch (type) {
    case 'string':
      return typeof raw === 'string' ? raw : null;
    case 'bool':
      return typeof raw === 'boolean' ? raw : null;
    case 'int':
    case 'fk': {
      if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
      if (typeof raw === 'string' && raw.trim() !== '') {
        const n = Number(raw);
        if (Number.isInteger(n)) return n;
      }
      return null;
    }
    default:
      return null;
  }
}

/** metadata.travelerId(Int) 안전 추출 (audit route 와 동일 규칙). */
function extractMetaTravelerId(metadata: Prisma.JsonValue): number | null {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const raw = (metadata as Record<string, unknown>).travelerId;
    if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
    if (typeof raw === 'string') {
      const n = Number(raw);
      if (Number.isInteger(n)) return n;
    }
  }
  return null;
}

export async function POST(
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

    // ── 되돌릴 traveler id (단건) ──────────────────────────────────
    const { id } = await params;
    const travelerId = Number(id);
    if (!Number.isInteger(travelerId) || travelerId <= 0) {
      return NextResponse.json({ ok: false, error: '잘못된 travelerId 입니다.' }, { status: 400, headers: noStore });
    }

    // ── body 파싱: expectedAuditId(낙관락 기준값) ──
    let body: { expectedAuditId?: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: '잘못된 요청 본문입니다.' }, { status: 400, headers: noStore });
    }
    const expectedAuditId =
      typeof body.expectedAuditId === 'number' ? body.expectedAuditId : NaN;
    if (!Number.isInteger(expectedAuditId) || expectedAuditId <= 0) {
      return NextResponse.json(
        { ok: false, error: '되돌릴 삭제 기록(expectedAuditId)이 필요합니다.' },
        { status: 400, headers: noStore }
      );
    }

    // updatedBy / 감사 userId 로 기록할 GmUser id(Int) 해석 (PATCH/DELETE 와 동일 규칙)
    const userId = await resolveActorGmUserId({
      userId: ctx.userId,
      role: ctx.role,
      mallUserId: ctx.mallUser?.id ?? null,
    });

    // ── 기준 삭제 감사 조회(테넌트 격리 기준 reservationId 확보) ──
    const deleteAudit = await prisma.gmReservationAudit.findUnique({
      where: { id: expectedAuditId },
    });
    if (
      !deleteAudit ||
      deleteAudit.action !== 'TRAVELER_DELETE' ||
      !deleteAudit.oldValue ||
      extractMetaTravelerId(deleteAudit.metadata) !== travelerId
    ) {
      return NextResponse.json(
        { ok: false, error: '되돌릴 삭제 기록을 찾을 수 없습니다.' },
        { status: 404, headers: noStore }
      );
    }

    const reservation = await prisma.gmReservation.findUnique({
      where: { id: deleteAudit.reservationId },
      select: { id: true, tripId: true },
    });
    if (!reservation) {
      return NextResponse.json({ ok: false, error: '예약 정보를 찾을 수 없습니다.' }, { status: 404, headers: noStore });
    }

    // ── 테넌트 격리: OWNER 는 자기 조직 예약만 (DELETE 와 동일 규칙, 위반 시 catch → 403) ──
    await assertReservationInOrg({
      reservationId: reservation.id,
      role: ctx.role,
      organizationId: ctx.organizationId,
    });

    // 재판정 모집단: OWNER 는 자기 조직 예약으로 한정, GLOBAL_ADMIN 은 trip 전체.
    // (DELETE / PATCH moveRoom 과 동일한 격리 규칙)
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

    // ── 복원 (단일 트랜잭션: 낙관락 재확인 + 재생성 + 싱글차지 재판정 + 감사로그) ──
    const result = await prisma.$transaction(async (tx) => {
      // (a) 동시 더블클릭 차단: 같은 삭제 audit 을 이미 되돌렸으면 충돌.
      //     [P1-1] 선조회 멱등 가드(베스트에포트) — 경합 시 최종 방어선은 PK UNIQUE(P2002).
      const already = await tx.gmReservationAudit.findFirst({
        where: {
          action: 'TRAVELER_UNDO',
          reservationId: deleteAudit.reservationId,
          metadata: { path: ['undoOfAuditId'], equals: expectedAuditId },
        },
        select: { id: true },
      });
      if (already) {
        return { conflict: 'ALREADY_RESTORED' as const };
      }

      // (b) 대상 id 가 이미 존재하면 복원 불가(재사용/중복복원)
      const exists = await tx.gmTraveler.findUnique({
        where: { id: travelerId },
        select: { id: true },
      });
      if (exists) {
        return { conflict: 'ALREADY_EXISTS' as const };
      }

      // (c) 스냅샷 파싱 → 화이트리스트 컬럼만, 기대 타입으로 가드 후 재생성 데이터로([P2-3]).
      const parsed = JSON.parse(deleteAudit.oldValue as string) as Record<string, unknown>;
      const reservationId =
        typeof parsed.reservationId === 'number' && Number.isInteger(parsed.reservationId)
          ? parsed.reservationId
          : deleteAudit.reservationId;
      const roomNumber =
        typeof parsed.roomNumber === 'number' && Number.isInteger(parsed.roomNumber)
          ? parsed.roomNumber
          : 1;

      // 타입 가드된 스칼라 값만 모은다. (string/int/bool/fk → coerceRestorable)
      const createData: Prisma.GmTravelerUncheckedCreateInput = {
        // 기준 컬럼은 스냅샷이 덮어쓰지 못하게 고정. version/updatedBy 는 복원 시점 기준.
        id: travelerId,
        reservationId,
        roomNumber,
        version: 0,
        updatedBy: userId,
      };
      for (const k of Object.keys(RESTORABLE_FIELDS) as (keyof typeof RESTORABLE_FIELDS)[]) {
        // 기준 컬럼은 위에서 이미 고정했으므로 스냅샷 값으로 덮어쓰지 않는다.
        if (k === 'roomNumber') continue;
        if (!(k in parsed)) continue;
        const value = coerceRestorable(RESTORABLE_FIELDS[k], parsed[k]);
        if (value === null) continue; // 부적합/누락 값은 기본값(null)로 둔다.
        (createData as Record<string, unknown>)[k] = value;
      }

      // [P1-2] FK 고아참조 방지 — userId/companionGroupId 는 존재검증 후에만 유지.
      //   userId        : GmUser 가 실제로 존재해야 유지, 없으면 null.
      //   companionGroupId : 같은 방(reservationId+roomNumber)에 같은 그룹 잔존 시 유지, 없으면 null.
      const userIdValue = createData.userId;
      if (typeof userIdValue === 'number') {
        const owner = await tx.gmUser.findUnique({ where: { id: userIdValue }, select: { id: true } });
        if (!owner) createData.userId = null;
      }
      const companionGroupIdValue = createData.companionGroupId;
      if (typeof companionGroupIdValue === 'number') {
        const groupPeer = await tx.gmTraveler.findFirst({
          where: {
            reservationId,
            roomNumber,
            companionGroupId: companionGroupIdValue,
          },
          select: { id: true },
        });
        if (!groupPeer) createData.companionGroupId = null;
      }

      const restored = await tx.gmTraveler.create({ data: createData });

      // (d) 복원 감사로그 — [P2-2] PII 평문 audit 금지: 식별자만 남긴다.
      //     상세 스냅샷(oldValue)은 DELETE 감사에 이미 보존되어 있으므로 중복 저장하지 않는다.
      await tx.gmReservationAudit.create({
        data: {
          reservationId,
          userId,
          action: 'TRAVELER_UNDO',
          oldValue: null,
          newValue: JSON.stringify({ travelerId, restored: true }),
          metadata: { travelerId, undoOfAuditId: expectedAuditId } as Prisma.InputJsonValue,
        },
      });

      // (e) 같은 방 점유 변화 → isSingleCharge 재판정(복원 본인 포함)
      const remaining = await tx.gmTraveler.findMany({
        where: { reservationId: { in: tripReservationIds } },
        select: { id: true, reservationId: true, roomNumber: true, passportNo: true, isSingleCharge: true },
      });
      const roomSingle = judgeSingleCharge(remaining, reservationId, roomNumber);

      let residualUpdated = 0;
      const residents = remaining.filter(
        (t) => t.reservationId === reservationId && t.roomNumber === roomNumber,
      );
      for (const r of residents) {
        if (r.isSingleCharge !== roomSingle) {
          await tx.gmTraveler.update({
            where: { id: r.id },
            data: { isSingleCharge: roomSingle, version: { increment: 1 }, updatedBy: userId },
          });
          await tx.gmReservationAudit.create({
            data: {
              reservationId,
              userId,
              action: 'TRAVELER_SINGLE_CHARGE_RECHECK',
              oldValue: JSON.stringify({ isSingleCharge: r.isSingleCharge }),
              newValue: JSON.stringify({ isSingleCharge: roomSingle }),
              metadata: { travelerId: r.id, cause: 'undo', oldRoom: roomNumber } as Prisma.InputJsonValue,
            },
          });
          residualUpdated++;
        }
      }

      return { restored, residualUpdated };
    });

    if ('conflict' in result) {
      const error =
        result.conflict === 'ALREADY_RESTORED'
          ? '이미 되돌린 삭제입니다.'
          : '대상 탑승객이 이미 존재하여 되돌릴 수 없습니다.';
      return NextResponse.json(
        { ok: false, conflict: true, error },
        { status: 409, headers: noStore }
      );
    }

    logger.log('[APIS Traveler UNDO]', {
      role: ctx.role,
      travelerId,
      action: 'TRAVELER_UNDO',
      undoOfAuditId: expectedAuditId,
      residualUpdated: result.residualUpdated,
    });

    return NextResponse.json(
      { ok: true, restored: result.restored, residualUpdated: result.residualUpdated },
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
    // 동시 복원으로 id 유니크 충돌(트랜잭션 경합) → 409
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return NextResponse.json(
        { ok: false, conflict: true, error: '대상 탑승객이 이미 존재하여 되돌릴 수 없습니다.' },
        { status: 409, headers: noStore }
      );
    }
    logger.error('[APIS Traveler UNDO]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500, headers: noStore });
  }
}
