export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';
import { assertReservationInOrg, ReservationForbidden, resolveUpdaterNames } from '@/lib/apis-traveler-write';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * GET /api/admin/apis/audit?reservationId=123
 * GET /api/admin/apis/audit?travelerId=456
 *
 * APIS 협업 Phase2 — "누가 언제 무엇을 바꿨나" 변경이력 타임라인.
 *
 * - reservationId 로 조회하면 그 예약의 모든 감사로그(셀편집/방이동/싱글차지재판정/undo 등).
 * - travelerId 로 조회하면 metadata.travelerId 가 일치하는 건만 필터(특정 탑승객 한 명의 이력).
 *   travelerId 로 들어와도 테넌트격리·소속 판정을 위해 먼저 reservationId 를 역추적한다.
 * - 최신순(createdAt DESC) 100건. oldValue/newValue JSON 파싱, 변경 필드 목록 추출.
 * - 수정자 이름은 board route 와 동일한 resolveUpdaterNames 패턴으로 배치 조회(N+1 금지).
 *
 * 권한: OWNER / GLOBAL_ADMIN + OWNER 테넌트격리(assertReservationInOrg).
 * 스키마 변경 없음. 읽기 전용(no-store).
 */

type AuditRow = {
  id: number;
  reservationId: number;
  userId: number | null;
  action: string;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
};

/** JSON 문자열을 안전 파싱. 파싱 불가 시 원본 문자열을 그대로 반환(타임라인에서 깨지지 않게). */
function safeParse(value: string | null): unknown {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

/** old/new 가 객체면 키 합집합으로 변경 필드 목록 도출. 아니면 fieldChanged 폴백. */
function deriveChangedFields(
  oldVal: unknown,
  newVal: unknown,
  fieldChanged: string | null,
): string[] {
  const keys = new Set<string>();
  if (oldVal && typeof oldVal === 'object' && !Array.isArray(oldVal)) {
    for (const k of Object.keys(oldVal as Record<string, unknown>)) keys.add(k);
  }
  if (newVal && typeof newVal === 'object' && !Array.isArray(newVal)) {
    for (const k of Object.keys(newVal as Record<string, unknown>)) keys.add(k);
  }
  if (keys.size > 0) return Array.from(keys);
  return fieldChanged && fieldChanged.trim() ? [fieldChanged.trim()] : [];
}

/** metadata.travelerId(Int) 안전 추출. */
function extractTravelerId(metadata: Prisma.JsonValue): number | null {
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

    const reservationIdParam = req.nextUrl.searchParams.get('reservationId')?.trim();
    const travelerIdParam = req.nextUrl.searchParams.get('travelerId')?.trim();

    let reservationId: number | null = null;
    let filterTravelerId: number | null = null;

    if (reservationIdParam) {
      const n = Number(reservationIdParam);
      if (!Number.isInteger(n) || n <= 0) {
        return NextResponse.json({ ok: false, error: 'reservationId 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      reservationId = n;
    } else if (travelerIdParam) {
      const t = Number(travelerIdParam);
      if (!Number.isInteger(t) || t <= 0) {
        return NextResponse.json({ ok: false, error: 'travelerId 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      filterTravelerId = t;
      // travelerId → reservationId 역추적 (테넌트격리/소속 판정 기준)
      const traveler = await prisma.gmTraveler.findUnique({
        where: { id: t },
        select: { reservationId: true },
      });
      if (!traveler) {
        return NextResponse.json({ ok: false, error: '해당 탑승객을 찾을 수 없습니다.' }, { status: 404 });
      }
      reservationId = traveler.reservationId;
    } else {
      return NextResponse.json(
        { ok: false, error: 'reservationId 또는 travelerId 파라미터가 필요합니다.' },
        { status: 400 },
      );
    }

    // ── 테넌트격리: OWNER 는 자기 조직 예약만 (board GET / PATCH 와 동일 규칙) ──
    try {
      await assertReservationInOrg({
        reservationId,
        role: ctx.role,
        organizationId: ctx.organizationId,
      });
    } catch (e) {
      if (e instanceof ReservationForbidden) {
        return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
      }
      throw e;
    }

    // ── 감사로그 조회 (reservationId 기준 최신순, take 100) ──────────
    const audits = await prisma.$queryRaw<AuditRow[]>(Prisma.sql`
      SELECT id, "reservationId", "userId", action, "fieldChanged",
             "oldValue", "newValue", reason, metadata, "createdAt"
      FROM "ReservationAudit"
      WHERE "reservationId" = ${reservationId}
      ORDER BY "createdAt" DESC, id DESC
      LIMIT 100
    `);

    // travelerId 필터(특정 탑승객 한 명) 시 metadata.travelerId 일치 건만
    const filtered = filterTravelerId != null
      ? audits.filter((a) => extractTravelerId(a.metadata) === filterTravelerId)
      : audits;

    // ── userId(Int) → 수정자 이름 배치 조회 (N+1 금지, board 와 공유) ──
    const userIds = Array.from(
      new Set(filtered.map((a) => a.userId).filter((v): v is number => v != null)),
    );
    const nameMap = await resolveUpdaterNames(userIds);

    const rows = filtered.map((a) => {
      const oldValue = safeParse(a.oldValue);
      const newValue = safeParse(a.newValue);
      return {
        id: a.id,
        action: a.action,
        userName: a.userId != null ? (nameMap.get(a.userId) ?? '') : '',
        oldValue,
        newValue,
        changedFields: deriveChangedFields(oldValue, newValue, a.fieldChanged),
        reason: a.reason ?? null,
        createdAt: a.createdAt,
        travelerId: extractTravelerId(a.metadata),
      };
    });

    logger.log('[APIS Audit]', {
      role: ctx.role,
      reservationId,
      travelerId: filterTravelerId,
      rows: rows.length,
    });

    return NextResponse.json(
      { ok: true, reservationId, travelerId: filterTravelerId, rows },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    logger.error('[APIS Audit]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
