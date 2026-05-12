export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export type ApisRow = {
  seq: number;
  rv: string;
  cabin: string | number;
  groupId: string | number;
  roomingGroupId: string | number;
  cabinType: string;
  engSurname: string;
  engGivenName: string;
  korName: string;
  residentNum: string;
  gender: string;
  birthDate: string;
  passportNo: string;
  issueDate: string;
  expiryDate: string;
  phone: string;
  airline: string;
  paymentDate: string;
  paymentMethod: string;
  paymentAmount: string | number;
  agentName: string;
  remarks: string;
  groupMemo: string;
  notes: string;
  passportDriveUrl: string;
};

type TripRow = {
  id: number;
  productCode: string;
  shipName: string;
  departureDate: Date;
  cruiseName: string | null;
};

type ReservationRow = {
  id: number;
  tripId: number;
  pnrNumber: string | null;
  cabinType: string | null;
  paymentDate: Date | null;
  paymentMethod: string | null;
  paymentAmount: number | null;
  agentName: string | null;
  groupMemo: string | null;
  remarks: string | null;
  airlineName: string | null;
};

type TravelerRow = {
  id: number;
  reservationId: number;
  roomNumber: number;
  engSurname: string | null;
  engGivenName: string | null;
  korName: string | null;
  residentNum: string | null;
  gender: string | null;
  birthDate: string | null;
  passportNo: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  phone: string | null;
  companionGroupId: number | null;
  roomingGroupId: number | null;
  notes: string | null;
  passportDriveUrl: string | null;
};

// Excel serial date → YYYY-MM-DD (xlsx sometimes returns numeric dates)
function excelDateToStr(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    // Excel epoch: Jan 0 1900
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(val);
}

/**
 * GET /api/admin/apis/excel?productCode=xxx
 * 특정 상품의 APIS 엑셀 파일 생성 · 다운로드
 * OWNER / GLOBAL_ADMIN 전용
 */
