export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

// 기존 /api/admin/apis/excel 의 25컬럼 + 제목행 + 안내행 양식과 100% 동일
// 차이점: productCode 대신 tripId 로 조회 (여행별 다운로드)

interface TripRow {
  id: number; productCode: string; shipName: string;
  departureDate: Date; cruiseName: string | null;
}

interface ReservationRow {
  id: number; pnrNumber: string | null; cabinType: string | null;
  paymentDate: Date | null; paymentMethod: string | null; paymentAmount: number | null;
  agentName: string | null; groupMemo: string | null; remarks: string | null;
  airlineName: string | null;
}

interface TravelerRow {
  id: number; reservationId: number; roomNumber: number;
  engSurname: string | null; engGivenName: string | null; korName: string | null;
  residentNum: string | null; gender: string | null; birthDate: string | null;
  passportNo: string | null; issueDate: string | null; expiryDate: string | null;
  phone: string | null; companionGroupId: number | null; roomingGroupId: number | null;
  notes: string | null; passportDriveUrl: string | null;
}

// Excel serial date → YYYY-MM-DD
function excelDateToStr(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(val);
}

export async function GET(req: NextRequest) {
  const manager = await requireCrmManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 401 });

  const tripIdRaw = req.nextUrl.searchParams.get('tripId');
  const tripId = parseInt(tripIdRaw ?? '', 10);
  if (isNaN(tripId)) return NextResponse.json({ ok: false, message: 'tripId 필수' }, { status: 400 });

  try {
    // ── 1. Trip 조회 ────────────────────────────────────────────
    const tripRows = await prisma.$queryRaw<TripRow[]>(
      Prisma.sql`SELECT id, "productCode", "shipName", "departureDate", "cruiseName" FROM "Trip" WHERE id = ${tripId} LIMIT 1`
    );
    if (!tripRows[0]) return NextResponse.json({ ok: false, message: '여행을 찾을 수 없습니다.' }, { status: 404 });
    const trip = tripRows[0];

    // ── 2. 예약 목록 ────────────────────────────────────────────
    const reservations = await prisma.$queryRaw<ReservationRow[]>(Prisma.sql`
      SELECT id, "pnrNumber", "cabinType",
             "paymentDate", "paymentMethod", "paymentAmount",
             "agentName", "groupMemo", remarks, "airlineName"
      FROM "Reservation"
      WHERE "tripId" = ${tripId}
      ORDER BY id ASC
    `);
    const reservationIds = reservations.map((r) => r.id);
    const reservationMap = new Map(reservations.map((r) => [r.id, r]));

    // ── 3. 탑승자 목록 ──────────────────────────────────────────
    const travelers = reservationIds.length === 0
      ? []
      : await prisma.$queryRaw<TravelerRow[]>(Prisma.sql`
          SELECT id, "reservationId", "roomNumber",
                 "engSurname", "engGivenName", "korName",
                 "residentNum", gender, "birthDate",
                 "passportNo", "issueDate", "expiryDate",
                 phone, "companionGroupId", "roomingGroupId",
                 notes, "passportDriveUrl"
          FROM "Traveler"
          WHERE "reservationId" = ANY(ARRAY[${Prisma.join(reservationIds)}]::int[])
          ORDER BY "reservationId" ASC, id ASC
        `);

    // ── 4. 엑셀 데이터 조합 ─────────────────────────────────────
    const depDateStr = (() => {
      const d = trip.departureDate;
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}년 ${m}월 ${day}일`;
    })();

    const shipLabel = trip.cruiseName ?? trip.shipName ?? trip.productCode;
    const titleText = `${depDateStr} ${shipLabel} 크루즈 명단`;

    // 컬럼 헤더 (기존 APIS 양식과 100% 동일 — 25개)
    const HEADERS = [
      '순번', 'RV', 'CABIN', '일행그룹', '루밍그룹', '카테고리',
      '영문성', '영문이름', '성 명', '주민번호', '성별', '생년월일',
      '여권번호', '여권생성일', '여권만료일', '고객연락처',
      '항공', '최종결제일', '결제방법', '결제 금액',
      '연결 담당자', '비고', '그룹 메모', '개별 메모', '여권링크',
    ];

    const dataRows: (string | number | null)[][] = [];
    let seq = 1;
    for (const tv of travelers) {
      const rv = reservationMap.get(tv.reservationId);
      if (!rv) continue;

      const paymentDateStr = rv.paymentDate
        ? (() => {
            const d = new Date(rv.paymentDate);
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
          })()
        : '';

      dataRows.push([
        seq++,
        rv.pnrNumber ?? '',
        tv.roomNumber > 0 ? tv.roomNumber : '',
        tv.companionGroupId ?? '',
        tv.roomingGroupId ?? '',
        rv.cabinType ?? '',
        tv.engSurname ?? '',
        tv.engGivenName ?? '',
        tv.korName ?? '',
        tv.residentNum ?? '',
        tv.gender ?? '',
        excelDateToStr(tv.birthDate),
        tv.passportNo ?? '',
        excelDateToStr(tv.issueDate),
        excelDateToStr(tv.expiryDate),
        tv.phone ?? '',
        rv.airlineName ?? '',
        paymentDateStr,
        rv.paymentMethod ?? '',
        rv.paymentAmount ?? '',
        rv.agentName ?? '',
        rv.remarks ?? '',
        rv.groupMemo ?? '',
        tv.notes ?? '',
        tv.passportDriveUrl ?? '',
      ]);
    }

    // ── 5. xlsx 워크북 생성 (제목행 + 안내행 + 헤더 + 데이터) ───
    const wb = XLSX.utils.book_new();
    const sheetName = `${depDateStr} ${trip.productCode}`.substring(0, 31);

    const sheetData: (string | number | null)[][] = [
      [titleText, ...Array(HEADERS.length - 1).fill('')],
      ['노랑색 칸의 내용을 샘플로 확인하시어 모객된 고객님들의 정보를 아래에 기재 해 주시기 바랍니다.', ...Array(HEADERS.length - 1).fill('')],
      HEADERS,
      ...dataRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // 열 너비 (기존 양식과 동일 25개)
    ws['!cols'] = [
      { wch: 6 },  { wch: 10 }, { wch: 8 },  { wch: 10 }, { wch: 10 }, { wch: 14 },
      { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 6 },  { wch: 12 },
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 50 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const today = new Date();
    const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const filename = encodeURIComponent(`APIS_${trip.productCode}_${todayStr}.xlsx`);

    logger.log('[APIS Excel by trip]', {
      role: manager.role, tripId: trip.id, productCode: trip.productCode,
      reservationCount: reservations.length, travelerCount: travelers.length,
    });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    logger.error('[GET /api/passport/admin/apis-excel]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
