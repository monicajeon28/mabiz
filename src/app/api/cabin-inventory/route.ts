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

    const where: Record<string, unknown> = {};

    // OWNER는 자기 조직만
    if (ctx.role === 'OWNER') {
      where.organizationId = ctx.organizationId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.tripName = { contains: search, mode: 'insensitive' };
    }

    const cabins = await prisma.cabinInventory.findMany({
      where,
      orderBy: [{ departureDate: 'asc' }, { tripName: 'asc' }, { cabinType: 'asc' }],
      include: { organization: { select: { id: true, name: true } } },
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
          organizationName: c.organization.name,
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

    // 기존 판매 현황 먼저 조회 (bookedCount 절대 수정 금지)
    const existingCabins = await prisma.cabinInventory.findMany({
      where: {
        organizationId,
        tripCode: tripCode ?? null,
      },
      select: { cabinType: true, bookedCount: true },
    });
    const bookedMap = new Map(existingCabins.map((c) => [c.cabinType, c.bookedCount]));

    // 판매수보다 적게 수정 시도 → 에러
    for (const c of cabins as { cabinType: string; totalCount: number }[]) {
      const sold = bookedMap.get(c.cabinType) ?? 0;
      if (c.totalCount < sold) {
        return NextResponse.json(
          { ok: false, error: `${c.cabinType}: 이미 ${sold}실 판매됨 — 총 수량은 ${sold} 이상이어야 합니다.` },
          { status: 400 },
        );
      }
    }

    // upsert: bookedCount 유지, totalCount만 업데이트, status 재계산
    const upsertResults = await Promise.all(
      (cabins as { cabinType: string; totalCount: number }[]).map((c) => {
        const sold = bookedMap.get(c.cabinType) ?? 0;
        const newStatus = c.totalCount <= sold ? 'SOLD_OUT' : 'AVAILABLE';
        return prisma.cabinInventory.upsert({
          where: {
            organizationId_tripCode_cabinType: {
              organizationId,
              tripCode: tripCode ?? '',
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
            bookedCount: 0,           // 신규: 판매수 0부터 시작
            status: 'AVAILABLE',
          },
          update: {
            totalCount: c.totalCount, // totalCount만 수정
            // bookedCount 절대 손대지 않음
            tripName,
            departureDate: departureDate ? new Date(departureDate) : null,
            shipName: shipName ?? null,
            status: newStatus,        // 판매수 기준 재계산
          },
        });
      }),
    );
    const created = { count: upsertResults.length };

    logger.info('[cabin-inventory] POST created', {
      organizationId,
      tripName,
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
 * 객실 수량 수정 (GLOBAL_ADMIN만)
 * - bookedCount >= totalCount이면 자동 SOLD_OUT
 */
export async function PUT(req: NextRequest) {
  try {
    const ctx = await getAuthContext();

    if (ctx.role !== 'GLOBAL_ADMIN') {
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
 * 여행 삭제 (GLOBAL_ADMIN만)
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