export async function GET(req: NextRequest) {
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
    // preview=1 이면 JSON 반환 (미리보기용)
    const isPreview = req.nextUrl.searchParams.get('preview') === '1';

    // ── 1. GmTrip 조회 ──────────────────────────────────────────
    const trips = await prisma.$queryRaw<TripRow[]>`
      SELECT id, "productCode", "shipName", "departureDate", "cruiseName"
      FROM "Trip"
      WHERE "productCode" = ${productCode}
      ORDER BY "departureDate" ASC
      LIMIT 10
    `;

    if (trips.length === 0) {
      return NextResponse.json({ ok: false, error: '해당 상품코드의 여행 일정을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 가장 가까운 미래 출발일 우선, 없으면 첫 번째
    const now = new Date();
    const trip = trips.find((t) => t.departureDate >= now) ?? trips[0]!;

    // ── 2. 예약 목록 조회 ────────────────────────────────────────
    const reservations = await prisma.$queryRaw<ReservationRow[]>`
      SELECT id, "tripId", "pnrNumber", "cabinType",
             "paymentDate", "paymentMethod", "paymentAmount",
             "agentName", "groupMemo", remarks, "airlineName"
      FROM "Reservation"
      WHERE "tripId" = ${trip.id}
      ORDER BY id ASC
    `;

    if (reservations.length === 0) {
      return NextResponse.json({ ok: false, error: '등록된 예약 정보가 없습니다.' }, { status: 404 });
    }

    const reservationIds = reservations.map((r) => r.id);
    const reservationMap = new Map(reservations.map((r) => [r.id, r]));

    // ── 3. 탑승자 목록 조회 ─────────────────────────────────────
    const travelers = await prisma.$queryRaw<TravelerRow[]>`
      SELECT id, "reservationId", "roomNumber",
             "engSurname", "engGivenName", "korName",
             "residentNum", gender, "birthDate",
             "passportNo", "issueDate", "expiryDate",
             phone, "companionGroupId", "roomingGroupId",
             notes, "passportDriveUrl"
      FROM "Traveler"
      WHERE "reservationId" = ANY(${reservationIds}::int[])
      ORDER BY "reservationId" ASC, id ASC
    `;

    // ── 4. 엑셀 데이터 조합 ─────────────────────────────────────
    const depDateStr = (() => {
      const d = trip.departureDate;
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}년 ${m}월 ${day}일`;
    })();

    const shipLabel = trip.cruiseName ?? trip.shipName ?? productCode;
    const titleText = `${depDateStr} ${shipLabel} 크루즈 명단`;

    // 컬럼 헤더 (실제 APIS 양식과 동일)
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

    // ── 5-a. 미리보기 JSON 응답 ─────────────────────────────────
    if (isPreview) {
      const previewRows: ApisRow[] = travelers.map((tv, idx) => {
        const rv = reservationMap.get(tv.reservationId);
        const paymentDateStr = rv?.paymentDate
          ? (() => {
              const d = new Date(rv.paymentDate);
              return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
            })()
          : '';
        return {
          seq: idx + 1,
          rv: rv?.pnrNumber ?? '',
          cabin: tv.roomNumber > 0 ? tv.roomNumber : '',
          groupId: tv.companionGroupId ?? '',
          roomingGroupId: tv.roomingGroupId ?? '',
          cabinType: rv?.cabinType ?? '',
          engSurname: tv.engSurname ?? '',
          engGivenName: tv.engGivenName ?? '',
          korName: tv.korName ?? '',
          residentNum: tv.residentNum ?? '',
          gender: tv.gender ?? '',
          birthDate: excelDateToStr(tv.birthDate),
          passportNo: tv.passportNo ?? '',
          issueDate: excelDateToStr(tv.issueDate),
          expiryDate: excelDateToStr(tv.expiryDate),
          phone: tv.phone ?? '',
          airline: rv?.airlineName ?? '',
          paymentDate: paymentDateStr,
          paymentMethod: rv?.paymentMethod ?? '',
          paymentAmount: rv?.paymentAmount ?? '',
          agentName: rv?.agentName ?? '',
          remarks: rv?.remarks ?? '',
          groupMemo: rv?.groupMemo ?? '',
          notes: tv.notes ?? '',
          passportDriveUrl: tv.passportDriveUrl ?? '',
        };
      });

      logger.log('[APIS Preview]', { role: ctx.role, productCode, count: previewRows.length });
      return NextResponse.json({
        ok: true,
        productCode,
        tripTitle: titleText,
        rows: previewRows,
        reservationCount: reservations.length,
        travelerCount: travelers.length,
      });
    }

    // ── 5-b. xlsx 워크북 생성 (다운로드) ────────────────────────
    const wb = XLSX.utils.book_new();

    // 시트명: 출발일 + 상품코드 (31자 제한)
    const sheetName = `${depDateStr} ${productCode}`.substring(0, 31);

    // 행 순서: [제목행, 안내행, 헤더행, 샘플행(선택), ...데이터]
    const sheetData: (string | number | null)[][] = [
      // Row 0: 제목 (첫 컬럼에만, 나머지 빈칸)
      [titleText, ...Array(HEADERS.length - 1).fill('')],
      // Row 1: 안내
      ['노랑색 칸의 내용을 샘플로 확인하시어 모객된 고객님들의 정보를 아래에 기재 해 주시기 바랍니다.', ...Array(HEADERS.length - 1).fill('')],
      // Row 2: 컬럼 헤더
      HEADERS,
      // Row 3~: 실제 데이터
      ...dataRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // 열 너비 설정
    ws['!cols'] = [
      { wch: 6 },  // 순번
      { wch: 10 }, // RV
      { wch: 8 },  // CABIN
      { wch: 10 }, // 일행그룹
      { wch: 10 }, // 루밍그룹
      { wch: 14 }, // 카테고리
      { wch: 12 }, // 영문성
      { wch: 14 }, // 영문이름
      { wch: 10 }, // 성명
      { wch: 16 }, // 주민번호
      { wch: 6 },  // 성별
      { wch: 12 }, // 생년월일
      { wch: 14 }, // 여권번호
      { wch: 12 }, // 여권생성일
      { wch: 12 }, // 여권만료일
      { wch: 14 }, // 고객연락처
      { wch: 12 }, // 항공
      { wch: 12 }, // 최종결제일
      { wch: 14 }, // 결제방법
      { wch: 12 }, // 결제금액
      { wch: 14 }, // 연결담당자
      { wch: 20 }, // 비고
      { wch: 20 }, // 그룹메모
      { wch: 20 }, // 개별메모
      { wch: 50 }, // 여권링크
    ];

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // ── 6. 버퍼 → 응답 ─────────────────────────────────────────
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const today = new Date();
    const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const filename = encodeURIComponent(`APIS_${productCode}_${todayStr}.xlsx`);

    logger.log('[APIS Excel]', {
      role: ctx.role,
      productCode,
      tripId: trip.id,
      reservationCount: reservations.length,
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
    logger.error('[APIS Excel]', { err });
    return NextResponse.json({ ok: false, error: '서버 오류' }, { status: 500 });
  }
}
