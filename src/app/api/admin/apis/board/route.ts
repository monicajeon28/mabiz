export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';
import { fetchApisData } from '@/lib/apis-excel';
import { getRoomColorValue } from '@/lib/pnr-utils';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * GET /api/admin/apis/board?productCode=xxx
 *
 * APIS 협업 편집 보드(방=색깔카드) 데이터 — 읽기 전용, 스키마 변경 없음.
 * /products·/passport/apis 의 단일 공용 보드 컴포넌트가 함께 사용한다.
 *
 * - 방 단위로 탑승객을 그룹핑하고 8색 색상을 부여(getRoomColorValue 재사용).
 * - 각 탑승객에 낙관적 잠금용 version, 셀 저장에 필요한 reservationId 포함.
 * - 카드 표시용: agentName(고객 담당자) + updatedByName(최근 수정자 이름, 배치조회로 N+1 방지).
 * - 여권번호/생년월일은 그대로 내려주되, 마스킹은 UI 책임.
 *
 * 권한: OWNER / GLOBAL_ADMIN + OWNER 테넌트격리(organizationId).
 */

/** updatedBy(Int userId) → 표시 이름 배치 조회 결과 */
type UpdatedByRow = {
  reservationId: number;
  travelerId: number;
  version: number;
  roomNumber: number;
  isSingleCharge: boolean;
  engSurname: string | null;
  engGivenName: string | null;
  korName: string | null;
  gender: string | null;
  birthDate: string | null;
  nationality: string | null;
  passportNo: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  phone: string | null;
  companionGroupId: number | null;
  updatedAt: Date;
  updatedBy: number | null;
};

const REQUIRED_FIELDS = 6; // 영문성·영문이름·성별·생년월일·여권번호·여권만료일

