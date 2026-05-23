export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

type RawProduct = {
  id: number;
  productCode: string;
  cruiseLine: string;
  shipName: string;
  packageName: string;
  basePrice: number;
  nights: number;
  days: number;
  isActive: boolean;
  saleStatus: string | null;
  availableCount: number | null;
  reservedCount: number | null;
  refundPolicy: unknown;
  itineraryPattern: unknown;
  tourCities: string | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
};

type TripRow = {
  productCode: string;
  departureDate: Date;
  shipName: string;
};

// CabinInventory: 상품 등록 시 설정한 총 용량
type InventoryRow = {
  tripCode: string;
  cabinType: string;
  total: bigint;
  status: string; // ★ AVAILABLE, SOLD_OUT 등
};

// Reservation: 실제 확정된 예약 건수 (여권+PNR 완료 기준)
type ReservationCountRow = {
  productCode: string;
  cabinType: string;
  count: bigint;
};

type CabinEntry = { total: number; booked: number; remaining: number; status: string };
type CabinSummary = Record<string, CabinEntry>;

const CABIN_STATUS = {
  AVAILABLE: 'AVAILABLE',
  SOLD_OUT: 'SOLD_OUT',
} as const;

type CabinStatus = typeof CABIN_STATUS[keyof typeof CABIN_STATUS];

function normalizeStatus(raw: string | null): CabinStatus {
  const normalized = (raw ?? '').toUpperCase().trim();
  return normalized === 'SOLD_OUT' ? 'SOLD_OUT' : 'AVAILABLE';
}

/**
 * 객실타입 정규화: 한국어/영어 혼용 → 통일된 키
 * CabinInventory.cabinType 과 Reservation.cabinType 이 다를 수 있으므로 정규화
 */
function normalizeCabinType(raw: string): string {
  const s = (raw ?? '').toLowerCase().trim();
  if (s.includes('발코니') || s.includes('balcony')) return 'balcony';
  if (s.includes('오션뷰') || s.includes('ocean')) return 'oceanview';
  if (s.includes('내측') || s.includes('inside') || s.includes('인사이드')) return 'inside';
  if (s.includes('스위트') || s.includes('suite')) return 'suite';
  return s || 'other';
}

