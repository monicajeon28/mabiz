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
 * POST /api/admin/apis/traveler
 *
 * APIS 협업 편집 Phase1: 같은 방(roomNumber)에 동행인(탑승객) 1명을 추가한다.
 *
 * 핵심:
 *  - PROSPECT 자동 매칭: phone > passportNo > (korName+birthDate) 3단계로 기존 고객(User)을 찾고,
 *    없으면 신규 PROSPECT User를 생성하여 traveler.userId에 연결한다.
 *    (src/app/api/pnr/partner/create/route.ts 의 동행자 매칭 로직 재사용)
 *  - companionGroupId: 같은 방에 기존 동행그룹이 있으면 재사용, 없으면 새 그룹 ID 생성.
 *  - 감사로그: GmReservationAudit (action: 'TRAVELER_COMPANION_ADD') 동시 기록.
 *  - 낙관적 잠금 기준값 version:0 으로 신규 생성.
 *
 * 권한: OWNER / GLOBAL_ADMIN 전용.
 */
export async function POST(req: NextRequest) {
  // ── RBAC: OWNER / GLOBAL_ADMIN 전용 ──────────────────────────
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

    // 감사로그/updatedBy = GmUser id(Int). CUID(memberId/adminId)를 Number()하면
    // NaN→null 이 되어 '최근 수정자' 표시가 깨지던 P1 버그를 막기 위해 공용 해석기 사용.
    const actorUserId = await resolveActorGmUserId({
      userId: ctx.userId,
      role: ctx.role,
      mallUserId: ctx.mallUser?.id ?? null,
    });

    const body = await req.json();
    const reservationIdRaw = body?.reservationId;
    const roomNumberRaw = body?.roomNumber;
    const korName: string | null = typeof body?.korName === 'string' ? body.korName.trim() : null;
    const phone: string | null = typeof body?.phone === 'string' ? body.phone.trim() || null : null;
    const passportNo: string | null =
      typeof body?.passportNo === 'string' ? body.passportNo.trim() || null : null;
    const gender: string | null = typeof body?.gender === 'string' ? body.gender.trim() || null : null;

    // birthDate → YYYY-MM-DD 문자열 정규화 (DB는 String 필드)
    const birthDateRaw = body?.birthDate;
    const birthDate: string | null = birthDateRaw
      ? typeof birthDateRaw === 'string'
        ? birthDateRaw.split('T')[0]
        : new Date(birthDateRaw).toISOString().split('T')[0]
      : null;

    // ── 필수 검증 ────────────────────────────────────────────
    const reservationId = Number(reservationIdRaw);
    const roomNumber = Number(roomNumberRaw);
    if (!Number.isInteger(reservationId) || reservationId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'reservationId가 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    if (!Number.isInteger(roomNumber) || roomNumber <= 0) {
      return NextResponse.json(
        { ok: false, error: 'roomNumber가 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    if (!korName && !phone && !passportNo) {
      return NextResponse.json(
        { ok: false, error: '동행인 식별 정보(이름/연락처/여권번호 중 하나)가 필요합니다.' },
        { status: 400 }
      );
    }

    // ── 예약 존재 검증 ───────────────────────────────────────────
    const reservation = await prisma.gmReservation.findUnique({
      where: { id: reservationId },
      select: { id: true },
    });
    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: '예약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ── OWNER 테넌트격리: 자기 조직 소유 예약에만 동행인 추가 허용 ──────
    // GLOBAL_ADMIN 은 전체 접근. OWNER 는 자기 조직 예약만 수정 가능.
    // Reservation → GmUser(mainUser) → OrganizationMember(phone 매칭) 으로 소속 판별.
    // (board/[id] 라우트와 동일한 격리 규칙)
    const isOwnerScoped = ctx.role === 'OWNER' && !!ctx.organizationId;
    if (isOwnerScoped) {
      const owned = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
        SELECT r.id
        FROM "Reservation" r
        JOIN "User" u ON u.id = r."mainUserId"
        JOIN "OrganizationMember" om
          ON om.phone = u.phone AND om."organizationId" = ${ctx.organizationId!}
        WHERE r.id = ${reservationId}
        LIMIT 1
      `);
      if (owned.length === 0) {
        return NextResponse.json(
          { ok: false, error: '해당 예약에 접근 권한이 없습니다.' },
          { status: 403 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // ── 1) PROSPECT 자동 매칭: phone > passportNo > (korName+birthDate) ──
      let matchedUser: { id: number; name: string | null; phone: string | null; email: string | null } | null =
        null;
      let foundBy = '';

      // 우선순위 1: phone
      if (phone) {
        matchedUser = await tx.gmUser.findFirst({
          where: { phone },
          select: { id: true, name: true, phone: true, email: true },
        });
        if (matchedUser) foundBy = 'phone';
      }

      // 우선순위 2: 여권번호 → Traveler → Reservation → mainUser
      if (!matchedUser && passportNo) {
        const existingTraveler = await tx.gmTraveler.findFirst({
          where: { passportNo },
          select: { userId: true, reservationId: true },
        });
        if (existingTraveler?.userId) {
          matchedUser = await tx.gmUser.findUnique({
            where: { id: existingTraveler.userId },
            select: { id: true, name: true, phone: true, email: true },
          });
        } else if (existingTraveler?.reservationId) {
          const existingReservation = await tx.gmReservation.findUnique({
            where: { id: existingTraveler.reservationId },
            select: { mainUserId: true },
          });
          if (existingReservation?.mainUserId) {
            matchedUser = await tx.gmUser.findUnique({
              where: { id: existingReservation.mainUserId },
              select: { id: true, name: true, phone: true, email: true },
            });
          }
        }
        if (matchedUser) foundBy = 'passport';
      }

      // 우선순위 3: 이름 + 생년월일 (신뢰도 낮음 → 둘 다 있어야 매칭)
      if (!matchedUser && korName && birthDate) {
        const existingTraveler = await tx.gmTraveler.findFirst({
          where: { korName, birthDate },
          select: { userId: true, reservationId: true },
        });
        if (existingTraveler?.userId) {
          matchedUser = await tx.gmUser.findUnique({
            where: { id: existingTraveler.userId },
            select: { id: true, name: true, phone: true, email: true },
          });
        } else if (existingTraveler?.reservationId) {
          const existingReservation = await tx.gmReservation.findUnique({
            where: { id: existingTraveler.reservationId },
            select: { mainUserId: true },
          });
          if (existingReservation?.mainUserId) {
            matchedUser = await tx.gmUser.findUnique({
              where: { id: existingReservation.mainUserId },
              select: { id: true, name: true, phone: true, email: true },
            });
          }
        }
        if (matchedUser) foundBy = 'name+birth';
      }

      // ── 2) 매칭 없으면 신규 PROSPECT 생성 (폴백) ──
      let linkedUserId: number;
      if (matchedUser) {
        // 기존 User 정보 보강 (비어있는 필드만)
        const updateData: Prisma.GmUserUpdateInput = {};
        if (korName && !matchedUser.name) updateData.name = korName;
        if (phone && !matchedUser.phone) updateData.phone = phone;
        if (Object.keys(updateData).length > 0) {
          // OWNER 테넌트격리: 매칭된 기존 User 가 동일 조직 소속일 때만 보강 update 수행.
          // (전사 phone/passport 매칭이 타 조직 고객을 잡았을 때 그 User 를 수정하지 않도록 차단)
          let mayEnrich = true;
          if (isOwnerScoped) {
            const sameOrg = await tx.$queryRaw<{ id: number }[]>(Prisma.sql`
              SELECT u.id
              FROM "User" u
              JOIN "OrganizationMember" om
                ON om.phone = u.phone AND om."organizationId" = ${ctx.organizationId!}
              WHERE u.id = ${matchedUser.id}
              LIMIT 1
            `);
            mayEnrich = sameOrg.length > 0;
          }
          if (mayEnrich) {
            await tx.gmUser.update({ where: { id: matchedUser.id }, data: updateData });
          }
        }
        linkedUserId = matchedUser.id;
        logger.log('[APIS Traveler Add] 기존 고객 재사용', {
          userId: linkedUserId,
          foundBy,
          reservationId,
        });
      } else {
        const passwordSource = passportNo || phone || `temp_${Date.now()}`;
        const hashedPassword = await bcrypt.hash(passwordSource, 10);
        const created = await tx.gmUser.create({
          data: {
            phone: phone || null,
            name: korName || null,
            password: hashedPassword,
            role: 'PROSPECT',
            onboarded: false,
            customerStatus: 'PROSPECT',
            customerSource: 'APIS_COMPANION',
            updatedAt: new Date(),
          },
          select: { id: true },
        });
        linkedUserId = created.id;
        logger.log('[APIS Traveler Add] 신규 PROSPECT 생성', {
          userId: linkedUserId,
          reservationId,
        });
      }

      // ── 3) companionGroupId: 같은 방 기존 그룹 재사용 / 없으면 새 그룹 ──
      // race condition 방지: (reservationId, roomNumber) 기준 트랜잭션 advisory lock 으로
      // "같은 방 조회 + 새 그룹 ID 산출"을 직렬화한다. 동시에 같은 방에 동행인을 추가해도
      // ① 같은 방인데 서로 다른 그룹이 생기거나 ② 두 요청이 같은 max+1 을 읽어 충돌하는 것을 차단.
      // 같은 트랜잭션이 끝날 때(COMMIT/ROLLBACK) 자동 해제되는 xact lock 사용.
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(${reservationId}::int, ${roomNumber}::int)`
      );

      const sameRoomTraveler = await tx.gmTraveler.findFirst({
        where: {
          reservationId,
          roomNumber,
          companionGroupId: { not: null },
        },
        select: { companionGroupId: true },
        orderBy: { id: 'asc' },
      });

      let companionGroupId: number;
      if (sameRoomTraveler?.companionGroupId) {
        companionGroupId = sameRoomTraveler.companionGroupId;
      } else {
        // 새 그룹 ID: 전체 companionGroupId 최대값 + 1.
        // advisory lock 으로 같은 방 동시 추가가 직렬화되므로, 새 그룹 산출 구간이 보호된다.
        const maxGroup = await tx.gmTraveler.aggregate({
          _max: { companionGroupId: true },
        });
        companionGroupId = (maxGroup._max.companionGroupId ?? 0) + 1;
      }

      // ── 4) 동행인 Traveler 생성 (version:0 = 낙관적 잠금 초기값) ──
      const traveler = await tx.gmTraveler.create({
        data: {
          reservationId,
          roomNumber,
          companionGroupId,
          userId: linkedUserId,
          korName: korName || null,
          phone: phone || null,
          passportNo: passportNo || null,
          birthDate,
          gender: gender || null,
          version: 0,
          updatedBy: actorUserId,
        },
      });

      // ── 5) 감사로그 ──
      await tx.gmReservationAudit.create({
        data: {
          reservationId,
          userId: actorUserId,
          action: 'TRAVELER_COMPANION_ADD',
          newValue: JSON.stringify({
            roomNumber,
            korName,
            phone,
            passportNo,
            linkedUserId,
            matchedBy: foundBy || 'new_prospect',
          }),
          metadata: { travelerId: traveler.id } as Prisma.InputJsonValue,
        },
      });

      return { traveler, linkedUserId, matchedBy: foundBy || 'new_prospect' };
    });

    logger.log('[APIS Traveler Add] 완료', {
      travelerId: result.traveler.id,
      reservationId,
      roomNumber,
      matchedBy: result.matchedBy,
    });

    return NextResponse.json({ ok: true, traveler: result.traveler });
  } catch (err) {
    logger.error('[APIS Traveler Add] Error', { err });
    return NextResponse.json(
      { ok: false, error: '동행인 추가에 실패했습니다.' },
      { status: 500 }
    );
  }
}
