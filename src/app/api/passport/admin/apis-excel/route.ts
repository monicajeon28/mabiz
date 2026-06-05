export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requireCrmManager } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

interface ApisTravelerRow {
  travelerId: number; reservationId: number; pnrNumber: string | null;
  roomNumber: number | null; cabinType: string | null;
  engSurname: string | null; engGivenName: string | null; korName: string | null;
  gender: string | null; birthDate: string | null; nationality: string | null;
  passportNo: string | null; issueDate: string | null; expiryDate: string | null;
  phone: string | null; companionGroupId: number | null; roomingGroupId: number | null;
  airlineName: string | null; agentName: string | null; notes: string | null;
  passportDriveUrl: string | null;
}

// Excel serial date → YYYY-MM-DD (xlsx sometimes returns numeric dates)
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
    const tripRows = await prisma.$queryRaw<Array<{ id: number; productCode: string; shipName: string; cruiseName: string | null; departureDate: Date }>>(
      Prisma.sql`SELECT id, "productCode", "shipName", "cruiseName", "departureDate" FROM "Trip" WHERE id = ${tripId} LIMIT 1`
    );
    if (!tripRows[0]) return NextResponse.json({ ok: false, message: '여행을 찾을 수 없습니다.' }, { status: 404 });
    const trip = tripRows[0];

    const travelers = await prisma.$queryRaw<ApisTravelerRow[]>(Prisma.sql`
      SELECT
        tr.id as "travelerId", tr."reservationId",
        r."pnrNumber", tr."roomNumber", r."cabinType",
        tr."engSurname", tr."engGivenName", tr."korName",
        tr.gender, tr."birthDate", tr.nationality,
        tr."passportNo", tr."issueDate", tr."expiryDate",
        tr.phone, tr."companionGroupId", tr."roomingGroupId",
        r."airlineName", r."agentName", tr.notes, tr."passportDriveUrl"
      FROM "Traveler" tr
      JOIN "Reservation" r ON r.id = tr."reservationId"
      WHERE r."tripId" = ${tripId}
      ORDER BY r.id ASC, tr."roomNumber" ASC, tr.id ASC
    `);

    // 컬럼 헤더 (한글)
    const HEADERS = [
      '순번', 'RV(PNR)', 'CABIN(방번호)', '일행그룹', '루밍그룹', '카테고리',
      '영문성', '영문이름', '성명', '성별', '생년월일', '국적',
      '여권번호', '여권발급일', '여권만료일', '연락처',
      '항공', '연결담당자', '개별메모', '여권링크',
    ];

    const dataRows: (string | number | null)[][] = [];
    let seq = 1;
    for (const tv of travelers) {
      dataRows.push([
        seq++,
        tv.pnrNumber ?? '',
        tv.roomNumber && tv.roomNumber > 0 ? tv.roomNumber : '',
        tv.companionGroupId ?? '',
        tv.roomingGroupId ?? '',
        tv.cabinType ?? '',
        tv.engSurname ?? '',
        tv.engGivenName ?? '',
        tv.korName ?? '',
        tv.gender ?? '',
        excelDateToStr(tv.birthDate),
        tv.nationality ?? '',
        tv.passportNo ?? '',
        excelDateToStr(tv.issueDate),
        excelDateToStr(tv.expiryDate),
        tv.phone ?? '',
        tv.airlineName ?? '',
        tv.agentName ?? '',
        tv.notes ?? '',
        tv.passportDriveUrl ?? '',
      ]);
    }

    const wb = XLSX.utils.book_new();
    const sheetName = `${trip.shipName ?? trip.productCode}`.substring(0, 31);
    const sheetData: (string | number | null)[][] = [HEADERS, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    ws['!cols'] = [
      { wch: 6 },  // 순번
      { wch: 12 }, // RV(PNR)
      { wch: 10 }, // CABIN
      { wch: 10 }, // 일행그룹
      { wch: 10 }, // 루밍그룹
      { wch: 14 }, // 카테고리
      { wch: 12 }, // 영문성
      { wch: 14 }, // 영문이름
      { wch: 10 }, // 성명
      { wch: 6 },  // 성별
      { wch: 12 }, // 생년월일
      { wch: 10 }, // 국적
      { wch: 14 }, // 여권번호
      { wch: 12 }, // 여권발급일
      { wch: 12 }, // 여권만료일
      { wch: 14 }, // 연락처
      { wch: 12 }, // 항공
      { wch: 14 }, // 연결담당자
      { wch: 20 }, // 개별메모
      { wch: 50 }, // 여권링크
    ];

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = encodeURIComponent(`APIS_${trip.shipName ?? ''}_${trip.productCode}.xlsx`);

    logger.log('[APIS Excel by trip]', {
      role: manager.role,
      tripId: trip.id,
      productCode: trip.productCode,
      travelerCount: travelers.length,
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
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
