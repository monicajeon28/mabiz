/**
 * APIS 협업 편집 기반 헬퍼 (Phase 0)
 *
 * 모든 탑승객(Traveler) 쓰기를 "변경 + 감사로그 기록 + 낙관적 잠금"으로 묶는다.
 * - 쓰기와 audit를 같은 트랜잭션에 묶어 '수정했는데 누가 바꿨는지 기록 안 됨'을 코드상 차단.
 * - version 불일치 시 충돌(409)로 막아 '마지막 저장이 앞사람 입력을 덮어쓰는' lost-update 방지.
 * - updatedBy = 마지막 수정자(userId), updatedAt = @updatedAt 자동 갱신.
 */
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/** 테넌트 격리 위반 — OWNER가 자기 조직 소속이 아닌 예약에 접근 시도. */
export class ReservationForbidden extends Error {
  constructor() {
    super('RESERVATION_FORBIDDEN');
    this.name = 'ReservationForbidden';
  }
}

/**
 * 테넌트 격리 공용 규칙.
 * board GET / traveler PATCH / traveler POST 가 같은 격리 규칙을 공유하게 한다.
 *
 * - GLOBAL_ADMIN : 전체 허용 (검증 통과).
 * - OWNER(scoped) : Reservation.mainUserId → User.phone → OrganizationMember(organizationId=ctx.organizationId)
 *                   매칭이 1건 이상이어야 자기 조직 예약. 0건이면 ReservationForbidden.
 * - 그 외(organizationId 없음) : 보수적으로 차단(ReservationForbidden).
 *
 * board route(GET)의 화이트리스트 방식(소속 예약만 노출)과 동일한 조인을 사용한다.
 *
 * @throws ReservationForbidden 자기 조직 소속이 아닌 예약
 */