export async function GET(req: NextRequest) {
  // ── RBAC: GLOBAL_ADMIN / OWNER 전용 ───────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN', 'OWNER'],
    errorMessage: '권한이 없습니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const productCode = req.nextUrl.searchParams.get('productCode')?.trim();
    if (!productCode) {
      return NextResponse.json({ ok: false, error: 'productCode 파라미터가 필요합니다.' }, { status: 400 });
    }

    // ── 데이터 조회 (apis-excel.fetchApisData 재사용) ──────────────
    const data = await fetchApisData(productCode);
    if (!data) {
      return NextResponse.json({ ok: false, error: '해당 상품코드를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { trip } = data;
    const departureDate = trip.departureDate;

    // ── OWNER 테넌트격리: 해당 organization 소유 예약만 조회 ────────
    // Reservation → GmUser(mainUser) → OrganizationMember(phone 매칭) 으로 소속 판별.
    // GLOBAL_ADMIN 은 전체 접근. OWNER 는 자기 조직 예약만 노출.
    const isOwnerScoped = ctx.role === 'OWNER' && !!ctx.organizationId;

    // ── 예약·탑승객 조회 (board용 컬럼만, agentName 포함) ──────────
    type ResRow = { id: number; agentName: string | null };
    const reservations = trip.id > 0
      ? await prisma.$queryRaw<ResRow[]>(Prisma.sql`
          SELECT id, "agentName"
          FROM "Reservation"
          WHERE "tripId" = ${trip.id}
          ORDER BY id ASC
        `)
      : [];

    let reservationIds = reservations.map((r) => r.id);

    // OWNER 테넌트격리: 조직 멤버 phone 으로 연결된 예약만 남김
    if (isOwnerScoped && reservationIds.length > 0) {
      const allowed = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
        SELECT r.id
        FROM "Reservation" r
        JOIN "User" u ON u.id = r."mainUserId"
        JOIN "OrganizationMember" om
          ON om.phone = u.phone AND om."organizationId" = ${ctx.organizationId!}
        WHERE r.id = ANY(ARRAY[${Prisma.join(reservationIds)}]::int[])
      `);
      const allowedSet = new Set(allowed.map((a) => a.id));
      reservationIds = reservationIds.filter((id) => allowedSet.has(id));
    }

    const agentNameMap = new Map(reservations.map((r) => [r.id, r.agentName ?? '']));

    const travelers = reservationIds.length === 0
      ? []
      : await prisma.$queryRaw<UpdatedByRow[]>(Prisma.sql`
          SELECT "reservationId", id AS "travelerId", version, "roomNumber",
                 "isSingleCharge",
                 "engSurname", "engGivenName", "korName", gender, "birthDate",
                 nationality, "passportNo", "issueDate", "expiryDate", phone,
                 "companionGroupId", "updatedAt", "updatedBy"
          FROM "Traveler"
          WHERE "reservationId" = ANY(ARRAY[${Prisma.join(reservationIds)}]::int[])
          ORDER BY "roomNumber" ASC, id ASC
        `);

    // ── updatedBy(Int) → 이름 배치 조회 (N+1 금지) ────────────────
    const updaterIds = Array.from(
      new Set(travelers.map((t) => t.updatedBy).filter((v): v is number => v != null)),
    );
    const updaterNameMap = await resolveUpdaterNames(updaterIds);

    // ── 그룹핑 단위 = '예약 × 방' + 색상 부여 ─────────────────────────
    // roomNumber 는 예약 단위로 매겨져 전역 유일하지 않다(메인유저는 항상 room 1).
    // 따라서 roomNumber 만으로 키잉하면 서로 다른 예약의 다른 고객이 같은 'room 1' 카드로
    // 병합되어 (a) 여권중복 오탐/누락, (b) 싱글차지·색상·완성도 표시 혼선, (c) 집계 왜곡이 발생한다.
    // → 키를 `${reservationId}::${roomNumber}` 튜플로 변경해 예약×방 단위로 분리한다.
    type RoomGroup = { reservationId: number; roomNumber: number; list: UpdatedByRow[] };
    const roomMap = new Map<string, RoomGroup>();
    for (const tv of travelers) {
      const room = tv.roomNumber > 0 ? tv.roomNumber : 0;
      const key = `${tv.reservationId}::${room}`;
      let group = roomMap.get(key);
      if (!group) {
        group = { reservationId: tv.reservationId, roomNumber: room, list: [] };
        roomMap.set(key, group);
      }
      group.list.push(tv);
    }

    let totalTravelers = 0;
    let completed = 0;
    let pendingPassport = 0;
    let expiredCount = 0;
    let incompleteCount = 0;
    let dupCount = 0;

    const rooms = Array.from(roomMap.values())
      .sort((a, b) =>
        a.reservationId !== b.reservationId
          ? a.reservationId - b.reservationId
          : a.roomNumber - b.roomNumber,
      )
      .map(({ reservationId, roomNumber, list }) => {
        // ── 같은 예약×방 내 여권번호 중복 감지(파생계산, 쓰기 없음) ──────
        // 동일 reservationId·roomNumber 범위 안에서 동일 passportNo 가 서로 다른 travelerId 로
        // 2건+ 존재하면 중복 후보. (다른 예약은 grouping 단계에서 이미 분리되어 섞이지 않는다.)
        //
        // ⚠️ 단, '싱글차지(1인 1실 = 동일 인물 여권 2회 입력)'는 정식 데이터 모델로 허용되므로
        //    중복 오탐(false positive)에서 제외한다.
        //    (apis-traveler-write.ts judgeSingleCharge / pnr/partner/create 의 판정 규칙과 동일 의미)
        //    제외 조건: 해당 여권번호를 가진 같은 방 행이 모두 isSingleCharge=true 이면
        //    동일인 더블엔트리(싱글차지)로 보고 중복 경고를 띄우지 않는다.
        const passportOwners = new Map<string, Set<number>>();
        for (const tv of list) {
          const pno = normalizePassport(tv.passportNo);
          if (!pno) continue;
          if (!passportOwners.has(pno)) passportOwners.set(pno, new Set());
          passportOwners.get(pno)!.add(tv.travelerId);
        }
        const dupPassportSet = new Set<string>();
        for (const [pno, owners] of passportOwners) {
          if (owners.size < 2) continue;
          // 같은 방에서 이 여권번호를 가진 모든 행
          const ownerRows = list.filter((t) => normalizePassport(t.passportNo) === pno);
          // 싱글차지 더블엔트리(동일인 2회 입력)면 정상 케이스 → 중복 제외
          if (ownerRows.every((t) => t.isSingleCharge)) continue;
          dupPassportSet.add(pno);
        }

        return {
          // 카드 그룹핑 단위 = 예약×방. 같은 roomNumber 라도 예약이 다르면 별도 카드로 분리된다.
          reservationId,
          roomNumber,
          colorHex: getRoomColorValue(roomNumber > 0 ? roomNumber : 1),
          travelers: list.map((tv) => {
            totalTravelers++;

            const filled = [
              tv.engSurname, tv.engGivenName, tv.gender,
              tv.birthDate, tv.passportNo, tv.expiryDate,
            ].filter((v) => !!(v && String(v).trim())).length;
            const isComplete = filled >= REQUIRED_FIELDS;
            if (isComplete) completed++;

            const expiredPassport = isPassportExpired(tv.expiryDate, departureDate);
            if (expiredPassport) expiredCount++;
            if (!tv.passportNo || !String(tv.passportNo).trim()) pendingPassport++;

            // ── 검증 warnings 산출 (파생계산, 쓰기 없음) ──────────────
            const warnings: string[] = [];

            // (3) 필수필드 null/빈값
            const missingFields = [
              ['engSurname', tv.engSurname],
              ['engGivenName', tv.engGivenName],
              ['gender', tv.gender],
              ['birthDate', tv.birthDate],
              ['passportNo', tv.passportNo],
              ['expiryDate', tv.expiryDate],
            ].filter(([, v]) => !(v && String(v).trim()));
            if (missingFields.length > 0) warnings.push('missing');

            // (1) 만료여권
            if (expiredPassport) warnings.push('expired');

            // (2) 여권번호 형식: 값이 있는데 형식 불일치
            const pnoRaw = tv.passportNo ? String(tv.passportNo).trim() : '';
            if (pnoRaw && !/^[A-Z0-9]{6,9}$/.test(pnoRaw.toUpperCase())) {
              warnings.push('passport_format');
            }

            // (4) 영문 성/이름 미분리: 한쪽만 채워짐
            const hasSurname = !!(tv.engSurname && String(tv.engSurname).trim());
            const hasGivenName = !!(tv.engGivenName && String(tv.engGivenName).trim());
            if (hasSurname !== hasGivenName) warnings.push('eng_split');

            // (5) 같은 방 동일 여권 중복
            const normPno = normalizePassport(tv.passportNo);
            if (normPno && dupPassportSet.has(normPno)) warnings.push('dup_passport');

            // 집계: 미완성(필수누락) / 중복
            if (missingFields.length > 0) incompleteCount++;
            if (warnings.includes('dup_passport')) dupCount++;

            // 상태: error(만료/형식/중복) > partial(미완성/영문분리) > complete
            const hasError =
              warnings.includes('expired') ||
              warnings.includes('passport_format') ||
              warnings.includes('dup_passport');
            const status: 'complete' | 'partial' | 'error' = hasError
              ? 'error'
              : (!isComplete || warnings.length > 0)
                ? 'partial'
                : 'complete';

            return {
              id: tv.travelerId,
              reservationId: tv.reservationId,
              version: tv.version,
              korName: tv.korName ?? '',
              engSurname: tv.engSurname ?? '',
              engGivenName: tv.engGivenName ?? '',
              gender: tv.gender ?? '',
              birthDate: tv.birthDate ?? '',
              nationality: tv.nationality ?? '',
              passportNo: tv.passportNo ?? '',
              issueDate: tv.issueDate ?? '',
              expiryDate: tv.expiryDate ?? '',
              phone: tv.phone ?? '',
              companionGroupId: tv.companionGroupId,
              isCompanion: tv.companionGroupId != null,
              agentName: agentNameMap.get(tv.reservationId) ?? '',
              updatedAt: tv.updatedAt,
              updatedByName: tv.updatedBy != null ? (updaterNameMap.get(tv.updatedBy) ?? '') : '',
              completeness: { filled, required: REQUIRED_FIELDS },
              expiredPassport,
              warnings,
              status,
            };
          }),
        };
      });

    logger.log('[APIS Board]', {
      role: ctx.role,
      productCode,
      tripId: trip.id,
      rooms: rooms.length,
      travelers: totalTravelers,
    });

    return NextResponse.json({
      ok: true,
      product: {
        code: trip.productCode,
        name: trip.cruiseName ?? trip.packageName ?? trip.shipName ?? trip.productCode,
        departureDate,
        shipName: trip.shipName,
      },
      rooms,
      summary: {
        totalTravelers,
        completed,
        pendingPassport,
        expiredCount,
        incompleteCount,
        dupCount,
      },
    });
  } catch (err) {
    logger.error('[APIS Board]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}

/**
 * updatedBy userId(Int) 목록 → 표시 이름 Map 배치 조회.
 * updatedBy 는 GmUser.id(Int) 이지만, OrganizationMember/GlobalAdmin 은 userId(String) 로
 * 연결될 수 있으므로 세 소스를 모두 배치 조회해 우선순위(멤버 → 관리자 → 몰유저)로 합친다.
 * 모든 조회는 IN 절 1회 — N+1 없음.
 */
async function resolveUpdaterNames(ids: number[]): Promise<Map<number, string>> {
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

/** 여권번호 정규화: 대문자화 + 공백/하이픈 제거. 빈값이면 null. 중복 비교 키로 사용. */
function normalizePassport(passportNo: string | null): string | null {
  if (!passportNo) return null;
  const norm = String(passportNo).trim().toUpperCase().replace(/[\s-]/g, '');
  return norm.length > 0 ? norm : null;
}

/** 여권만료일(YYYY-MM-DD 등) < 출발일 이면 만료. 파싱 불가 시 false. */
function isPassportExpired(expiryDate: string | null, departureDate: Date): boolean {
  if (!expiryDate || !String(expiryDate).trim()) return false;
  const exp = new Date(String(expiryDate).trim());
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() < departureDate.getTime();
}
