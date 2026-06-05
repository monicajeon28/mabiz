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

    // ── 방 단위 그룹핑 + 색상 부여 ────────────────────────────────
    const roomMap = new Map<number, UpdatedByRow[]>();
    for (const tv of travelers) {
      const room = tv.roomNumber > 0 ? tv.roomNumber : 0;
      if (!roomMap.has(room)) roomMap.set(room, []);
      roomMap.get(room)!.push(tv);
    }

    let totalTravelers = 0;
    let completed = 0;
    let pendingPassport = 0;
    let expiredCount = 0;

    const rooms = Array.from(roomMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([roomNumber, list]) => ({
        roomNumber,
        colorHex: getRoomColorValue(roomNumber > 0 ? roomNumber : 1),
        travelers: list.map((tv) => {
          totalTravelers++;

          const filled = [
            tv.engSurname, tv.engGivenName, tv.gender,
            tv.birthDate, tv.passportNo, tv.expiryDate,
          ].filter((v) => !!(v && String(v).trim())).length;
          if (filled >= REQUIRED_FIELDS) completed++;

          const expiredPassport = isPassportExpired(tv.expiryDate, departureDate);
          if (expiredPassport) expiredCount++;
          if (!tv.passportNo || !String(tv.passportNo).trim()) pendingPassport++;

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
          };
        }),
      }));

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

/** 여권만료일(YYYY-MM-DD 등) < 출발일 이면 만료. 파싱 불가 시 false. */
function isPassportExpired(expiryDate: string | null, departureDate: Date): boolean {
  if (!expiryDate || !String(expiryDate).trim()) return false;
  const exp = new Date(String(expiryDate).trim());
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() < departureDate.getTime();
}