export async function assertReservationInOrg(params: {
  reservationId: number;
  role: string;
  organizationId: string | null;
}): Promise<void> {
  const { reservationId, role, organizationId } = params;

  // GLOBAL_ADMIN 은 전체 허용
  if (role === 'GLOBAL_ADMIN') return;

  // OWNER 외 역할 또는 organizationId 없음 → 차단 (이 API는 OWNER/GLOBAL_ADMIN 전용)
  if (role !== 'OWNER' || !organizationId) {
    throw new ReservationForbidden();
  }

  // OWNER scoped: Reservation → mainUser(phone) → OrganizationMember(organizationId) 매칭 확인
  const matched = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT r.id
    FROM "Reservation" r
    JOIN "User" u ON u.id = r."mainUserId"
    JOIN "OrganizationMember" om
      ON om.phone = u.phone AND om."organizationId" = ${organizationId}
    WHERE r.id = ${reservationId}
    LIMIT 1
  `);

  if (matched.length === 0) {
    throw new ReservationForbidden();
  }
}

/**
 * 감사로그/updatedBy 에 기록할 "표시 가능한 식별자" = GmUser.id(Int) 를 해석한다.
 *
 * board route 의 resolveUpdaterNames 는 updatedBy(Int)를
 *  - User.id(Int)                                → name
 *  - OrganizationMember.userId(String=GmUser id) → displayName
 *  - GlobalAdmin.userId(String=GmUser id)        → displayName
 * 로 역해석한다. 따라서 세 경로 모두와 일치하도록 updatedBy 에는 GmUser.id 를 저장해야 한다.
 *
 * - OWNER : 세션이 phone 으로 연결해 둔 ctx.mallUser.id (= GmUser id) 사용.
 *           누락 시 OrganizationMember.userId 폴백 조회.
 * - GLOBAL_ADMIN : GlobalAdmin.userId(= GmUser id) 폴백 조회.
 *
 * 숫자(Int)로 환산되지 않으면 null (CUID 가 NaN 으로 떨어지던 버그 방지).
 */
export async function resolveActorGmUserId(params: {
  userId: string;
  role: string;
  mallUserId?: number | null;
}): Promise<number | null> {
  const { userId, role, mallUserId } = params;

  // 1) 세션에 이미 연결된 GmUser id (OWNER 는 phone 매칭으로 채워짐)
  if (typeof mallUserId === 'number' && Number.isInteger(mallUserId)) {
    return mallUserId;
  }

  // 2) GLOBAL_ADMIN: GlobalAdmin.userId(String=GmUser id) 폴백 조회
  if (role === 'GLOBAL_ADMIN') {
    const admin = await prisma.globalAdmin.findUnique({
      where: { id: userId },
      select: { userId: true },
    });
    const n = admin?.userId ? Number(admin.userId) : NaN;
    return Number.isInteger(n) ? n : null;
  }

  // 3) OWNER/멤버: OrganizationMember.userId(String=GmUser id) 폴백 조회
  const member = await prisma.organizationMember.findUnique({
    where: { id: userId },
    select: { userId: true },
  });
  const n = member?.userId ? Number(member.userId) : NaN;
  return Number.isInteger(n) ? n : null;
}

/**
 * 감사로그/updatedBy 의 userId(Int) 목록 → 표시 이름 Map 배치 조회 (공용).
 *
 * board GET 카드의 수정자 표시와 audit 타임라인의 수정자 표시가 동일 규칙을 쓰도록 공유한다.
 * userId 는 GmUser.id(Int) 이지만 OrganizationMember/GlobalAdmin 은 userId(String) 로 연결될 수
 * 있으므로 세 소스를 모두 IN 절 1회로 배치 조회해 우선순위(몰유저 → 관리자 → 멤버)로 합친다.
 * 모든 조회는 IN 절 1회 — N+1 없음.
 */
export async function resolveUpdaterNames(ids: number[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (ids.length === 0) return result;

  const strIds = ids.map((i) => String(i));

  const [members, admins, mallUsers] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { userId: { in: strIds } },
      select: { userId: true, displayName: true },
    }),
    prisma.globalAdmin.findMany({
      where: { userId: { in: strIds } },
      select: { userId: true, displayName: true },
    }),
    prisma.$queryRaw<{ id: number; name: string | null }[]>(Prisma.sql`
      SELECT id, name FROM "User"
      WHERE id = ANY(ARRAY[${Prisma.join(ids)}]::int[])
    `),
  ]);

  // 우선순위 낮음 → 높음 순서로 채워 마지막에 높은 우선순위가 덮어쓰게 함
  for (const u of mallUsers) {
    if (u.name && u.name.trim()) result.set(u.id, u.name.trim());
  }
  for (const a of admins) {
    if (a.userId && a.displayName && a.displayName.trim()) {
      result.set(Number(a.userId), a.displayName.trim());
    }
  }
  for (const m of members) {
    if (m.userId && m.displayName && m.displayName.trim()) {
      result.set(Number(m.userId), m.displayName.trim());
    }
  }

  return result;
}

/** 낙관적 잠금 충돌 — 다른 사람이 먼저 수정함. latest로 최신본 반환. */
export class TravelerVersionConflict extends Error {
  constructor(public latest: unknown) {
    super('TRAVELER_VERSION_CONFLICT');
    this.name = 'TravelerVersionConflict';
  }
}

/** 대상 탑승객 없음 */
export class TravelerNotFound extends Error {
  constructor() {
    super('TRAVELER_NOT_FOUND');
    this.name = 'TravelerNotFound';
  }
}

/** Traveler 수정 가능 필드 화이트리스트 (임의 컬럼 주입 방지) */
const EDITABLE_FIELDS = [
  'roomNumber', 'isSingleCharge', 'engSurname', 'engGivenName', 'korName',
  'residentNum', 'gender', 'birthDate', 'passportNo', 'issueDate', 'expiryDate',
  'nationality', 'notes', 'phone', 'companionGroupId', 'roomingGroupId',
  'passportImage', 'passportDriveUrl',
] as const;

type EditableField = typeof EDITABLE_FIELDS[number];

export interface WriteTravelerParams {
  travelerId: number;
  /** 변경할 필드들 (화이트리스트 외 키는 무시) */
  changes: Partial<Record<EditableField, unknown>>;
  /** 수정자 userId (OrganizationMember/GlobalAdmin). 없으면 null 기록 */
  userId: number | null;
  /** 낙관적 잠금: 제공 시 현재 version과 비교, 불일치하면 충돌 */
  expectedVersion?: number;
  /** 감사 action 라벨 (기본 TRAVELER_UPDATE) */
  action?: string;
}

/**
 * 탑승객 1건을 안전하게 수정한다. 변경 + version+1 + updatedBy + 감사로그를 한 트랜잭션으로.
 * @throws TravelerVersionConflict version 불일치
 * @throws TravelerNotFound 대상 없음
 */
export async function writeTravelerWithAudit(params: WriteTravelerParams) {
  const { travelerId, changes, userId, expectedVersion, action } = params;

  // 화이트리스트로 정제 (undefined 제외)
  const safe: Record<string, unknown> = {};
  for (const k of EDITABLE_FIELDS) {
    if (k in changes && changes[k] !== undefined) safe[k] = changes[k];
  }

  return prisma.$transaction(async (tx) => {
    const cur = await tx.gmTraveler.findUnique({ where: { id: travelerId } });
    if (!cur) throw new TravelerNotFound();

    // 낙관적 잠금
    if (expectedVersion !== undefined && cur.version !== expectedVersion) {
      throw new TravelerVersionConflict(cur);
    }

    // 변경 전/후 스냅샷 (변경 필드만 — 감사로그 가독성)
    const curRecord = cur as unknown as Record<string, unknown>;
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    for (const k of Object.keys(safe)) {
      oldValue[k] = curRecord[k];
      newValue[k] = safe[k];
    }

    let updated;
    if (expectedVersion !== undefined) {
      // 조건부 원자 업데이트: where에 version을 포함해 lost-update를 DB 레벨에서 차단.
      // TOCTOU(check-then-act)를 제거 — 동시 저장 시 한쪽만 count===1, 나머지는 0이 되어 충돌 처리.
      const res = await tx.gmTraveler.updateMany({
        where: { id: travelerId, version: expectedVersion },
        data: {
          ...(safe as Prisma.GmTravelerUpdateManyMutationInput),
          version: { increment: 1 },
          updatedBy: userId,
        },
      });
      if (res.count === 0) {
        // 그 사이 다른 트랜잭션이 version을 올림 → 최신본을 다시 읽어 충돌 반환.
        const latest = await tx.gmTraveler.findUnique({ where: { id: travelerId } });
        if (!latest) throw new TravelerNotFound();
        throw new TravelerVersionConflict(latest);
      }
      updated = await tx.gmTraveler.findUnique({ where: { id: travelerId } });
      if (!updated) throw new TravelerNotFound();
    } else {
      updated = await tx.gmTraveler.update({
        where: { id: travelerId },
        data: {
          ...(safe as Prisma.GmTravelerUpdateInput),
          version: { increment: 1 },
          updatedBy: userId,
        },
      });
    }

    await tx.gmReservationAudit.create({
      data: {
        reservationId: cur.reservationId,
        userId,
        action: action ?? 'TRAVELER_UPDATE',
        oldValue: JSON.stringify(oldValue),
        newValue: JSON.stringify(newValue),
        metadata: { travelerId } as Prisma.InputJsonValue,
      },
    });

    return updated;
  });
}

/**
 * 방 점유 상태로 싱글차지 여부 재판정 (공용 규칙).
 * src/app/api/pnr/partner/create/route.ts 의 판정 규칙과 동일:
 *  - 방 인원이 1명이거나
 *  - 같은 여권번호가 2개 이상(동일 인물 2회 입력) → 싱글차지.
 *
 * ⚠️ [P0/data-loss] roomNumber 는 trip 전역 유일값이 아니라 '예약(reservationId) 단위'로
 * 매겨진다 — 각 예약의 메인유저는 항상 room 1 로 배정된다(pnr/partner/create). 따라서
 * trip 내 여러 예약을 한 모집단으로 넘기면 서로 다른 예약의 'room 1'들이 한 방으로 잘못
 * 합산되어 싱글차지 판정이 뒤집힌다(요금 누락/오과금). 같은 방은 반드시
 * (reservationId, roomNumber) 복합키로 식별한다.
 */
export function judgeSingleCharge(
  travelers: { reservationId: number; roomNumber: number; passportNo: string | null }[],
  reservationId: number,
  roomNumber: number,
): boolean {
  const inRoom = travelers.filter(
    (t) => t.reservationId === reservationId && t.roomNumber === roomNumber,
  );
  if (inRoom.length <= 1) return true;

  const passportCounts = new Map<string, number>();
  for (const t of inRoom) {
    if (t.passportNo) {
      passportCounts.set(t.passportNo, (passportCounts.get(t.passportNo) ?? 0) + 1);
    }
  }
  return passportCounts.size === 1 && (Array.from(passportCounts.values())[0] ?? 0) >= 2;
}

/** 방 1개당 최대 정원 (정원 초과 이동 차단). 일반 크루즈 객실 기준 4인. */
export const ROOM_MAX_OCCUPANCY = 4;

/** 정원 초과 방으로의 이동 시도 — 차단. */
export class RoomCapacityExceeded extends Error {
  constructor(public roomNumber: number) {
    super('ROOM_CAPACITY_EXCEEDED');
    this.name = 'RoomCapacityExceeded';
  }
}

export interface MoveTravelerParams {
  travelerId: number;
  targetRoom: number;
  /** trip 내 이동 범위(같은 trip의 예약 id들). 이동/재판정 모집단. */
  tripReservationIds: number[];
  /** 수정자 GmUser id. 없으면 null 기록 */
  userId: number | null;
  /** 낙관적 잠금: 이동 대상 traveler의 기대 version */
  expectedVersion?: number;
}

/**
 * 방 이동 — 이동 대상 + "떠난 방"의 잔류 탑승객까지 싱글차지를 함께 재판정해
 * 한 트랜잭션에서 갱신한다. (요금 누락/lost-update 방지)
 *
 * 절차:
 *  1) 대상 traveler 조회 + 낙관적 잠금 확인. 이미 같은 방이면 변경 없음(반환).
 *  2) 정원 초과 방으로의 이동 차단(targetRoom 현재 인원 + 1 > 정원 → RoomCapacityExceeded).
 *  3) 이동 후 상태를 가정해 targetRoom / oldRoom 의 싱글차지를 재판정.
 *  4) 대상은 roomNumber+isSingleCharge 갱신, oldRoom 잔류 탑승객은 isSingleCharge 변동분만 갱신.
 *  5) 각 변경 건에 대해 감사로그 기록.
 *
 * @throws TravelerVersionConflict 이동 대상 version 불일치
 * @throws TravelerNotFound 대상 없음
 * @throws RoomCapacityExceeded 정원 초과
 */
export async function moveTravelerRoomWithAudit(params: MoveTravelerParams) {
  const { travelerId, targetRoom, tripReservationIds, userId, expectedVersion } = params;

  return prisma.$transaction(async (tx) => {
    const cur = await tx.gmTraveler.findUnique({ where: { id: travelerId } });
    if (!cur) throw new TravelerNotFound();

    if (expectedVersion !== undefined && cur.version !== expectedVersion) {
      throw new TravelerVersionConflict(cur);
    }

    const oldRoom = cur.roomNumber;
    // 방 번호는 예약 단위로 매겨지므로(메인유저=room 1) 같은 방 판정은 반드시
    // cur.reservationId 로 한정한다. 방 이동은 같은 예약 안에서만 일어난다.
    const reservationId = cur.reservationId;

    // trip 내 전체 탑승객 (재판정 모집단). reservationId 를 함께 읽어 복합키 판정.
    const tripTravelers = await tx.gmTraveler.findMany({
      where: { reservationId: { in: tripReservationIds } },
      select: { id: true, reservationId: true, roomNumber: true, passportNo: true, isSingleCharge: true },
    });

    // 동일 방으로의 이동이면 변경 없음
    if (oldRoom === targetRoom) {
      return { moved: cur, residualUpdated: 0 };
    }

    // 정원 초과 차단: 같은 예약의 targetRoom 현재 인원(대상 제외) + 1 > 정원
    const targetCurrentCount = tripTravelers.filter(
      (t) => t.reservationId === reservationId && t.roomNumber === targetRoom && t.id !== travelerId,
    ).length;
    if (targetCurrentCount + 1 > ROOM_MAX_OCCUPANCY) {
      throw new RoomCapacityExceeded(targetRoom);
    }

    // 이동 후 상태 가정
    const movedState = tripTravelers.map((t) =>
      t.id === travelerId ? { ...t, roomNumber: targetRoom } : t,
    );

    const targetSingle = judgeSingleCharge(movedState, reservationId, targetRoom);

    // ── 1) 이동 대상 갱신 (낙관적 잠금 조건부 원자 업데이트) ──
    const moveData = {
      roomNumber: targetRoom,
      isSingleCharge: targetSingle,
      version: { increment: 1 },
      updatedBy: userId,
    };

    if (expectedVersion !== undefined) {
      const res = await tx.gmTraveler.updateMany({
        where: { id: travelerId, version: expectedVersion },
        data: moveData,
      });
      if (res.count === 0) {
        const latest = await tx.gmTraveler.findUnique({ where: { id: travelerId } });
        if (!latest) throw new TravelerNotFound();
        throw new TravelerVersionConflict(latest);
      }
    } else {
      await tx.gmTraveler.update({ where: { id: travelerId }, data: moveData });
    }

    await tx.gmReservationAudit.create({
      data: {
        reservationId: cur.reservationId,
        userId,
        action: 'TRAVELER_MOVE_ROOM',
        oldValue: JSON.stringify({ roomNumber: oldRoom, isSingleCharge: cur.isSingleCharge }),
        newValue: JSON.stringify({ roomNumber: targetRoom, isSingleCharge: targetSingle }),
        metadata: { travelerId } as Prisma.InputJsonValue,
      },
    });

    // ── 2) "떠난 방" 잔류 탑승객 싱글차지 재판정 (변동분만 갱신) ──
    // 같은 예약(reservationId)의 oldRoom 만 잔류자로 본다(타 예약 room 1 합산 금지).
    const oldRoomSingle = judgeSingleCharge(movedState, reservationId, oldRoom);
    let residualUpdated = 0;
    const residents = tripTravelers.filter(
      (t) => t.reservationId === reservationId && t.roomNumber === oldRoom && t.id !== travelerId,
    );
    for (const r of residents) {
      if (r.isSingleCharge !== oldRoomSingle) {
        await tx.gmTraveler.update({
          where: { id: r.id },
          data: { isSingleCharge: oldRoomSingle, version: { increment: 1 }, updatedBy: userId },
        });
        await tx.gmReservationAudit.create({
          data: {
            reservationId: cur.reservationId,
            userId,
            action: 'TRAVELER_SINGLE_CHARGE_RECHECK',
            oldValue: JSON.stringify({ isSingleCharge: r.isSingleCharge }),
            newValue: JSON.stringify({ isSingleCharge: oldRoomSingle }),
            metadata: { travelerId: r.id, cause: 'room_move', oldRoom } as Prisma.InputJsonValue,
          },
        });
        residualUpdated++;
      }
    }

    const moved = await tx.gmTraveler.findUnique({ where: { id: travelerId } });
    if (!moved) throw new TravelerNotFound();
    return { moved, residualUpdated };
  });
}