/**
 * GET /api/products
 * 크루즈 상품 목록 조회 (CruiseProduct 테이블)
 * + 출발일(D-day) + 일정 + 객실 잔여 현황 + 환불정책
 *
 * FREE_SALES: 403
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1')  || 1);
    const limit  = Math.min(200, parseInt(searchParams.get('limit') ?? '50') || 50);
    const offset = (page - 1) * limit;

    const q           = searchParams.get('q')?.trim() ?? '';
    const isActiveRaw = searchParams.get('isActive');
    const isActive: boolean | null =
      isActiveRaw === 'true'  ? true  :
      isActiveRaw === 'false' ? false :
      null;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`p."deletedAt" IS NULL`,
    ];
    if (isActive !== null) conditions.push(Prisma.sql`p."isActive" = ${isActive}`);
    if (q) conditions.push(Prisma.sql`(p."packageName" ILIKE ${'%' + q + '%'} OR p."productCode" ILIKE ${'%' + q + '%'})`);

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<RawProduct[]>(Prisma.sql`
        SELECT p.id, p."productCode", p."cruiseLine", p."shipName",
               p."packageName", p."basePrice", p.nights, p.days,
               p."isActive", p."saleStatus",
               p."availableCount", p."reservedCount",
               p."refundPolicy", p."itineraryPattern", p."tourCities",
               p."startDate", p."endDate", p."createdAt"
        FROM "CruiseProduct" p
        ${whereClause}
        ORDER BY p."startDate" DESC NULLS LAST, p."createdAt" DESC
        LIMIT 50 OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total FROM "CruiseProduct" p ${whereClause}
      `),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    // ── 배치 조회 (병렬) ─────────────────────────────────────────
    const codes = rows
      .map((r) => r.productCode)
      .filter((c): c is string => !!c && c.length > 0);

    const [tripRows, inventoryRows, reservationRows] = await (codes.length > 0
      ? Promise.all([
          // 1) Trip 출발일
          prisma.$queryRaw<TripRow[]>(Prisma.sql`
            SELECT DISTINCT ON ("productCode") "productCode", "departureDate", "shipName"
            FROM "Trip"
            WHERE "productCode" IN (${Prisma.join(codes)})
            ORDER BY "productCode", "departureDate" ASC
          `),
          // 2) CabinInventory 총 용량 (상품 등록 시 설정)
          // GLOBAL_ADMIN은 organizationId가 null → 전체 조회
          ctx.organizationId
            ? prisma.$queryRaw<InventoryRow[]>(Prisma.sql`
                SELECT "tripCode", "cabinType",
                       SUM("totalCount")::bigint AS total,
                       MAX("status") AS status
                FROM "CabinInventory"
                WHERE "tripCode" IN (${Prisma.join(codes)})
                  AND "organizationId" = ${ctx.organizationId}
                GROUP BY "tripCode", "cabinType"
              `)
            : prisma.$queryRaw<InventoryRow[]>(Prisma.sql`
                SELECT "tripCode", "cabinType",
                       SUM("totalCount")::bigint AS total,
                       MAX("status") AS status
                FROM "CabinInventory"
                WHERE "tripCode" IN (${Prisma.join(codes)})
                GROUP BY "tripCode", "cabinType"
              `),
          // 3) 실제 판매 카운트 (2인1실 기준 — PNR 완료 예약건 수)
          prisma.$queryRaw<ReservationCountRow[]>(Prisma.sql`
            SELECT t."productCode", r."cabinType",
                   COUNT(r.id)::bigint AS count
            FROM "Reservation" r
            JOIN "Trip" t ON r."tripId" = t.id
            WHERE t."productCode" IN (${Prisma.join(codes)})
              AND r.status = 'CONFIRMED'
              AND r."pnrStatus" = 'COMPLETED'
            GROUP BY t."productCode", r."cabinType"
          `),
        ])
      : Promise.resolve([[] as TripRow[], [] as InventoryRow[], [] as ReservationCountRow[]]));

    // ── 인덱스 맵 빌드 ───────────────────────────────────────────
    const tripMap = new Map<string, TripRow>();
    for (const t of tripRows) tripMap.set(t.productCode, t);

    // CabinInventory: productCode → { normalizedCabinType → { total, status } }
    const inventoryTotalMap = new Map<string, Map<string, { total: number; status: string }>>();
    for (const inv of inventoryRows) {
      if (!inv.tripCode) continue;
      if (!inventoryTotalMap.has(inv.tripCode)) inventoryTotalMap.set(inv.tripCode, new Map());
      const key = normalizeCabinType(inv.cabinType);
      const cur = inventoryTotalMap.get(inv.tripCode)!;
      const existing = cur.get(key);
      cur.set(key, {
        total: (existing?.total ?? 0) + Number(inv.total),
        status: normalizeStatus(inv.status), // MAX("status")에서 반환된 값, null-safe normalization
      });
    }

    // Reservation: productCode → { normalizedCabinType → bookedCount }
    const reservationBookedMap = new Map<string, Map<string, number>>();
    for (const rv of reservationRows) {
      if (!rv.productCode) continue;
      if (!reservationBookedMap.has(rv.productCode)) reservationBookedMap.set(rv.productCode, new Map());
      const key = normalizeCabinType(rv.cabinType ?? '');
      const cur = reservationBookedMap.get(rv.productCode)!;
      cur.set(key, (cur.get(key) ?? 0) + Number(rv.count));
    }

    // ── D-day 계산 (KST 기준) ────────────────────────────────────
    const todayKst = new Date(Date.now() + 9 * 3600000);
    todayKst.setUTCHours(0, 0, 0, 0);

    function calcDaysLeft(dep: Date): number {
      const d = new Date(dep);
      d.setUTCHours(0, 0, 0, 0);
      return Math.round((d.getTime() - todayKst.getTime()) / 86400000);
    }

    // ── 기항지 추출 (itineraryPattern JSON) ──────────────────────
    function extractPorts(pattern: unknown): string[] {
      if (!Array.isArray(pattern)) return [];
      return (pattern as Array<{ type?: string; location?: string; country?: string }>)
        .filter((d) => d.type !== 'sea' && d.location && d.location !== '해상')
        .map((d) => d.location ?? '')
        .filter(Boolean);
    }

    const products = rows.map((r) => {
      const trip       = tripMap.get(r.productCode);
      const depDate    = trip?.departureDate ?? r.startDate ?? null;
      const daysLeft   = depDate ? calcDaysLeft(depDate) : null;

      // 객실 잔여: CabinInventory 총량 - 실제 예약수
      const invTotals  = inventoryTotalMap.get(r.productCode);
      const rvBookings = reservationBookedMap.get(r.productCode);

      let cabinSummary: CabinSummary | null = null;
      if (invTotals && invTotals.size > 0) {
        cabinSummary = {};
        for (const [cabinType, data] of invTotals.entries()) {
          const booked = rvBookings?.get(cabinType) ?? 0;
          cabinSummary[cabinType] = {
            total: data.total,
            booked,
            remaining: Math.max(0, data.total - booked),
            status: data.status, // ★ CabinInventory.status 직접 전달
          };
        }
      }

      const ports = extractPorts(r.itineraryPattern);

      return {
        id:           r.id,
        code:         r.productCode,
        name:         r.packageName,
        cruiseLine:   r.cruiseLine,
        shipName:     trip?.shipName ?? r.shipName,
        nights:       r.nights,
        days:         r.days,
        price:        Number(r.basePrice),
        isActive:     r.isActive,
        saleStatus:   r.saleStatus,
        availableCount: r.availableCount,
        reservedCount:  r.reservedCount,
        refundPolicy: r.refundPolicy ?? null,
        ports,                          // 기항지 목록
        tourCities:   r.tourCities,
        createdAt:    r.createdAt.toISOString(),
        departureDate: depDate ? depDate.toISOString() : null,
        daysLeft,
        cabinSummary,
      };
    });

    logger.log('[GET /api/products]', { role: ctx.role, total, page });
    return NextResponse.json({ ok: true, products, total, page, totalPages: Math.ceil(total / limit) });

  } catch (err) {
    logger.error('[GET /api/products]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
