import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cabin-inventory
 * 잔여객실 목록 조회
 * - GLOBAL_ADMIN: 전체 조직
 * - OWNER: 자기 조직만
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    const where: Record<string, unknown> = {} as any;

    // OWNER는 자기 조직만
    if (ctx.role === 'OWNER') {
      where.organizationId = ctx.organizationId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      // LIKE 와일드카드 이스케이프
      const escapedSearch = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      where.tripName = { contains: escapedSearch, mode: 'insensitive' };
    }

    const cabins = await prisma.cabinInventory.findMany({
      where,
      orderBy: [{ departureDate: 'asc' }, { tripName: 'asc' }, { cabinType: 'asc' }],
    });

    // availableCount 계산 + 여행별 그룹핑
    const tripMap = new Map<string, {
      tripName: string;
      tripCode: string | null;
      departureDate: string | null;
      shipName: string | null;
      organizationId: string;
      organizationName: string | null;
      cabins: Array<{
        id: string;
        cabinType: string;
        totalCount: number;
        bookedCount: number;
        availableCount: number;
        status: string;
      }>;
    }>();

    for (const c of cabins) {
      // 그룹 키: org + tripCode(있으면) 또는 tripName
      const groupKey = `${c.organizationId}::${c.tripCode ?? c.tripName}`;

      if (!tripMap.has(groupKey)) {
        tripMap.set(groupKey, {
          tripName: c.tripName,
          tripCode: c.tripCode,
          departureDate: c.departureDate?.toISOString() ?? null,
          shipName: c.shipName,
          organizationId: c.organizationId,
          organizationName: null,
          cabins: [],
        });
      }

      tripMap.get(groupKey)!.cabins.push({
        id: c.id,
        cabinType: c.cabinType,
        totalCount: c.totalCount,
        bookedCount: c.bookedCount,
        availableCount: Math.max(0, c.totalCount - c.bookedCount),
        status: c.status,
      });
    }

    const trips = Array.from(tripMap.values());

    return NextResponse.json({ ok: true, trips, totalCabinRows: cabins.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('[cabin-inventory] GET error', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/cabin-inventory
 * 새 여행 + 객실 등록 (GLOBAL_ADMIN만)
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // OWNER는 자기 조직만 등록 가능
    const body = await req.json();
    let { organizationId, tripName, tripCode, departureDate, shipName, cabins } = body;

    // GLOBAL_ADMIN은 organizationId 없이 호출 가능 → 자동으로 첫 번째 조직 사용
    if (!organizationId && ctx.role === 'GLOBAL_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (firstOrg) organizationId = firstOrg.id;
    }

    // OWNER는 자기 조직만
    if (ctx.role === 'OWNER' && ctx.organizationId && organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: '자기 조직만 등록 가능합니다' }, { status: 403 });
    }

    if (!organizationId || !tripName || !Array.isArray(cabins) || cabins.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'organizationId, tripName, cabins[] 필수' },
        { status: 400 },
      );
    }

    // 각 cabin 유효성 검사
    for (const cabin of cabins) {
      if (!cabin.cabinType || typeof cabin.totalCount !== 'number' || cabin.totalCount < 0) {
        return NextResponse.json(
          { ok: false, error: '각 cabin에 cabinType(string)과 totalCount(0 이상 정수) 필수' },
          { status: 400 },
        );
      }
    }

    // 원자적 처리: 트랜잭션으로 검증+upsert 함께 수행
    let created = { count: 0 };
    try {
      created = await prisma.$transaction(async (tx) => {
        // 기존 판매 현황 먼저 조회 (bookedCount 절대 수정 금지)
        const existingCabins = await tx.cabinInventory.findMany({
          where: {
            organizationId,
            ...(tripCode
              ? { tripCode }
              : { tripCode: null, tripName }),
          },
          select: { cabinType: true, bookedCount: true },
        });
        const bookedMap = new Map(existingCabins.map((c) => [c.cabinType, c.bookedCount]));

        // 실제 예약 수 집계 (tripCode 기준)
        let reservationMap = new Map<string, number>();
        if (tripCode) {
          // tripCode로 GmTrip 찾아서 tripId 목록 가져오기
          const trips = await tx.gmTrip.findMany({
            where: { productCode: tripCode },
            select: { id: true },
          });
          const tripIds = trips.map((t) => t.id);

          if (tripIds.length > 0) {
            const reservationGroups = await (tx.gmReservation.groupBy as any)({
              by: ['cabinType'],
              where: {
                tripId: { in: tripIds },
                status: 'CONFIRMED',
                pnrStatus: 'COMPLETED',
              },
              _count: { id: true },
            });
            reservationMap = new Map(
              reservationGroups.map((r: { cabinType: string | null; _count: { id: number } }) => [
                r.cabinType ?? 'unknown',
                r._count.id,
              ])
            );
          }
        }

        // 판매수보다 적게 수정 시도 → 에러 (수동 bookedCount와 실제 예약수 중 큰 값 사용)
        for (const c of cabins as { cabinType: string; totalCount: number }[]) {
          const manualBooked = bookedMap.get(c.cabinType) ?? 0;
          const actualBooked = reservationMap.get(c.cabinType) ?? 0;
          const sold = Math.max(manualBooked, actualBooked);
          if (c.totalCount < sold) {
            throw new Error(
              `${c.cabinType}: 이미 ${sold}실 판매됨 — 총 수량은 ${sold} 이상이어야 합니다.`
            );
          }
        }

        // upsert: bookedCount 유지, totalCount만 업데이트, status 재계산
        const upsertResults = await Promise.all(
          (cabins as { cabinType: string; totalCount: number }[]).map((c) => {
            const manualBooked = bookedMap.get(c.cabinType) ?? 0;
            const actualBooked = reservationMap.get(c.cabinType) ?? 0;
            const sold = Math.max(manualBooked, actualBooked);
            const newStatus = c.totalCount <= sold ? 'SOLD_OUT' : 'AVAILABLE';
            return tx.cabinInventory.upsert({
              where: {
                organizationId_tripCode_cabinType: {
                  organizationId,
                  tripCode: tripCode ?? null,
                  cabinType: c.cabinType,
                },
              },
              create: {
                organizationId,
                tripName,
                tripCode: tripCode ?? null,
                departureDate: departureDate ? new Date(departureDate) : null,
                shipName: shipName ?? null,
                cabinType: c.cabinType,
                totalCount: c.totalCount,
                bookedCount: sold,
                status: c.totalCount <= sold ? 'SOLD_OUT' : 'AVAILABLE',
              },
              update: {
                totalCount: c.totalCount,
                tripName,
                departureDate: departureDate ? new Date(departureDate) : null,
                shipName: shipName ?? null,
                status: newStatus,
              },
            });
          }),
        );
        return { count: upsertResults.length };
      });
    } catch (txErr) {
      const msg = txErr instanceof Error ? txErr.message : 'Transaction error';
      logger.error('[cabin-inventory] POST transaction error', { error: msg });

      if (msg.includes('이미') || msg.includes('판매')) {
        return NextResponse.json({ ok: false, error: msg }, { status: 400 });
      }
      return NextResponse.json({ ok: false, error: '객실 등록에 실패했습니다.' }, { status: 500 });
    }

    logger.info('[cabin-inventory] POST created', {
      organizationId,
      tripName,
      tripCode,
      count: created.count,
    });

    return NextResponse.json({ ok: true, createdCount: created.count }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('[cabin-inventory] POST error', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * PUT /api/cabin-inventory
 * 객실 수량 수정 (GLOBAL_ADMIN + OWNER)
 * - bookedCount >= totalCount이면 자동 SOLD_OUT
 */
export async function PUT(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role !== 'GLOBAL_ADMIN' && ctx.role !== 'OWNER') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { id, totalCount, status } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: 'id 필수' }, { status: 400 });
    }

    // 기존 레코드 조회
    const existing = await prisma.cabinInventory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: '해당 객실을 찾을 수 없습니다' }, { status: 404 });
    }

    // OWNER는 자기 조직만 수정 가능
    if (ctx.role === 'OWNER' && existing.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: '자기 조직의 객실만 수정 가능합니다' }, { status: 403 });
    }

    const newTotalCount = typeof totalCount === 'number' ? totalCount : existing.totalCount;
    let newStatus = status ?? existing.status;

    // bookedCount >= totalCount이면 자동 SOLD_OUT
    if (existing.bookedCount >= newTotalCount && newStatus !== 'CLOSED') {
      newStatus = 'SOLD_OUT';
    }

    const updated = await prisma.cabinInventory.update({
      where: { id },
      data: {
        ...(typeof totalCount === 'number' ? { totalCount } : {}),
        status: newStatus,
      },
    });

    logger.info('[cabin-inventory] PUT updated', { id, totalCount: newTotalCount, status: newStatus });

    return NextResponse.json({
      ok: true,
      cabin: {
        ...updated,
        availableCount: Math.max(0, updated.totalCount - updated.bookedCount),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('[cabin-inventory] PUT error', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/cabin-inventory
 * 여행 삭제 (GLOBAL_ADMIN만, OWNER는 불가)
 */
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: 'id 필수' }, { status: 400 });
    }

    const existing = await prisma.cabinInventory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: '해당 객실을 찾을 수 없습니다' }, { status: 404 });
    }

    await prisma.cabinInventory.delete({ where: { id } });

    logger.info('[cabin-inventory] DELETE removed', { id, tripName: existing.tripName, cabinType: existing.cabinType });

    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    logger.error('[cabin-inventory] DELETE error', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
